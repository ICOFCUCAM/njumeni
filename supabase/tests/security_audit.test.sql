begin;
select plan(12);

create temporary table audit_test_ids (
  owner_a uuid,
  owner_b uuid,
  org_a uuid,
  org_b uuid,
  workspace_a uuid
) on commit drop;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'audit-a@example.invalid', now(), now()),
  ('b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'audit-b@example.invalid', now(), now())
on conflict (id) do nothing;

insert into public.organizations (owner_principal_id, name, slug, kind)
select principal.id, 'Audit Tenant A', 'audit-tenant-a', 'enterprise'
from private.principals principal
join private.principal_identities identity on identity.principal_id = principal.id
where identity.auth_user_id = 'a1000000-0000-4000-8000-000000000001'
returning id;

insert into public.organizations (owner_principal_id, name, slug, kind)
select principal.id, 'Audit Tenant B', 'audit-tenant-b', 'enterprise'
from private.principals principal
join private.principal_identities identity on identity.principal_id = principal.id
where identity.auth_user_id = 'b1000000-0000-4000-8000-000000000002'
returning id;

insert into audit_test_ids(owner_a, owner_b, org_a, org_b)
select
  (select principal.id from private.principals principal join private.principal_identities identity on identity.principal_id=principal.id where identity.auth_user_id='a1000000-0000-4000-8000-000000000001'),
  (select principal.id from private.principals principal join private.principal_identities identity on identity.principal_id=principal.id where identity.auth_user_id='b1000000-0000-4000-8000-000000000002'),
  (select id from public.organizations where slug='audit-tenant-a'),
  (select id from public.organizations where slug='audit-tenant-b');

update audit_test_ids
set workspace_a = (
  select workspace.id from public.workspaces workspace
  join public.organizations organization on organization.id=workspace.organization_id
  where organization.slug='audit-tenant-a' and workspace.slug='general'
);

select is(
  (select count(*)::integer from private.security_audit_events where organization_id=(select org_a from audit_test_ids) and event_key='organizations.insert'),
  1,
  'organisation creation is captured'
);

select ok(
  (select count(*) > 0 from private.security_audit_events where organization_id=(select org_a from audit_test_ids) and event_key='workspaces.insert'),
  'default workspace creation is captured'
);

select ok(
  has_table_privilege('authenticated', 'private.security_audit_events', 'SELECT') = false,
  'authenticated cannot read the audit table directly'
);

select ok(
  has_table_privilege('authenticated', 'private.security_audit_events', 'INSERT') = false,
  'authenticated cannot forge audit rows'
);

select throws_ok(
  $$update private.security_audit_events set outcome='failure' where organization_id=(select org_a from audit_test_ids)$$,
  '55000',
  'Security audit events are append-only',
  'audit rows cannot be updated'
);

select throws_ok(
  $$delete from private.security_audit_events where organization_id=(select org_a from audit_test_ids)$$,
  '55000',
  'Security audit events are append-only',
  'audit rows cannot be deleted'
);

select ok(
  (select count(*) = 0 from private.security_audit_events where organization_id=(select org_a from audit_test_ids) and metadata ?| array['email','email_normalized','token_hash']),
  'audit metadata excludes invitation addresses and token hashes'
);

select ok(
  (select count(*) > 0 from private.security_audit_events where organization_id=(select org_a from audit_test_ids) and resource_type='workspace'),
  'workspace lifecycle event carries a resource reference'
);

select throws_ok(
  $$select * from public.list_security_audit_events((select org_b from audit_test_ids), null, null, 100)$$,
  '42501',
  'Audit access denied',
  'tenant B owner cannot read tenant A audit events'
);

select throws_ok(
  $$select * from public.list_security_audit_events((select org_a from audit_test_ids), null, null, 201)$$,
  '22023',
  'Invalid audit query scope',
  'audit page size is bounded'
);

select ok(
  (select count(*) = 0 from private.security_audit_events where source_event_id is not null and event_id is null),
  'mirrored events have stable generated event identifiers'
);

select ok(
  (select count(*) = 0 from private.security_audit_events where octet_length(metadata::text) > 2048),
  'audit metadata remains within the configured size limit'
);

select * from finish();
rollback;
