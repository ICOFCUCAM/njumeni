-- Early-access requests from the public homepage: validation, consent, dedupe, rate cap, operator-only reading, retention.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('ea000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'ea-operator@example.invalid', now(), now()),
  ('ea000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'ea-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select principal_id, 'knowledge_admin' from private.principal_identities where auth_user_id = 'ea000000-0000-4000-8000-0000000000a1';

set local role anon;
select is(public.early_access_request('Ada@Example.org', 'Ada Lovelace', 'Analytical Ltd', 'law_firm', 'demonstration',
  array['NO', 'GB'], 'We would like a demonstration.', true), 'received', 'a visitor without a session can request a demonstration');
select throws_ok($$select public.early_access_request('b@example.org', 'Bo', null, 'individual', 'early_access', '{}', null, false)$$,
  '22023', 'EARLY_ACCESS_CONSENT_REQUIRED', 'consent is required');
select throws_ok($$select public.early_access_request('not-an-email', 'Bo Bo', null, 'individual', 'early_access', '{}', null, true)$$,
  '22023', 'EARLY_ACCESS_EMAIL_INVALID', 'the email address is validated');
select throws_ok($$select public.early_access_request('c@example.org', 'Cy', null, 'pirate', 'early_access', '{}', null, true)$$,
  '22023', 'EARLY_ACCESS_INPUT_INVALID', 'the audience must be one of the five');
select throws_ok($$select public.early_access_request('c@example.org', 'Cy Young', null, 'individual', 'early_access', array['no; drop'], null, true)$$,
  '22023', 'EARLY_ACCESS_INPUT_INVALID', 'jurisdiction codes are validated');
select is(public.early_access_request('ada@example.org', 'Ada Lovelace', null, 'law_firm', 'early_access', '{}', null, true), 'received',
  'a repeat request gives the same answer');
select throws_ok($$select count(*) from private.early_access_requests$$, '42501', null, 'visitors cannot read requests');
reset role;
select is((select count(*)::int from private.early_access_requests where email = 'ada@example.org'), 1, 'one request per address, updated in place');
select is((select interest from private.early_access_requests where email = 'ada@example.org'), 'early_access', 'the latest request wins');

insert into private.early_access_requests (email, full_name, audience, interest, consent_at)
select 'bulk' || g || '@example.org', 'Bulk sender', 'individual', 'early_access', now() from generate_series(1, 60) g;
set local role anon;
select throws_ok($$select public.early_access_request('new@example.org', 'New Person', null, 'individual', 'early_access', '{}', null, true)$$,
  '53400', 'EARLY_ACCESS_BUSY', 'more than 60 new requests an hour are refused');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'ea000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.early_access_list(null)$$, '42501', 'EARLY_ACCESS_NOT_AUTHORISED', 'customers cannot read requests');
set local request.jwt.claim.sub = 'ea000000-0000-4000-8000-0000000000a1';
create temporary table ada on commit drop as select (r ->> 'id')::uuid as id from jsonb_array_elements(public.early_access_list(null)) r
  where r ->> 'email' = 'ada@example.org';
select is((select r ->> 'fullName' from jsonb_array_elements(public.early_access_list('new')) r where r ->> 'email' = 'ada@example.org'),
  'Ada Lovelace', 'platform operators read requests');
select lives_ok($$select public.early_access_set_status((select id from ada), 'contacted')$$,
  'operators mark requests as contacted');
reset role;

update private.early_access_requests set retain_until = now() - interval '1 day' where email like 'bulk%';
select is(public.early_access_purge_expired(), 60, 'requests are deleted when their retention ends');

select * from finish();
rollback;
