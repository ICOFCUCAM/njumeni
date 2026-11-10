begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'profile-one@njumeni.test'),
  ('10000000-0000-4000-8000-000000000002', 'profile-two@njumeni.test');

select set_config(
  'njumeni.test.principal_one',
  (select principal_id::text from private.principal_identities where auth_user_id = '10000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'njumeni.test.principal_two',
  (select principal_id::text from private.principal_identities where auth_user_id = '10000000-0000-4000-8000-000000000002'),
  true
);

select is(
  (select count(*) from public.user_profiles),
  2::bigint,
  'Auth-user trigger provisions one profile per principal'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.user_profiles),
  1::bigint,
  'User one can read only their own profile'
);

select lives_ok(
  $$update public.user_profiles set display_name = 'Profile One' where principal_id = private.current_principal_id()$$,
  'User one can update their own profile'
);

select is(
  (with changed as (
    update public.user_profiles
    set display_name = 'Cross-account write'
    where principal_id = current_setting('njumeni.test.principal_two')::uuid
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'User one cannot update user two profile'
);

select throws_ok(
  $$update public.user_profiles set timezone = 'Mars/Olympus_Mons' where principal_id = private.current_principal_id()$$,
  '23514',
  'Timezone must be a supported IANA time-zone identifier',
  'Database rejects an unsupported time zone'
);

select throws_ok(
  $$update public.user_profiles set avatar_url = 'http://example.com/avatar.png' where principal_id = private.current_principal_id()$$,
  '23514',
  'Avatar URL must be a valid HTTPS URL without embedded credentials',
  'Database rejects an insecure avatar URL'
);

select throws_ok(
  $$update public.user_profiles set principal_id = current_setting('njumeni.test.principal_two')::uuid where principal_id = private.current_principal_id()$$,
  '42501',
  'Profile ownership is immutable',
  'Profile owner cannot be reassigned'
);

reset role;
select throws_ok(
  $$update private.principal_identities set provider_subject = 'tampered-subject' where auth_user_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  'Provider identity mappings are immutable',
  'Provider subject mapping cannot be changed'
);
select is(
  has_table_privilege('authenticated', 'private.principals', 'SELECT'),
  false,
  'Authenticated role has no direct principal-table read privilege'
);

update private.principals
set status = 'suspended'
where id = current_setting('njumeni.test.principal_two')::uuid;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.user_profiles),
  0::bigint,
  'Suspended principal cannot read a profile'
);
select is(
  (with changed as (
    update public.user_profiles set display_name = 'Suspended write'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'Suspended principal cannot update a profile'
);

reset role;
update private.principals
set status = 'deactivated'
where id = current_setting('njumeni.test.principal_two')::uuid;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.user_profiles),
  0::bigint,
  'Deactivated principal cannot read a profile'
);
select is(
  (with changed as (
    update public.user_profiles set display_name = 'Deactivated write'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'Deactivated principal cannot update a profile'
);

reset role;
delete from auth.users where id = '10000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from private.principal_identities where auth_user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'Deleting an Auth user removes its provider identity mapping'
);

select is(
  (select count(*) from public.user_profiles where principal_id = current_setting('njumeni.test.principal_one')::uuid),
  0::bigint,
  'Deleting an Auth user cascades to its profile'
);

select * from finish();
rollback;
