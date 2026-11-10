begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

-- This is the consolidated Phase 1 security contract suite. It deliberately
-- uses catalog/permission assertions plus unauthenticated negative calls.
-- The task-specific pgTAP suites provide realistic two-principal fixtures.

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'organisation records have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.workspaces'::regclass),
  'workspace records have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_invitations'::regclass),
  'organisation invitations have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.organization_role_bindings'::regclass)
  and (select relrowsecurity from pg_class where oid = 'private.workspace_role_bindings'::regclass),
  'role bindings are protected by row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.security_audit_events'::regclass),
  'security audit events have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.billing_customers'::regclass)
  and (select relrowsecurity from pg_class where oid = 'private.subscriptions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'private.subscription_entitlements'::regclass),
  'billing identity, subscription and entitlement tables have row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.usage_records'::regclass),
  'usage ledger has row-level security enabled'
);

select ok(
  not has_table_privilege('anon', 'private.organization_role_bindings', 'SELECT')
  and not has_table_privilege('authenticated', 'private.organization_role_bindings', 'SELECT')
  and not has_table_privilege('authenticated', 'private.workspace_role_bindings', 'SELECT'),
  'untrusted API roles cannot read private role bindings directly'
);
select ok(
  not has_table_privilege('anon', 'private.security_audit_events', 'SELECT')
  and not has_table_privilege('authenticated', 'private.security_audit_events', 'SELECT')
  and not has_table_privilege('authenticated', 'private.security_audit_events', 'INSERT'),
  'audit records cannot be read or forged through direct table grants'
);
select ok(
  not has_table_privilege('anon', 'private.billing_customers', 'SELECT')
  and not has_table_privilege('authenticated', 'private.subscriptions', 'SELECT')
  and not has_table_privilege('authenticated', 'private.subscription_entitlements', 'SELECT')
  and not has_table_privilege('authenticated', 'private.usage_records', 'INSERT'),
  'billing and usage records are inaccessible through direct API table grants'
);

select ok(
  not has_function_privilege('anon', 'public.has_permission(text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_security_audit_events(uuid,uuid,bigint,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_organization_entitlements(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.record_usage_event(uuid,uuid,text,numeric,text,text,jsonb)', 'EXECUTE'),
  'anonymous callers cannot execute authenticated security or billing RPCs'
);
select ok(
  not has_function_privilege('authenticated', 'private.apply_subscription_snapshot(text,text,text,text,text,uuid,text,text,timestamp with time zone,timestamp with time zone,boolean,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'private.apply_subscription_snapshot(text,text,text,text,text,uuid,text,text,timestamp with time zone,timestamp with time zone,boolean,jsonb)', 'EXECUTE'),
  'provider subscription ingestion is restricted to the service role'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  private.has_permission(
    'matter.read',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
    null
  ),
  false,
  'permission evaluation denies a caller without an authenticated principal'
);
select is(
  private.storage_object_scope_allows(
    'njumeni-workspace-files',
    'not-a-tenant/not-a-workspace/not-a-file/invalid.pdf',
    'document.read'
  ),
  false,
  'storage scope helper denies malformed object paths'
);
select is(
  private.storage_object_scope_allows(
    'unexpected-public-bucket',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/ffffffff-ffff-4fff-8fff-ffffffffffff/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/file.pdf',
    'document.read'
  ),
  false,
  'storage scope helper denies unregistered buckets'
);

reset role;

select ok(
  (select not public from storage.buckets where id = 'njumeni-workspace-files'),
  'workspace document bucket is private'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'storage object metadata is protected by row-level security'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'private.security_audit_events'::regclass
      and tgname = 'security_audit_events_immutable'
      and not tgisinternal
  ),
  'audit event table has its append-only mutation guard'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'private.usage_records'::regclass
      and tgname = 'usage_records_immutable'
      and not tgisinternal
  ),
  'usage ledger has its append-only mutation guard'
);
select ok(
  not exists (
    select 1 from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = 'has_permission'
      and pg_get_functiondef(procedure.oid) ilike '%subscription_entitlements%'
  ),
  'commercial entitlements are not consulted by the resource authorisation evaluator'
);

select * from finish();
rollback;
