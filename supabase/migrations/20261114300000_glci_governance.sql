-- GLCI-11: approval, audit and production governance (docs/GLCI_SPECIFICATION.md §2 engine 7, §5).
--
-- 1. Governance policy (private.glci_governance_policy). Two-person approval is the default.
--    Solo-owner mode can be switched on only by a platform_admin, with a reason, and is audited.
--    While it is on, an operator may approve their own request, but every such decision is
--    recorded as self-approved.
-- 2. Approval requests (private.glci_approval_requests) for consequential GLCI actions that have no
--    proposal of their own:
--      activate_target       monitoring activation of an official source;
--      production_deployment a database migration, web, worker or configuration release.
--    A request executes only when approved: by a second operator, or self-approved under solo mode.
--    Activating a monitoring target now requires an approval request; pausing or retiring does not.
--    The four-eyes rule on remediation proposals follows the same policy.
-- 3. Deployment register (private.glci_deployments): every production change with its reference,
--    checksum, approval and verification. Hosted migrations that are already applied are backfilled
--    from supabase_migrations.schema_migrations. glci_governance_report() flags any migration applied
--    without a register entry.
-- 4. Audit checkpoints and exports: a checkpoint pins the GLCI audit chain's head (sequence and
--    hash), so later truncation or rewriting is detectable against it. An export returns a range of
--    events with the verification result and a SHA-256 digest, and records that it was taken.
-- Everything is append-only except the current state of requests and the singleton policy.

-- ------------------------------------------------------------------ policy
create table private.glci_governance_policy (
  id boolean primary key default true check (id),
  require_two_person boolean not null default true,
  reason text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into private.glci_governance_policy (id) values (true) on conflict do nothing;
alter table private.glci_governance_policy enable row level security;
revoke all on private.glci_governance_policy from public, anon, authenticated;
grant select on private.glci_governance_policy to service_role;

create or replace function private.glci_two_person_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select require_two_person from private.glci_governance_policy), true)
$$;
revoke all on function private.glci_two_person_required() from public, anon, authenticated;

create or replace function public.glci_set_governance_policy(p_require_two_person boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.is_platform_operator('platform_admin') then
    raise exception 'GLCI_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_require_two_person is null or p_reason is null or char_length(btrim(p_reason)) < 20 then
    raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023';
  end if;
  update private.glci_governance_policy set require_two_person = p_require_two_person, reason = btrim(p_reason),
    updated_by = private.current_principal_id(), updated_at = now();
  perform private.glci_audit('governance.policy_changed', 'governance_policy', 'singleton',
    jsonb_build_object('requireTwoPerson', p_require_two_person, 'reason', btrim(p_reason)));
end;
$$;

-- ------------------------------------------------------------------ deployments
create table private.glci_deployments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('database_migration', 'web_release', 'worker_release', 'configuration')),
  environment text not null default 'hosted' check (environment in ('hosted', 'staging')),
  reference text not null check (char_length(reference) between 1 and 200),
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{32,64}$'),
  description text not null check (char_length(description) between 5 and 2000),
  approval_request_id uuid,
  approved_by uuid,
  self_approved boolean not null default false,
  deployed_by uuid,
  deployed_at timestamptz not null default now(),
  outcome text not null check (outcome in ('deployed', 'failed', 'rolled_back', 'backfilled')),
  verification jsonb not null default '{}'::jsonb check (jsonb_typeof(verification) = 'object' and pg_column_size(verification) <= 16384),
  unique (kind, environment, reference, outcome)
);
create index glci_deployments_time_idx on private.glci_deployments(environment, deployed_at desc);
create index glci_deployments_request_idx on private.glci_deployments(approval_request_id);
alter table private.glci_deployments enable row level security;
revoke all on private.glci_deployments from public, anon, authenticated;
grant select on private.glci_deployments to service_role;
create trigger glci_deployments_append_only before update or delete on private.glci_deployments
  for each row execute function private.reject_append_only_mutation();

-- Backfill: migrations already applied here were deployed and verified before the register existed.
-- This migration's own history row is written after it runs, so it is recorded through the register
-- by its deployment (glci_record_deployment); until then the report lists it as unrecorded.
insert into private.glci_deployments (kind, environment, reference, checksum, description, outcome, deployed_at, verification)
select 'database_migration', 'hosted', m.version, md5(coalesce(m.statements[1], '')), 'Migration ' || coalesce(m.name, m.version) || ' (recorded before the register existed)',
  'backfilled', now(), jsonb_build_object('source', 'supabase_migrations.schema_migrations')
from supabase_migrations.schema_migrations m
on conflict do nothing;

-- ------------------------------------------------------------------ approval requests
create table private.glci_approval_requests (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('activate_target', 'production_deployment')),
  subject text not null check (char_length(subject) between 1 and 200),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 16384),
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  self_approved boolean not null default false,
  result jsonb
);
create index glci_approval_requests_status_idx on private.glci_approval_requests(status, requested_at desc);
alter table private.glci_approval_requests enable row level security;
revoke all on private.glci_approval_requests from public, anon, authenticated;
grant select on private.glci_approval_requests to service_role;
alter table private.glci_deployments add constraint glci_deployments_request_fkey
  foreign key (approval_request_id) references private.glci_approval_requests(id) on delete restrict;

create or replace function public.glci_request_action(p_action_type text, p_subject text, p_payload jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.glci_require_operator();
  if p_action_type = 'activate_target' and not exists (select 1 from private.glci_monitoring_targets where target_key = p_subject) then
    raise exception 'GLCI_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_action_type = 'production_deployment' and (coalesce(p_payload ->> 'kind', '') not in ('database_migration', 'web_release', 'worker_release', 'configuration')
      or coalesce(p_payload ->> 'reference', '') = '') then
    raise exception 'GLCI_DEPLOYMENT_REQUEST_INVALID' using errcode = '22023';
  end if;
  insert into private.glci_approval_requests (action_type, subject, payload, reason, requested_by)
  values (p_action_type, p_subject, coalesce(p_payload, '{}'), btrim(coalesce(p_reason, '')), private.current_principal_id())
  returning id into v_id;
  perform private.glci_audit('governance.requested', 'approval_request', v_id::text,
    jsonb_build_object('action', p_action_type, 'subject', p_subject, 'reason', p_reason));
  return v_id;
end;
$$;

-- Approving executes the action: monitoring activation runs at once (the activation-basis guard
-- still applies); a deployment approval authorises the deployment, recorded later with its result.
create or replace function public.glci_decide_action(p_request_id uuid, p_decision text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_request private.glci_approval_requests;
  v_self boolean;
  v_result jsonb := '{}'::jsonb;
begin
  perform private.glci_require_operator();
  select * into v_request from private.glci_approval_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'GLCI_APPROVAL_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' or p_decision not in ('approved', 'rejected') then raise exception 'GLCI_DECISION_INVALID' using errcode = '22023'; end if;
  if p_note is null or char_length(btrim(p_note)) < 5 then raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023'; end if;
  v_self := v_request.requested_by = private.current_principal_id();
  if v_self and private.glci_two_person_required() then raise exception 'GLCI_FOUR_EYES_REQUIRED' using errcode = '42501'; end if;

  if p_decision = 'approved' and v_request.action_type = 'activate_target' then
    update private.glci_monitoring_targets set status = 'active' where target_key = v_request.subject;
    v_result := jsonb_build_object('targetKey', v_request.subject, 'targetStatus', 'active');
  elsif p_decision = 'approved' then
    v_result := jsonb_build_object('authorised', v_request.payload);
  end if;

  update private.glci_approval_requests set status = case when p_decision = 'rejected' then 'rejected'
      when action_type = 'activate_target' then 'executed' else 'approved' end,
    decided_by = private.current_principal_id(), decided_at = now(), decision_note = btrim(p_note), self_approved = v_self, result = v_result
  where id = p_request_id;
  perform private.glci_audit('governance.' || p_decision, 'approval_request', p_request_id::text,
    jsonb_build_object('action', v_request.action_type, 'subject', v_request.subject, 'selfApproved', v_self, 'note', btrim(p_note)));
  return jsonb_build_object('status', p_decision, 'selfApproved', v_self) || v_result;
end;
$$;

-- Records a production deployment's result. Hosted changes need an approved deployment request
-- (operators); the deployment workflow may record with the service role (its own approval gate is
-- the GitHub "production" environment).
create or replace function public.glci_record_deployment(p_request_id uuid, p_kind text, p_reference text, p_checksum text,
  p_description text, p_outcome text, p_verification jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request private.glci_approval_requests;
  v_id uuid;
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if not v_service then perform private.glci_require_operator(); end if;
  if p_outcome not in ('deployed', 'failed', 'rolled_back') then raise exception 'GLCI_DEPLOYMENT_INVALID' using errcode = '22023'; end if;
  if p_request_id is not null then
    select * into v_request from private.glci_approval_requests where id = p_request_id for update;
    if v_request.id is null or v_request.action_type <> 'production_deployment' or v_request.status <> 'approved'
      or v_request.payload ->> 'reference' is distinct from p_reference then
      raise exception 'GLCI_DEPLOYMENT_NOT_APPROVED' using errcode = '42501';
    end if;
  elsif not v_service then
    raise exception 'GLCI_DEPLOYMENT_NOT_APPROVED' using errcode = '42501';
  end if;
  insert into private.glci_deployments (kind, reference, checksum, description, approval_request_id, approved_by, self_approved,
    deployed_by, outcome, verification)
  values (p_kind, p_reference, nullif(p_checksum, ''), p_description, p_request_id, v_request.decided_by, coalesce(v_request.self_approved, false),
    private.current_principal_id(), p_outcome, coalesce(p_verification, '{}'))
  returning id into v_id;
  if p_request_id is not null then
    update private.glci_approval_requests set status = case when p_outcome = 'deployed' then 'executed' else 'failed' end,
      result = coalesce(result, '{}') || jsonb_build_object('deploymentId', v_id, 'outcome', p_outcome)
    where id = p_request_id;
  end if;
  perform private.glci_audit('governance.deployment_' || p_outcome, 'deployment', v_id::text,
    jsonb_build_object('kind', p_kind, 'reference', p_reference, 'checksum', p_checksum, 'requestId', p_request_id),
    case when v_service then 'system' else 'operator' end);
  return v_id;
end;
$$;

-- ------------------------------------------------------------------ audit checkpoints and exports
create table private.glci_audit_checkpoints (
  id bigint generated always as identity primary key,
  head_sequence bigint not null,
  head_hash text not null check (head_hash ~ '^[a-f0-9]{64}$'),
  chain_valid boolean not null,
  kind text not null check (kind in ('checkpoint', 'export')),
  range_from bigint,
  range_to bigint,
  export_digest text check (export_digest is null or export_digest ~ '^[a-f0-9]{64}$'),
  taken_by uuid,
  taken_at timestamptz not null default now()
);
alter table private.glci_audit_checkpoints enable row level security;
revoke all on private.glci_audit_checkpoints from public, anon, authenticated;
grant select on private.glci_audit_checkpoints to service_role;
create trigger glci_audit_checkpoints_append_only before update or delete on private.glci_audit_checkpoints
  for each row execute function private.reject_append_only_mutation();

-- Chain verification plus agreement with every earlier checkpoint (detects truncation and rewrites).
create or replace function private.glci_audit_integrity()
returns jsonb language sql stable security definer set search_path = '' as $$
  with broken as (
    select count(*) as n from (
      select e.*, lag(e.record_hash) over (order by e.sequence_number) as expected_previous from private.glci_audit_events e) x
    where x.previous_hash is distinct from x.expected_previous
      or x.record_hash <> private.glci_audit_digest(x.occurred_at, x.actor_principal_id, x.actor_kind, x.event_type,
        x.subject_type, x.subject_id, x.details, x.previous_hash)),
  checkpoint_mismatch as (
    select count(*) as n from private.glci_audit_checkpoints c
    where c.head_sequence > 0 and not exists (select 1 from private.glci_audit_events e
      where e.sequence_number = c.head_sequence and e.record_hash = c.head_hash))
  select jsonb_build_object('chainValid', (select n from broken) = 0, 'brokenLinks', (select n from broken),
    'checkpointsMatch', (select n from checkpoint_mismatch) = 0, 'checkpointMismatches', (select n from checkpoint_mismatch),
    'events', (select count(*) from private.glci_audit_events),
    'headSequence', (select max(sequence_number) from private.glci_audit_events),
    'headHash', (select record_hash from private.glci_audit_events order by sequence_number desc limit 1),
    'checkpoints', (select count(*) from private.glci_audit_checkpoints))
$$;
revoke all on function private.glci_audit_integrity() from public, anon, authenticated;

create or replace function public.glci_audit_checkpoint()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_integrity jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform private.glci_require_operator(); end if;
  v_integrity := private.glci_audit_integrity();
  if (v_integrity ->> 'headSequence') is null then raise exception 'GLCI_AUDIT_EMPTY' using errcode = '22023'; end if;
  insert into private.glci_audit_checkpoints (head_sequence, head_hash, chain_valid, kind, taken_by)
  values ((v_integrity ->> 'headSequence')::bigint, v_integrity ->> 'headHash',
    (v_integrity ->> 'chainValid')::boolean and (v_integrity ->> 'checkpointsMatch')::boolean, 'checkpoint', private.current_principal_id());
  return v_integrity;
end;
$$;

create or replace function public.glci_audit_export(p_from bigint default 1, p_to bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_to bigint := coalesce(p_to, (select max(sequence_number) from private.glci_audit_events));
  v_events jsonb;
  v_digest text;
  v_integrity jsonb;
begin
  perform private.glci_require_operator();
  if p_from is null or p_from < 1 or v_to is null or v_to < p_from or v_to - p_from > 50000 then
    raise exception 'GLCI_AUDIT_RANGE_INVALID' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('sequence', e.sequence_number, 'occurredAt', e.occurred_at, 'actorPrincipalId', e.actor_principal_id,
      'actorKind', e.actor_kind, 'eventType', e.event_type, 'subjectType', e.subject_type, 'subjectId', e.subject_id, 'details', e.details,
      'previousHash', e.previous_hash, 'recordHash', e.record_hash) order by e.sequence_number), '[]'::jsonb)
  into v_events from private.glci_audit_events e where e.sequence_number between p_from and v_to;
  v_digest := encode(extensions.digest(convert_to(v_events::text, 'UTF8'), 'sha256'), 'hex');
  v_integrity := private.glci_audit_integrity();
  insert into private.glci_audit_checkpoints (head_sequence, head_hash, chain_valid, kind, range_from, range_to, export_digest, taken_by)
  values ((v_integrity ->> 'headSequence')::bigint, v_integrity ->> 'headHash', (v_integrity ->> 'chainValid')::boolean,
    'export', p_from, v_to, v_digest, private.current_principal_id());
  perform private.glci_audit('governance.audit_exported', 'audit_export', p_from || '-' || v_to, jsonb_build_object('digest', v_digest));
  return jsonb_build_object('format', 'njumeni-glci-audit-export-1', 'exportedAt', now(), 'range', jsonb_build_object('from', p_from, 'to', v_to),
    'integrity', v_integrity, 'sha256', v_digest,
    'verification', 'record_hash = sha256 over the unit-separated fields (occurred_at UTC, actor, kind, event, subject type, subject id, details, previous hash); each previousHash equals the prior recordHash. sha256 is over the events array as exported.',
    'events', v_events);
end;
$$;

-- ------------------------------------------------------------------ governance report
create or replace function public.glci_governance_report()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return jsonb_build_object(
    'policy', (select jsonb_build_object('requireTwoPerson', require_two_person, 'reason', reason, 'updatedAt', updated_at) from private.glci_governance_policy),
    'audit', private.glci_audit_integrity(),
    'lastCheckpoint', (select jsonb_build_object('kind', kind, 'headSequence', head_sequence, 'takenAt', taken_at, 'exportDigest', export_digest)
      from private.glci_audit_checkpoints order by id desc limit 1),
    'pendingApprovals', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'actionType', r.action_type, 'subject', r.subject,
        'payload', r.payload, 'reason', r.reason, 'requestedAt', r.requested_at, 'requestedBy', r.requested_by,
        'requestedByMe', r.requested_by = private.current_principal_id()) order by r.requested_at)
      from private.glci_approval_requests r where r.status in ('pending', 'approved')), '[]'::jsonb),
    'recentDecisions', coalesce((select jsonb_agg(jsonb_build_object('actionType', r.action_type, 'subject', r.subject, 'status', r.status,
        'selfApproved', r.self_approved, 'decidedAt', r.decided_at) order by r.decided_at desc)
      from (select * from private.glci_approval_requests where decided_at is not null order by decided_at desc limit 20) r), '[]'::jsonb),
    'deployments', coalesce((select jsonb_agg(jsonb_build_object('kind', d.kind, 'reference', d.reference, 'outcome', d.outcome,
        'checksum', d.checksum, 'selfApproved', d.self_approved, 'deployedAt', d.deployed_at) order by d.deployed_at desc, d.reference desc)
      from (select * from private.glci_deployments order by deployed_at desc, reference desc limit 30) d), '[]'::jsonb),
    'unrecordedMigrations', coalesce((select jsonb_agg(m.version order by m.version) from supabase_migrations.schema_migrations m
      where not exists (select 1 from private.glci_deployments d where d.kind = 'database_migration' and d.environment = 'hosted'
        and d.reference = m.version and d.outcome in ('deployed', 'backfilled'))), '[]'::jsonb));
end;
$$;

-- ------------------------------------------------------------------ carried-forward functions
-- Activation of a monitoring target is consequential: it now goes through an approval request.
-- Pausing and retiring stay direct. Carried forward from 20261113200000 with only that rule added.
create or replace function public.glci_set_target_status(p_target_key text, p_status text, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_target private.glci_monitoring_targets;
begin
  perform private.glci_require_operator();
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_status = 'active' then
    raise exception 'GLCI_APPROVAL_REQUIRED' using errcode = '42501',
      hint = 'Request activation with glci_request_action(''activate_target'', ...); it runs when approved.';
  end if;
  update private.glci_monitoring_targets set status = p_status where target_key = p_target_key returning * into v_target;
  if v_target.id is null then raise exception 'GLCI_TARGET_NOT_FOUND' using errcode = 'P0002'; end if;
  perform private.glci_audit('registry.target_status', 'monitoring_target', p_target_key,
    jsonb_build_object('status', p_status, 'reason', btrim(p_reason), 'basis', private.glci_target_activation_basis(v_target)));
  return p_status;
end;
$$;

-- The remediation four-eyes rule follows the governance policy. Carried forward from
-- 20261113700000 with only the self-approval condition and its record changed.
create or replace function public.glci_decide_proposal(p_proposal_id uuid, p_decision text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_proposal private.glci_remediation_proposals;
  v_self boolean;
begin
  perform private.glci_require_operator();
  select * into v_proposal from private.glci_remediation_proposals where id = p_proposal_id for update;
  if v_proposal.id is null then raise exception 'GLCI_PROPOSAL_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'proposed' or p_decision not in ('approved', 'rejected') then
    raise exception 'GLCI_DECISION_INVALID' using errcode = '22023';
  end if;
  v_self := v_proposal.proposed_by is not null and v_proposal.proposed_by = private.current_principal_id();
  if v_self and private.glci_two_person_required() then
    raise exception 'GLCI_FOUR_EYES_REQUIRED' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) < 5 then raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023'; end if;
  update private.glci_remediation_proposals set status = p_decision, decided_by = private.current_principal_id(), decided_at = now(),
    decision_note = case when v_self then '[self-approved under solo-owner policy] ' else '' end || btrim(p_note) where id = p_proposal_id;
  update private.glci_issues set status = 'in_progress', updated_at = now() where id = v_proposal.issue_id and status = 'open' and p_decision = 'approved';
  perform private.glci_audit('remediation.' || p_decision, 'glci_proposal', p_proposal_id::text,
    jsonb_build_object('action', v_proposal.action_type, 'note', btrim(p_note), 'selfApproved', v_self));
  return p_decision;
end;
$$;

revoke all on function public.glci_record_deployment(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.glci_record_deployment(uuid, text, text, text, text, text, jsonb) to authenticated, service_role;
revoke all on function public.glci_audit_checkpoint() from public, anon;
grant execute on function public.glci_audit_checkpoint() to authenticated, service_role;
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_set_governance_policy(boolean, text)', 'public.glci_request_action(text, text, jsonb, text)',
    'public.glci_decide_action(uuid, text, text)', 'public.glci_audit_export(bigint, bigint)', 'public.glci_governance_report()'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
