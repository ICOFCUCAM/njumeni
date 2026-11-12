-- GLCI-07: observatory snapshot, command-centre log, topic examination and engineering requests.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c7000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-obs-operator@example.invalid', now(), now()),
  ('c7000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'glci-obs-second@example.invalid', now(), now()),
  ('c7000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-obs-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi
where pi.auth_user_id in ('c7000000-0000-4000-8000-0000000000a1', 'c7000000-0000-4000-8000-0000000000a2');
create temporary table k (key text primary key, value text) on commit drop;
grant all on k to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_observatory()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot open the observatory');
select throws_ok($$select public.glci_command_record(gen_random_uuid(), 'operator', 'hello there', null, null, '{}')$$, 'GLCI_NOT_AUTHORISED',
  'customers cannot use the command centre');

set local request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000a1';
select ok(public.glci_observatory() ?& array['headline', 'currency', 'sources', 'recentChanges', 'failedIngestion', 'issues',
  'engineeringTasks', 'audit', 'auditChain'], 'the snapshot has every dashboard section of spec §6');
select is((public.glci_observatory() -> 'headline' ->> 'jurisdictionsProfiled')::integer, 9, 'headline figures are measured, not illustrative');
select is((public.glci_observatory() -> 'headline' ->> 'verifiedCurrent')::integer, 0, 'nothing is claimed current before it is verified');
select is(jsonb_array_length(public.glci_observatory() -> 'sources'), 22, 'every monitoring target is shown with its health');

-- command centre conversation log
insert into k values ('conv', gen_random_uuid()::text);
select is(public.glci_command_record((select value::uuid from k where key = 'conv'), 'operator', 'Is our European coverage current?', null, null, '{}'), 1,
  'the operator question is recorded');
select is(public.glci_command_record((select value::uuid from k where key = 'conv'), 'assistant', 'Coverage report…', 'coverage_report',
  'njumeni-command-rules-1.0.0', '{"jurisdictions":["EU"]}'), 2, 'and the answer, with its intent and engine');
select is(jsonb_array_length(public.glci_command_conversation((select value::uuid from k where key = 'conv'))), 2, 'the conversation reads back in order');
set local request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000a2';
select throws_ok($$select public.glci_command_conversation((select value::uuid from k where key = 'conv'))$$, 'GLCI_NOT_AUTHORISED',
  'another operator cannot read or continue someone else''s conversation');
set local request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000a1';

-- topic examination (spec §5 example 1) and engineering requests (example 3)
select is(public.glci_examine_authorities('NO', array['utlending']), '[]'::jsonb, 'no Norwegian immigration acts are ingested yet: none found');
select throws_ok($$select public.glci_examine_authorities('NO', array['x'])$$, 'GLCI_COMMAND_INVALID', 'topic terms are validated');
insert into k select 'request', public.glci_request_engineering_task('NO', 'no-lovdata-current-laws',
  'Update the Norwegian legal ingestion connector to support the latest official source format.',
  (select value::uuid from k where key = 'conv'))::text;
reset role;
select is((select status || '/' || proposed_by_kind from private.glci_remediation_proposals where id = ((select value from k where key = 'request')::jsonb ->> 'proposalId')::uuid),
  'proposed/operator', 'the request becomes an operator-proposed engineering task');
set local role authenticated;
set local request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000a1';
select throws_ok(format($$select public.glci_decide_proposal(%L, 'approved', 'Approving my own request')$$,
  (select value from k where key = 'request')::jsonb ->> 'proposalId'), 'GLCI_FOUR_EYES_REQUIRED', 'the requester cannot approve it');
set local request.jwt.claim.sub = 'c7000000-0000-4000-8000-0000000000a2';
select is(public.glci_decide_proposal(((select value from k where key = 'request')::jsonb ->> 'proposalId')::uuid, 'approved', 'Second operator approves'),
  'approved', 'a second operator approves');
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.glci_reconcile_issues();
select set_config('request.jwt.claim.role', '', true);
select is((select status from private.glci_issues where id = ((select value from k where key = 'request')::jsonb ->> 'issueId')::uuid), 'in_progress',
  'reconciliation does not auto-resolve an engineering request');
select is((select count(*)::int from private.glci_audit_events where event_type = 'command.asked'), 1, 'questions are audited');

select * from finish();
rollback;
