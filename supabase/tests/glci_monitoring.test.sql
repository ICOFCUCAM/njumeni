-- GLCI-02: monitoring claims, observations, outcome classification, currency status and
-- change-to-ingestion hand-off. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c2000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-monitor-operator@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'c2000000-0000-4000-8000-0000000000a1';
create temporary table k (key text primary key, value text) on commit drop;
grant all on k to authenticated;
create function pg_temp.claim() returns uuid language sql as $$
  select lease_token from public.glci_monitor_claim('pgtap-monitor', 10, 60) where target_key = 'no-lovdata-current-laws'
$$;
create function pg_temp.fp(p text) returns text language sql as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

select is((select count(*)::int from private.glci_target_state), (select count(*)::int from private.glci_monitoring_targets),
  'every monitoring target has a state row');
select is((select count(*)::int from public.glci_monitor_claim('pgtap-monitor', 10, 60)), 0, 'inactive targets are never claimed');

update private.glci_monitoring_targets set status = 'active' where target_key = 'no-lovdata-current-laws';
select is(private.glci_target_currency((select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws')),
  'not_checked', 'an active target that was never checked is "not checked", not current');

insert into k values ('lease1', pg_temp.claim()::text);
select isnt((select value from k where key = 'lease1'), null, 'a due active target is leased to a worker');
select is((select count(*)::int from public.glci_monitor_claim('other-worker', 10, 60)), 0, 'a leased target is not claimed twice');
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease1'), pg_temp.fp('v1'),
  '{"lastModified":"2026-11-11T02:32:00Z","sizeBytes":5809848}', null, null, 120), 'first_seen', 'the first successful check is first_seen');
select throws_ok($$select public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease1'),
  pg_temp.fp('v1'), '{}', null, null, 1)$$, 'GLCI_MONITOR_LEASE_LOST', 'a finished lease cannot record again');
select is(private.glci_target_currency((select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws')),
  'verified', 'the first successful check establishes a verified baseline');

-- unchanged
update private.glci_target_state set next_check_at = now() - interval '1 second';
insert into k values ('lease2', pg_temp.claim()::text);
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease2'), pg_temp.fp('v1'), '{}', null, null, 80),
  'unchanged', 'the same fingerprint is unchanged');
select is(private.glci_target_currency((select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws')),
  'verified', 'a recent successful, unchanged check is verified');
select ok((select next_check_at > now() + interval '23 hours' from private.glci_target_state s join private.glci_monitoring_targets t on t.id = s.target_id
  where t.target_key = 'no-lovdata-current-laws'), 'the next check follows the jurisdiction schedule (daily for Norway)');

-- the source goes dark (J-GLCI-2)
update private.glci_target_state set next_check_at = now() - interval '1 second';
insert into k values ('lease3', pg_temp.claim()::text);
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease3'), null, '{"httpStatus":503}',
  'UPSTREAM_5XX', 'unreachable', 30000), 'unreachable', 'an unreachable source is recorded as unreachable');
select is(private.glci_target_currency((select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws')),
  'check_failing', 'a failing source is never reported as current, even though nothing changed');
select ok((select next_check_at < now() + interval '1 hour' and consecutive_failures = 1 from private.glci_target_state s
  join private.glci_monitoring_targets t on t.id = s.target_id where t.target_key = 'no-lovdata-current-laws'), 'failures are retried sooner');

-- the source changes its format (J-GLCI-3)
update private.glci_target_state set next_check_at = now() - interval '1 second';
insert into k values ('lease4', pg_temp.claim()::text);
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease4'), null, '{}',
  'LOVDATA_LISTING_SCHEMA_CHANGED', 'integration_failure', 50), 'integration_failure', 'a format change is an integration failure');
select is(private.glci_target_currency((select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws')),
  'integration_failure', 'the integration failure is visible in the currency status');

-- staleness
update private.glci_target_state set next_check_at = now() - interval '1 second';
insert into k values ('lease5', pg_temp.claim()::text);
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease5'), pg_temp.fp('v1'), '{}', null, null, 70),
  'unchanged', 'recovery: the source answers again, unchanged');
update private.glci_target_state set last_success_at = now() - interval '3 days'
  where target_id = (select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws');
select is(private.glci_target_currency((select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws')),
  'stale', 'a check older than the jurisdiction''s stale window is stale');

-- a change on a source that is not enabled for ingestion
update private.glci_target_state set next_check_at = now() - interval '1 second';
insert into k values ('lease6', pg_temp.claim()::text);
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease6'), pg_temp.fp('v2'), '{}', null, null, 70),
  'changed', 'a new fingerprint is a change');
select is((select ingestion_note from private.glci_observations where outcome = 'changed' and fingerprint = pg_temp.fp('v2')),
  'Change detected; source not enabled for ingestion, nothing queued', 'nothing is ingested from a source that is not enabled');

-- a change on an enabled source queues ingestion (continuous change ingestion)
select lives_ok(format($$select public.legal_source_record_rights_review((select id from private.legal_sources where source_key = 'lovdata-official'),
  'pgTAP reviewer', 'NLOD-2.0', '2.0', 'https://api.lovdata.no/', %L, now() - interval '1 minute', now() + interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":true}'::jsonb)$$,
  (private.legal_source_licence_policy((select id from private.legal_sources where source_key = 'lovdata-official'))).attribution_text),
  'the Lovdata rights review is recorded (test only)');
select lives_ok($$select public.legal_source_set_activation((select id from private.legal_sources where source_key = 'lovdata-official'),
  'pgTAP operator', 'Activation for the GLCI monitoring test', 'active', true, 'lovdata-public-data', '1.1.0')$$, 'Lovdata is enabled (test only)');
update private.glci_target_state set next_check_at = now() - interval '1 second';
insert into k values ('lease7', pg_temp.claim()::text);
select is(public.glci_monitor_record('no-lovdata-current-laws', (select value::uuid from k where key = 'lease7'), pg_temp.fp('v3'), '{}', null, null, 70),
  'changed', 'another change is detected');
select is((select j.idempotency_key from private.glci_observations o join private.legal_source_ingestion_jobs j on j.id = o.ingestion_job_id
  where o.fingerprint = pg_temp.fp('v3')), 'glci:no-lovdata-current-laws:' || pg_temp.fp('v3'), 'the change queued an idempotent ingestion job');

-- operators, customers and the audit trail
select is((select array_agg(event_type order by sequence_number) from private.glci_audit_events where event_type like 'monitor.%'),
  array['monitor.first_seen', 'monitor.unreachable', 'monitor.integration_failure', 'monitor.changed', 'monitor.changed'],
  'every outcome except "unchanged" is audited, in order');
set local role authenticated;
set local request.jwt.claim.sub = 'c2000000-0000-4000-8000-0000000000a1';
select is((select r ->> 'currency' from jsonb_array_elements(public.glci_monitoring_status()) r where r ->> 'targetKey' = 'no-lovdata-current-laws'),
  'changed', 'operators see the currency status of every target');
reset role;
select throws_ok($$select public.glci_monitor_record('no-lovdata-current-laws', gen_random_uuid(), null, '{}', 'X', 'unreachable', 1)$$,
  'GLCI_MONITOR_LEASE_LOST', 'a result without a valid lease is refused');

select * from finish();
rollback;
