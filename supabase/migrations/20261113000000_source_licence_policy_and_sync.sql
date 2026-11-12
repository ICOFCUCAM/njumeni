-- Source-specific licence policies, dataset synchronisation records and item-level retries.
--
-- 1. private.legal_source_licence_policies: an append-only, versioned licence policy per source.
--    A policy states the licence, the attribution, the hosts data may be acquired from, the
--    datasets that are licensed, and which uses are permitted. It applies only to the source it
--    names: sources without a policy keep the general rights-evidence rules, except that model
--    training, fine-tuning and website scraping are never permitted without an explicit policy.
--    The first policy is Lovdata's public API datasets under NLOD 2.0 (owner decision 2026-11-12).
-- 2. Enforcement in the database, independent of the worker:
--    - every new authority version of a source with a policy must come from a permitted
--      acquisition host and a licensed dataset;
--    - such a source cannot be enabled for ingestion unless its licence identifier and
--      attribution match the policy, and it cannot be enabled with web (scraping) access when the
--      policy forbids scraping.
-- 3. private.legal_source_dataset_syncs: one record per completed synchronisation of a dataset
--    (archive SHA-256, size, last-modified, retrieval time). The worker skips an unchanged archive
--    (incremental synchronisation), and authorities no longer present in a complete dataset are
--    flagged, not deleted: their status becomes 'unknown' with the date they left the dataset.
-- 4. private.legal_ingestion_item_failures: per-authority failures with backoff, so a failed item
--    is retried by later jobs and abandoned for operator review after repeated failure.
-- 5. Reranking traceability: each research finding keeps the reranker's trace (version, first-stage
--    rank and score, the legal signals and the reasons), validated and size-bounded.
--    research_record_run and research_get_run are carried forward from 20261111300000 unchanged
--    except for that column.
-- Nothing here approves, activates or enables a source.

-- ------------------------------------------------------------------ licence policies
create table private.legal_source_licence_policies (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  policy_version integer not null check (policy_version > 0),
  licence_identifier text not null check (char_length(licence_identifier) between 1 and 200),
  licence_uri text not null check (licence_uri ~ '^https://[^[:space:]]+$' and char_length(licence_uri) <= 2048),
  attribution_text text not null check (char_length(attribution_text) between 1 and 2000),
  acquisition_hosts text[] not null check (cardinality(acquisition_hosts) between 1 and 10),
  permitted_datasets text[] not null default '{}'::text[] check (cardinality(permitted_datasets) <= 50),
  permitted_uses jsonb not null,
  conditions text[] not null default '{}'::text[] check (cardinality(conditions) <= 30),
  evidence_uris text[] not null check (cardinality(evidence_uris) between 1 and 20),
  legal_basis text not null check (char_length(legal_basis) between 10 and 4000),
  recorded_by text not null check (char_length(recorded_by) between 1 and 200),
  recorded_at timestamptz not null default now(),
  unique (source_id, policy_version),
  check (jsonb_typeof(permitted_uses) = 'object'
    and permitted_uses ?& array['retrieval_augmented_generation','commercial_use','display','quotation',
      'redistribution','model_training','model_fine_tuning','website_scraping']
    and not jsonb_path_exists(permitted_uses, '$.* ? (@.type() != "boolean")'))
);
alter table private.legal_source_licence_policies enable row level security;
revoke all on private.legal_source_licence_policies from public, anon, authenticated;
grant select on private.legal_source_licence_policies to service_role;
create trigger legal_source_licence_policies_append_only
  before update or delete on private.legal_source_licence_policies
  for each row execute function private.reject_append_only_mutation();
comment on table private.legal_source_licence_policies is
  'Append-only, versioned licence policy per source. The latest version applies to that source only.';

create or replace function private.legal_source_licence_policy(p_source_id uuid)
returns private.legal_source_licence_policies
language sql stable security definer set search_path = ''
as $$
  select p.* from private.legal_source_licence_policies p
  where p.source_id = p_source_id order by p.policy_version desc limit 1
$$;
revoke all on function private.legal_source_licence_policy(uuid) from public, anon, authenticated;

-- Uses never permitted without an explicit policy: training, fine-tuning and scraping.
create or replace function private.legal_source_permits_use(p_source_id uuid, p_use text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_policy private.legal_source_licence_policies;
begin
  if p_use not in ('retrieval_augmented_generation','commercial_use','display','quotation',
      'redistribution','model_training','model_fine_tuning','website_scraping') then
    raise exception 'LEGAL_SOURCE_USE_UNKNOWN' using errcode = '22023';
  end if;
  v_policy := private.legal_source_licence_policy(p_source_id);
  if v_policy.id is null then
    return p_use not in ('model_training','model_fine_tuning','website_scraping');
  end if;
  return coalesce((v_policy.permitted_uses ->> p_use)::boolean, false);
end;
$$;
revoke all on function private.legal_source_permits_use(uuid, text) from public, anon, authenticated;

create or replace function public.legal_source_licence_policy_get(p_source_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_source_id uuid;
  v_policy private.legal_source_licence_policies;
begin
  select id into v_source_id from private.legal_sources where source_key = p_source_key;
  if v_source_id is null then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode = 'P0002'; end if;
  v_policy := private.legal_source_licence_policy(v_source_id);
  if v_policy.id is null then return null; end if;
  return jsonb_build_object(
    'sourceKey', p_source_key, 'policyVersion', v_policy.policy_version,
    'licenceIdentifier', v_policy.licence_identifier, 'licenceUri', v_policy.licence_uri,
    'attributionText', v_policy.attribution_text, 'acquisitionHosts', to_jsonb(v_policy.acquisition_hosts),
    'permittedDatasets', to_jsonb(v_policy.permitted_datasets), 'permittedUses', v_policy.permitted_uses,
    'conditions', to_jsonb(v_policy.conditions), 'evidenceUris', to_jsonb(v_policy.evidence_uris),
    'recordedAt', v_policy.recorded_at);
end;
$$;
revoke all on function public.legal_source_licence_policy_get(text) from public, anon, authenticated;
grant execute on function public.legal_source_licence_policy_get(text) to service_role;

create or replace function public.legal_source_record_licence_policy(
  p_source_key text, p_recorded_by text, p_licence_identifier text, p_licence_uri text,
  p_attribution_text text, p_acquisition_hosts text[], p_permitted_datasets text[],
  p_permitted_uses jsonb, p_conditions text[], p_evidence_uris text[], p_legal_basis text
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_source_id uuid;
  v_version integer;
begin
  select id into v_source_id from private.legal_sources where source_key = p_source_key for update;
  if v_source_id is null then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from unnest(coalesce(p_acquisition_hosts, '{}')) h
      where h !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$')
    or exists (select 1 from unnest(coalesce(p_permitted_datasets, '{}')) d where d !~ '^[a-z0-9][a-z0-9._-]{0,120}$') then
    raise exception 'LEGAL_SOURCE_LICENCE_POLICY_INVALID' using errcode = '22023';
  end if;
  select coalesce(max(policy_version), 0) + 1 into v_version
    from private.legal_source_licence_policies where source_id = v_source_id;
  insert into private.legal_source_licence_policies (
    source_id, policy_version, licence_identifier, licence_uri, attribution_text, acquisition_hosts,
    permitted_datasets, permitted_uses, conditions, evidence_uris, legal_basis, recorded_by)
  values (v_source_id, v_version, btrim(p_licence_identifier), p_licence_uri, btrim(p_attribution_text),
    p_acquisition_hosts, coalesce(p_permitted_datasets, '{}'), p_permitted_uses, coalesce(p_conditions, '{}'),
    p_evidence_uris, btrim(p_legal_basis), btrim(p_recorded_by));
  return v_version;
end;
$$;
revoke all on function public.legal_source_record_licence_policy(text, text, text, text, text, text[], text[], jsonb, text[], text[], text)
  from public, anon, authenticated;
grant execute on function public.legal_source_record_licence_policy(text, text, text, text, text, text[], text[], jsonb, text[], text[], text)
  to service_role;

-- Every new version of a source with a policy comes from a permitted host and a licensed dataset.
create or replace function private.enforce_licence_policy_on_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_source_id uuid;
  v_dataset text;
  v_policy private.legal_source_licence_policies;
  v_host text;
begin
  select a.source_id, a.source_metadata ->> 'dataset' into v_source_id, v_dataset
    from private.legal_authorities a where a.id = new.authority_id;
  v_policy := private.legal_source_licence_policy(v_source_id);
  if v_policy.id is null then return new; end if;
  v_host := lower(substring(new.source_uri from '^https://([^/:?#]+)'));
  if v_host is null or not (v_host = any (v_policy.acquisition_hosts)) then
    raise exception 'LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED' using errcode = '42501';
  end if;
  if cardinality(v_policy.permitted_datasets) > 0
    and (v_dataset is null or not (v_dataset = any (v_policy.permitted_datasets))) then
    raise exception 'LEGAL_SOURCE_LICENCE_DATASET_NOT_PERMITTED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_licence_policy_on_version() from public, anon, authenticated;
create trigger legal_authority_versions_licence_policy
  before insert on private.legal_authority_versions
  for each row execute function private.enforce_licence_policy_on_version();

-- A source with a policy is enabled only under that policy's licence and attribution.
create or replace function private.enforce_licence_policy_on_source()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_policy private.legal_source_licence_policies;
begin
  if not new.ingestion_enabled then return new; end if;
  v_policy := private.legal_source_licence_policy(new.id);
  if v_policy.id is null then return new; end if;
  if new.licence_identifier is distinct from v_policy.licence_identifier
    or new.attribution_text is distinct from v_policy.attribution_text then
    raise exception 'LEGAL_SOURCE_LICENCE_POLICY_MISMATCH' using errcode = '42501';
  end if;
  if new.access_method = 'web' and not (v_policy.permitted_uses ->> 'website_scraping')::boolean then
    raise exception 'LEGAL_SOURCE_SCRAPING_NOT_PERMITTED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_licence_policy_on_source() from public, anon, authenticated;
create trigger legal_sources_licence_policy
  before insert or update on private.legal_sources
  for each row execute function private.enforce_licence_policy_on_source();

-- Lovdata: the API datasets, not the website. The source is still planned and not enabled.
update private.legal_sources
  set access_method = 'bulk_download', updated_at = now(),
      coverage = coverage || '{"scope":"Lovdata public API datasets (current laws and central regulations) under NLOD 2.0; not website content"}'::jsonb
  where source_key = 'lovdata-official' and access_method = 'web' and not ingestion_enabled;

insert into private.legal_source_licence_policies (
  source_id, policy_version, licence_identifier, licence_uri, attribution_text, acquisition_hosts,
  permitted_datasets, permitted_uses, conditions, evidence_uris, legal_basis, recorded_by)
select s.id, 1, 'NLOD-2.0', 'https://data.norge.no/nlod/en/2.0',
  'Inneholder data under Norsk lisens for offentlige data (NLOD) 2.0 tilgjengeliggjort av Lovdata. '
    || 'Contains data under the Norwegian Licence for Open Government Data (NLOD) 2.0 made available by Lovdata.',
  array['api.lovdata.no'],
  array['gjeldende-lover.tar.bz2', 'gjeldende-sentrale-forskrifter.tar.bz2'],
  '{"retrieval_augmented_generation":true,"commercial_use":true,"display":true,"quotation":true,
    "redistribution":true,"model_training":false,"model_fine_tuning":false,"website_scraping":false}'::jsonb,
  array[
    'Attribution to Lovdata under NLOD 2.0 must accompany displayed or redistributed material.',
    'Acquire data only from the official API (api.lovdata.no); ordinary website scraping is prohibited (Lovdata user terms).',
    'Only the licensed public API datasets of current laws and central regulations are covered.',
    'Ordinary Lovdata website content must not be used for AI training.',
    'No model fine-tuning on Lovdata material without separate legal confirmation.',
    'This policy does not extend to any other source.'],
  array['https://lovdata.no/info/brukeravtale',
    'https://lovdata.no/artikkel/lovdata_tilrettelegger_for_bruk_tilpasset_var_ki-hverdag_gjor_api_av_oppdatert_regelverk_gratis_tilgjengelig_for_alle/5277',
    'https://api.lovdata.no/',
    'https://data.norge.no/nlod/en/2.0'],
  'Owner decision 2026-11-12: Lovdata releases its public API datasets of current formal laws and central '
    || 'regulations under NLOD 2.0 and directs larger downloads to the API; commercial use and RAG may proceed '
    || 'for those datasets. Website scraping remains prohibited by the user terms.',
  'Owner decision 2026-11-12 (recorded by migration 20261113000000)'
from private.legal_sources s
where s.source_key = 'lovdata-official'
  and not exists (select 1 from private.legal_source_licence_policies p where p.source_id = s.id);

-- ------------------------------------------------------------------ shared lease check
create or replace function private.legal_ingestion_leased_source(p_source_key text, p_job_id uuid, p_lease_token uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_source_id uuid;
begin
  select src.id into v_source_id from private.legal_source_ingestion_jobs job
    join private.legal_sources src on src.id = job.source_id
    where job.id = p_job_id and job.status = 'leased' and src.source_key = p_source_key
      and job.lease_token = p_lease_token and job.lease_expires_at > now();
  if v_source_id is null then raise exception 'LEGAL_INGESTION_LEASE_LOST'; end if;
  return v_source_id;
end;
$$;
revoke all on function private.legal_ingestion_leased_source(text, uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ dataset synchronisation
create table private.legal_source_dataset_syncs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  dataset text not null check (dataset ~ '^[a-z0-9][a-z0-9._-]{0,120}$'),
  dataset_sha256 text not null check (dataset_sha256 ~ '^[a-f0-9]{64}$'),
  dataset_size_bytes bigint not null check (dataset_size_bytes > 0),
  dataset_last_modified timestamptz,
  retrieved_at timestamptz not null,
  source_uri text not null check (source_uri ~ '^https://' and char_length(source_uri) <= 2048),
  job_id uuid references private.legal_source_ingestion_jobs(id) on delete restrict,
  authorities_listed integer not null check (authorities_listed >= 0),
  authorities_absent integer not null default 0 check (authorities_absent >= 0),
  completed_at timestamptz not null default now()
);
create index legal_source_dataset_syncs_source_idx on private.legal_source_dataset_syncs(source_id, dataset, completed_at desc);
create index legal_source_dataset_syncs_job_idx on private.legal_source_dataset_syncs(job_id);
alter table private.legal_source_dataset_syncs enable row level security;
revoke all on private.legal_source_dataset_syncs from public, anon, authenticated;
grant select on private.legal_source_dataset_syncs to service_role;
create trigger legal_source_dataset_syncs_append_only
  before update or delete on private.legal_source_dataset_syncs
  for each row execute function private.reject_append_only_mutation();

create or replace function public.legal_ingestion_last_dataset_sync(p_source_key text, p_dataset text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('datasetSha256', d.dataset_sha256, 'retrievedAt', d.retrieved_at,
    'completedAt', d.completed_at, 'authoritiesListed', d.authorities_listed)
  from private.legal_source_dataset_syncs d join private.legal_sources s on s.id = d.source_id
  where s.source_key = p_source_key and d.dataset = p_dataset
  order by d.completed_at desc limit 1
$$;
revoke all on function public.legal_ingestion_last_dataset_sync(text, text) from public, anon, authenticated;
grant execute on function public.legal_ingestion_last_dataset_sync(text, text) to service_role;

-- Records a complete synchronisation. Authorities of this dataset that the complete listing no
-- longer contains are flagged (status 'unknown', with the date), never deleted.
create or replace function public.legal_ingestion_complete_dataset_sync(
  p_source_key text, p_dataset text, p_dataset_sha256 text, p_dataset_size_bytes bigint,
  p_dataset_last_modified timestamptz, p_retrieved_at timestamptz, p_source_uri text,
  p_listed_external_ids text[], p_job_id uuid, p_lease_token uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_source_id uuid;
  v_absent integer;
begin
  v_source_id := private.legal_ingestion_leased_source(p_source_key, p_job_id, p_lease_token);
  if p_listed_external_ids is null or cardinality(p_listed_external_ids) not between 1 and 100000 then
    raise exception 'LEGAL_INGESTION_DATASET_LISTING_INVALID' using errcode = '22023';
  end if;
  if not private.legal_source_permits_use(v_source_id, 'retrieval_augmented_generation') then
    raise exception 'LEGAL_SOURCE_USE_NOT_PERMITTED' using errcode = '42501';
  end if;
  with absent as (
    update private.legal_authorities a
      set legal_status = 'unknown',
          source_metadata = a.source_metadata || jsonb_build_object(
            'absentFromDatasetSince', p_retrieved_at, 'statusBeforeAbsence', a.legal_status)
      where a.source_id = v_source_id and a.source_metadata ->> 'dataset' = p_dataset
        and not (a.external_id = any (p_listed_external_ids))
        and not (a.source_metadata ? 'absentFromDatasetSince')
      returning 1)
  select count(*) into v_absent from absent;
  -- An authority that reappears in a later dataset loses the absence flag when it is re-ingested
  -- (legal_ingestion_append_authority replaces source_metadata), so it is cleared here too.
  update private.legal_authorities a
    set source_metadata = a.source_metadata - 'absentFromDatasetSince' - 'statusBeforeAbsence'
    where a.source_id = v_source_id and a.source_metadata ->> 'dataset' = p_dataset
      and a.external_id = any (p_listed_external_ids) and a.source_metadata ? 'absentFromDatasetSince';
  insert into private.legal_source_dataset_syncs (source_id, dataset, dataset_sha256, dataset_size_bytes,
    dataset_last_modified, retrieved_at, source_uri, job_id, authorities_listed, authorities_absent)
  values (v_source_id, p_dataset, p_dataset_sha256, p_dataset_size_bytes, p_dataset_last_modified,
    p_retrieved_at, p_source_uri, p_job_id, cardinality(p_listed_external_ids), v_absent);
  return jsonb_build_object('authoritiesListed', cardinality(p_listed_external_ids), 'authoritiesAbsent', v_absent);
end;
$$;
revoke all on function public.legal_ingestion_complete_dataset_sync(text, text, text, bigint, timestamptz, timestamptz, text, text[], uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.legal_ingestion_complete_dataset_sync(text, text, text, bigint, timestamptz, timestamptz, text, text[], uuid, uuid)
  to service_role;

-- ------------------------------------------------------------------ item-level retries
create table private.legal_ingestion_item_failures (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  external_id text not null check (char_length(external_id) between 1 and 512),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'abandoned')),
  failure_code text not null check (failure_code ~ '^[A-Z0-9_]{1,80}$'),
  attempts integer not null default 1 check (attempts between 1 and 1000),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  resolved_at timestamptz,
  last_job_id uuid references private.legal_source_ingestion_jobs(id) on delete restrict,
  unique (source_id, external_id)
);
create index legal_ingestion_item_failures_due_idx on private.legal_ingestion_item_failures(source_id, status, next_attempt_at);
create index legal_ingestion_item_failures_job_idx on private.legal_ingestion_item_failures(last_job_id);
alter table private.legal_ingestion_item_failures enable row level security;
revoke all on private.legal_ingestion_item_failures from public, anon, authenticated;
grant select on private.legal_ingestion_item_failures to service_role;

-- Records the outcome of one item. Retryable failures back off exponentially (1 min doubling to
-- 24 h) and are abandoned after 8 attempts; terminal failures are abandoned after 3; items the
-- source no longer has are abandoned at once. A success resolves the record.
create or replace function public.legal_ingestion_record_item_outcome(
  p_source_key text, p_external_id text, p_succeeded boolean, p_failure_code text,
  p_failure_class text, p_job_id uuid, p_lease_token uuid
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_source_id uuid;
  v_row private.legal_ingestion_item_failures%rowtype;
  v_limit integer;
begin
  v_source_id := private.legal_ingestion_leased_source(p_source_key, p_job_id, p_lease_token);
  if p_external_id is null or char_length(p_external_id) not between 1 and 512 or p_succeeded is null then
    raise exception 'LEGAL_INGESTION_ITEM_OUTCOME_INVALID' using errcode = '22023';
  end if;
  if p_succeeded then
    update private.legal_ingestion_item_failures
      set status = 'resolved', resolved_at = now(), next_attempt_at = null, last_job_id = p_job_id
      where source_id = v_source_id and external_id = p_external_id and status = 'pending';
    return 'resolved';
  end if;
  if p_failure_code is null or p_failure_code !~ '^[A-Z0-9_]{1,80}$'
    or coalesce(p_failure_class not in ('retryable', 'terminal', 'skip'), true) then
    raise exception 'LEGAL_INGESTION_ITEM_OUTCOME_INVALID' using errcode = '22023';
  end if;
  insert into private.legal_ingestion_item_failures (source_id, external_id, failure_code, last_job_id, status, next_attempt_at)
  values (v_source_id, p_external_id, p_failure_code, p_job_id, 'pending', now())
  on conflict (source_id, external_id) do update
    set attempts = case when private.legal_ingestion_item_failures.status = 'pending'
          then private.legal_ingestion_item_failures.attempts + 1 else 1 end,
        failure_code = excluded.failure_code, last_failed_at = now(), last_job_id = p_job_id,
        status = 'pending', resolved_at = null,
        first_failed_at = case when private.legal_ingestion_item_failures.status = 'pending'
          then private.legal_ingestion_item_failures.first_failed_at else now() end
  returning * into v_row;
  v_limit := case p_failure_class when 'retryable' then 8 when 'terminal' then 3 else 1 end;
  if v_row.attempts >= v_limit then
    update private.legal_ingestion_item_failures set status = 'abandoned', next_attempt_at = null where id = v_row.id;
    return 'abandoned';
  end if;
  update private.legal_ingestion_item_failures
    set next_attempt_at = now() + least(interval '24 hours', interval '1 minute' * power(2, v_row.attempts - 1))
    where id = v_row.id;
  return 'pending';
end;
$$;
revoke all on function public.legal_ingestion_record_item_outcome(text, text, boolean, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.legal_ingestion_record_item_outcome(text, text, boolean, text, text, uuid, uuid)
  to service_role;

create or replace function public.legal_ingestion_due_item_retries(p_source_key text, p_limit integer default 25)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(f.external_id order by f.next_attempt_at, f.external_id), '{}'::text[])
  from (select f.external_id, f.next_attempt_at from private.legal_ingestion_item_failures f
    join private.legal_sources s on s.id = f.source_id
    where s.source_key = p_source_key and f.status = 'pending' and f.next_attempt_at <= now()
    order by f.next_attempt_at, f.external_id
    limit greatest(1, least(coalesce(p_limit, 25), 100))) f
$$;
revoke all on function public.legal_ingestion_due_item_retries(text, integer) from public, anon, authenticated;
grant execute on function public.legal_ingestion_due_item_retries(text, integer) to service_role;

comment on function public.legal_ingestion_complete_dataset_sync(text, text, text, bigint, timestamptz, timestamptz, text, text[], uuid, uuid) is
  'Records a complete dataset synchronisation and flags (never deletes) authorities the dataset no longer lists.';
comment on function public.legal_ingestion_record_item_outcome(text, text, boolean, text, text, uuid, uuid) is
  'Per-authority failure accounting with exponential backoff; resolved on success, abandoned for review after repeated failure.';

-- ------------------------------------------------------------------ reranking traceability
alter table private.research_findings add column ranking_trace jsonb
  check (ranking_trace is null or (jsonb_typeof(ranking_trace) = 'object' and pg_column_size(ranking_trace) <= 4096));
comment on column private.research_findings.ranking_trace is
  'Second-stage reranker trace: version, first-stage rank and score, legal signals and reasons.';

-- Keeps only the documented trace fields; anything else (or an oversized trace) is dropped.
create or replace function private.research_ranking_trace(p_trace jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_trace jsonb;
begin
  if p_trace is null or jsonb_typeof(p_trace) <> 'object'
    or coalesce(p_trace ->> 'rerankerVersion' !~ '^[a-z0-9.+-]{1,60}$', true) then
    return null;
  end if;
  v_trace := jsonb_strip_nulls(jsonb_build_object(
    'rerankerVersion', p_trace ->> 'rerankerVersion',
    'firstStageRank', case when jsonb_typeof(p_trace -> 'firstStageRank') = 'number' then p_trace -> 'firstStageRank' end,
    'firstStageScore', case when jsonb_typeof(p_trace -> 'firstStageScore') = 'number' then p_trace -> 'firstStageScore' end,
    'score', case when jsonb_typeof(p_trace -> 'score') = 'number' then p_trace -> 'score' end,
    'features', (select jsonb_object_agg(key, value) from jsonb_each(case when jsonb_typeof(p_trace -> 'features') = 'object' then p_trace -> 'features' else '{}' end)
      where key in ('retrieval','jurisdiction','authority','currency','provision','citation','language') and jsonb_typeof(value) = 'number'),
    'reasons', (select jsonb_agg(left(value #>> '{}', 200)) from jsonb_array_elements(case when jsonb_typeof(p_trace -> 'reasons') = 'array' then p_trace -> 'reasons' else '[]' end)
      with ordinality as r(value, n) where jsonb_typeof(value) = 'string' and n <= 8)));
  return case when pg_column_size(v_trace) <= 4096 then v_trace end;
end;
$$;
revoke all on function private.research_ranking_trace(jsonb) from public, anon, authenticated;

create or replace function public.research_record_run(
  p_organization_id uuid, p_workspace_id uuid, p_question text, p_jurisdiction_code text,
  p_as_of_date date, p_language_codes text[], p_retrieval_mode text, p_limitations jsonb,
  p_engine_version text, p_findings jsonb, p_claims jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_level text;
  v_finding jsonb;
  v_claim jsonb;
  v_claim_id uuid;
  v_ordinal integer := 0;
  v_passage record;
  v_category text;
  v_failures text[];
  v_status text;
  v_has_verified boolean := false;
  v_quote text;
  v_citation text;
  v_quote_permitted boolean;
  v_display_permitted boolean;
  v_passage_id uuid;
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  select status into v_level from private.jurisdictions where code = p_jurisdiction_code;
  if v_level is null then
    raise exception 'RESEARCH_JURISDICTION_UNKNOWN' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_findings, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_claims, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_findings, '[]'::jsonb)) > 50 or jsonb_array_length(coalesce(p_claims, '[]'::jsonb)) > 100 then
    raise exception 'RESEARCH_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  insert into private.research_runs (organization_id, workspace_id, question, jurisdiction_code, as_of_date,
    language_codes, retrieval_mode, status, coverage_level, limitations, engine_version, created_by)
  values (p_organization_id, p_workspace_id, btrim(p_question), p_jurisdiction_code, p_as_of_date,
    p_language_codes, p_retrieval_mode, 'abstained', v_level, coalesce(p_limitations, '[]'::jsonb),
    p_engine_version, private.current_principal_id())
  returning id into v_run_id;

  -- Findings must reference real passages; their authority and version are derived, not trusted.
  for v_finding in select value from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) loop
    insert into private.research_findings (run_id, rank, passage_id, authority_version_id, authority_id, score, ranking_trace)
    select v_run_id, (v_finding ->> 'rank')::integer, passage.id, version.id, version.authority_id,
      least(greatest((v_finding ->> 'score')::real, 0), 1),
      private.research_ranking_trace(v_finding -> 'trace')
    from private.legal_authority_passages passage
    join private.legal_authority_versions version on version.id = passage.authority_version_id
    where passage.id = (v_finding ->> 'passage_id')::uuid;
  end loop;

  for v_claim in select value from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) loop
    v_category := v_claim ->> 'category';
    v_failures := '{}';
    v_quote := nullif(v_claim ->> 'quoted_text', '');
    v_citation := nullif(v_claim ->> 'citation_text', '');
    v_status := 'not_applicable';
    v_passage_id := null;

    if v_category in ('verified_authority', 'conflicting_authority') or v_claim ? 'passage_id' then
      select passage.id, passage.content, version.id as version_id, version.valid_from, version.valid_until,
        authority.id as authority_id, authority.citation, authority.jurisdiction_code, authority.legal_status,
        source.id as source_id, source.rights_status, source.status as source_status, source.ingestion_enabled
      into v_passage
      from private.legal_authority_passages passage
      join private.legal_authority_versions version on version.id = passage.authority_version_id
      join private.legal_authorities authority on authority.id = version.authority_id
      join private.legal_sources source on source.id = authority.source_id
      where passage.id = nullif(v_claim ->> 'passage_id', '')::uuid;
      v_passage_id := v_passage.id;

      select coalesce((e.permissions ->> 'quote')::boolean, false), coalesce((e.permissions ->> 'display')::boolean, false)
      into v_quote_permitted, v_display_permitted
      from private.legal_source_rights_evidence e
      where e.source_id = v_passage.source_id and (e.review_expires_at is null or e.review_expires_at > now());

      -- existence: the cited authority exists in a registered source
      if v_passage_id is null then
        v_failures := array_append(v_failures, 'CITATION_NOT_FOUND');
      else
        -- resolution: a stated citation must match the authority that owns the passage
        if v_citation is not null and lower(btrim(v_citation)) not like lower(btrim(coalesce(v_passage.citation, ''))) || '%' then
          v_failures := array_append(v_failures, 'CITATION_MISMATCH');
        end if;
        -- currency: the version must be in force on the research date, in the same jurisdiction
        if (v_passage.valid_from is not null and v_passage.valid_from > p_as_of_date)
          or (v_passage.valid_until is not null and p_as_of_date >= v_passage.valid_until)
          or v_passage.legal_status in ('repealed', 'expired', 'overruled')
          or v_passage.jurisdiction_code <> p_jurisdiction_code then
          v_failures := array_append(v_failures, 'AUTHORITY_NOT_IN_FORCE_ON_DATE');
        end if;
        -- source rights: approved, active, enabled, display permitted
        if v_passage.rights_status <> 'approved' or v_passage.source_status <> 'active'
          or not v_passage.ingestion_enabled or not coalesce(v_display_permitted, false) then
          v_failures := array_append(v_failures, 'SOURCE_NOT_PERMITTED');
        end if;
        -- quotation: verbatim (whitespace-normalised) and quoting permitted
        if v_quote is not null then
          if not coalesce(v_quote_permitted, false) then
            v_failures := array_append(v_failures, 'QUOTATION_NOT_PERMITTED');
          elsif position(private.normalise_quotation(v_quote) in private.normalise_quotation(v_passage.content)) = 0 then
            v_failures := array_append(v_failures, 'QUOTATION_MISMATCH');
          end if;
        end if;
      end if;
      v_status := case when cardinality(v_failures) = 0 then 'verified' else 'failed' end;
    end if;

    insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, citation_text,
      quoted_text, verification_status, failure_codes)
    values (v_run_id, v_ordinal, v_category, left(v_claim ->> 'statement', 4000),
      v_passage_id,
      v_citation, v_quote, v_status, v_failures)
    returning id into v_claim_id;

    if v_status <> 'not_applicable' then
      insert into private.citation_checks (run_id, claim_id, check_type, passed, detail) values
        (v_run_id, v_claim_id, 'existence', not ('CITATION_NOT_FOUND' = any(v_failures)), null),
        (v_run_id, v_claim_id, 'resolution', not ('CITATION_MISMATCH' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), v_citation),
        (v_run_id, v_claim_id, 'currency', not ('AUTHORITY_NOT_IN_FORCE_ON_DATE' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), p_as_of_date::text),
        (v_run_id, v_claim_id, 'source_rights', not ('SOURCE_NOT_PERMITTED' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), null);
      if v_quote is not null then
        insert into private.citation_checks (run_id, claim_id, check_type, passed, detail)
        values (v_run_id, v_claim_id, 'quotation',
          not ('QUOTATION_MISMATCH' = any(v_failures) or 'QUOTATION_NOT_PERMITTED' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), null);
      end if;
    end if;
    if v_category = 'verified_authority' and v_status = 'verified' then
      v_has_verified := true;
    end if;
    v_ordinal := v_ordinal + 1;
  end loop;

  -- Verified-or-abstain: a run is 'answered' only when at least one law claim verified.
  if v_has_verified then
    -- research_runs is append-only; the status is decided before any reader can see the run,
    -- so the insert-time value is replaced inside this transaction via a guarded path.
    perform set_config('njumeni.research_status_update', v_run_id::text, true);
    update private.research_runs set status = 'answered' where id = v_run_id;
  end if;
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'research.run_recorded',
    'research_run', v_run_id, jsonb_build_object('answered', v_has_verified));
  return v_run_id;
end;
$$;

create or replace function public.research_get_run(p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_run private.research_runs;
begin
  select * into v_run from private.research_runs where id = p_run_id;
  if not found then
    raise exception 'RESEARCH_NOT_AUTHORISED' using errcode = '42501';
  end if;
  perform private.require_research_scope(v_run.organization_id, v_run.workspace_id, 'research.read');
  return jsonb_build_object(
    'id', v_run.id, 'question', v_run.question, 'jurisdictionCode', v_run.jurisdiction_code,
    'asOfDate', v_run.as_of_date, 'languageCodes', to_jsonb(v_run.language_codes),
    'retrievalMode', v_run.retrieval_mode, 'status', v_run.status, 'coverageLevel', v_run.coverage_level,
    'limitations', v_run.limitations, 'engineVersion', v_run.engine_version, 'createdAt', v_run.created_at,
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ordinal', c.ordinal, 'category', c.category, 'statement', c.statement,
        'citation', c.citation_text, 'quotedText', c.quoted_text,
        'verificationStatus', c.verification_status, 'failureCodes', to_jsonb(c.failure_codes),
        'passageId', c.cited_passage_id,
        'authorityTitle', a.title, 'authorityCitation', a.citation,
        'validFrom', v.valid_from, 'validUntil', v.valid_until,
        'sourceUri', coalesce(v.source_uri, a.canonical_uri)
      ) order by c.ordinal)
      from private.research_claims c
      left join private.legal_authority_passages p on p.id = c.cited_passage_id
      left join private.legal_authority_versions v on v.id = p.authority_version_id
      left join private.legal_authorities a on a.id = v.authority_id
      where c.run_id = v_run.id), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object('rank', f.rank, 'passageId', f.passage_id, 'score', f.score,
        'authorityTitle', a.title, 'citation', a.citation, 'rankingTrace', f.ranking_trace) order by f.rank)
      from private.research_findings f join private.legal_authorities a on a.id = f.authority_id
      where f.run_id = v_run.id), '[]'::jsonb),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object('checkType', k.check_type, 'passed', k.passed, 'claimOrdinal', c.ordinal)
        order by c.ordinal, k.check_type)
      from private.citation_checks k join private.research_claims c on c.id = k.claim_id
      where k.run_id = v_run.id), '[]'::jsonb)
  );
end;
$$;
