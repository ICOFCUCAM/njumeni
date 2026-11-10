begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email)
values
  ('20000000-0000-4000-8000-000000000001', 'tenant-one@njumeni.test'),
  ('20000000-0000-4000-8000-000000000002', 'tenant-two@njumeni.test');

select set_config(
  'njumeni.test.principal_one',
  (select principal_id::text from private.principal_identities where auth_user_id = '20000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'njumeni.test.principal_two',
  (select principal_id::text from private.principal_identities where auth_user_id = '20000000-0000-4000-8000-000000000002'),
  true
);
select set_config(
  'njumeni.test.personal_org_one',
  (select id::text from public.organizations where owner_principal_id = current_setting('njumeni.test.principal_one')::uuid and kind = 'personal'),
  true
);
select set_config(
  'njumeni.test.personal_org_two',
  (select id::text from public.organizations where owner_principal_id = current_setting('njumeni.test.principal_two')::uuid and kind = 'personal'),
  true
);
select set_config(
  'njumeni.test.personal_workspace_one',
  (select id::text from public.workspaces where organization_id = current_setting('njumeni.test.personal_org_one')::uuid and kind = 'personal'),
  true
);

select is(
  (select count(*) from public.organizations where kind = 'personal'),
  2::bigint,
  'Each new principal receives exactly one personal organisation'
);
select is(
  (select count(*) from public.workspaces where kind = 'personal'),
  2::bigint,
  'Each personal organisation receives one default personal workspace'
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.organizations),
  1::bigint,
  'User one can read only their own personal organisation'
);
select is(
  (select count(*) from public.workspaces),
  1::bigint,
  'User one can read only their own personal workspace'
);

select lives_ok(
  $$insert into public.organizations (name, slug, kind) values ('Tenant One Law Firm', 'tenant-one-law-firm', 'law_firm')$$,
  'Owner can create an additional organisation without supplying an owner principal'
);

reset role;
select set_config(
  'njumeni.test.extra_org_one',
  (select id::text from public.organizations where slug = 'tenant-one-law-firm'),
  true
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.organizations),
  2::bigint,
  'Owner can read the personal and newly created organisation'
);

select lives_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
      values (current_setting('njumeni.test.extra_org_one')::uuid, 'Matter Alpha', 'matter-alpha', 'matter')$sql$,
  'Owner can create a workspace in their own active organisation'
);

select throws_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
      values (current_setting('njumeni.test.personal_org_two')::uuid, 'Foreign Workspace', 'foreign-workspace', 'team')$sql$,
  '42501',
  'new row violates row-level security policy for table "workspaces"',
  'Owner cannot create a workspace inside another principal organisation'
);

select is(
  (select count(*) from public.organizations where id = current_setting('njumeni.test.personal_org_two')::uuid),
  0::bigint,
  'Owner cannot read another principal organisation'
);

select throws_ok(
  $$insert into public.organizations (name, slug, kind) values ('Forged Personal', 'forged-personal', 'personal')$$,
  '42501',
  'Personal organisations are provisioned by the identity lifecycle',
  'Owner cannot create an extra personal organisation'
);

select throws_ok(
  $sql$update public.organizations set owner_principal_id = current_setting('njumeni.test.principal_two')::uuid
      where id = current_setting('njumeni.test.personal_org_one')::uuid$sql$,
  '42501',
  'permission denied for table organizations',
  'Owner cannot update the organisation ownership column'
);

select throws_ok(
  $sql$update public.workspaces set organization_id = current_setting('njumeni.test.personal_org_two')::uuid
      where id = current_setting('njumeni.test.personal_workspace_one')::uuid$sql$,
  '42501',
  'permission denied for table workspaces',
  'Owner cannot update the workspace organisation column'
);

reset role;
select throws_ok(
  $sql$update public.organizations set owner_principal_id = current_setting('njumeni.test.principal_two')::uuid
      where id = current_setting('njumeni.test.personal_org_one')::uuid$sql$,
  '42501',
  'Organisation ownership is immutable',
  'Database trigger prevents privileged organisation ownership reassignment'
);
select throws_ok(
  $sql$update public.workspaces set organization_id = current_setting('njumeni.test.personal_org_two')::uuid
      where id = current_setting('njumeni.test.personal_workspace_one')::uuid$sql$,
  '42501',
  'Workspace organisation and creator are immutable',
  'Database trigger prevents privileged workspace reassignment'
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select lives_ok(
  $sql$update public.workspaces set status = 'archived'
      where id = current_setting('njumeni.test.personal_workspace_one')::uuid$sql$,
  'Owner can archive an owned workspace'
);
select throws_ok(
  $sql$update public.workspaces set status = 'suspended'
      where id = current_setting('njumeni.test.personal_workspace_one')::uuid$sql$,
  '42501',
  'Workspace status may only be active or archived through the user interface',
  'Owner cannot set a privileged suspended status'
);

reset role;
delete from auth.users where id = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from private.principal_identities where auth_user_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'Auth deletion removes the provider identity mapping'
);
select is(
  (select count(*) from private.principals
   where id = current_setting('njumeni.test.principal_one')::uuid and status = 'deactivated'),
  1::bigint,
  'Auth deletion deactivates the principal'
);
select is(
  (select count(*) from public.organizations
   where id = current_setting('njumeni.test.personal_org_one')::uuid),
  1::bigint,
  'Auth deletion retains the organisation for controlled tenant retention'
);
select is(
  (select count(*) from public.workspaces
   where organization_id = current_setting('njumeni.test.personal_org_one')::uuid),
  1::bigint,
  'Auth deletion retains the workspace for controlled tenant retention'
);

select * from finish();
rollback;
