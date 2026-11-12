-- GLCI-12: continuous monitoring and recovery testing (docs/GLCI_SPECIFICATION.md §8).
--
-- 1. Worker heartbeats (private.glci_worker_heartbeats). The monitoring worker reports each cycle.
-- 2. Alarms that do not depend on the worker. Reconciliation opens:
--      monitoring_overdue  an active target that was due more than an hour ago and was not checked;
--      worker_silent       overdue checks and no worker heartbeat for two hours.
--    Like every issue, they resolve themselves when the condition clears.
-- 3. Housekeeping tick (glci_tick). It reconciles issues; once a day it also verifies currency and
--    takes an audit checkpoint. It is scheduled hourly inside the database with pg_cron where the
--    extension exists, so alarms fire even when no worker runs. The worker also calls it each cycle.
-- 4. Recovery drill (glci_run_recovery_drill). It exercises the real functions against a synthetic
--    source inside a savepoint that is always rolled back, then keeps only the result
--    (private.glci_drill_runs). It is safe to run on production. Scenarios:
--      source outage, recovery after an outage, format change, replay/idempotency,
--      failed item and retry, overdue alarm, audit integrity.

alter table private.glci_issues drop constraint glci_issues_kind_check;
alter table private.glci_issues add constraint glci_issues_kind_check check (kind in ('integration_failure', 'source_unreachable',
  'knowledge_lag', 'legal_change_review', 'engineering_request', 'monitoring_overdue', 'worker_silent'));

create table private.glci_worker_heartbeats (
  worker_id text primary key check (worker_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  worker_kind text not null check (worker_kind in ('monitor', 'ingestion')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  cycles bigint not null default 0 check (cycles >= 0),
  last_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(last_summary) = 'object' and pg_column_size(last_summary) <= 8192)
);
alter table private.glci_worker_heartbeats enable row level security;
revoke all on private.glci_worker_heartbeats from public, anon, authenticated;
grant select on private.glci_worker_heartbeats to service_role;

create or replace function public.glci_worker_heartbeat(p_worker_id text, p_worker_kind text, p_summary jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.glci_worker_heartbeats (worker_id, worker_kind, last_seen_at, cycles, last_summary)
  values (p_worker_id, p_worker_kind, now(), 1, coalesce(p_summary, '{}'))
  on conflict (worker_id) do update set last_seen_at = now(), cycles = private.glci_worker_heartbeats.cycles + 1,
    worker_kind = excluded.worker_kind, last_summary = excluded.last_summary;
end;
$$;
revoke all on function public.glci_worker_heartbeat(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.glci_worker_heartbeat(text, text, jsonb) to service_role;

-- An active target is overdue when it was due more than an hour ago and nobody checked it since.
create or replace function private.glci_target_overdue(p_target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select t.status = 'active' and s.next_check_at < now() - interval '1 hour'
    and (s.lease_expires_at is null or s.lease_expires_at < now())
  from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id where t.id = p_target_id
$$;
revoke all on function private.glci_target_overdue(uuid) from public, anon, authenticated;

-- Reconciliation, carried forward from 20261113800000 with the two GLCI-12 alarms added.
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

  -- GLCI-12: active targets nobody has checked in time (the worker is down or blocked).
  for v_row in select t.target_key, t.jurisdiction_code, t.name, s.next_check_at, s.last_checked_at
    from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
    where t.status = 'active' and private.glci_target_overdue(t.id) loop
    v_issue := private.glci_open_issue('overdue:' || v_row.target_key, v_row.jurisdiction_code, 'monitoring_overdue', 'high',
      v_row.name || ' has not been checked since it was due',
      jsonb_build_object('dueAt', v_row.next_check_at, 'lastCheckedAt', v_row.last_checked_at), 'monitoring_target', v_row.target_key);
    v_open := v_open || ('overdue:' || v_row.target_key);
  end loop;
  -- The monitoring worker itself: overdue checks and no heartbeat for two hours.
  if exists (select 1 from private.glci_monitoring_targets t where t.status = 'active' and private.glci_target_overdue(t.id))
    and coalesce((select max(last_seen_at) from private.glci_worker_heartbeats where worker_kind = 'monitor'), '-infinity') < now() - interval '2 hours' then
    v_issue := private.glci_open_issue('worker:monitor', null, 'worker_silent', 'critical',
      'The monitoring worker has not reported for two hours',
      jsonb_build_object('lastHeartbeatAt', (select max(last_seen_at) from private.glci_worker_heartbeats where worker_kind = 'monitor')),
      'worker', 'monitor');
    v_open := v_open || 'worker:monitor'::text;
  end if;

  -- Conditions that cleared resolve their issues.
  with cleared as (
    update private.glci_issues set status = 'resolved', resolved_at = now(), updated_at = now(),
      resolution_note = coalesce(resolution_note, 'The condition cleared.')
    where status in ('open', 'in_progress') and kind <> 'engineering_request' and not (issue_key = any (v_open)) returning id)
  select count(*) into v_resolved from cleared;
  if v_resolved > 0 then
    perform private.glci_audit('issue.auto_resolved', 'glci_issue', null, jsonb_build_object('count', v_resolved), 'system');
  end if;
  return jsonb_build_object('openConditions', cardinality(v_open), 'resolved', v_resolved);
end;
$$;

-- ------------------------------------------------------------------ housekeeping tick
create table private.glci_scheduler_state (
  id boolean primary key default true check (id),
  last_tick_at timestamptz,
  last_tick_summary jsonb not null default '{}'::jsonb,
  ticks bigint not null default 0
);
insert into private.glci_scheduler_state (id) values (true) on conflict do nothing;
alter table private.glci_scheduler_state enable row level security;
revoke all on private.glci_scheduler_state from public, anon, authenticated;
grant select on private.glci_scheduler_state to service_role;

create or replace function public.glci_tick()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_summary jsonb := '{}'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform private.glci_require_operator(); end if;
  v_summary := v_summary || jsonb_build_object('reconcile', public.glci_reconcile_issues());
  if coalesce((select max(measured_at) from private.glci_currency_reports), '-infinity') < now() - interval '23 hours' then
    v_summary := v_summary || jsonb_build_object('currency', public.glci_run_currency_verification(null));
  end if;
  if exists (select 1 from private.glci_audit_events)
    and coalesce((select max(taken_at) from private.glci_audit_checkpoints where kind = 'checkpoint'), '-infinity') < now() - interval '23 hours' then
    v_summary := v_summary || jsonb_build_object('checkpoint', (public.glci_audit_checkpoint() ->> 'chainValid'));
  end if;
  update private.glci_scheduler_state set last_tick_at = now(), last_tick_summary = v_summary, ticks = ticks + 1;
  return v_summary;
end;
$$;
revoke all on function public.glci_tick() from public, anon;
grant execute on function public.glci_tick() to authenticated, service_role;

-- Hourly in the database when pg_cron exists (it does on Supabase); otherwise the worker's calls suffice.
do $schedule$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('glci-housekeeping', '17 * * * *',
      $cmd$select set_config('request.jwt.claim.role', 'service_role', false); select public.glci_tick();$cmd$);
  end if;
exception when others then
  raise notice 'GLCI housekeeping not scheduled in the database (%); the monitoring worker runs it', sqlerrm;
end;
$schedule$;

-- ------------------------------------------------------------------ recovery drill
create table private.glci_drill_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  passed boolean not null,
  scenarios jsonb not null check (jsonb_typeof(scenarios) = 'array'),
  requested_by uuid
);
create index glci_drill_runs_time_idx on private.glci_drill_runs(started_at desc);
alter table private.glci_drill_runs enable row level security;
revoke all on private.glci_drill_runs from public, anon, authenticated;
grant select on private.glci_drill_runs to service_role;
create trigger glci_drill_runs_append_only before update or delete on private.glci_drill_runs
  for each row execute function private.reject_append_only_mutation();

create or replace function public.glci_run_recovery_drill()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_started timestamptz := clock_timestamp();
  v_results jsonb := '[]'::jsonb;
  v_requested_by uuid := private.current_principal_id();
  v_target_id uuid;
  v_lease uuid;
  v_outcome text;
  v_ok boolean;
  v_detail text;
  v_i integer;
  v_issues_before integer;
  v_passed boolean;
  v_job uuid;
  v_fp constant text := encode(extensions.digest('glci-drill-v1', 'sha256'), 'hex');
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform private.glci_require_operator(); end if;
  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    -- A synthetic, rights-approved source and an active target that exist only inside this savepoint.
    insert into private.legal_sources (jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status)
    values ('NO', 'glci-drill-source', 'GLCI recovery drill source', 'Synthetic', 'legislation', 'https://drill.example.invalid/', 'api', 'approved');
    insert into private.glci_monitoring_targets (jurisdiction_code, target_key, name, target_type, official_uri, source_id, monitor_adapter_key, config, status)
    values ('NO', 'glci-drill-target', 'GLCI recovery drill target', 'legal_database', 'https://drill.example.invalid/',
      (select id from private.legal_sources where source_key = 'glci-drill-source'), 'json-listing',
      '{"listUrl":"https://drill.example.invalid/list","idField":"id"}', 'active')
    returning id into v_target_id;

    -- 1. Source outage: three failed checks open an unreachable-source issue; currency is not claimed.
    for v_i in 1 .. 3 loop
      update private.glci_target_state set next_check_at = now() - interval '1 second' where target_id = v_target_id;
      select c.lease_token into v_lease from public.glci_monitor_claim('glci-drill', 100, 60) c where c.target_key = 'glci-drill-target';
      perform public.glci_monitor_record('glci-drill-target', v_lease, null, '{}', 'UPSTREAM_5XX', 'unreachable', 1);
    end loop;
    perform public.glci_reconcile_issues();
    v_ok := exists (select 1 from private.glci_issues where issue_key = 'unreachable:glci-drill-target' and status = 'open')
      and private.glci_target_currency(v_target_id) = 'check_failing';
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'source_outage', 'passed', v_ok,
      'detail', 'Three failed checks: issue opened, currency check_failing (never current).'));

    -- 2. Recovery: a successful check resolves the outage issue and the target is verified again.
    update private.glci_target_state set next_check_at = now() - interval '1 second' where target_id = v_target_id;
    select c.lease_token into v_lease from public.glci_monitor_claim('glci-drill', 100, 60) c where c.target_key = 'glci-drill-target';
    v_outcome := public.glci_monitor_record('glci-drill-target', v_lease, v_fp, '{}', null, null, 1);
    perform public.glci_reconcile_issues();
    v_ok := (select status from private.glci_issues where issue_key = 'unreachable:glci-drill-target') = 'resolved'
      and private.glci_target_currency(v_target_id) in ('verified', 'changed');
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'outage_recovery', 'passed', v_ok,
      'detail', 'Successful check (' || v_outcome || '): outage issue resolved automatically.'));

    -- 3. Format change: an integration failure opens a critical issue with an engineering proposal.
    update private.glci_target_state set next_check_at = now() - interval '1 second' where target_id = v_target_id;
    select c.lease_token into v_lease from public.glci_monitor_claim('glci-drill', 100, 60) c where c.target_key = 'glci-drill-target';
    perform public.glci_monitor_record('glci-drill-target', v_lease, null, '{}', 'GLCI_FEED_NOT_JSON', 'integration_failure', 1);
    perform public.glci_reconcile_issues();
    v_ok := exists (select 1 from private.glci_issues i join private.glci_remediation_proposals p on p.issue_id = i.id
      where i.issue_key = 'integration:glci-drill-target' and i.severity = 'critical' and p.action_type = 'engineering_task');
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'format_change', 'passed', v_ok,
      'detail', 'Integration failure: critical issue and engineering task proposed.'));

    -- 4. Replay: the same listing twice is unchanged; reconciling twice opens nothing new.
    update private.glci_target_state set next_check_at = now() - interval '1 second' where target_id = v_target_id;
    select c.lease_token into v_lease from public.glci_monitor_claim('glci-drill', 100, 60) c where c.target_key = 'glci-drill-target';
    perform public.glci_monitor_record('glci-drill-target', v_lease, v_fp, '{}', null, null, 1);
    update private.glci_target_state set next_check_at = now() - interval '1 second' where target_id = v_target_id;
    select c.lease_token into v_lease from public.glci_monitor_claim('glci-drill', 100, 60) c where c.target_key = 'glci-drill-target';
    v_outcome := public.glci_monitor_record('glci-drill-target', v_lease, v_fp, '{}', null, null, 1);
    perform public.glci_reconcile_issues();
    select count(*) into v_issues_before from private.glci_issues;
    perform public.glci_reconcile_issues();
    v_ok := v_outcome = 'unchanged' and (select count(*) from private.glci_issues) = v_issues_before
      and (select status from private.glci_issues where issue_key = 'integration:glci-drill-target') = 'resolved';
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'replay_idempotency', 'passed', v_ok,
      'detail', 'Replayed listing: ' || v_outcome || '; repeated reconciliation adds nothing; the format issue resolved after recovery.'));

    -- 5. Failed sync item and retry: a retryable failure is queued, retried when due and resolved.
    update private.legal_sources set status = 'active', ingestion_enabled = true, licence_identifier = 'DRILL', attribution_text = 'Drill',
      adapter_key = 'glci-drill-adapter', adapter_version = '1.0.0' where source_key = 'glci-drill-source';
    insert into private.legal_source_rights_evidence (source_id, terms_uri, reviewed_by, reviewed_at, permissions)
    values ((select id from private.legal_sources where source_key = 'glci-drill-source'), 'https://drill.example.invalid/terms', 'drill', now(),
      '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":false}');
    v_job := public.legal_ingestion_enqueue_job((select id from private.legal_sources where source_key = 'glci-drill-source'),
      'glci-drill-adapter', '1.0.0', 'glci-drill-job');
    select c.lease_token into v_lease from public.legal_ingestion_claim_job('glci-drill', 60) c where c.job_id = v_job;
    perform public.legal_ingestion_record_item_outcome('glci-drill-source', 'DRILL/1', false, 'NETWORK_TIMEOUT', 'retryable', v_job, v_lease);
    update private.legal_ingestion_item_failures set next_attempt_at = now() - interval '1 second' where external_id = 'DRILL/1';
    v_ok := 'DRILL/1' = any (public.legal_ingestion_due_item_retries('glci-drill-source'));
    perform public.legal_ingestion_record_item_outcome('glci-drill-source', 'DRILL/1', true, null, null, v_job, v_lease);
    v_ok := v_ok and (select status from private.legal_ingestion_item_failures where external_id = 'DRILL/1') = 'resolved';
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'failed_sync_retry', 'passed', v_ok,
      'detail', 'A retryable item failure is listed for retry when due and resolved on success.'));

    -- 6. Overdue alarm: a target nobody checks raises an alarm without any worker involvement.
    update private.glci_target_state set next_check_at = now() - interval '3 hours', lease_token = null, lease_owner = null, lease_expires_at = null
      where target_id = v_target_id;
    perform public.glci_reconcile_issues();
    v_ok := exists (select 1 from private.glci_issues where issue_key = 'overdue:glci-drill-target' and status = 'open');
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'overdue_alarm', 'passed', v_ok,
      'detail', 'A target due three hours ago raises a monitoring_overdue issue from the database alone.'));

    -- 7. Audit integrity throughout.
    v_ok := (private.glci_audit_integrity() ->> 'chainValid')::boolean and (private.glci_audit_integrity() ->> 'checkpointsMatch')::boolean;
    v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'audit_integrity', 'passed', v_ok,
      'detail', 'The GLCI audit chain verifies and agrees with every checkpoint.'));

    raise exception 'GLCI_DRILL_ROLLBACK';
  exception when others then
    if sqlerrm <> 'GLCI_DRILL_ROLLBACK' then
      v_results := v_results || jsonb_build_array(jsonb_build_object('scenario', 'drill_error', 'passed', false, 'detail', left(sqlerrm, 300)));
    end if;
  end;
  -- Everything above is rolled back; only the result is kept.
  v_passed := jsonb_array_length(v_results) >= 7 and not exists (select 1 from jsonb_array_elements(v_results) r where not (r ->> 'passed')::boolean);
  insert into private.glci_drill_runs (started_at, finished_at, passed, scenarios, requested_by)
  values (v_started, clock_timestamp(), v_passed, v_results, v_requested_by);
  perform private.glci_audit('drill.' || case when v_passed then 'passed' else 'failed' end, 'recovery_drill', null,
    jsonb_build_object('scenarios', jsonb_array_length(v_results)), case when v_requested_by is null then 'system' else 'operator' end);
  return jsonb_build_object('passed', v_passed, 'scenarios', v_results);
end;
$$;
revoke all on function public.glci_run_recovery_drill() from public, anon;
grant execute on function public.glci_run_recovery_drill() to authenticated, service_role;

create or replace function public.glci_continuous_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return jsonb_build_object(
    'scheduler', (select jsonb_build_object('lastTickAt', last_tick_at, 'ticks', ticks, 'lastSummary', last_tick_summary) from private.glci_scheduler_state),
    'databaseSchedule', exists (select 1 from pg_extension where extname = 'pg_cron'),
    'workers', coalesce((select jsonb_agg(jsonb_build_object('workerId', worker_id, 'kind', worker_kind, 'lastSeenAt', last_seen_at, 'cycles', cycles)
      order by last_seen_at desc) from private.glci_worker_heartbeats), '[]'::jsonb),
    'overdueTargets', coalesce((select jsonb_agg(t.target_key order by t.target_key) from private.glci_monitoring_targets t
      where private.glci_target_overdue(t.id)), '[]'::jsonb),
    'drills', coalesce((select jsonb_agg(jsonb_build_object('startedAt', d.started_at, 'passed', d.passed, 'scenarios', d.scenarios) order by d.started_at desc)
      from (select * from private.glci_drill_runs order by started_at desc limit 5) d), '[]'::jsonb));
end;
$$;
revoke all on function public.glci_continuous_status() from public, anon;
grant execute on function public.glci_continuous_status() to authenticated, service_role;
