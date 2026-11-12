-- GLCI-12: worker heartbeats, overdue and worker-silent alarms, housekeeping tick, recovery drill.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('cc000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-cm-op@example.invalid', now(), now()),
  ('cc000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-cm-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'cc000000-0000-4000-8000-0000000000a1';

select ok(exists (select 1 from cron.job where jobname = 'glci-housekeeping' and schedule = '17 * * * *'),
  'housekeeping is scheduled hourly inside the database');

-- An active target that nobody checks.
update private.glci_monitoring_targets set status = 'active' where target_key = 'no-lovdata-current-laws';
update private.glci_target_state set next_check_at = now() - interval '3 hours'
  where target_id = (select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws');
set local request.jwt.claim.role = 'service_role';
select lives_ok($$select public.glci_tick()$$, 'the scheduler runs housekeeping with the service role');
select is((select status || '/' || severity from private.glci_issues where issue_key = 'overdue:no-lovdata-current-laws'), 'open/high',
  'an overdue active source raises an alarm without any worker');
select is((select status || '/' || severity from private.glci_issues where issue_key = 'worker:monitor'), 'open/critical',
  'with no worker heartbeat, the silent worker is a critical issue');
select ok((select ticks >= 1 and last_tick_at is not null from private.glci_scheduler_state), 'the tick is recorded');
select ok((select last_tick_summary ? 'currency' and last_tick_summary ? 'checkpoint' from private.glci_scheduler_state),
  'the first tick of the day verifies currency and takes an audit checkpoint');
select ok(not ((public.glci_tick()) ? 'currency'), 'later ticks the same day only reconcile');

-- The worker comes back.
select lives_ok($$select public.glci_worker_heartbeat('monitor-1', 'monitor', '{"checked":1}')$$, 'the worker reports a heartbeat');
select public.glci_worker_heartbeat('monitor-1', 'monitor', '{"checked":2}');
select is((select cycles from private.glci_worker_heartbeats where worker_id = 'monitor-1'), 2::bigint, 'heartbeats count cycles');
update private.glci_target_state set next_check_at = now() + interval '1 hour'
  where target_id = (select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws');
select public.glci_tick();
select is((select status from private.glci_issues where issue_key = 'overdue:no-lovdata-current-laws'), 'resolved',
  'the overdue alarm resolves once the source is checked');
select is((select status from private.glci_issues where issue_key = 'worker:monitor'), 'resolved', 'and so does the silent-worker alarm');
set local request.jwt.claim.role = '';

-- Recovery drill.
set local role authenticated;
set local request.jwt.claim.sub = 'cc000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_run_recovery_drill()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot run drills');
select throws_ok($$select public.glci_worker_heartbeat('x', 'monitor', '{}')$$, '42501', 'permission denied for function glci_worker_heartbeat',
  'only the service role reports heartbeats');
set local request.jwt.claim.sub = 'cc000000-0000-4000-8000-0000000000a1';
create temporary table drill on commit drop as select public.glci_run_recovery_drill() as result;
reset role;
select ok((select (result ->> 'passed')::boolean from drill), 'the recovery drill passes');
select is((select array_agg(s.value ->> 'scenario' order by s.ordinality) from drill, jsonb_array_elements(result -> 'scenarios') with ordinality s),
  array['source_outage', 'outage_recovery', 'format_change', 'replay_idempotency', 'failed_sync_retry', 'overdue_alarm', 'audit_integrity'],
  'it covers outage, recovery, format change, replay, retry, overdue and audit integrity');
select is((select count(*)::int from private.legal_sources where source_key = 'glci-drill-source')
  + (select count(*)::int from private.glci_issues where issue_key like '%glci-drill-target'), 0, 'everything the drill did is rolled back');
select is((select count(*)::int from private.glci_drill_runs where passed and started_at >= now()), 1, 'only the result is kept');

select * from finish();
rollback;
