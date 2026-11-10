-- Phase 2.5: durable ingestion leases, checkpoints and retry scheduling.
-- This migration is additive. It does not enable any legal source or start ingestion.

alter table private.legal_authority_versions
  add column if not exists is_current_source_version boolean not null default true;

create unique index if not exists legal_authority_one_current_version_idx
  on private.legal_authority_versions(authority_id)
  where is_current_source_version;

create table if not exists private.legal_source_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  adapter_key text not null,
  adapter_version text not null,
  status text not null default 'queued'
    check (status in ('queued','leased','succeeded','partial','failed','cancelled','dead_letter')),
  cursor_reference text,
  checkpoint jsonb not null default '{}'::jsonb check (jsonb_typeof(checkpoint)='object'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 30),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  last_failure_code text check (last_failure_code is null or last_failure_code ~ '^[A-Z0-9_]{1,80}$'),
  ingestion_run_id uuid references private.legal_source_ingestion_runs(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='leased') = (lease_token is not null)),
  check ((status='leased') = (lease_owner is not null)),
  check ((status='leased') = (lease_expires_at is not null))
);
create index if not exists legal_ingestion_jobs_claim_idx
  on private.legal_source_ingestion_jobs(available_at,created_at)
  where status='queued';
create index if not exists legal_ingestion_jobs_lease_idx
  on private.legal_source_ingestion_jobs(lease_expires_at)
  where status='leased';
create index if not exists legal_ingestion_jobs_source_idx
  on private.legal_source_ingestion_jobs(source_id,created_at desc);

create table if not exists private.legal_source_ingestion_checkpoints (
  job_id uuid primary key references private.legal_source_ingestion_jobs(id) on delete restrict,
  cursor_reference text,
  completed_external_ids text[] not null default '{}'::text[],
  discovered_count integer not null default 0 check (discovered_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists private.legal_source_ingestion_failures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references private.legal_source_ingestion_jobs(id) on delete restrict,
  external_id text,
  failure_code text not null check (failure_code ~ '^[A-Z0-9_]{1,80}$'),
  failure_class text not null check (failure_class in ('retryable','permanent','skip','cancelled')),
  attempt_number integer not null check (attempt_number > 0),
  detail_hash text,
  occurred_at timestamptz not null default now()
);
create index if not exists legal_ingestion_failures_job_idx
  on private.legal_source_ingestion_failures(job_id,occurred_at desc);

-- All queue operations are performed through narrowly scoped service-role RPCs.
create or replace function public.legal_ingestion_claim_job(p_worker_id text,p_lease_seconds integer default 90)
returns table(job_id uuid,source_id uuid,adapter_key text,adapter_version text,cursor_reference text,checkpoint jsonb,lease_token uuid,attempt_count integer)
language plpgsql security definer set search_path=''
as $$
declare v_job private.legal_source_ingestion_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) not between 1 and 120
    or p_lease_seconds not between 15 and 900 then
    raise exception 'LEGAL_INGESTION_CLAIM_ARGUMENT_INVALID';
  end if;
  update private.legal_source_ingestion_jobs j
    set status=case when j.attempt_count+1>=j.max_attempts then 'dead_letter' else 'queued' end,
        lease_owner=null,lease_token=null,lease_expires_at=null,heartbeat_at=null,
        available_at=now(),updated_at=now()
    where j.status='leased' and j.lease_expires_at<=now()
      and j.attempt_count>=j.max_attempts;
  update private.legal_source_ingestion_jobs j
    set status='queued',lease_owner=null,lease_token=null,lease_expires_at=null,heartbeat_at=null,
        available_at=now(),updated_at=now()
    where j.status='leased' and j.lease_expires_at<=now()
      and j.attempt_count<j.max_attempts;
  select * into v_job from private.legal_source_ingestion_jobs j
    where j.status='queued' and j.available_at<=now()
    order by j.available_at,j.created_at
    for update skip locked limit 1;
  if not found then return; end if;
  update private.legal_source_ingestion_jobs j
    set status='leased',lease_owner=p_worker_id,lease_token=gen_random_uuid(),
        lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
        heartbeat_at=now(),attempt_count=j.attempt_count+1,updated_at=now()
    where j.id=v_job.id returning * into v_job;
  return query select v_job.id,v_job.source_id,v_job.adapter_key,v_job.adapter_version,
    v_job.cursor_reference,v_job.checkpoint,v_job.lease_token,v_job.attempt_count;
end;
$$;

create or replace function public.legal_ingestion_heartbeat(p_job_id uuid,p_lease_token uuid,p_lease_seconds integer default 90)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  if p_lease_seconds not between 15 and 900 then raise exception 'LEGAL_INGESTION_LEASE_INVALID'; end if;
  update private.legal_source_ingestion_jobs
    set heartbeat_at=now(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),updated_at=now()
    where id=p_job_id and status='leased' and lease_token=p_lease_token and lease_expires_at>now();
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;

create or replace function public.legal_ingestion_save_checkpoint(
  p_job_id uuid,p_lease_token uuid,p_cursor text,p_completed_external_ids text[],
  p_discovered integer,p_created integer,p_unchanged integer,p_skipped integer,p_failures integer
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  if least(p_discovered,p_created,p_unchanged,p_skipped,p_failures)<0 then
    raise exception 'LEGAL_INGESTION_CHECKPOINT_INVALID';
  end if;
  if not exists(select 1 from private.legal_source_ingestion_jobs
    where id=p_job_id and status='leased' and lease_token=p_lease_token and lease_expires_at>now()
    for update) then return false; end if;
  insert into private.legal_source_ingestion_checkpoints(job_id,cursor_reference,completed_external_ids,
    discovered_count,created_count,unchanged_count,skipped_count,failure_count,updated_at)
  values(p_job_id,p_cursor,coalesce(p_completed_external_ids,'{}'),p_discovered,p_created,p_unchanged,p_skipped,p_failures,now())
  on conflict(job_id) do update set cursor_reference=excluded.cursor_reference,
    completed_external_ids=excluded.completed_external_ids,discovered_count=excluded.discovered_count,
    created_count=excluded.created_count,unchanged_count=excluded.unchanged_count,
    skipped_count=excluded.skipped_count,failure_count=excluded.failure_count,updated_at=now();
  update private.legal_source_ingestion_jobs set cursor_reference=p_cursor,
    checkpoint=jsonb_build_object(
      'completedExternalIds',coalesce(to_jsonb(p_completed_external_ids),'[]'::jsonb),
      'discovered',p_discovered,'created',p_created,'unchanged',p_unchanged,
      'skipped',p_skipped,'failures',p_failures
    ),updated_at=now() where id=p_job_id and lease_token=p_lease_token;
  return true;
end;
$$;

create or replace function public.legal_ingestion_finish_job(
  p_job_id uuid,p_lease_token uuid,p_status text,p_failure_code text default null,
  p_retry_delay_seconds integer default null
) returns text language plpgsql security definer set search_path=''
as $$
declare v_job private.legal_source_ingestion_jobs%rowtype; v_status text;
begin
  select * into v_job from private.legal_source_ingestion_jobs
    where id=p_job_id and status='leased' and lease_token=p_lease_token and lease_expires_at>now()
    for update;
  if not found then return 'lease_lost'; end if;
  if p_status in ('succeeded','partial','cancelled') then v_status=p_status;
  elsif p_status='failed' and v_job.attempt_count>=v_job.max_attempts then v_status='dead_letter';
  elsif p_status='failed' and p_retry_delay_seconds between 1 and 86400 then v_status='queued';
  elsif p_status='failed' then v_status='dead_letter';
  else raise exception 'LEGAL_INGESTION_FINISH_STATUS_INVALID'; end if;
  update private.legal_source_ingestion_jobs set status=v_status,
    available_at=case when v_status='queued' then now()+make_interval(secs=>p_retry_delay_seconds) else available_at end,
    last_failure_code=p_failure_code,lease_owner=null,lease_token=null,lease_expires_at=null,
    heartbeat_at=null,updated_at=now() where id=p_job_id;
  return v_status;
end;
$$;

revoke all on function public.legal_ingestion_claim_job(text,integer) from public,anon,authenticated;
revoke all on function public.legal_ingestion_heartbeat(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.legal_ingestion_save_checkpoint(uuid,uuid,text,text[],integer,integer,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.legal_ingestion_finish_job(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.legal_ingestion_claim_job(text,integer) to service_role;
grant execute on function public.legal_ingestion_heartbeat(uuid,uuid,integer) to service_role;
grant execute on function public.legal_ingestion_save_checkpoint(uuid,uuid,text,text[],integer,integer,integer,integer,integer) to service_role;
grant execute on function public.legal_ingestion_finish_job(uuid,uuid,text,text,integer) to service_role;
