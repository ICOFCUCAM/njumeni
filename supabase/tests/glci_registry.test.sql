-- GLCI-01: jurisdiction monitoring profiles, monitoring targets, activation gates and the GLCI audit chain.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c1000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-operator@example.invalid', now(), now()),
  ('c1000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'c1000000-0000-4000-8000-0000000000a1';

-- ------------------------------------------------------------------ registry contents (spec §4)
select is((select count(*)::int from private.jurisdictions where code in ('SE', 'DK', 'FI', 'UG') and status = 'catalogued'), 4,
  'Sweden, Denmark, Finland and Uganda are catalogued');
select is((select array_agg(jurisdiction_code order by jurisdiction_code) from private.glci_jurisdiction_profiles),
  array['CM', 'DK', 'EU', 'FI', 'GB', 'NO', 'SE', 'UG', 'US'], 'every jurisdiction in spec §4 has a monitoring profile');
select ok((select bool_and(effective_date_rules ->> 'publicationIsNotCommencement' = 'true') from private.glci_jurisdiction_profiles),
  'every profile states that publication is not commencement');
select ok((select bool_and(effective_date_rules -> 'dateKinds' ?& array['publication', 'enactment', 'effective', 'repeal', 'transitional'])
  from private.glci_jurisdiction_profiles), 'every profile distinguishes the five date kinds');
select is((select authority_hierarchy -> 0 ->> 'authorityType' from private.glci_jurisdiction_profiles where jurisdiction_code = 'NO'), 'constitution',
  'the Norwegian hierarchy starts with the Constitution');
select ok((select bool_and(exists (select 1 from private.glci_monitoring_targets t where t.jurisdiction_code = p.jurisdiction_code))
  from private.glci_jurisdiction_profiles p), 'every profiled jurisdiction has monitoring targets');
select is((select count(*)::int from private.glci_monitoring_targets where status = 'active'), 0, 'every target is seeded inactive');
select is((select count(*)::int from private.glci_monitoring_targets where jurisdiction_code = 'NO'), 5,
  'Norway: Lovdata (two datasets), Lovtidend, Stortinget, government');

-- ------------------------------------------------------------------ activation gates
select is((select private.glci_target_activation_basis(t) from private.glci_monitoring_targets t where target_key = 'no-lovdata-current-laws'),
  'licence_policy_v2', 'the Lovdata API listing may be monitored under the Lovdata licence policy');
select is((select private.glci_target_activation_basis(t) from private.glci_monitoring_targets t where target_key = 'no-stortinget'), null,
  'a target without a monitor adapter and reviewed source cannot be activated');
select is((select private.glci_target_activation_basis(t) from private.glci_monitoring_targets t where target_key = 'gb-legislation'), null,
  'a source still under rights review cannot be monitored');
select throws_ok($$update private.glci_monitoring_targets set status = 'active' where target_key = 'se-riksdagen'$$,
  'GLCI_TARGET_ACTIVATION_NOT_PERMITTED', 'activation without a lawful basis is refused');

-- ------------------------------------------------------------------ operator API
set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_registry()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot read the GLCI registry');
select throws_ok($$select public.glci_set_target_status('no-lovdata-current-laws', 'active', 'Customer tries to activate')$$,
  'GLCI_NOT_AUTHORISED', 'customers cannot change monitoring');
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-0000000000a1';
select ok(jsonb_array_length(public.glci_registry()) >= 17, 'the operator sees every jurisdiction');
select is((select r -> 'targets' -> 0 ->> 'activationBasis' from jsonb_array_elements(public.glci_registry()) r where r ->> 'code' = 'NO'),
  'licence_policy_v2', 'the registry reports the activation basis per target');
-- Activation needs an approval request since GLCI-11 (glci_governance.test.sql); pausing stays direct.
select is(public.glci_set_target_status('no-lovdata-current-laws', 'paused', 'Pause until the rights review is complete'),
  'paused', 'the operator pauses a target directly');
select throws_ok($$select public.glci_set_target_status('no-lovdata-current-laws', 'paused', 'short')$$, 'GLCI_REASON_REQUIRED',
  'status changes need a reason');
select lives_ok($$select public.glci_register_target('UG', 'ug-ulii', 'Uganda Legal Information Institute', 'legal_database',
  'https://ulii.org/', null, null, '{}'::jsonb, 'Added without a code change')$$, 'a new target is registered as data (J-GLCI-4)');
select throws_ok($$select public.glci_upsert_jurisdiction_profile('UG', '{"monitoringLanguages":["en"],"authorityHierarchy":[{"authorityType":"act","rank":1}],
  "publicationSchedule":{},"effectiveDateRules":{"publicationIsNotCommencement":false},"reviewProcedure":{"reviewerRole":"knowledge_admin"}}'::jsonb)$$,
  'GLCI_PROFILE_INVALID', 'a profile that treats publication as commencement is refused');
reset role;

-- ------------------------------------------------------------------ audit chain
select is((select count(*)::int from private.glci_audit_events where event_type in ('registry.target_status', 'registry.target_registered')), 2,
  'registry changes are audited');
select is((select count(*)::int from (
  select e.*, lag(e.record_hash) over (order by e.sequence_number) as expected_previous from private.glci_audit_events e) x
  where x.previous_hash is distinct from x.expected_previous
    or x.record_hash <> private.glci_audit_digest(x.occurred_at, x.actor_principal_id, x.actor_kind, x.event_type,
      x.subject_type, x.subject_id, x.details, x.previous_hash)), 0, 'the GLCI audit chain verifies');

select * from finish();
rollback;
