-- GLCI-09: controlled Claude Code execution of engineering tasks (docs/GLCI_SPECIFICATION.md §5).
--
-- An approved engineering proposal becomes an engineering task. The application hands it to:
--   1. the owner's Claude Code routine (same routine as the command centre, task kind
--      "njumeni-glci-engineering-task"), or, when that is unavailable,
--   2. the "GLCI engineering task" GitHub Actions workflow (anthropics/claude-code-action).
-- Either executor works on its own branch (glci/task-<id>), runs the repository's checks and opens a
-- pull request. It never pushes to protected branches, never deploys and never changes the hosted
-- database. It reports back through glci_engineering_task_report (service role). Merging and
-- deployment stay with the owner's normal review and deployment approval.
-- The task row holds the current state; every transition is kept in an append-only event history.

create table private.glci_engineering_tasks (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references private.glci_remediation_proposals(id) on delete restrict,
  issue_id uuid not null references private.glci_issues(id) on delete restrict,
  jurisdiction_code text references private.jurisdictions(code) on delete restrict,
  target_key text,
  instruction text not null check (char_length(instruction) between 10 and 4000),
  branch_name text not null unique check (branch_name ~ '^glci/task-[0-9a-f]{8}$'),
  status text not null default 'queued' check (status in ('queued', 'dispatched', 'running', 'pr_opened', 'failed', 'cancelled')),
  executor text check (executor is null or executor in ('claude_code_routine', 'github_action')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  session_url text check (session_url is null or (session_url ~ '^https://' and char_length(session_url) <= 2048)),
  pull_request_url text check (pull_request_url is null or pull_request_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$'),
  last_error text check (last_error is null or last_error ~ '^[A-Z0-9_]{1,80}$'),
  summary text check (summary is null or char_length(summary) <= 4000),
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index glci_engineering_tasks_status_idx on private.glci_engineering_tasks(status, created_at desc);
create index glci_engineering_tasks_issue_idx on private.glci_engineering_tasks(issue_id);
create index glci_engineering_tasks_jurisdiction_idx on private.glci_engineering_tasks(jurisdiction_code);
alter table private.glci_engineering_tasks enable row level security;
revoke all on private.glci_engineering_tasks from public, anon, authenticated;
grant select on private.glci_engineering_tasks to service_role;

create table private.glci_engineering_task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references private.glci_engineering_tasks(id) on delete restrict,
  status text not null,
  executor text,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 8192),
  occurred_at timestamptz not null default now()
);
create index glci_engineering_task_events_task_idx on private.glci_engineering_task_events(task_id, id);
alter table private.glci_engineering_task_events enable row level security;
revoke all on private.glci_engineering_task_events from public, anon, authenticated;
grant select on private.glci_engineering_task_events to service_role;
create trigger glci_engineering_task_events_append_only before update or delete on private.glci_engineering_task_events
  for each row execute function private.reject_append_only_mutation();

create or replace function private.glci_engineering_transition(p_task_id uuid, p_status text, p_executor text, p_detail jsonb, p_actor_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.glci_engineering_task_events (task_id, status, executor, detail) values (p_task_id, p_status, p_executor, coalesce(p_detail, '{}'));
  perform private.glci_audit('engineering.' || p_status, 'engineering_task', p_task_id::text,
    jsonb_build_object('executor', p_executor) || coalesce(p_detail, '{}'), p_actor_kind);
end;
$$;
revoke all on function private.glci_engineering_transition(uuid, text, text, jsonb, text) from public, anon, authenticated;

create or replace function private.glci_create_engineering_task(p_proposal private.glci_remediation_proposals)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_issue private.glci_issues;
begin
  select * into v_issue from private.glci_issues where id = p_proposal.issue_id;
  insert into private.glci_engineering_tasks (id, proposal_id, issue_id, jurisdiction_code, target_key, instruction, branch_name, approved_by)
  values (v_id, p_proposal.id, p_proposal.issue_id, coalesce(p_proposal.proposal ->> 'jurisdictionCode', v_issue.jurisdiction_code),
    coalesce(p_proposal.proposal ->> 'targetKey', v_issue.detail ->> 'targetKey'),
    left(coalesce(p_proposal.proposal ->> 'instruction', p_proposal.rationale), 4000),
    'glci/task-' || left(replace(v_id::text, '-', ''), 8), p_proposal.decided_by);
  perform private.glci_engineering_transition(v_id, 'queued', null, jsonb_build_object('proposalId', p_proposal.id), 'operator');
  return v_id;
end;
$$;
revoke all on function private.glci_create_engineering_task(private.glci_remediation_proposals) from public, anon, authenticated;

-- The brief an executor receives: the task, the failing source and its recent evidence.
create or replace function public.glci_engineering_task_brief(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_task private.glci_engineering_tasks;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform private.glci_require_operator(); end if;
  select * into v_task from private.glci_engineering_tasks where id = p_task_id;
  if v_task.id is null then raise exception 'GLCI_ENGINEERING_TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'kind', 'njumeni-glci-engineering-task', 'taskId', v_task.id, 'branch', v_task.branch_name,
    'jurisdictionCode', v_task.jurisdiction_code, 'targetKey', v_task.target_key, 'instruction', v_task.instruction,
    'target', (select jsonb_build_object('name', t.name, 'officialUri', t.official_uri, 'monitorAdapter', t.monitor_adapter_key,
        'config', t.config, 'sourceKey', s.source_key, 'ingestionAdapter', s.adapter_key, 'ingestionAdapterVersion', s.adapter_version)
      from private.glci_monitoring_targets t left join private.legal_sources s on s.id = t.source_id where t.target_key = v_task.target_key),
    'recentObservations', coalesce((select jsonb_agg(jsonb_build_object('checkedAt', o.checked_at, 'outcome', o.outcome,
        'failureCode', o.failure_code, 'observed', o.observed) order by o.checked_at desc)
      from (select o.* from private.glci_observations o join private.glci_monitoring_targets t on t.id = o.target_id
        where t.target_key = v_task.target_key order by o.checked_at desc limit 10) o), '[]'::jsonb),
    'recentIngestionFailures', coalesce((select jsonb_agg(jsonb_build_object('externalId', f.external_id, 'failureCode', f.failure_code,
        'attempts', f.attempts, 'status', f.status))
      from (select f.* from private.legal_ingestion_item_failures f join private.glci_monitoring_targets t on t.source_id = f.source_id
        where t.target_key = v_task.target_key order by f.last_failed_at desc limit 20) f), '[]'::jsonb));
end;
$$;

-- The application records which executor accepted the task.
create or replace function public.glci_engineering_task_dispatched(p_task_id uuid, p_executor text, p_session_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  update private.glci_engineering_tasks set status = 'dispatched', executor = p_executor, session_url = p_session_url,
    attempts = attempts + 1, last_error = null, updated_at = now()
  where id = p_task_id and status in ('queued', 'failed');
  if not found then raise exception 'GLCI_ENGINEERING_TASK_NOT_DISPATCHABLE' using errcode = '22023'; end if;
  perform private.glci_engineering_transition(p_task_id, 'dispatched', p_executor, jsonb_build_object('sessionUrl', p_session_url), 'operator');
end;
$$;

create or replace function public.glci_engineering_task_dispatch_failed(p_task_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  update private.glci_engineering_tasks set status = 'failed', last_error = p_error, updated_at = now()
  where id = p_task_id and status in ('queued', 'failed');
  if not found then raise exception 'GLCI_ENGINEERING_TASK_NOT_DISPATCHABLE' using errcode = '22023'; end if;
  perform private.glci_engineering_transition(p_task_id, 'failed', null, jsonb_build_object('error', p_error), 'operator');
end;
$$;

-- Executors report progress (service role: the Claude Code routine's database connector, or the
-- GitHub workflow's reporting step).
create or replace function public.glci_engineering_task_report(p_task_id uuid, p_status text, p_pull_request_url text, p_summary text,
  p_error text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_task private.glci_engineering_tasks;
begin
  select * into v_task from private.glci_engineering_tasks where id = p_task_id for update;
  if v_task.id is null then raise exception 'GLCI_ENGINEERING_TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_task.status not in ('dispatched', 'running') or p_status not in ('running', 'pr_opened', 'failed')
    or (p_status = 'pr_opened' and p_pull_request_url is null) or (p_status = 'failed' and p_error is null) then
    raise exception 'GLCI_ENGINEERING_REPORT_INVALID' using errcode = '22023';
  end if;
  update private.glci_engineering_tasks set status = p_status, pull_request_url = coalesce(p_pull_request_url, pull_request_url),
    summary = coalesce(left(p_summary, 4000), summary), last_error = p_error, updated_at = now()
  where id = p_task_id;
  perform private.glci_engineering_transition(p_task_id, p_status, v_task.executor,
    jsonb_build_object('pullRequestUrl', p_pull_request_url, 'error', p_error), 'engineering_agent');
  return p_status;
end;
$$;

create or replace function public.glci_engineering_tasks_list(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status, 'executor', t.executor, 'branch', t.branch_name,
      'jurisdictionCode', t.jurisdiction_code, 'targetKey', t.target_key, 'instruction', t.instruction, 'attempts', t.attempts,
      'sessionUrl', t.session_url, 'pullRequestUrl', t.pull_request_url, 'lastError', t.last_error, 'summary', t.summary,
      'createdAt', t.created_at, 'updatedAt', t.updated_at) order by t.created_at desc)
    from (select * from private.glci_engineering_tasks order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) t), '[]'::jsonb);
end;
$$;

-- Approved engineering proposals now create tasks. Carried forward from 20261113700000 with only
-- the engineering branch changed (it previously refused with GLCI_EXECUTOR_NOT_AVAILABLE).
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
    -- Engineering task: queued for the controlled runner (Claude Code routine, else GitHub Action).
    v_result := jsonb_build_object('engineeringTaskId', private.glci_create_engineering_task(v_proposal));
  end if;

  update private.glci_remediation_proposals set status = 'executed', executed_at = now(), execution_result = v_result where id = p_proposal_id;
  perform private.glci_audit('remediation.executed', 'glci_proposal', p_proposal_id::text,
    jsonb_build_object('action', v_proposal.action_type, 'result', v_result));
  return v_result;
end;
$$;


revoke all on function public.glci_engineering_task_report(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.glci_engineering_task_report(uuid, text, text, text, text) to service_role;
revoke all on function public.glci_engineering_task_brief(uuid) from public, anon;
grant execute on function public.glci_engineering_task_brief(uuid) to authenticated, service_role;
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_engineering_task_dispatched(uuid, text, text)',
    'public.glci_engineering_task_dispatch_failed(uuid, text)', 'public.glci_engineering_tasks_list(integer)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
