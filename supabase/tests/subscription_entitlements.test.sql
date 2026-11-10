begin;
select plan(12);

create temporary table billing_test_ids (
  owner_a uuid,
  owner_b uuid,
  org_a uuid,
  org_b uuid
) on commit drop;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'billing-a@example.invalid', now(), now()),
  ('d1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'billing-b@example.invalid', now(), now())
on conflict (id) do nothing;

insert into public.organizations(owner_principal_id,name,slug,kind)
select principal.id,'Billing Tenant A','billing-tenant-a','enterprise'
from private.principals principal join private.principal_identities identity on identity.principal_id=principal.id
where identity.auth_user_id='c1000000-0000-4000-8000-000000000001'
on conflict do nothing;
insert into public.organizations(owner_principal_id,name,slug,kind)
select principal.id,'Billing Tenant B','billing-tenant-b','enterprise'
from private.principals principal join private.principal_identities identity on identity.principal_id=principal.id
where identity.auth_user_id='d1000000-0000-4000-8000-000000000002'
on conflict do nothing;

insert into billing_test_ids(owner_a,owner_b,org_a,org_b)
select
 (select principal.id from private.principals principal join private.principal_identities identity on identity.principal_id=principal.id where identity.auth_user_id='c1000000-0000-4000-8000-000000000001'),
 (select principal.id from private.principals principal join private.principal_identities identity on identity.principal_id=principal.id where identity.auth_user_id='d1000000-0000-4000-8000-000000000002'),
 (select id from public.organizations where slug='billing-tenant-a'),
 (select id from public.organizations where slug='billing-tenant-b');

grant select on billing_test_ids to authenticated;

select ok(
  has_table_privilege('authenticated','private.subscriptions','SELECT') = false
  and has_table_privilege('authenticated','private.billing_customers','SELECT') = false
  and has_table_privilege('anon','private.subscription_entitlements','SELECT') = false,
  'billing identity and entitlement tables are not directly exposed'
);

select ok(
  exists(select 1 from private.subscription_plans where plan_key='professional')
  and exists(select 1 from private.subscription_plans where plan_key='institutional'),
  'commercial plan catalogue is seeded'
);

select ok(
  not has_function_privilege('authenticated',
    'private.apply_subscription_snapshot(text,text,text,text,text,uuid,text,text,timestamp with time zone,timestamp with time zone,boolean,jsonb)',
    'EXECUTE'),
  'authenticated callers cannot invoke provider snapshot ingestion'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);

select throws_ok(
  $$select * from public.get_organization_entitlements((select org_a from billing_test_ids))$$,
  '42501',
  'Billing access denied',
  'tenant B owner cannot read tenant A entitlements'
);

select throws_ok(
  $$select public.record_usage_event((select org_a from billing_test_ids),null,'research.query',1,'operation','billing-idem-0001','{}'::jsonb)$$,
  '42501',
  'Usage event is invalid or unauthorised',
  'tenant B cannot record usage against tenant A'
);

select throws_ok(
  $$insert into private.usage_records(organization_id,usage_key,quantity,unit,idempotency_key) values ((select org_a from billing_test_ids),'research.query',1,'operation','manual-insert-0001')$$,
  '42501',
  null,
  'authenticated callers cannot insert usage ledger rows directly'
);

reset role;

select ok(
  (select count(*)=0 from private.billing_customers where organization_id=(select org_a from billing_test_ids)),
  'untrusted requests cannot create billing customer links'
);

select ok(
  (select count(*)=0 from private.subscriptions where organization_id=(select org_a from billing_test_ids)),
  'untrusted requests cannot create subscriptions'
);

select ok(
  (select count(*)=0 from private.subscription_entitlements where organization_id=(select org_a from billing_test_ids)),
  'untrusted requests cannot forge entitlements'
);

select ok(
  (select count(*)=0 from private.billing_provider_events),
  'untrusted requests cannot forge provider event receipts'
);

select ok(
  not exists(
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public' and procedure.proname='has_permission'
      and pg_get_functiondef(procedure.oid) ilike '%subscription%'
  ),
  'resource authorisation evaluator does not consult subscription state'
);

select ok(
  exists(select 1 from pg_indexes where schemaname='private' and indexname='usage_records_org_key_time_idx'),
  'usage ledger has tenant/time index for metering queries'
);

select * from finish();
rollback;
