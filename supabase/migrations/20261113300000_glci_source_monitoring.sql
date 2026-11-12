-- GLCI-02: automated legal source monitoring (docs/GLCI_SPECIFICATION.md §2 engine 1, §8).
--
-- 1. private.glci_target_state: the schedule and lease state of each monitoring target (one row
--    per target). Workers claim due, active targets under a lease, so two workers never check
--    the same target at once.
-- 2. private.glci_observations: one append-only row per check. The outcome is one of:
--      first_seen | unchanged | changed           — the source answered and was understood;
--      unreachable                                — network failure, timeout, 429 or 5xx;
--      integration_failure                        — the source answered but Njumeni no longer
--                                                   understands it (format or API change);
--      failed                                     — any other error.
--    The database, not the worker, decides changed/unchanged by comparing fingerprints.
-- 3. glci_monitoring_status(): a target is "verified" only when its last successful check is
--    recent and the most recent check succeeded. A target that was never checked, is stale,
--    unreachable or failing is reported as such, never as current (spec §8, additional
--    requirement).
-- 4. A detected change on a source enabled for ingestion queues an idempotent ingestion job
--    (continuous change ingestion). Otherwise the observation records why nothing was queued.

create table private.glci_target_state (
  target_id uuid primary key references private.glci_monitoring_targets(id) on delete restrict,
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_outcome text,
  last_fingerprint text check (last_fingerprint is null or last_fingerprint ~ '^[a-f0-9]{64}$'),
  last_changed_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  check ((lease_token is null) = (lease_expires_at is null))
);
create index glci_target_state_due_idx on private.glci_target_state(next_check_at);
alter table private.glci_target_state enable row level security;
revoke all on private.glci_target_state from public, anon, authenticated;
grant select on private.glci_target_state to service_role;

create table private.glci_observations (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references private.glci_monitoring_targets(id) on delete restrict,
  checked_at timestamptz not null default now(),
  outcome text not null check (outcome in ('first_seen', 'unchanged', 'changed', 'unreachable', 'integration_failure', 'failed')),
  fingerprint text check (fingerprint is null or fingerprint ~ '^[a-f0-9]{64}$'),
  previous_fingerprint text check (previous_fingerprint is null or previous_fingerprint ~ '^[a-f0-9]{64}$'),
  observed jsonb not null default '{}'::jsonb check (jsonb_typeof(observed) = 'object' and pg_column_size(observed) <= 8192),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z0-9_]{1,80}$'),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  worker_id text check (worker_id is null or char_length(worker_id) <= 120),
  ingestion_job_id uuid references private.legal_source_ingestion_jobs(id) on delete restrict,
  ingestion_note text check (ingestion_note is null or char_length(ingestion_note) <= 300),
  check ((outcome in ('first_seen', 'unchanged', 'changed')) = (fingerprint is not null)),
  check ((outcome in ('unreachable', 'integration_failure', 'failed')) = (failure_code is not null))
);
create index glci_observations_target_idx on private.glci_observations(target_id, checked_at desc);
create index glci_observations_outcome_idx on private.glci_observations(outcome, checked_at desc);
create index glci_observations_job_idx on private.glci_observations(ingestion_job_id);
alter table private.glci_observations enable row level security;
revoke all on private.glci_observations from public, anon, authenticated;
grant select on private.glci_observations to service_role;
create trigger glci_observations_append_only before update or delete on private.glci_observations
  for each row execute function private.reject_append_only_mutation();

-- Every target has a state row (existing targets now, new targets on insert).
insert into private.glci_target_state (target_id) select id from private.glci_monitoring_targets on conflict do nothing;
create or replace function private.glci_create_target_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.glci_target_state (target_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.glci_create_target_state() from public, anon, authenticated;
create trigger glci_monitoring_targets_state after insert on private.glci_monitoring_targets
  for each row execute function private.glci_create_target_state();

-- Effective interval: the target's, else its jurisdiction profile's, else daily.
create or replace function private.glci_target_interval(p_target_id uuid)
returns interval language sql stable security definer set search_path = '' as $$
  select make_interval(mins => coalesce(t.check_interval_minutes, p.check_interval_minutes, 1440))
  from private.glci_monitoring_targets t left join private.glci_jurisdiction_profiles p on p.jurisdiction_code = t.jurisdiction_code
  where t.id = p_target_id
$$;
revoke all on function private.glci_target_interval(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ worker API (service role)
create or replace function public.glci_monitor_claim(p_worker_id text, p_limit integer default 10, p_lease_seconds integer default 300)
returns table (target_key text, jurisdiction_code text, monitor_adapter_key text, official_uri text, config jsonb,
  source_key text, previous_fingerprint text, lease_token uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,120}$' or p_limit not between 1 and 100
    or p_lease_seconds not between 30 and 3600 then
    raise exception 'GLCI_MONITOR_ARGUMENT_INVALID' using errcode = '22023';
  end if;
  return query
  with due as (
    select s.target_id from private.glci_target_state s
      join private.glci_monitoring_targets t on t.id = s.target_id
      where t.status = 'active' and s.next_check_at <= now()
        and (s.lease_expires_at is null or s.lease_expires_at < now())
      order by s.next_check_at limit p_limit
      for update of s skip locked),
  leased as (
    update private.glci_target_state s set lease_owner = p_worker_id, lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from due where s.target_id = due.target_id
    returning s.target_id, s.lease_token, s.last_fingerprint)
  select t.target_key, t.jurisdiction_code, t.monitor_adapter_key, t.official_uri, t.config, src.source_key,
    l.last_fingerprint, l.lease_token
  from leased l join private.glci_monitoring_targets t on t.id = l.target_id
  left join private.legal_sources src on src.id = t.source_id;
end;
$$;

create or replace function public.glci_monitor_record(p_target_key text, p_lease_token uuid, p_fingerprint text, p_observed jsonb,
  p_failure_code text, p_failure_class text, p_duration_ms integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_target private.glci_monitoring_targets;
  v_state private.glci_target_state;
  v_outcome text;
  v_source private.legal_sources;
  v_job uuid;
  v_note text;
begin
  select * into v_target from private.glci_monitoring_targets where target_key = p_target_key;
  select * into v_state from private.glci_target_state where target_id = v_target.id for update;
  if v_target.id is null or p_lease_token is null or v_state.lease_token is distinct from p_lease_token or v_state.lease_expires_at < now() then
    raise exception 'GLCI_MONITOR_LEASE_LOST' using errcode = '42501';
  end if;
  if (p_fingerprint is null) = (p_failure_code is null)
    or (p_fingerprint is not null and p_fingerprint !~ '^[a-f0-9]{64}$')
    or (p_failure_code is not null and (p_failure_code !~ '^[A-Z0-9_]{1,80}$'
      or coalesce(p_failure_class not in ('unreachable', 'integration_failure', 'failed'), true))) then
    raise exception 'GLCI_MONITOR_RESULT_INVALID' using errcode = '22023';
  end if;
  v_outcome := case
    when p_failure_code is not null then p_failure_class
    when v_state.last_fingerprint is null then 'first_seen'
    when v_state.last_fingerprint = p_fingerprint then 'unchanged'
    else 'changed' end;

  if v_outcome = 'changed' then
    select * into v_source from private.legal_sources where id = v_target.source_id;
    if v_source.id is null or not v_source.ingestion_enabled or v_source.adapter_key is null then
      v_note := 'Change detected; source not enabled for ingestion, nothing queued';
    else
      begin
        v_job := public.legal_ingestion_enqueue_job(v_source.id, v_source.adapter_key, v_source.adapter_version,
          'glci:' || v_target.target_key || ':' || p_fingerprint);
        v_note := 'Ingestion job queued';
      exception when others then
        v_note := left('Change detected; ingestion not queued: ' || sqlerrm, 300);
      end;
    end if;
  end if;

  insert into private.glci_observations (target_id, outcome, fingerprint, previous_fingerprint, observed, failure_code, duration_ms,
    worker_id, ingestion_job_id, ingestion_note)
  values (v_target.id, v_outcome, p_fingerprint, v_state.last_fingerprint, coalesce(p_observed, '{}'::jsonb), p_failure_code,
    p_duration_ms, v_state.lease_owner, v_job, v_note);

  update private.glci_target_state set
    last_checked_at = now(),
    last_success_at = case when p_failure_code is null then now() else last_success_at end,
    last_outcome = v_outcome,
    last_fingerprint = coalesce(p_fingerprint, last_fingerprint),
    last_changed_at = case when v_outcome in ('changed', 'first_seen') then now() else last_changed_at end,
    consecutive_failures = case when p_failure_code is null then 0 else consecutive_failures + 1 end,
    -- Failures retry sooner (15 min doubling, never later than the normal interval).
    next_check_at = now() + case when p_failure_code is null then private.glci_target_interval(v_target.id)
      else least(private.glci_target_interval(v_target.id), make_interval(mins => 15 * power(2, least(consecutive_failures, 6))::integer)) end,
    lease_owner = null, lease_token = null, lease_expires_at = null
  where target_id = v_target.id;

  if v_outcome <> 'unchanged' then
    perform private.glci_audit('monitor.' || v_outcome, 'monitoring_target', v_target.target_key,
      jsonb_build_object('fingerprint', p_fingerprint, 'previousFingerprint', v_state.last_fingerprint, 'failureCode', p_failure_code,
        'ingestionJobId', v_job, 'ingestionNote', v_note), 'worker');
  end if;
  return v_outcome;
end;
$$;

-- ------------------------------------------------------------------ status (operators)
create or replace function private.glci_target_currency(p_target_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when t.status <> 'active' then 'not_monitored'
    when s.last_checked_at is null then 'not_checked'
    when s.last_outcome = 'integration_failure' then 'integration_failure'
    when s.last_outcome in ('unreachable', 'failed') then 'check_failing'
    when s.last_success_at < now() - make_interval(hours => coalesce(p.stale_after_hours, 48)) then 'stale'
    when s.last_outcome = 'changed' then 'changed'
    else 'verified' end
  from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
  left join private.glci_jurisdiction_profiles p on p.jurisdiction_code = t.jurisdiction_code
  where t.id = p_target_id
$$;
revoke all on function private.glci_target_currency(uuid) from public, anon, authenticated;

create or replace function public.glci_monitoring_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'targetKey', t.target_key, 'jurisdictionCode', t.jurisdiction_code, 'name', t.name, 'status', t.status,
      'currency', private.glci_target_currency(t.id), 'lastCheckedAt', s.last_checked_at, 'lastSuccessAt', s.last_success_at,
      'lastOutcome', s.last_outcome, 'lastChangedAt', s.last_changed_at, 'consecutiveFailures', s.consecutive_failures,
      'nextCheckAt', s.next_check_at,
      'lastFailureCode', (select o.failure_code from private.glci_observations o where o.target_id = t.id and o.failure_code is not null
        order by o.checked_at desc limit 1))
    order by t.jurisdiction_code, t.target_key)
    from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id), '[]'::jsonb);
end;
$$;

create or replace function public.glci_target_observations(p_target_key text, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object('checkedAt', o.checked_at, 'outcome', o.outcome, 'fingerprint', o.fingerprint,
      'failureCode', o.failure_code, 'observed', o.observed, 'durationMs', o.duration_ms, 'ingestionJobId', o.ingestion_job_id,
      'ingestionNote', o.ingestion_note) order by o.checked_at desc)
    from (select * from private.glci_observations where target_id = (select id from private.glci_monitoring_targets where target_key = p_target_key)
      order by checked_at desc limit greatest(1, least(coalesce(p_limit, 50), 500))) o), '[]'::jsonb);
end;
$$;

-- Operators can ask for an immediate check (it runs at the next worker poll).
create or replace function public.glci_request_check(p_target_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  update private.glci_target_state set next_check_at = now()
    where target_id = (select id from private.glci_monitoring_targets where target_key = p_target_key and status = 'active');
  if not found then raise exception 'GLCI_TARGET_NOT_ACTIVE' using errcode = '22023'; end if;
  perform private.glci_audit('monitor.check_requested', 'monitoring_target', p_target_key);
end;
$$;

revoke all on function public.glci_monitor_claim(text, integer, integer) from public, anon, authenticated;
grant execute on function public.glci_monitor_claim(text, integer, integer) to service_role;
revoke all on function public.glci_monitor_record(text, uuid, text, jsonb, text, text, integer) from public, anon, authenticated;
grant execute on function public.glci_monitor_record(text, uuid, text, jsonb, text, text, integer) to service_role;
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_monitoring_status()', 'public.glci_target_observations(text, integer)',
    'public.glci_request_check(text)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
