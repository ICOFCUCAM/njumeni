-- Phase 10: enterprise and institutional systems (Master Plan v2.0 Modules J, K, L, §16, U-14;
-- ADR-0002 deferred item 4: support break-glass access).
-- Offices and teams; platform operators with no default access to customer content and
-- break-glass support access that is customer-approved, time-bound, read-only and audited;
-- organisation retention policies; a compliance obligation register with regulatory change
-- detection; EU AI Act risk classification that gates AI per workspace; institutional reporting;
-- SSO readiness; enterprise API keys acting as scoped, delegated credentials.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Offices and teams
-- ---------------------------------------------------------------------------------------------
create table private.org_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  parent_id uuid references private.org_units (id) on delete restrict,
  unit_kind text not null check (unit_kind in ('office', 'team')),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  location text check (location is null or char_length(location) <= 200),
  created_at timestamptz not null default now(),
  unique (organization_id, unit_kind, name)
);
create table private.org_unit_members (
  unit_id uuid not null references private.org_units (id) on delete restrict,
  principal_id uuid not null references private.principals (id) on delete restrict,
  added_by uuid references private.principals (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (unit_id, principal_id)
);

create or replace function public.org_unit_create(p_organization_id uuid, p_kind text, p_name text,
  p_parent_id uuid default null, p_location text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if private.current_principal_id() is null or not private.has_permission('organization.manage_members', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_parent_id is not null and not exists (select 1 from private.org_units where id = p_parent_id and organization_id = p_organization_id) then
    raise exception 'ENTERPRISE_UNIT_INVALID' using errcode = '22023';
  end if;
  insert into private.org_units (organization_id, parent_id, unit_kind, name, location)
  values (p_organization_id, p_parent_id, p_kind, btrim(p_name), nullif(btrim(p_location), ''))
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, null, 'organization.unit_created', 'org_unit', v_id,
    jsonb_build_object('kind', p_kind));
  return v_id;
end;
$$;

create or replace function public.org_unit_add_member(p_unit_id uuid, p_principal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_unit private.org_units;
begin
  select * into v_unit from private.org_units where id = p_unit_id;
  if not found or private.current_principal_id() is null
    or not private.has_permission('organization.manage_members', v_unit.organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_memberships where organization_id = v_unit.organization_id
      and principal_id = p_principal_id and status = 'active')
    and not exists (select 1 from public.organizations where id = v_unit.organization_id and owner_principal_id = p_principal_id) then
    raise exception 'ENTERPRISE_NOT_A_MEMBER' using errcode = '22023';
  end if;
  insert into private.org_unit_members (unit_id, principal_id, added_by) values (p_unit_id, p_principal_id, private.current_principal_id())
  on conflict do nothing;
end;
$$;

-- Assigns every eligible team member (workspace member, not barred) to a matter.
create or replace function public.matter_assign_team(p_matter_id uuid, p_unit_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters; v_count integer;
begin
  v_matter := private.matter_writable(p_matter_id);
  if not exists (select 1 from private.org_units where id = p_unit_id and organization_id = v_matter.organization_id) then
    raise exception 'ENTERPRISE_UNIT_INVALID' using errcode = '22023';
  end if;
  insert into private.matter_assignments (matter_id, principal_id, assignment_role, assigned_by)
  select p_matter_id, m.principal_id, 'team_member', private.current_principal_id()
  from private.org_unit_members m
  where m.unit_id = p_unit_id and not private.matter_barred(p_matter_id, m.principal_id)
    and exists (select 1 from public.workspace_memberships w where w.workspace_id = v_matter.workspace_id
      and w.principal_id = m.principal_id and w.status = 'active')
  on conflict (matter_id, principal_id) do nothing;
  get diagnostics v_count = row_count;
  perform private.matter_log(p_matter_id, 'procedural_step', format('Team assigned (%s member(s))', v_count),
    jsonb_build_object('unitId', p_unit_id));
  return v_count;
end;
$$;

create or replace function public.org_structure(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission('organization.read', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.unit_kind, 'name', u.name, 'location', u.location,
    'parentId', u.parent_id,
    'members', coalesce((select jsonb_agg(coalesce(p.display_name, 'Member') order by p.display_name)
      from private.org_unit_members m left join public.user_profiles p on p.principal_id = m.principal_id where m.unit_id = u.id), '[]'::jsonb))
    order by u.unit_kind, u.name)
    from private.org_units u where u.organization_id = p_organization_id), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Platform operators and break-glass support access (§16, ADR-0002)
-- ---------------------------------------------------------------------------------------------
create table private.platform_operators (
  principal_id uuid primary key references private.principals (id) on delete restrict,
  operator_role text not null check (operator_role in ('platform_admin', 'support', 'knowledge_admin', 'ai_operations')),
  added_at timestamptz not null default now()
);

create table private.support_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  operator_principal_id uuid not null references private.principals (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  requested_minutes integer not null check (requested_minutes between 15 and 480),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'revoked')),
  requested_at timestamptz not null default now(),
  decided_by uuid references private.principals (id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz,
  check ((status = 'approved') = (expires_at is not null) or status = 'revoked')
);
create index support_access_active_idx on private.support_access_requests (operator_principal_id, organization_id) where status = 'approved';

do $tables$
declare v_table text;
begin
  foreach v_table in array array['org_units', 'org_unit_members', 'platform_operators', 'support_access_requests'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
  end loop;
end;
$tables$;

create or replace function private.is_platform_operator(p_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.platform_operators where principal_id = private.current_principal_id()
    and (p_role is null or operator_role = p_role or operator_role = 'platform_admin'));
$$;
revoke all on function private.is_platform_operator(text) from public, anon, authenticated;

-- The role-based evaluator is kept unchanged under a new name; has_permission adds one rule:
-- an operator with an approved, unexpired support grant for the organisation may READ (never
-- write) while the grant lasts. Every function that checks permissions by name inherits this.
alter function private.has_permission(text, uuid, uuid) rename to has_permission_roles;

create or replace function private.has_permission(p_permission_key text, p_organization_id uuid, p_workspace_id uuid default null)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if private.has_permission_roles(p_permission_key, p_organization_id, p_workspace_id) then
    return true;
  end if;
  return p_permission_key in ('organization.read', 'workspace.read', 'matter.read', 'document.read', 'research.read')
    and exists (
      select 1 from private.support_access_requests r
      where r.operator_principal_id = private.current_principal_id() and r.status = 'approved' and r.expires_at > now()
        and r.organization_id = coalesce(p_organization_id, (select organization_id from public.workspaces where id = p_workspace_id))
        and (p_workspace_id is null or exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.organization_id = r.organization_id)));
exception when others then
  return false;
end;
$$;
revoke all on function private.has_permission(text, uuid, uuid) from public, anon;
grant execute on function private.has_permission(text, uuid, uuid) to authenticated;
revoke all on function private.has_permission_roles(text, uuid, uuid) from public, anon;
grant execute on function private.has_permission_roles(text, uuid, uuid) to authenticated;

create or replace function public.support_access_request(p_organization_id uuid, p_reason text, p_minutes integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_platform_operator('support') then raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501'; end if;
  insert into private.support_access_requests (organization_id, operator_principal_id, reason, requested_minutes)
  values (p_organization_id, private.current_principal_id(), btrim(p_reason), p_minutes)
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, null, 'support.access_requested', 'support_access', v_id,
    jsonb_build_object('minutes', p_minutes));
  return v_id;
end;
$$;

-- Only the customer (organisation.update) decides; the operator can never approve their own request.
create or replace function public.support_access_decide(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_request private.support_access_requests;
begin
  select * into v_request from private.support_access_requests where id = p_request_id for update;
  if not found or private.current_principal_id() is null
    or v_request.operator_principal_id = private.current_principal_id()
    or not private.has_permission_roles('organization.update', v_request.organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'denied', 'revoked')
    or (p_decision in ('approved', 'denied') and v_request.status <> 'pending')
    or (p_decision = 'revoked' and v_request.status <> 'approved') then
    raise exception 'ENTERPRISE_DECISION_INVALID' using errcode = '22023';
  end if;
  update private.support_access_requests set status = p_decision, decided_by = private.current_principal_id(), decided_at = now(),
    expires_at = case when p_decision = 'approved' then now() + make_interval(mins => v_request.requested_minutes)
      when p_decision = 'revoked' then now() else null end
  where id = p_request_id;
  perform private.record_evidence_audit(v_request.organization_id, null, 'support.access_' || p_decision, 'support_access', p_request_id,
    jsonb_build_object('operator', v_request.operator_principal_id));
end;
$$;

create or replace function public.support_access_list(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not (private.has_permission_roles('organization.update', p_organization_id, null)
      or private.is_platform_operator('support')) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason, 'minutes', r.requested_minutes,
    'status', case when r.status = 'approved' and r.expires_at <= now() then 'expired' else r.status end,
    'requestedAt', r.requested_at, 'expiresAt', r.expires_at,
    'operator', (select coalesce(p.display_name, 'Njumeni support') from public.user_profiles p where p.principal_id = r.operator_principal_id))
    order by r.requested_at desc)
    from private.support_access_requests r where r.organization_id = p_organization_id
      and (private.has_permission_roles('organization.update', p_organization_id, null) or r.operator_principal_id = private.current_principal_id())), '[]'::jsonb);
end;
$$;

-- Back office overview: platform metadata only, never customer content.
create or replace function public.platform_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'organizations', (select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind, 'status', o.status,
      'createdAt', o.created_at,
      'members', (select count(*) from public.organization_memberships m where m.organization_id = o.id and m.status = 'active') + 1,
      'workspaces', (select count(*) from public.workspaces w where w.organization_id = o.id))
      order by o.created_at desc) from public.organizations o),
    'counts', jsonb_build_object(
      'principals', (select count(*) from private.principals),
      'matters', (select count(*) from private.matters),
      'documents', (select count(*) from private.legal_documents),
      'researchRuns', (select count(*) from private.research_runs),
      'legalSources', (select count(*) from private.legal_sources),
      'activeSources', (select count(*) from private.legal_sources where status = 'active')),
    'ai', jsonb_build_object(
      'executions30Days', (select count(*) from private.ai_executions where created_at > now() - interval '30 days'),
      'failed30Days', (select count(*) from private.ai_executions where status = 'failed' and created_at > now() - interval '30 days'),
      'refused30Days', (select count(*) from private.ai_executions where status = 'refused' and created_at > now() - interval '30 days'),
      'costUsd30Days', (select coalesce(sum(estimated_cost_usd), 0) from private.ai_executions where created_at > now() - interval '30 days'),
      'providers', (select jsonb_agg(jsonb_build_object('key', provider_key, 'status', status) order by provider_key) from private.ai_providers)),
    'auditChainValid', (public.verify_security_audit_chain() ->> 'valid')::boolean,
    'activeSupportGrants', (select count(*) from private.support_access_requests where status = 'approved' and expires_at > now()));
end;
$$;

create or replace function public.platform_is_operator()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_operator();
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Retention policies
-- ---------------------------------------------------------------------------------------------
create table private.retention_policies (
  organization_id uuid not null references public.organizations (id) on delete restrict,
  artefact_class text not null check (artefact_class in ('closed_matters', 'evidence', 'documents', 'research', 'ai_executions')),
  retain_years integer not null check (retain_years between 1 and 50),
  updated_by uuid references private.principals (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, artefact_class)
);
alter table private.retention_policies enable row level security;
revoke all on private.retention_policies from public, anon, authenticated;

create or replace function public.retention_set_policy(p_organization_id uuid, p_class text, p_years integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.update', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.retention_policies (organization_id, artefact_class, retain_years, updated_by)
  values (p_organization_id, p_class, p_years, private.current_principal_id())
  on conflict (organization_id, artefact_class) do update set retain_years = excluded.retain_years,
    updated_by = excluded.updated_by, updated_at = now();
  perform private.record_evidence_audit(p_organization_id, null, 'retention.policy_set', 'organization', p_organization_id,
    jsonb_build_object('class', p_class, 'years', p_years));
end;
$$;

-- What has passed its retention period. Items under legal hold are never due. Disposal itself
-- is a separate, reviewed operation (Phase 13); this report only identifies candidates.
create or replace function public.retention_report(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_years jsonb;
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.update', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(artefact_class, retain_years), '{}'::jsonb) into v_years
  from private.retention_policies where organization_id = p_organization_id;
  return jsonb_build_object(
    'policies', v_years,
    'closedMattersDue', (select count(*) from private.matters where organization_id = p_organization_id
      and status in ('closed', 'archived') and v_years ? 'closed_matters'
      and closed_at < now() - make_interval(years => (v_years ->> 'closed_matters')::int)),
    'evidenceDue', (select count(*) from private.evidence_items where organization_id = p_organization_id
      and not legal_hold and v_years ? 'evidence' and created_at < now() - make_interval(years => (v_years ->> 'evidence')::int)),
    'evidenceOnLegalHold', (select count(*) from private.evidence_items where organization_id = p_organization_id and legal_hold),
    'documentsDue', (select count(*) from private.legal_documents where organization_id = p_organization_id
      and v_years ? 'documents' and updated_at < now() - make_interval(years => (v_years ->> 'documents')::int)),
    'researchDue', (select count(*) from private.research_runs where organization_id = p_organization_id
      and v_years ? 'research' and created_at < now() - make_interval(years => (v_years ->> 'research')::int)));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Compliance obligations (Module L)
-- ---------------------------------------------------------------------------------------------
insert into private.permission_catalog (permission_key, scope, description) values
  ('compliance.manage', 'workspace', 'Maintain compliance obligations and assessments')
on conflict (permission_key) do nothing;
insert into private.role_permissions (role_key, permission_key) values
  ('workspace_manager', 'compliance.manage'), ('workspace_editor', 'compliance.manage')
on conflict do nothing;

create table private.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  title text not null check (char_length(btrim(title)) between 3 and 300),
  description text check (description is null or char_length(description) <= 4000),
  authority_passage_id uuid not null references private.legal_authority_passages (id) on delete restrict,
  owner_principal_id uuid references private.principals (id) on delete set null,
  review_interval_days integer not null default 365 check (review_interval_days between 7 and 1825),
  status text not null default 'not_assessed' check (status in ('not_assessed', 'compliant', 'partially_compliant', 'non_compliant', 'not_applicable')),
  last_assessed_at timestamptz,
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict
);
create table private.compliance_assessments (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references private.compliance_obligations (id) on delete restrict,
  status text not null check (status in ('compliant', 'partially_compliant', 'non_compliant', 'not_applicable')),
  note text not null check (char_length(btrim(note)) between 3 and 4000),
  evidence_item_id uuid references private.evidence_items (id) on delete restrict,
  assessed_by uuid references private.principals (id) on delete set null,
  assessed_at timestamptz not null default clock_timestamp()
);
create trigger compliance_assessments_append_only before update or delete on private.compliance_assessments
  for each row execute function private.reject_append_only_mutation();
alter table private.compliance_obligations enable row level security;
alter table private.compliance_assessments enable row level security;
revoke all on private.compliance_obligations, private.compliance_assessments from public, anon, authenticated;

create or replace function public.compliance_add_obligation(p_organization_id uuid, p_workspace_id uuid, p_title text,
  p_authority_passage_id uuid, p_description text default null, p_review_interval_days integer default 365)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if private.current_principal_id() is null or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission('compliance.manage', p_organization_id, p_workspace_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  -- Every obligation is anchored in an approved, current source (Module L: source-linked rules).
  if not exists (select 1 from private.legal_authority_passages p
    join private.legal_authority_versions v on v.id = p.authority_version_id
    join private.legal_authorities a on a.id = v.authority_id
    join private.legal_sources s on s.id = a.source_id
    where p.id = p_authority_passage_id and s.rights_status = 'approved' and s.status = 'active') then
    raise exception 'COMPLIANCE_SOURCE_INVALID' using errcode = '22023';
  end if;
  insert into private.compliance_obligations (organization_id, workspace_id, title, description, authority_passage_id,
    owner_principal_id, review_interval_days, created_by)
  values (p_organization_id, p_workspace_id, btrim(p_title), nullif(btrim(p_description), ''), p_authority_passage_id,
    private.current_principal_id(), p_review_interval_days, private.current_principal_id())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.compliance_assess(p_obligation_id uuid, p_status text, p_note text, p_evidence_item_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_obligation private.compliance_obligations;
begin
  select * into v_obligation from private.compliance_obligations where id = p_obligation_id for update;
  if not found or private.current_principal_id() is null
    or not private.has_permission('compliance.manage', v_obligation.organization_id, v_obligation.workspace_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_evidence_item_id is not null and not exists (select 1 from private.evidence_items where id = p_evidence_item_id
    and workspace_id = v_obligation.workspace_id and status = 'active') then
    raise exception 'COMPLIANCE_EVIDENCE_OUT_OF_SCOPE' using errcode = '42501';
  end if;
  insert into private.compliance_assessments (obligation_id, status, note, evidence_item_id, assessed_by)
  values (p_obligation_id, p_status, btrim(p_note), p_evidence_item_id, private.current_principal_id());
  update private.compliance_obligations set status = p_status, last_assessed_at = now() where id = p_obligation_id;
  perform private.record_evidence_audit(v_obligation.organization_id, v_obligation.workspace_id, 'compliance.assessed',
    'compliance_obligation', p_obligation_id, jsonb_build_object('status', p_status));
end;
$$;

-- The register with regulatory change monitoring: an obligation needs review when it is overdue,
-- never assessed, or when its law changed (a newer version, or adverse treatment) after the last
-- assessment.
create or replace function public.compliance_register(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission('research.read', p_organization_id, p_workspace_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(row order by (row ->> 'reviewRequired')::boolean desc, row ->> 'title') from (
    select jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description, 'status', o.status,
      'citation', a.citation, 'validFrom', v.valid_from, 'validUntil', v.valid_until,
      'lastAssessedAt', o.last_assessed_at,
      'nextReview', (coalesce(o.last_assessed_at, o.created_at) + make_interval(days => o.review_interval_days))::date,
      'lawChanged', ch.changed,
      'reviewRequired', o.last_assessed_at is null or ch.changed
        or coalesce(o.last_assessed_at, o.created_at) + make_interval(days => o.review_interval_days) < now(),
      'assessments', coalesce((select jsonb_agg(jsonb_build_object('status', s.status, 'note', s.note, 'at', s.assessed_at,
        'evidence', (select title from private.evidence_items where id = s.evidence_item_id)) order by s.assessed_at desc)
        from private.compliance_assessments s where s.obligation_id = o.id), '[]'::jsonb)) as row
    from private.compliance_obligations o
    join private.legal_authority_passages p on p.id = o.authority_passage_id
    join private.legal_authority_versions v on v.id = p.authority_version_id
    join private.legal_authorities a on a.id = v.authority_id
    cross join lateral (select o.last_assessed_at is not null and (
        exists (select 1 from private.legal_authority_versions nv where nv.authority_id = a.id and nv.id <> v.id
          and nv.valid_from > v.valid_from and nv.valid_from <= now()::date and nv.created_at > o.last_assessed_at)
        or exists (select 1 from private.legal_authority_relationships r where
          ((r.from_authority_id = a.id and r.relationship_type in ('amended_by', 'repealed_by', 'replaced_by', 'overruled_by'))
           or (r.to_authority_id = a.id and r.relationship_type in ('amends', 'repeals', 'replaces', 'overrules')))
          and r.created_at > o.last_assessed_at)) as changed) ch
    where o.organization_id = p_organization_id and o.workspace_id = p_workspace_id) obligations), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. EU AI Act risk classification (U-14) gating AI per workspace
-- ---------------------------------------------------------------------------------------------
alter table private.workspace_ai_settings add column ai_risk_class text not null default 'standard'
  check (ai_risk_class in ('standard', 'high_risk_justice'));
alter table private.workspace_ai_settings add column conformity_reference text
  check (conformity_reference is null or char_length(conformity_reference) between 5 and 300);

create or replace function public.ai_set_risk_classification(p_organization_id uuid, p_workspace_id uuid, p_class text,
  p_conformity_reference text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.update', p_organization_id, null)
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.workspace_ai_settings (workspace_id, organization_id, ai_risk_class, conformity_reference, updated_by)
  values (p_workspace_id, p_organization_id, p_class, nullif(btrim(p_conformity_reference), ''), private.current_principal_id())
  on conflict (workspace_id) do update set ai_risk_class = excluded.ai_risk_class,
    conformity_reference = excluded.conformity_reference, updated_by = excluded.updated_by, updated_at = now();
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'ai.risk_classified', 'workspace', p_workspace_id,
    jsonb_build_object('class', p_class, 'conformity', p_conformity_reference is not null));
end;
$$;

-- The Phase 5 authoriser is kept unchanged (moved out of the API); the public entry point first
-- applies the risk classification: a high-risk justice workspace runs no agent until a conformity
-- assessment is recorded.
alter function public.ai_authorise_execution(uuid, uuid, text, text, text[], integer) set schema private;
alter function private.ai_authorise_execution(uuid, uuid, text, text, text[], integer) rename to ai_authorise_execution_base;
revoke all on function private.ai_authorise_execution_base(uuid, uuid, text, text, text[], integer) from public, anon, authenticated;

create or replace function public.ai_authorise_execution(
  p_organization_id uuid, p_workspace_id uuid, p_agent_key text, p_provider_key text,
  p_egress_classes text[], p_estimated_tokens integer
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_settings private.workspace_ai_settings;
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'research.read');
  select * into v_settings from private.workspace_ai_settings where workspace_id = p_workspace_id;
  if v_settings.ai_risk_class = 'high_risk_justice' and v_settings.conformity_reference is null then
    return jsonb_build_object('allowed', false, 'reason', 'AI_CONFORMITY_REQUIRED');
  end if;
  return private.ai_authorise_execution_base(p_organization_id, p_workspace_id, p_agent_key, p_provider_key,
    p_egress_classes, p_estimated_tokens);
end;
$$;
revoke all on function public.ai_authorise_execution(uuid, uuid, text, text, text[], integer) from public, anon;
grant execute on function public.ai_authorise_execution(uuid, uuid, text, text, text[], integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. Institutional reporting (aggregates only, no content)
-- ---------------------------------------------------------------------------------------------
create or replace function public.institutional_report(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not (private.has_permission_roles('organization.update', p_organization_id, null)
      or private.has_permission_roles('audit.read', p_organization_id, null)) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'workspaces', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name,
      'aiRiskClass', coalesce(s.ai_risk_class, 'standard'), 'conformityRecorded', s.conformity_reference is not null,
      'openMatters', (select count(*) from private.matters m where m.workspace_id = w.id and m.status in ('open', 'on_hold')),
      'closedMatters', (select count(*) from private.matters m where m.workspace_id = w.id and m.status in ('closed', 'archived')),
      'overdueDeadlines', (select count(*) from private.matter_deadlines d join private.matters m on m.id = d.matter_id
        where m.workspace_id = w.id and d.status = 'pending' and d.due_at < now()),
      'approvedDocuments', (select count(*) from private.legal_documents d where d.workspace_id = w.id and d.status = 'approved'),
      'obligations', (select count(*) from private.compliance_obligations o where o.workspace_id = w.id),
      'nonCompliant', (select count(*) from private.compliance_obligations o where o.workspace_id = w.id and o.status = 'non_compliant'),
      'aiExecutions30Days', (select count(*) from private.ai_executions e where e.workspace_id = w.id and e.created_at > now() - interval '30 days'),
      'aiRefusals30Days', (select count(*) from private.ai_executions e where e.workspace_id = w.id and e.status = 'refused' and e.created_at > now() - interval '30 days'))
      order by w.name)
      from public.workspaces w left join private.workspace_ai_settings s on s.workspace_id = w.id
      where w.organization_id = p_organization_id), '[]'::jsonb),
    'pendingReviews', (select count(*) from private.review_requests where organization_id = p_organization_id and status = 'pending'),
    'conflictChecks90Days', (select count(*) from private.conflict_checks where organization_id = p_organization_id and run_at > now() - interval '90 days'),
    'activeSupportGrants', (select count(*) from private.support_access_requests where organization_id = p_organization_id
      and status = 'approved' and expires_at > now()));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. SSO readiness
-- ---------------------------------------------------------------------------------------------
create table private.sso_configurations (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  protocol text not null check (protocol in ('saml', 'oidc')),
  issuer text not null check (char_length(issuer) between 5 and 500),
  metadata_url text check (metadata_url is null or metadata_url ~ '^https://'),
  enforced boolean not null default false,
  updated_by uuid references private.principals (id) on delete set null,
  updated_at timestamptz not null default now()
);
create table private.sso_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  domain text not null unique check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  verification_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.sso_configurations enable row level security;
alter table private.sso_domains enable row level security;
revoke all on private.sso_configurations, private.sso_domains from public, anon, authenticated;

create or replace function public.sso_configure(p_organization_id uuid, p_protocol text, p_issuer text, p_metadata_url text default null,
  p_enforced boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.update', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_enforced and not exists (select 1 from private.sso_domains where organization_id = p_organization_id and verified_at is not null) then
    raise exception 'SSO_DOMAIN_NOT_VERIFIED' using errcode = '55000';
  end if;
  insert into private.sso_configurations (organization_id, protocol, issuer, metadata_url, enforced, updated_by)
  values (p_organization_id, p_protocol, btrim(p_issuer), nullif(btrim(p_metadata_url), ''), p_enforced, private.current_principal_id())
  on conflict (organization_id) do update set protocol = excluded.protocol, issuer = excluded.issuer,
    metadata_url = excluded.metadata_url, enforced = excluded.enforced, updated_by = excluded.updated_by, updated_at = now();
  perform private.record_evidence_audit(p_organization_id, null, 'sso.configured', 'organization', p_organization_id,
    jsonb_build_object('protocol', p_protocol, 'enforced', p_enforced));
end;
$$;

create or replace function public.sso_add_domain(p_organization_id uuid, p_domain text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.sso_domains;
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.update', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.sso_domains (organization_id, domain) values (p_organization_id, lower(btrim(p_domain)))
  returning * into v_row;
  return jsonb_build_object('domain', v_row.domain, 'txtRecord', format('njumeni-verification=%s', v_row.verification_token));
end;
$$;

-- Domain ownership is confirmed by a platform operator after checking the DNS TXT record.
create or replace function public.platform_verify_sso_domain(p_domain text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row private.sso_domains;
begin
  if not private.is_platform_operator('support') then raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501'; end if;
  update private.sso_domains set verified_at = now() where domain = lower(btrim(p_domain)) and verified_at is null returning * into v_row;
  if v_row.id is null then raise exception 'SSO_DOMAIN_UNKNOWN' using errcode = '22023'; end if;
  perform private.record_evidence_audit(v_row.organization_id, null, 'sso.domain_verified', 'organization', v_row.organization_id,
    jsonb_build_object('domain', v_row.domain));
end;
$$;

create or replace function public.sso_status(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.update', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'configuration', (select jsonb_build_object('protocol', protocol, 'issuer', issuer, 'metadataUrl', metadata_url, 'enforced', enforced)
      from private.sso_configurations where organization_id = p_organization_id),
    'domains', coalesce((select jsonb_agg(jsonb_build_object('domain', domain, 'verified', verified_at is not null,
      'txtRecord', format('njumeni-verification=%s', verification_token)) order by domain)
      from private.sso_domains where organization_id = p_organization_id), '[]'::jsonb));
end;
$$;

-- Sign-in discovery (callable before sign-in): reveals only whether a verified, enforced SSO
-- configuration exists for the e-mail's domain, and its protocol. No organisation is named.
create or replace function public.sso_discover(p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('sso', true, 'protocol', c.protocol)
    from private.sso_domains d join private.sso_configurations c on c.organization_id = d.organization_id
    where d.domain = lower(split_part(btrim(p_email), '@', 2)) and d.verified_at is not null and c.enforced
    limit 1), jsonb_build_object('sso', false));
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Enterprise API keys: delegated, scoped, revocable credentials
-- ---------------------------------------------------------------------------------------------
create table private.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  name text not null check (char_length(btrim(name)) between 3 and 100),
  key_prefix text not null unique check (key_prefix ~ '^[0-9a-f]{8}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (scopes <@ array['research.read', 'matters.read'] and cardinality(scopes) >= 1),
  created_by uuid not null references private.principals (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict
);
alter table private.api_keys enable row level security;
revoke all on private.api_keys from public, anon, authenticated;

-- The secret is returned once and only its SHA-256 is stored.
create or replace function public.api_key_create(p_organization_id uuid, p_workspace_id uuid, p_name text, p_scopes text[], p_days integer default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_prefix text := encode(extensions.gen_random_bytes(4), 'hex'); v_secret text := encode(extensions.gen_random_bytes(24), 'hex');
  v_key text; v_id uuid;
begin
  if private.current_principal_id() is null or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission_roles('workspace.manage_members', p_organization_id, p_workspace_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  v_key := format('njk_%s_%s', v_prefix, v_secret);
  insert into private.api_keys (organization_id, workspace_id, name, key_prefix, key_hash, scopes, created_by, expires_at)
  values (p_organization_id, p_workspace_id, btrim(p_name), v_prefix, encode(extensions.digest(v_key, 'sha256'), 'hex'), p_scopes,
    private.current_principal_id(), now() + make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365)))
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'api_key.created', 'api_key', v_id,
    jsonb_build_object('prefix', v_prefix, 'scopes', p_scopes));
  return jsonb_build_object('id', v_id, 'key', v_key, 'prefix', v_prefix);
end;
$$;

create or replace function public.api_key_revoke(p_key_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_key private.api_keys;
begin
  select * into v_key from private.api_keys where id = p_key_id;
  if not found or private.current_principal_id() is null
    or not private.has_permission_roles('workspace.manage_members', v_key.organization_id, v_key.workspace_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  update private.api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key_id;
  perform private.record_evidence_audit(v_key.organization_id, v_key.workspace_id, 'api_key.revoked', 'api_key', p_key_id);
end;
$$;

create or replace function public.api_key_list(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission_roles('workspace.manage_members', p_organization_id, p_workspace_id) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'prefix', key_prefix, 'scopes', to_jsonb(scopes),
    'expiresAt', expires_at, 'revoked', revoked_at is not null, 'lastUsedAt', last_used_at) order by created_at desc)
    from private.api_keys where workspace_id = p_workspace_id), '[]'::jsonb);
end;
$$;

-- Resolves a key and, for the rest of the transaction, acts as its creator: every downstream
-- check (role permissions, barriers, workspace scope) applies, and the key's scope narrows it.
create or replace function private.api_key_act_as(p_key text, p_scope text)
returns private.api_keys language plpgsql security definer set search_path = '' as $$
declare v_key private.api_keys; v_user uuid;
begin
  if p_key !~ '^njk_[0-9a-f]{8}_[0-9a-f]{48}$' then raise exception 'API_KEY_INVALID' using errcode = '28000'; end if;
  select * into v_key from private.api_keys where key_prefix = substr(p_key, 5, 8);
  if not found or v_key.key_hash <> encode(extensions.digest(p_key, 'sha256'), 'hex')
    or v_key.revoked_at is not null or v_key.expires_at <= now() then
    raise exception 'API_KEY_INVALID' using errcode = '28000';
  end if;
  if not (p_scope = any (v_key.scopes)) then raise exception 'API_KEY_SCOPE' using errcode = '42501'; end if;
  select auth_user_id into v_user from private.principal_identities where principal_id = v_key.created_by and provider = 'supabase' limit 1;
  if v_user is null then raise exception 'API_KEY_INVALID' using errcode = '28000'; end if;
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  update private.api_keys set last_used_at = now() where id = v_key.id;
  return v_key;
end;
$$;
revoke all on function private.api_key_act_as(text, text) from public, anon, authenticated;

create or replace function public.api_key_research_get_run(p_key text, p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key private.api_keys;
begin
  v_key := private.api_key_act_as(p_key, 'research.read');
  if not exists (select 1 from private.research_runs where id = p_run_id and workspace_id = v_key.workspace_id) then
    raise exception 'RESEARCH_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return public.research_get_run(p_run_id);
end;
$$;

create or replace function public.api_key_matter_list(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key private.api_keys;
begin
  v_key := private.api_key_act_as(p_key, 'matters.read');
  return public.matter_list(v_key.organization_id, v_key.workspace_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.org_unit_create(uuid, text, text, uuid, text)',
    'public.org_unit_add_member(uuid, uuid)',
    'public.matter_assign_team(uuid, uuid)',
    'public.org_structure(uuid)',
    'public.support_access_request(uuid, text, integer)',
    'public.support_access_decide(uuid, text)',
    'public.support_access_list(uuid)',
    'public.platform_overview()',
    'public.platform_is_operator()',
    'public.retention_set_policy(uuid, text, integer)',
    'public.retention_report(uuid)',
    'public.compliance_add_obligation(uuid, uuid, text, uuid, text, integer)',
    'public.compliance_assess(uuid, text, text, uuid)',
    'public.compliance_register(uuid, uuid)',
    'public.ai_set_risk_classification(uuid, uuid, text, text)',
    'public.institutional_report(uuid)',
    'public.sso_configure(uuid, text, text, text, boolean)',
    'public.sso_add_domain(uuid, text)',
    'public.platform_verify_sso_domain(text)',
    'public.sso_status(uuid)',
    'public.api_key_create(uuid, uuid, text, text[], integer)',
    'public.api_key_revoke(uuid)',
    'public.api_key_list(uuid, uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
  -- Callable without a session: sign-in discovery and API-key endpoints (the key is the credential).
  foreach v_signature in array array[
    'public.sso_discover(text)',
    'public.api_key_research_get_run(text, uuid)',
    'public.api_key_matter_list(text)'] loop
    execute format('revoke all on function %s from public', v_signature);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_signature);
  end loop;
end;
$grants$;

-- Organisation member directory (names only) for administration screens.
create or replace function public.org_member_directory(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission_roles('organization.read', p_organization_id, null) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('principalId', d.principal_id, 'name', d.name, 'owner', d.owner) order by d.name)
    from (
      select m.principal_id, coalesce(p.display_name, 'Member') as name, false as owner from public.organization_memberships m
      left join public.user_profiles p on p.principal_id = m.principal_id
      where m.organization_id = p_organization_id and m.status = 'active'
      union
      select o.owner_principal_id, coalesce(p.display_name, 'Owner'), true from public.organizations o
      left join public.user_profiles p on p.principal_id = o.owner_principal_id where o.id = p_organization_id
    ) d), '[]'::jsonb);
end;
$$;
revoke all on function public.org_member_directory(uuid) from public, anon;
grant execute on function public.org_member_directory(uuid) to authenticated, service_role;
