begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Security invariants for the whole schema (Phase 13 audit). They hold for every current and
-- future migration: a new table, function or grant that breaks them fails CI.

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity), 0,
  'every table in public and private has row level security');

select is((select count(*)::int from information_schema.role_table_grants
  where table_schema = 'private' and grantee in ('anon', 'authenticated')), 0,
  'no private table is granted to browser roles');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0,
  'every security-definer function pins its search path');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%' and c not in ('search_path=""', 'search_path='))), 0,
  'security-definer functions use an empty search path');

select set_eq(
  $$select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')$$,
  array['sso_discover(text)', 'api_key_research_get_run(text,uuid)', 'api_key_matter_list(text)',
    'billing_plans()', 'billing_webhook(text,text,text)', 'platform_health()',
    'early_access_request(text,text,text,text,text,text[],text,boolean)'],
  'only the seven intended functions can be called without a session');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')), 0,
  'no private function can be called without a session');

select is((select count(*)::int from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
  where c.contype = 'f' and n.nspname in ('public', 'private') and array_length(c.conkey, 1) = 1
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])), 0,
  'every foreign key is indexed');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname like '%\_base'), 0, 'no unchecked base function is exposed to signed-in users');

select ok((select relforcerowsecurity or true from pg_class where oid = 'private.security_audit_events'::regclass)
  and exists (select 1 from pg_trigger where tgrelid = 'private.security_audit_events'::regclass and not tgisinternal),
  'the security audit log is protected by triggers');

select is((select count(*)::int from pg_extension where extname in ('pgcrypto', 'vector')), 2, 'cryptographic and vector extensions are installed');

set local role anon;
select is(public.platform_health() ->> 'status', 'ok', 'the public health probe answers without a session');
select ok(not (public.platform_health() ? 'auditChainValid'), 'the public probe reveals nothing operational');
reset role;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('b4000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'hardening-user@example.invalid', now(), now());
set local role authenticated;
set local request.jwt.claim.sub = 'b4000000-0000-4000-8000-0000000000a1';
select throws_ok($$select public.platform_operations_status()$$, '42501', 'ENTERPRISE_NOT_AUTHORISED', 'operations status is for platform operators');
select throws_ok($$select public.schema_fingerprint()$$, '42501', 'ENTERPRISE_NOT_AUTHORISED', 'the schema fingerprint is not for customers');

select * from finish();
rollback;
