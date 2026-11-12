-- GLCI-11: governance policy, two-person approvals, deployment register, audit checkpoints and exports.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('cb000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-gov-a@example.invalid', now(), now()),
  ('cb000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'glci-gov-b@example.invalid', now(), now()),
  ('cb000000-0000-4000-8000-0000000000ad', 'authenticated', 'authenticated', 'glci-gov-admin@example.invalid', now(), now()),
  ('cb000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-gov-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, case when pi.auth_user_id = 'cb000000-0000-4000-8000-0000000000ad' then 'platform_admin' else 'knowledge_admin' end
from private.principal_identities pi
where pi.auth_user_id in ('cb000000-0000-4000-8000-0000000000a1', 'cb000000-0000-4000-8000-0000000000a2', 'cb000000-0000-4000-8000-0000000000ad');
create temporary table k (key text primary key, value text) on commit drop;
grant all on k to authenticated, service_role;
create function pg_temp.as_user(p_user text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user, true);
end;
$$;

select ok((select require_two_person from private.glci_governance_policy), 'two-person approval is the default');
select is((select array_agg(m.version order by m.version) from supabase_migrations.schema_migrations m where m.version < '20261114300000'
  and not exists (select 1 from private.glci_deployments d where d.reference = m.version and d.outcome = 'backfilled')), null,
  'every migration applied before the register is backfilled; later ones are recorded by their deployments');

-- monitoring activation needs an approval
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.glci_set_target_status('no-lovdata-current-laws', 'active', 'Start monitoring Lovdata now')$$,
  'GLCI_APPROVAL_REQUIRED', 'a target can no longer be activated directly');
insert into k select 'activate', public.glci_request_action('activate_target', 'no-lovdata-current-laws', '{}', 'Start monitoring the NLOD dataset')::text;
select throws_ok($$select public.glci_decide_action((select value::uuid from k where key = 'activate'), 'approved', 'I approve my own request')$$,
  'GLCI_FOUR_EYES_REQUIRED', 'the requester cannot approve it');
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a2');
select is(public.glci_decide_action((select value::uuid from k where key = 'activate'), 'approved', 'Second operator approves') ->> 'status', 'approved',
  'a second operator approves');
reset role;
select is((select status from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws'), 'active', 'and the target is activated');
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a1');
insert into k select 'bad', public.glci_request_action('activate_target', 'se-riksdagen', '{}', 'Monitor the Riksdag without a review')::text;
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a2');
select throws_ok($$select public.glci_decide_action((select value::uuid from k where key = 'bad'), 'approved', 'Approve anyway')$$,
  'GLCI_TARGET_ACTIVATION_NOT_PERMITTED', 'approval cannot bypass the lawful-basis rule');

-- policy changes
select throws_ok($$select public.glci_set_governance_policy(false, 'The knowledge admin wants to work alone')$$, 'GLCI_NOT_AUTHORISED',
  'only a platform admin can change the governance policy');
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000ad');
select throws_ok($$select public.glci_set_governance_policy(false, 'solo')$$, 'GLCI_REASON_REQUIRED', 'a substantive reason is required');
select lives_ok($$select public.glci_set_governance_policy(false, 'Single-owner company until a second operator joins')$$,
  'solo-owner mode is switched on by a platform admin');

-- solo mode: self-approval is allowed and recorded
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a1');
insert into k select 'deploy', public.glci_request_action('production_deployment', '20261114300000',
  '{"kind":"database_migration","reference":"20261114300000"}', 'Deploy the governance migration')::text;
select is((public.glci_decide_action((select value::uuid from k where key = 'deploy'), 'approved', 'Self-approved as sole owner') ->> 'selfApproved')::boolean,
  true, 'under solo mode the requester may approve, recorded as self-approved');
select throws_ok($$select public.glci_record_deployment(null, 'database_migration', '20261114300000', null, 'No request', 'deployed', '{}')$$,
  'GLCI_DEPLOYMENT_NOT_APPROVED', 'an operator cannot record a hosted deployment without an approved request');
select throws_ok($$select public.glci_record_deployment((select value::uuid from k where key = 'deploy'), 'database_migration', '20261114999999', null,
  'Different reference', 'deployed', '{}')$$, 'GLCI_DEPLOYMENT_NOT_APPROVED', 'the deployment must match what was approved');
insert into k select 'deployment', public.glci_record_deployment((select value::uuid from k where key = 'deploy'), 'database_migration', '20261114300000',
  repeat('a', 32), 'Governance migration', 'deployed', '{"historyMatches":true}')::text;
reset role;
select is((select self_approved::text || '/' || outcome from private.glci_deployments where id = (select value::uuid from k where key = 'deployment')),
  'true/deployed', 'the deployment is registered with its approval');
select is((select status from private.glci_approval_requests where id = (select value::uuid from k where key = 'deploy')), 'executed', 'and the request is closed');
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select lives_ok($$select public.glci_record_deployment(null, 'web_release', 'abc1234', null, 'Web release from the deployment workflow', 'deployed', '{}')$$,
  'the deployment workflow records with the service role');
reset role;
set local request.jwt.claim.role = '';

-- remediation follows the same policy
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a1');
insert into k select 'eng', public.glci_request_engineering_task('NO', null, 'Investigate the Lovdata archive size check behaviour.', null)::text;
select is(public.glci_decide_proposal(((select value from k where key = 'eng')::jsonb ->> 'proposalId')::uuid, 'approved', 'Sole owner approves'), 'approved',
  'under solo mode a remediation proposal can be self-approved');
reset role;
select ok((select decision_note like '[self-approved under solo-owner policy]%' from private.glci_remediation_proposals
  where id = ((select value from k where key = 'eng')::jsonb ->> 'proposalId')::uuid), 'and the decision says so');

-- deployment register completeness
insert into supabase_migrations.schema_migrations (version, statements, name) values ('20991231000000', array['select 1'], 'unregistered_change');
select pg_temp.as_user('cb000000-0000-4000-8000-0000000000a2');
select ok((public.glci_governance_report() -> 'unrecordedMigrations') @> '["20991231000000"]'::jsonb
  and not (public.glci_governance_report() -> 'unrecordedMigrations') @> '["20261114300000"]'::jsonb,
  'a migration applied without a register entry is flagged (this migration was recorded above through the register)');

-- audit checkpoints, exports and tamper detection
select ok((public.glci_audit_checkpoint() ->> 'chainValid')::boolean, 'a checkpoint pins the current head of a valid chain');
insert into k select 'export', public.glci_audit_export(1, null)::text;
select is((select value::jsonb ->> 'format' from k where key = 'export'), 'njumeni-glci-audit-export-1', 'an export has a versioned format');
select is((select value::jsonb ->> 'sha256' from k where key = 'export'),
  (select encode(extensions.digest(convert_to((value::jsonb -> 'events')::text, 'UTF8'), 'sha256'), 'hex') from k where key = 'export'),
  'its digest covers exactly the exported events');
reset role;
alter table private.glci_audit_events disable trigger glci_audit_events_append_only;
update private.glci_audit_events set details = details || '{"tampered":true}' where sequence_number = (select min(sequence_number) from private.glci_audit_events);
delete from private.glci_audit_events where sequence_number >= (select max(head_sequence) from private.glci_audit_checkpoints);
alter table private.glci_audit_events enable trigger glci_audit_events_append_only;
select ok(not (private.glci_audit_integrity() ->> 'chainValid')::boolean, 'rewriting an event breaks the chain');
select ok(not (private.glci_audit_integrity() ->> 'checkpointsMatch')::boolean, 'truncating the log contradicts the checkpoint');

select pg_temp.as_user('cb000000-0000-4000-8000-0000000000b1');
select throws_ok($$select public.glci_governance_report()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot see governance');
reset role;

select * from finish();
rollback;
