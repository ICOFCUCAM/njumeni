-- GLCI-06: discrepancy and remediation workflows (docs/GLCI_SPECIFICATION.md §3 steps 5–8).
--
-- 1. Issues (private.glci_issues). They are opened from the GLCI signals, de-duplicated by a
--    stable issue key, and resolved automatically when their condition clears:
--      integration_failure    a monitor no longer understands its source (J-GLCI-3);
--      source_unreachable     three or more consecutive failed checks (J-GLCI-2);
--      knowledge_lag          an upstream change not yet ingested;
--      legal_change_review    a detected amendment or withdrawal awaiting review (with impacts).
-- 2. Remediation proposals (private.glci_remediation_proposals): concrete actions with a rationale:
--      resync_source       queue an ingestion job for the source (the normal gates apply);
--      review_change       confirm or dismiss a detected change;
--      notify_affected     tell affected customers that research they rely on may be outdated;
--      engineering_task    a repository change for the engineering agent (executed in GLCI-09).
--    Proposals come from the system, an AI agent (advisory, GLCI-08) or an operator. Execution
--    needs approval by a GLCI operator. Approval of an operator's own proposal is refused (four eyes).
-- 3. Currency notices (private.research_currency_notices): what an affected customer sees. A notice
--    on a research run says the law it relied on changed, which section, and when. Only members who
--    may read that run see it (research.read).
-- Everything is audited in the GLCI chain.
-- 4. Correction to GLCI-05: knowledge lag compared the change with the last ingestion only while
--    the latest check outcome was "changed". A later "unchanged" or failed check hid an upstream
--    change that was never ingested. Lag now uses the time the source last changed, whatever the
--    latest outcome. glci_jurisdiction_currency is carried forward with only that condition changed.

create table private.glci_issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique check (char_length(issue_key) between 3 and 300),
  jurisdiction_code text references private.jurisdictions(code) on delete restrict,
  kind text not null check (kind in ('integration_failure', 'source_unreachable', 'knowledge_lag', 'legal_change_review')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  title text not null check (char_length(title) between 3 and 300),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  subject_type text not null,
  subject_id text not null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  check ((status in ('resolved', 'dismissed')) = (resolved_at is not null))
);
create index glci_issues_status_idx on private.glci_issues(status, severity, opened_at desc);
create index glci_issues_jurisdiction_idx on private.glci_issues(jurisdiction_code, status);
alter table private.glci_issues enable row level security;
revoke all on private.glci_issues from public, anon, authenticated;
grant select on private.glci_issues to service_role;

create table private.glci_remediation_proposals (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references private.glci_issues(id) on delete restrict,
  action_type text not null check (action_type in ('resync_source', 'review_change', 'notify_affected', 'engineering_task')),
  proposed_by_kind text not null check (proposed_by_kind in ('system', 'ai_agent', 'operator')),
  proposed_by uuid,
  proposal jsonb not null default '{}'::jsonb check (jsonb_typeof(proposal) = 'object'),
  rationale text not null check (char_length(rationale) between 10 and 4000),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'executed', 'failed')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  executed_at timestamptz,
  execution_result jsonb,
  created_at timestamptz not null default now(),
  unique (issue_id, action_type)
);
create index glci_remediation_proposals_status_idx on private.glci_remediation_proposals(status, created_at desc);
alter table private.glci_remediation_proposals enable row level security;
revoke all on private.glci_remediation_proposals from public, anon, authenticated;
grant select on private.glci_remediation_proposals to service_role;

create table private.research_currency_notices (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references private.research_runs(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  change_event_id uuid not null references private.glci_change_events(id) on delete restrict,
  severity text not null check (severity in ('high', 'low')),
  message text not null check (char_length(message) between 10 and 1000),
  sections text[] not null default '{}',
  effective_date date,
  created_at timestamptz not null default now(),
  unique (research_run_id, change_event_id)
);
create index research_currency_notices_run_idx on private.research_currency_notices(research_run_id);
create index research_currency_notices_org_idx on private.research_currency_notices(organization_id);
create index research_currency_notices_ws_idx on private.research_currency_notices(workspace_id);
create index research_currency_notices_event_idx on private.research_currency_notices(change_event_id);
alter table private.research_currency_notices enable row level security;
revoke all on private.research_currency_notices from public, anon, authenticated;
grant select on private.research_currency_notices to service_role;
create trigger research_currency_notices_append_only before update or delete on private.research_currency_notices
  for each row execute function private.reject_append_only_mutation();

-- ------------------------------------------------------------------ issue lifecycle
create or replace function private.glci_open_issue(p_issue_key text, p_jurisdiction text, p_kind text, p_severity text, p_title text,
  p_detail jsonb, p_subject_type text, p_subject_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_status text;
begin
  select id, status into v_id, v_status from private.glci_issues where issue_key = p_issue_key for update;
  if v_id is null then
    insert into private.glci_issues (issue_key, jurisdiction_code, kind, severity, title, detail, subject_type, subject_id)
    values (p_issue_key, p_jurisdiction, p_kind, p_severity, p_title, coalesce(p_detail, '{}'), p_subject_type, p_subject_id)
    returning id into v_id;
    perform private.glci_audit('issue.opened', 'glci_issue', v_id::text, jsonb_build_object('key', p_issue_key, 'kind', p_kind, 'severity', p_severity), 'system');
  elsif v_status = 'resolved' then
    -- The condition came back: reopen, so recurrence is visible rather than silently new.
    update private.glci_issues set status = 'open', resolved_at = null, resolution_note = null, detail = coalesce(p_detail, '{}'),
      updated_at = now() where id = v_id;
    perform private.glci_audit('issue.reopened', 'glci_issue', v_id::text, jsonb_build_object('key', p_issue_key), 'system');
  else
    update private.glci_issues set detail = coalesce(p_detail, '{}'), updated_at = now() where id = v_id and status in ('open', 'in_progress');
  end if;
  return v_id;
end;
$$;
revoke all on function private.glci_open_issue(text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;

create or replace function private.glci_propose(p_issue_id uuid, p_action_type text, p_proposal jsonb, p_rationale text,
  p_by_kind text default 'system')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into private.glci_remediation_proposals (issue_id, action_type, proposed_by_kind, proposed_by, proposal, rationale)
  values (p_issue_id, p_action_type, p_by_kind, case when p_by_kind = 'system' then null else private.current_principal_id() end,
    coalesce(p_proposal, '{}'), p_rationale)
  on conflict (issue_id, action_type) do nothing
  returning id into v_id;
  if v_id is not null then
    perform private.glci_audit('remediation.proposed', 'glci_proposal', v_id::text,
      jsonb_build_object('issueId', p_issue_id, 'action', p_action_type, 'by', p_by_kind), p_by_kind);
  end if;
  return v_id;
end;
$$;
revoke all on function private.glci_propose(uuid, text, jsonb, text, text) from public, anon, authenticated;

-- Scans every signal, opens or refreshes issues with their proposals, and resolves issues whose
-- condition has cleared. Idempotent: the worker runs it after each monitoring pass.
create or replace function public.glci_reconcile_issues()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_issue uuid;
  v_open text[] := '{}';
  v_resolved integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform private.glci_require_operator(); end if;

  -- Monitoring: integration failures and repeatedly unreachable sources.
  for v_row in select t.target_key, t.jurisdiction_code, t.name, t.source_id, s.last_outcome, s.consecutive_failures,
      (select o.failure_code from private.glci_observations o where o.target_id = t.id order by o.checked_at desc limit 1) as failure_code
    from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
    where t.status = 'active' and (s.last_outcome = 'integration_failure' or (s.last_outcome in ('unreachable', 'failed') and s.consecutive_failures >= 3)) loop
    if v_row.last_outcome = 'integration_failure' then
      v_issue := private.glci_open_issue('integration:' || v_row.target_key, v_row.jurisdiction_code, 'integration_failure', 'critical',
        'Njumeni no longer understands ' || v_row.name, jsonb_build_object('failureCode', v_row.failure_code), 'monitoring_target', v_row.target_key);
      perform private.glci_propose(v_issue, 'engineering_task',
        jsonb_build_object('targetKey', v_row.target_key, 'failureCode', v_row.failure_code,
          'instruction', 'Investigate the change in the official source format or API and update its monitor and ingestion adapter, with tests.'),
        'The source answered in a form the monitor no longer recognises (' || coalesce(v_row.failure_code, 'unknown') || '). The adapter needs an engineering change.');
      v_open := v_open || ('integration:' || v_row.target_key);
    else
      v_issue := private.glci_open_issue('unreachable:' || v_row.target_key, v_row.jurisdiction_code, 'source_unreachable', 'high',
        v_row.name || ' has not answered ' || v_row.consecutive_failures || ' checks in a row',
        jsonb_build_object('failureCode', v_row.failure_code, 'consecutiveFailures', v_row.consecutive_failures), 'monitoring_target', v_row.target_key);
      v_open := v_open || ('unreachable:' || v_row.target_key);
    end if;
  end loop;

  -- Knowledge lag: an upstream change after the source's last successful ingestion.
  for v_row in select t.target_key, t.jurisdiction_code, t.name, src.source_key, src.id as source_id, s.last_changed_at
    from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
    join private.legal_sources src on src.id = t.source_id
    where t.status = 'active' and s.last_changed_at is not null
      and coalesce((select max(r.finished_at) from private.legal_source_ingestion_runs r where r.source_id = t.source_id
        and r.status in ('succeeded', 'partial')), '-infinity') < s.last_changed_at loop
    v_issue := private.glci_open_issue('lag:' || v_row.target_key, v_row.jurisdiction_code, 'knowledge_lag', 'high',
      v_row.name || ' changed and Njumeni has not ingested it yet', jsonb_build_object('changedAt', v_row.last_changed_at, 'sourceKey', v_row.source_key),
      'monitoring_target', v_row.target_key);
    perform private.glci_propose(v_issue, 'resync_source', jsonb_build_object('sourceKey', v_row.source_key),
      'The official source changed on ' || v_row.last_changed_at::date || '. Re-synchronise it so research uses the current text.');
    v_open := v_open || ('lag:' || v_row.target_key);
  end loop;

  -- Legal changes awaiting review, with their impact.
  for v_row in select e.id, e.jurisdiction_code, e.change_type, a.citation, a.title, e.effective_date, e.commencement_status,
      (select count(*) from private.glci_change_impacts i where i.event_id = e.id and i.severity = 'high') as high_impacts,
      (select count(*) from private.glci_change_impacts i where i.event_id = e.id and i.impact_type = 'research_run') as runs
    from private.glci_change_events e join private.legal_authorities a on a.id = e.authority_id
    where not e.is_baseline and e.change_type in ('amended', 'withdrawn') and e.review_status in ('detected', 'assessed') loop
    v_issue := private.glci_open_issue('change:' || v_row.id, v_row.jurisdiction_code, 'legal_change_review',
      case when v_row.high_impacts > 0 then 'high' else 'medium' end,
      initcap(v_row.change_type) || ': ' || coalesce(v_row.citation, v_row.title),
      jsonb_build_object('changeEventId', v_row.id, 'effectiveDate', v_row.effective_date, 'commencementStatus', v_row.commencement_status,
        'highImpacts', v_row.high_impacts, 'researchRuns', v_row.runs), 'change_event', v_row.id::text);
    perform private.glci_propose(v_issue, 'review_change', jsonb_build_object('changeEventId', v_row.id),
      'A ' || v_row.change_type || ' change was detected. An operator confirms it (or dismisses a false positive).');
    if v_row.runs > 0 then
      perform private.glci_propose(v_issue, 'notify_affected', jsonb_build_object('changeEventId', v_row.id),
        v_row.runs || ' research run(s) relied on the changed text. Notify the affected workspaces so they re-verify.');
    end if;
    v_open := v_open || ('change:' || v_row.id);
  end loop;

  -- Conditions that cleared resolve their issues.
  with cleared as (
    update private.glci_issues set status = 'resolved', resolved_at = now(), updated_at = now(),
      resolution_note = coalesce(resolution_note, 'The condition cleared.')
    where status in ('open', 'in_progress') and not (issue_key = any (v_open)) returning id)
  select count(*) into v_resolved from cleared;
  if v_resolved > 0 then
    perform private.glci_audit('issue.auto_resolved', 'glci_issue', null, jsonb_build_object('count', v_resolved), 'system');
  end if;
  return jsonb_build_object('openConditions', cardinality(v_open), 'resolved', v_resolved);
end;
$$;

-- ------------------------------------------------------------------ approval and execution
create or replace function public.glci_decide_proposal(p_proposal_id uuid, p_decision text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_proposal private.glci_remediation_proposals;
begin
  perform private.glci_require_operator();
  select * into v_proposal from private.glci_remediation_proposals where id = p_proposal_id for update;
  if v_proposal.id is null then raise exception 'GLCI_PROPOSAL_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'proposed' or p_decision not in ('approved', 'rejected') then
    raise exception 'GLCI_DECISION_INVALID' using errcode = '22023';
  end if;
  if v_proposal.proposed_by is not null and v_proposal.proposed_by = private.current_principal_id() then
    raise exception 'GLCI_FOUR_EYES_REQUIRED' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) < 5 then raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023'; end if;
  update private.glci_remediation_proposals set status = p_decision, decided_by = private.current_principal_id(), decided_at = now(),
    decision_note = btrim(p_note) where id = p_proposal_id;
  update private.glci_issues set status = 'in_progress', updated_at = now() where id = v_proposal.issue_id and status = 'open' and p_decision = 'approved';
  perform private.glci_audit('remediation.' || p_decision, 'glci_proposal', p_proposal_id::text,
    jsonb_build_object('action', v_proposal.action_type, 'note', btrim(p_note)));
  return p_decision;
end;
$$;

create or replace function public.glci_execute_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_proposal private.glci_remediation_proposals;
  v_source private.legal_sources;
  v_event private.glci_change_events;
  v_result jsonb;
  v_count integer;
begin
  perform private.glci_require_operator();
  select * into v_proposal from private.glci_remediation_proposals where id = p_proposal_id for update;
  if v_proposal.id is null then raise exception 'GLCI_PROPOSAL_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'approved' then raise exception 'GLCI_PROPOSAL_NOT_APPROVED' using errcode = '42501'; end if;

  if v_proposal.action_type = 'resync_source' then
    select * into v_source from private.legal_sources where source_key = v_proposal.proposal ->> 'sourceKey';
    -- The ordinary ingestion gates decide: rights, activation, adapter pin.
    v_result := jsonb_build_object('ingestionJobId', public.legal_ingestion_enqueue_job(v_source.id, v_source.adapter_key, v_source.adapter_version,
      'glci-resync:' || p_proposal_id));
  elsif v_proposal.action_type = 'review_change' then
    update private.glci_change_events set review_status = 'confirmed' where id = (v_proposal.proposal ->> 'changeEventId')::uuid
      and review_status in ('detected', 'assessed');
    v_result := jsonb_build_object('reviewStatus', 'confirmed');
  elsif v_proposal.action_type = 'notify_affected' then
    select * into v_event from private.glci_change_events where id = (v_proposal.proposal ->> 'changeEventId')::uuid;
    insert into private.research_currency_notices (research_run_id, organization_id, workspace_id, change_event_id, severity, message, sections, effective_date)
    select r.id, r.organization_id, r.workspace_id, v_event.id, i.severity,
      'The law this research relied on has ' || case v_event.change_type when 'withdrawn' then 'been withdrawn from the official source'
        else 'been amended' end || coalesce(' (' || a.citation || ')', '') ||
        case when v_event.commencement_status = 'pending_commencement' then '; the change takes effect on ' || v_event.effective_date
          when v_event.effective_date is not null then '; in force from ' || v_event.effective_date else '' end ||
        '. Re-verify this research before relying on it.',
      coalesce((select array_agg(distinct x.section_key) from private.glci_change_impacts x where x.event_id = v_event.id
        and x.impact_type in ('research_finding', 'research_claim') and (x.dependency_path -> 2 ->> 'researchRun')::uuid = r.id
        and x.section_key is not null), '{}'),
      v_event.effective_date
    from private.glci_change_impacts i join private.research_runs r on r.id = i.subject_id
    join private.legal_authorities a on a.id = v_event.authority_id
    where i.event_id = v_event.id and i.impact_type = 'research_run'
    on conflict do nothing;
    get diagnostics v_count = row_count;
    v_result := jsonb_build_object('noticesCreated', v_count);
  else
    -- Engineering tasks run through the controlled Claude Code integration (GLCI-09).
    raise exception 'GLCI_EXECUTOR_NOT_AVAILABLE' using errcode = '0A000';
  end if;

  update private.glci_remediation_proposals set status = 'executed', executed_at = now(), execution_result = v_result where id = p_proposal_id;
  perform private.glci_audit('remediation.executed', 'glci_proposal', p_proposal_id::text,
    jsonb_build_object('action', v_proposal.action_type, 'result', v_result));
  return v_result;
end;
$$;

-- Operators can dismiss an issue with a reason (for example, a false positive).
create or replace function public.glci_dismiss_issue(p_issue_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if p_reason is null or char_length(btrim(p_reason)) < 10 then raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023'; end if;
  update private.glci_issues set status = 'dismissed', resolved_at = now(), updated_at = now(), resolution_note = btrim(p_reason)
    where id = p_issue_id and status in ('open', 'in_progress');
  if not found then raise exception 'GLCI_ISSUE_NOT_OPEN' using errcode = '22023'; end if;
  perform private.glci_audit('issue.dismissed', 'glci_issue', p_issue_id::text, jsonb_build_object('reason', btrim(p_reason)));
end;
$$;

create or replace function public.glci_issues_list(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'issueKey', i.issue_key, 'jurisdictionCode', i.jurisdiction_code,
      'kind', i.kind, 'severity', i.severity, 'status', i.status, 'title', i.title, 'detail', i.detail, 'openedAt', i.opened_at,
      'resolvedAt', i.resolved_at, 'resolutionNote', i.resolution_note,
      'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'actionType', p.action_type, 'proposedByKind', p.proposed_by_kind,
          'rationale', p.rationale, 'proposal', p.proposal, 'status', p.status, 'decisionNote', p.decision_note,
          'executionResult', p.execution_result) order by p.created_at)
        from private.glci_remediation_proposals p where p.issue_id = i.id), '[]'::jsonb))
    order by case i.severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, i.opened_at desc)
    from private.glci_issues i where p_status is null or i.status = p_status), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ customer-facing notices
create or replace function public.research_run_currency_notices(p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_run private.research_runs;
begin
  select * into v_run from private.research_runs where id = p_run_id;
  if not found then raise exception 'RESEARCH_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_research_scope(v_run.organization_id, v_run.workspace_id, 'research.read');
  return coalesce((select jsonb_agg(jsonb_build_object('severity', n.severity, 'message', n.message, 'sections', to_jsonb(n.sections),
      'effectiveDate', n.effective_date, 'createdAt', n.created_at) order by n.created_at desc)
    from private.research_currency_notices n where n.research_run_id = p_run_id), '[]'::jsonb);
end;
$$;

revoke all on function public.glci_reconcile_issues() from public, anon;
grant execute on function public.glci_reconcile_issues() to authenticated, service_role;
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_decide_proposal(uuid, text, text)', 'public.glci_execute_proposal(uuid)',
    'public.glci_dismiss_issue(uuid, text)', 'public.glci_issues_list(text)', 'public.research_run_currency_notices(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;

-- ------------------------------------------------------------------ GLCI-05 correction (knowledge lag)
create or replace function private.glci_jurisdiction_currency(p_jurisdiction_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_targets jsonb;
  v_active integer;
  v_unverified integer;
  v_lag jsonb;
  v_completeness jsonb;
  v_temporal jsonb;
  v_citations jsonb;
  v_missing integer;
  v_verdict text;
  v_reasons text[] := '{}';
begin
  select coalesce(jsonb_object_agg(c.currency, c.n), '{}'::jsonb), coalesce(sum(c.n) filter (where c.currency <> 'not_monitored'), 0),
    coalesce(sum(c.n) filter (where c.currency in ('not_checked', 'stale', 'check_failing', 'integration_failure')), 0)
  into v_targets, v_active, v_unverified
  from (select private.glci_target_currency(t.id) as currency, count(*) as n
    from private.glci_monitoring_targets t where t.jurisdiction_code = p_jurisdiction_code group by 1) c;

  -- Knowledge lag: the monitor saw a change after the source's last successful ingestion run.
  select coalesce(jsonb_agg(jsonb_build_object('targetKey', t.target_key, 'changedAt', s.last_changed_at, 'lastIngestedAt', ing.last_finished)), '[]'::jsonb)
  into v_lag
  from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
  left join lateral (select max(r.finished_at) as last_finished from private.legal_source_ingestion_runs r
    where r.source_id = t.source_id and r.status in ('succeeded', 'partial')) ing on true
  where t.jurisdiction_code = p_jurisdiction_code and t.status = 'active' and s.last_changed_at is not null
    and (ing.last_finished is null or ing.last_finished < s.last_changed_at);

  -- Completeness against each source's latest complete dataset, and the semantic index.
  select coalesce(jsonb_agg(jsonb_build_object('sourceKey', x.source_key, 'dataset', x.dataset, 'listed', x.listed, 'present', x.present,
      'missing', greatest(x.listed - x.present, 0), 'passagesWithoutEmbedding', x.unembedded)), '[]'::jsonb),
    coalesce(sum(greatest(x.listed - x.present, 0) + x.unembedded), 0)
  into v_completeness, v_missing
  from (select src.source_key, d.dataset, d.authorities_listed as listed,
      (select count(*) from private.legal_authorities a where a.source_id = src.id and a.source_metadata ->> 'dataset' = d.dataset
        and not (a.source_metadata ? 'absentFromDatasetSince'))::integer as present,
      (select count(*) from private.legal_authority_passages p join private.legal_authority_versions v on v.id = p.authority_version_id
        join private.legal_authorities a on a.id = v.authority_id
        where a.source_id = src.id and v.is_current_source_version and p.embedding is null)::integer as unembedded
    from private.legal_sources src
    join lateral (select distinct on (ds.dataset) ds.* from private.legal_source_dataset_syncs ds where ds.source_id = src.id
      order by ds.dataset, ds.completed_at desc) d on true
    where src.jurisdiction_code = p_jurisdiction_code) x;

  select jsonb_build_object(
    'unknownStatus', (select count(*) from private.legal_authorities a where a.jurisdiction_code = p_jurisdiction_code and a.legal_status = 'unknown'),
    'withdrawnFromSource', (select count(*) from private.legal_authorities a where a.jurisdiction_code = p_jurisdiction_code
      and a.source_metadata ? 'absentFromDatasetSince'),
    'pendingCommencement', (select count(*) from private.legal_authority_versions v join private.legal_authorities a on a.id = v.authority_id
      where a.jurisdiction_code = p_jurisdiction_code and v.is_current_source_version and v.valid_from > current_date),
    'withoutEffectiveDate', (select count(*) from private.legal_authority_versions v join private.legal_authorities a on a.id = v.authority_id
      where a.jurisdiction_code = p_jurisdiction_code and v.is_current_source_version and v.valid_from is null))
  into v_temporal;

  select jsonb_build_object(
    'claimsCitingSupersededText', (select count(*) from private.research_claims k join private.legal_authority_passages p on p.id = k.cited_passage_id
      join private.legal_authority_versions v on v.id = p.authority_version_id join private.legal_authorities a on a.id = v.authority_id
      where a.jurisdiction_code = p_jurisdiction_code and not v.is_current_source_version),
    'findingsCitingSupersededText', (select count(*) from private.research_findings f join private.legal_authority_versions v on v.id = f.authority_version_id
      join private.legal_authorities a on a.id = v.authority_id where a.jurisdiction_code = p_jurisdiction_code and not v.is_current_source_version),
    'openHighImpacts', (select count(*) from private.glci_change_impacts i join private.glci_change_events e on e.id = i.event_id
      where e.jurisdiction_code = p_jurisdiction_code and i.severity = 'high' and e.review_status in ('detected', 'assessed')))
  into v_citations;

  if v_active = 0 then
    v_verdict := 'not_monitored';
    v_reasons := array['No active monitoring target: Njumeni cannot say whether its knowledge is current.'];
  elsif v_unverified > 0 then
    v_verdict := 'unverified';
    v_reasons := array[v_unverified || ' monitored source(s) not verified (never checked, stale, failing or broken).'];
  else
    if jsonb_array_length(v_lag) > 0 then v_reasons := v_reasons || (jsonb_array_length(v_lag) || ' upstream change(s) not yet ingested.'); end if;
    if v_missing > 0 then v_reasons := v_reasons || (v_missing || ' missing authorities or unindexed passages.'); end if;
    if (v_citations ->> 'openHighImpacts')::integer > 0 then
      v_reasons := v_reasons || ((v_citations ->> 'openHighImpacts') || ' high-severity impact(s) of legal changes not yet resolved.');
    end if;
    if (v_citations ->> 'claimsCitingSupersededText')::integer > 0 then
      v_reasons := v_reasons || ((v_citations ->> 'claimsCitingSupersededText') || ' research claim(s) cite superseded text.');
    end if;
    v_verdict := case when cardinality(v_reasons) = 0 then 'current' else 'behind' end;
  end if;

  return jsonb_build_object('jurisdictionCode', p_jurisdiction_code, 'verdict', v_verdict, 'reasons', to_jsonb(v_reasons),
    'measuredAt', now(), 'targets', v_targets, 'knowledgeLag', v_lag, 'completeness', v_completeness,
    'temporalValidity', v_temporal, 'citationAccuracy', v_citations);
end;
$$;
revoke all on function private.glci_jurisdiction_currency(text) from public, anon, authenticated;
