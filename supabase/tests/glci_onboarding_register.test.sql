-- GLCI-10: onboarding register, monitor adapter catalogue and the official-host guard.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('ca000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-onboard-operator@example.invalid', now(), now()),
  ('ca000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-onboard-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'ca000000-0000-4000-8000-0000000000a1';
create function pg_temp.step(p_code text, p_key text) returns boolean language sql as $$
  select (s ->> 'done')::boolean from jsonb_array_elements(private.glci_jurisdiction_onboarding(p_code) -> 'steps') s where s ->> 'key' = p_key
$$;

select is((select array_agg(adapter_key order by adapter_key) from private.glci_monitor_adapters),
  array['atom-feed', 'json-listing', 'lovdata-public-data-listing', 'rss-feed'], 'four monitor adapters are catalogued');
select ok((select format_verified from private.glci_monitor_adapters where adapter_key = 'lovdata-public-data-listing')
  and not (select format_verified from private.glci_monitor_adapters where adapter_key = 'atom-feed'), 'only verified formats are marked verified');
select throws_ok($$update private.glci_monitoring_targets set monitor_adapter_key = 'made-up' where target_key = 'se-sfs'$$, '23503', null,
  'a target can only use a catalogued adapter');
select throws_ok($$update private.glci_monitoring_targets set config = '{"feedUrl":"https://evil.example/feed"}' where target_key = 'gb-legislation'$$,
  '23514', null, 'a feed URL off the official host is refused');
select is((select monitor_adapter_key from private.glci_monitoring_targets where target_key = 'gb-legislation'), 'atom-feed',
  'the UK legislation target is prepared with the Atom monitor (still inactive)');

-- the register
select is((private.glci_jurisdiction_onboarding('NO') ->> 'total')::integer, 10, 'ten onboarding stages');
select ok(pg_temp.step('NO', 'rights') and pg_temp.step('NO', 'monitor') and not pg_temp.step('NO', 'monitoring'),
  'Norway: rights covered by the licence policy and a monitor assigned, monitoring not yet active');
select is(private.glci_jurisdiction_onboarding('NO') -> 'nextStep' ->> 'key', 'monitoring', 'so Norway''s next step is to activate monitoring');
select is(private.glci_jurisdiction_onboarding('GB') -> 'nextStep' ->> 'key', 'rights', 'the UK waits for its rights review');
select ok((private.glci_jurisdiction_onboarding('GB') -> 'nextStep' ->> 'owner')::boolean, 'which is the owner''s action');
select is(private.glci_jurisdiction_onboarding('KE') -> 'nextStep' ->> 'key', 'profile', 'a catalogued country starts with its profile');
update private.glci_monitoring_targets set status = 'active' where target_key = 'no-lovdata-current-laws';
select is(private.glci_jurisdiction_onboarding('NO') -> 'nextStep' ->> 'key', 'checked', 'the register follows live state');

set local role authenticated;
set local request.jwt.claim.sub = 'ca000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_onboarding_register()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot read the onboarding register');
set local request.jwt.claim.sub = 'ca000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.glci_set_target_monitor('dk-retsinformation', 'json-listing',
  '{"listUrl":"https://www.retsinformation.dk/api/document/changed","itemsPath":"","idField":"id"}', 'Prepare Denmark monitoring from its open API')$$,
  'operators prepare a new country''s monitor as data');
reset role;

select * from finish();
rollback;
