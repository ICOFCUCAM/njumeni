-- Phase 2 Task 2.7: jurisdiction coverage levels aligned to Master Plan v2.0 §6.7 (U-21).
--   catalogued -> planned -> pilot -> partial -> supported (and suspended).
-- A published level can never exceed recorded evidence:
--   pilot     requires a live source (rights approved, active, ingestion enabled);
--   partial   additionally requires a passing retrieval evaluation recorded within the review interval;
--   supported additionally requires citation verification and update monitoring, which arrive in
--             Phases 4 and 6, so it is refused for now.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- 1. Five-level vocabulary. Norway returns to 'planned': no Norwegian source is live yet.
alter table private.jurisdictions drop constraint if exists jurisdictions_status_check;
update private.jurisdictions set status = 'planned', updated_at = now()
where status = 'pilot'
  and not exists (
    select 1 from private.legal_sources as source
    where source.jurisdiction_code = jurisdictions.code
      and source.rights_status = 'approved' and source.status = 'active' and source.ingestion_enabled
  );
alter table private.jurisdictions
  add constraint jurisdictions_status_check
  check (status in ('catalogued', 'planned', 'pilot', 'partial', 'supported', 'suspended'));

-- 2. Recorded retrieval evaluations (append-only evidence for the 'partial' level).
create table private.legal_retrieval_evaluations (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references private.jurisdictions (code) on delete restrict,
  dataset_key text not null check (dataset_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  dataset_version integer not null check (dataset_version > 0),
  content_licence text not null check (char_length(content_licence) between 1 and 120),
  case_count integer not null check (case_count > 0),
  passed boolean not null,
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  gates jsonb not null check (jsonb_typeof(gates) = 'array'),
  code_revision text check (code_revision is null or code_revision ~ '^[0-9a-f]{7,40}$'),
  recorded_by text not null check (char_length(recorded_by) between 1 and 200),
  evaluated_at timestamptz not null default now()
);
create index legal_retrieval_evaluations_jurisdiction_idx
  on private.legal_retrieval_evaluations (jurisdiction_code, evaluated_at desc);
alter table private.legal_retrieval_evaluations enable row level security;
revoke all on private.legal_retrieval_evaluations from public, anon, authenticated;
grant select, insert on private.legal_retrieval_evaluations to service_role;
-- A plain append-only guard. private.reject_legal_knowledge_mutation() was later specialised for
-- authority versions and reads OLD.is_current_source_version, so on any other table it failed with
-- 42703 instead of the intended 55000. Relationships are re-pointed to this guard as well.
create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $guard$
begin
  raise exception 'This record is append-only; record a new entry instead' using errcode = '55000';
end;
$guard$;
revoke all on function private.reject_append_only_mutation() from public, anon, authenticated;

drop trigger if exists legal_authority_relationships_immutable on private.legal_authority_relationships;
create trigger legal_authority_relationships_immutable
  before update or delete on private.legal_authority_relationships
  for each row execute function private.reject_append_only_mutation();

create trigger legal_retrieval_evaluations_immutable
  before update or delete on private.legal_retrieval_evaluations
  for each row execute function private.reject_append_only_mutation();
comment on table private.legal_retrieval_evaluations is
  'Append-only record of retrieval evaluation runs; evidence for the partial coverage level.';

create or replace function public.legal_record_retrieval_evaluation(
  p_jurisdiction_code text,
  p_dataset_key text,
  p_dataset_version integer,
  p_content_licence text,
  p_case_count integer,
  p_passed boolean,
  p_metrics jsonb,
  p_gates jsonb,
  p_code_revision text,
  p_recorded_by text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if p_passed is null or p_metrics is null or p_gates is null then
    raise exception 'LEGAL_EVALUATION_RECORD_INVALID' using errcode = '22023';
  end if;
  -- A run may only be recorded as passed when every gate it reports passed.
  if p_passed and exists (
    select 1 from jsonb_array_elements(p_gates) as gate
    where coalesce((gate ->> 'passed')::boolean, false) = false
  ) then
    raise exception 'LEGAL_EVALUATION_PASS_INCONSISTENT' using errcode = '22023';
  end if;
  if p_passed and jsonb_array_length(p_gates) = 0 then
    raise exception 'LEGAL_EVALUATION_PASS_WITHOUT_GATES' using errcode = '22023';
  end if;
  insert into private.legal_retrieval_evaluations (
    jurisdiction_code, dataset_key, dataset_version, content_licence, case_count, passed,
    metrics, gates, code_revision, recorded_by
  ) values (
    p_jurisdiction_code, p_dataset_key, p_dataset_version, p_content_licence, p_case_count,
    p_passed, p_metrics, p_gates, p_code_revision, p_recorded_by
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.legal_record_retrieval_evaluation(text, text, integer, text, integer, boolean, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.legal_record_retrieval_evaluation(text, text, integer, text, integer, boolean, jsonb, jsonb, text, text)
  to service_role;

-- 3. Evidence gate on the published level.
create or replace function private.enforce_jurisdiction_coverage_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_live boolean;
  v_interval integer;
  v_evaluated boolean;
begin
  if new.status in ('catalogued', 'planned', 'suspended') then
    return new;
  end if;
  select exists (
    select 1 from private.legal_sources as source
    where source.jurisdiction_code = new.code
      and source.rights_status = 'approved' and source.status = 'active' and source.ingestion_enabled
  ) into v_live;
  if not v_live then
    raise exception 'LEGAL_COVERAGE_LEVEL_REQUIRES_LIVE_SOURCE' using errcode = '23514';
  end if;
  if new.status = 'pilot' then
    return new;
  end if;
  v_interval := coalesce((new.metadata ->> 'coverageReviewIntervalDays')::integer, 90);
  select exists (
    select 1 from private.legal_retrieval_evaluations as evaluation
    where evaluation.jurisdiction_code = new.code
      and evaluation.passed
      and evaluation.evaluated_at > now() - make_interval(days => v_interval)
      and evaluation.evaluated_at = (
        select max(latest.evaluated_at) from private.legal_retrieval_evaluations as latest
        where latest.jurisdiction_code = new.code)
  ) into v_evaluated;
  if not v_evaluated then
    raise exception 'LEGAL_COVERAGE_LEVEL_REQUIRES_PASSING_EVALUATION' using errcode = '23514';
  end if;
  if new.status = 'partial' then
    return new;
  end if;
  -- 'supported' needs citation verification and update-monitoring evidence (Phases 4 and 6).
  raise exception 'LEGAL_COVERAGE_SUPPORTED_REQUIRES_VERIFICATION_EVIDENCE' using errcode = '23514';
end;
$function$;
revoke all on function private.enforce_jurisdiction_coverage_evidence() from public, anon, authenticated;
create trigger jurisdictions_coverage_evidence
  before insert or update of status on private.jurisdictions
  for each row execute function private.enforce_jurisdiction_coverage_evidence();

-- 4. Coverage snapshot: adds the published level, roadmap flag and latest evaluation, and drops an
--    unused join on rights evidence (one row per source, so it never changed the result).
create or replace function public.legal_jurisdiction_coverage_snapshot(p_jurisdiction_code text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_profile jsonb;
begin
  select jsonb_build_object(
    'jurisdictionCode', j.code,
    'publishedStatus', j.status,
    'onRoadmap', j.status <> 'catalogued',
    'requestedAuthorityTypes', coalesce(j.metadata->'coverageAuthorityTypes', '[]'::jsonb),
    'requestedLanguages', to_jsonb(j.official_languages),
    'reviewIntervalDays', coalesce((j.metadata->>'coverageReviewIntervalDays')::integer, 90),
    'latestEvaluation', (
      select jsonb_build_object(
        'datasetKey', e.dataset_key, 'datasetVersion', e.dataset_version,
        'passed', e.passed, 'evaluatedAt', e.evaluated_at)
      from private.legal_retrieval_evaluations e
      where e.jurisdiction_code = j.code
      order by e.evaluated_at desc, e.id
      limit 1),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceKey', s.source_key,
        'rightsStatus', s.rights_status,
        'sourceStatus', s.status,
        'ingestionEnabled', s.ingestion_enabled,
        'authorityTypes', coalesce(s.coverage->'authorityTypes', '[]'::jsonb),
        'languages', coalesce(s.coverage->'languages', '[]'::jsonb),
        'lastVerifiedAt', s.coverage->>'lastVerifiedAt',
        'coverageFrom', s.coverage->'coverageFrom',
        'coverageUntil', s.coverage->'coverageUntil',
        'knownGaps', coalesce(s.coverage->'knownGaps', '[]'::jsonb)
      ) order by s.source_key)
      from private.legal_sources s
      where s.jurisdiction_code = j.code
    ), '[]'::jsonb)
  ) into v_profile
  from private.jurisdictions j where j.code = p_jurisdiction_code;
  if v_profile is null then
    raise exception 'LEGAL_COVERAGE_JURISDICTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;
revoke all on function public.legal_jurisdiction_coverage_snapshot(text) from public, anon, authenticated;
grant execute on function public.legal_jurisdiction_coverage_snapshot(text) to service_role;
