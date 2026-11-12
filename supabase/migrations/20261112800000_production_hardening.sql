-- Phase 13: production hardening (Master Plan v2.0 Phase 13, §18.3).
-- Defence in depth from the pre-launch security audit: row level security on every table
-- (including internal queue and log tables that already had no grants), an index for every
-- foreign key, a minimal public health probe, an operator status report for monitoring, and a
-- schema fingerprint used to prove that a hosted database equals the repository migrations (U-27).
-- Forward migration; it is part of the cumulative set first deployed to the hosted project.

-- ---------------------------------------------------------------------------------------------
-- 1. Row level security everywhere
-- ---------------------------------------------------------------------------------------------
do $rls$
declare v_table regclass;
begin
  for v_table in
    select c.oid::regclass from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table %s enable row level security', v_table);
  end loop;
end;
$rls$;

-- No private function keeps PostgreSQL's default execute right for PUBLIC/anon.
do $private_functions$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke all on function %s from public, anon', v_function);
  end loop;
end;
$private_functions$;

-- ---------------------------------------------------------------------------------------------
-- 2. An index for every single-column foreign key (joins, tenant scans, restricted deletes)
-- ---------------------------------------------------------------------------------------------
do $indexes$
declare v_row record; v_name text;
begin
  for v_row in
    select c.conrelid::regclass as rel, n.nspname as schema_name, cl.relname as table_name, a.attname as column_name
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and n.nspname in ('public', 'private') and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
    order by 1, 4
  loop
    v_name := left(format('%s_%s_fk_idx', v_row.table_name, v_row.column_name), 63);
    execute format('create index if not exists %I on %s (%I)', v_name, v_row.rel, v_row.column_name);
  end loop;
end;
$indexes$;

-- ---------------------------------------------------------------------------------------------
-- 3. Health and operations monitoring
-- ---------------------------------------------------------------------------------------------
-- Public liveness probe: reveals only that the database answers and its schema version.
create or replace function public.platform_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', 'ok', 'time', now(),
    'schemaVersion', (select max(version) from supabase_migrations.schema_migrations));
$$;

-- Operator status for alerting (§16 AI operations and platform administration).
create or replace function public.platform_operations_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'checkedAt', now(),
    'schemaVersion', (select max(version) from supabase_migrations.schema_migrations),
    'databaseBytes', pg_database_size(current_database()),
    'auditChainValid', (public.verify_security_audit_chain() ->> 'valid')::boolean,
    'ai', jsonb_build_object(
      'failedLastHour', (select count(*) from private.ai_executions where status = 'failed' and created_at > now() - interval '1 hour'),
      'refusedLastHour', (select count(*) from private.ai_executions where status = 'refused' and created_at > now() - interval '1 hour'),
      'safetyFlagsLastDay', (select count(*) from private.ai_executions where cardinality(safety_flags) > 0 and created_at > now() - interval '1 day')),
    'ingestion', jsonb_build_object(
      'failedJobs', (select count(*) from private.legal_source_ingestion_jobs where status in ('failed', 'dead_letter')),
      'queuedJobs', (select count(*) from private.legal_source_ingestion_jobs where status in ('queued', 'leased'))),
    'billing', jsonb_build_object(
      'webhookFailures', (select count(*) from private.billing_provider_events where outcome = 'failed'),
      'openInvoices', (select count(*) from private.invoices where status = 'open')),
    'quality', jsonb_build_object(
      'pendingReviews', (select count(*) from private.review_requests where status = 'pending'),
      'oldestPendingReviewHours', (select extract(epoch from now() - min(requested_at)) / 3600 from private.review_requests where status = 'pending'),
      'blockedVerificationsLastDay', (select count(*) from private.verification_reports where outcome = 'blocked' and created_at > now() - interval '1 day')),
    'security', jsonb_build_object(
      'activeSupportGrants', (select count(*) from private.support_access_requests where status = 'approved' and expires_at > now()),
      'deniedEventsLastHour', (select count(*) from private.security_audit_events where outcome = 'denied' and occurred_at > now() - interval '1 hour')));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Schema fingerprint: proves a database equals the repository migrations (U-27)
-- ---------------------------------------------------------------------------------------------
create or replace function public.schema_fingerprint()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  -- Operators, the service role, or a direct administrative connection (no request identity).
  if not private.is_platform_operator() and coalesce(auth.role(), '') <> 'service_role'
    and not (auth.uid() is null and session_user in ('postgres', 'supabase_admin')) then
    raise exception 'ENTERPRISE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
    'tables', (select md5(string_agg(format('%s.%s.%s:%s', table_schema, table_name, column_name, data_type), ',' order by table_schema, table_name, column_name))
      from information_schema.columns where table_schema in ('public', 'private')),
    'functions', (select md5(string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc), ',' order by p.oid::regprocedure::text))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private')),
    'policies', (select md5(coalesce(string_agg(format('%s.%s.%s', schemaname, tablename, policyname), ',' order by schemaname, tablename, policyname), ''))
      from pg_policies where schemaname in ('public', 'private', 'storage')));
end;
$$;

do $grants$
begin
  revoke all on function public.platform_health() from public;
  grant execute on function public.platform_health() to anon, authenticated, service_role;
  revoke all on function public.platform_operations_status() from public, anon;
  grant execute on function public.platform_operations_status() to authenticated, service_role;
  revoke all on function public.schema_fingerprint() from public, anon;
  grant execute on function public.schema_fingerprint() to authenticated, service_role;
end;
$grants$;
