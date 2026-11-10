-- Phase 2.4 / 2.7: PostgREST service-role wrappers and coverage snapshot.
-- The private functions remain the data-access implementation. These public wrappers
-- are executable only by service_role and are intended for trusted server processes.

create or replace function public.legal_search_passages_lexical(
  p_query text,
  p_jurisdiction_code text,
  p_as_of_date date,
  p_language_codes text[],
  p_authority_types text[] default '{}'::text[],
  p_limit integer default 12
)
returns table(
  passage_id uuid,authority_id uuid,authority_version_id uuid,authority_title text,
  citation text,jurisdiction_code text,authority_type text,language_code text,
  legal_status text,valid_from date,valid_until date,source_uri text,
  source_content_hash text,passage_content text,page_number integer,
  section_path text[],source_key text,lexical_score real
)
language sql security definer set search_path=''
as $$
  select * from private.search_legal_passages_lexical(
    p_query,p_jurisdiction_code,p_as_of_date,p_language_codes,p_authority_types,p_limit
  );
$$;

create or replace function public.legal_search_passages_semantic(
  p_embedding extensions.vector(1536),
  p_embedding_model_key text,
  p_jurisdiction_code text,
  p_as_of_date date,
  p_language_codes text[],
  p_authority_types text[] default '{}'::text[],
  p_limit integer default 12
)
returns table(
  passage_id uuid,authority_id uuid,authority_version_id uuid,authority_title text,
  citation text,jurisdiction_code text,authority_type text,language_code text,
  legal_status text,valid_from date,valid_until date,source_uri text,
  source_content_hash text,passage_content text,page_number integer,
  section_path text[],source_key text,semantic_score real
)
language sql security definer set search_path=''
as $$
  select * from private.search_legal_passages_semantic(
    p_embedding,p_embedding_model_key,p_jurisdiction_code,p_as_of_date,
    p_language_codes,p_authority_types,p_limit
  );
$$;

create or replace function public.legal_jurisdiction_coverage_snapshot(p_jurisdiction_code text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_profile jsonb;
begin
  select jsonb_build_object(
    'jurisdictionCode',j.code,
    'requestedAuthorityTypes',coalesce(j.metadata->'coverageAuthorityTypes','[]'::jsonb),
    'requestedLanguages',to_jsonb(j.official_languages),
    'reviewIntervalDays',coalesce((j.metadata->>'coverageReviewIntervalDays')::integer,90),
    'sources',coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceKey',s.source_key,
        'rightsStatus',s.rights_status,
        'sourceStatus',s.status,
        'ingestionEnabled',s.ingestion_enabled,
        'authorityTypes',coalesce(s.coverage->'authorityTypes','[]'::jsonb),
        'languages',coalesce(s.coverage->'languages','[]'::jsonb),
        'lastVerifiedAt',s.coverage->>'lastVerifiedAt',
        'coverageFrom',s.coverage->'coverageFrom',
        'coverageUntil',s.coverage->'coverageUntil',
        'knownGaps',coalesce(s.coverage->'knownGaps','[]'::jsonb)
      ) order by s.source_key)
      from private.legal_sources s
      left join private.legal_source_rights_evidence e on e.source_id=s.id
      where s.jurisdiction_code=j.code
    ),'[]'::jsonb)
  ) into v_profile
  from private.jurisdictions j where j.code=p_jurisdiction_code;
  if v_profile is null then raise exception 'LEGAL_COVERAGE_JURISDICTION_NOT_FOUND' using errcode='P0002'; end if;
  return v_profile;
end;
$$;

revoke all on function public.legal_search_passages_lexical(text,text,date,text[],text[],integer) from public,anon,authenticated;
revoke all on function public.legal_search_passages_semantic(extensions.vector,text,text,date,text[],text[],integer) from public,anon,authenticated;
revoke all on function public.legal_jurisdiction_coverage_snapshot(text) from public,anon,authenticated;
grant execute on function public.legal_search_passages_lexical(text,text,date,text[],text[],integer) to service_role;
grant execute on function public.legal_search_passages_semantic(extensions.vector,text,text,date,text[],text[],integer) to service_role;
grant execute on function public.legal_jurisdiction_coverage_snapshot(text) to service_role;

comment on function public.legal_search_passages_lexical(text,text,date,text[],text[],integer) is
  'Service-role-only PostgREST wrapper for private lexical legal passage retrieval.';
comment on function public.legal_search_passages_semantic(extensions.vector,text,text,date,text[],text[],integer) is
  'Service-role-only PostgREST wrapper for private semantic legal passage retrieval.';
comment on function public.legal_jurisdiction_coverage_snapshot(text) is
  'Service-role-only snapshot of declared jurisdiction coverage and source-rights review state.';
