-- Hosted schema verification (Phase 13, U-27): run with psql against the hosted database after
-- `supabase db push`. Every line must read "ok"; the deployment workflow fails otherwise.
\set ON_ERROR_STOP on
select case when count(*) = 0 then 'ok' else 'FAIL tables without row level security: ' || string_agg(c.oid::regclass::text, ', ') end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity;
select case when count(*) = 0 then 'ok' else 'FAIL private tables granted to browser roles' end
  from information_schema.role_table_grants where table_schema = 'private' and grantee in ('anon', 'authenticated');
select case when count(*) = 0 then 'ok' else 'FAIL definer functions without a pinned search path' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
select case when array_agg(p.proname::text order by p.proname) = array['api_key_matter_list', 'api_key_research_get_run', 'billing_plans',
    'billing_webhook', 'platform_health', 'sso_discover'] then 'ok'
  else 'FAIL unexpected anonymous functions: ' || array_to_string(array_agg(p.proname::text order by p.proname), ', ') end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
select case when (public.verify_security_audit_chain() ->> 'valid')::boolean then 'ok' else 'FAIL audit chain' end;
select 'migrations=' || string_agg(version, ',' order by version) from supabase_migrations.schema_migrations;
