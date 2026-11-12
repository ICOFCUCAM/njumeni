-- Authority routing (legal-route-1.0.0).
--
-- Plain-language questions often miss the act that answers them: the passages that match their
-- words or meaning best come from other acts, so the right act never reaches the first-stage pool
-- (held-out evaluation, 2026-11-12: 6 of 27 misses). Routing asks first which acts the question is
-- about, using one vector per authority version: the centroid (mean) of its passage embeddings.
-- The research engine then also searches within the top routed acts.
--
-- Same eligibility as passage search: approved, active, ingestion-enabled sources; in force on the
-- as-of date; not repealed, expired or overruled; requested languages and authority types.

create table private.legal_authority_centroids (
  authority_version_id uuid not null references private.legal_authority_versions(id) on delete cascade,
  embedding_model_key text not null references private.legal_embedding_profiles(profile_key),
  centroid extensions.vector not null,
  passage_count integer not null check (passage_count > 0),
  computed_at timestamptz not null default now(),
  primary key (authority_version_id, embedding_model_key)
);
create index legal_authority_centroids_profile_idx on private.legal_authority_centroids(embedding_model_key);
alter table private.legal_authority_centroids enable row level security;
revoke all on private.legal_authority_centroids from public, anon, authenticated;

-- Recompute every centroid of a profile from the stored passage embeddings (worker, after backfill).
create or replace function public.legal_refresh_authority_centroids(p_profile_key text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not exists (select 1 from private.legal_embedding_profiles where profile_key = p_profile_key and status = 'active') then
    raise exception 'LEGAL_EMBEDDING_PROFILE_UNKNOWN' using errcode = '22023';
  end if;
  delete from private.legal_authority_centroids where embedding_model_key = p_profile_key;
  insert into private.legal_authority_centroids (authority_version_id, embedding_model_key, centroid, passage_count)
  select passage.authority_version_id, p_profile_key, extensions.avg(passage.embedding), count(*)
  from private.legal_authority_passages as passage
  where passage.embedding is not null and passage.embedding_model_key = p_profile_key
  group by passage.authority_version_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.legal_refresh_authority_centroids(text) from public, anon, authenticated;
grant execute on function public.legal_refresh_authority_centroids(text) to service_role;

create or replace function private.legal_retrieval_check(
  p_embedding extensions.vector, p_embedding_model_key text, p_jurisdiction_code text, p_as_of_date date,
  p_language_codes text[], p_limit integer
) returns void language plpgsql stable security definer set search_path = '' as $$
declare v_dimensions integer;
begin
  if p_embedding is null or p_embedding_model_key is null or length(btrim(p_embedding_model_key)) = 0 then
    raise exception 'LEGAL_RETRIEVAL_EMBEDDING_PROFILE_REQUIRED' using errcode = '22023';
  end if;
  select profile.dimensions into v_dimensions from private.legal_embedding_profiles as profile
  where profile.profile_key = p_embedding_model_key and profile.status = 'active';
  if v_dimensions is null then raise exception 'LEGAL_RETRIEVAL_EMBEDDING_PROFILE_UNKNOWN' using errcode = '22023'; end if;
  if extensions.vector_dims(p_embedding) <> v_dimensions then
    raise exception 'LEGAL_RETRIEVAL_EMBEDDING_DIMENSION_MISMATCH' using errcode = '22023';
  end if;
  if p_jurisdiction_code is null or p_jurisdiction_code !~ '^[A-Z][A-Z0-9_-]{1,15}$' or p_as_of_date is null then
    raise exception 'LEGAL_RETRIEVAL_SCOPE_INVALID' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_language_codes), 0) = 0 then raise exception 'LEGAL_RETRIEVAL_LANGUAGE_REQUIRED' using errcode = '22023'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then raise exception 'LEGAL_RETRIEVAL_LIMIT_INVALID' using errcode = '22023'; end if;
end;
$$;
revoke all on function private.legal_retrieval_check(extensions.vector, text, text, date, text[], integer) from public, anon, authenticated;

-- The acts a question is about, by centroid similarity.
create or replace function private.route_legal_authorities(
  p_embedding extensions.vector, p_embedding_model_key text, p_jurisdiction_code text, p_as_of_date date,
  p_language_codes text[], p_authority_types text[] default '{}'::text[], p_limit integer default 5
) returns table (authority_id uuid, authority_version_id uuid, route_score real)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.legal_retrieval_check(p_embedding, p_embedding_model_key, p_jurisdiction_code, p_as_of_date, p_language_codes, p_limit);
  return query
  select authority.id, version.id, (1 - (centroid.centroid operator(extensions.<=>) p_embedding))::real
  from private.legal_authority_centroids as centroid
  join private.legal_authority_versions as version on version.id = centroid.authority_version_id
  join private.legal_authorities as authority on authority.id = version.authority_id
  join private.legal_sources as source on source.id = authority.source_id
  where centroid.embedding_model_key = p_embedding_model_key
    and authority.jurisdiction_code = p_jurisdiction_code
    and authority.language_code = any(p_language_codes)
    and (coalesce(cardinality(p_authority_types), 0) = 0 or authority.authority_type = any(p_authority_types))
    and authority.legal_status not in ('repealed', 'expired', 'overruled')
    and (version.valid_from is null or version.valid_from <= p_as_of_date)
    and (version.valid_until is null or p_as_of_date < version.valid_until)
    and source.rights_status = 'approved' and source.status = 'active' and source.ingestion_enabled
  order by centroid.centroid operator(extensions.<=>) p_embedding, authority.id
  limit p_limit;
end;
$$;
revoke all on function private.route_legal_authorities(extensions.vector, text, text, date, text[], text[], integer) from public, anon, authenticated;

-- Semantic passage search restricted to given authorities (the routed acts).
create or replace function private.search_legal_passages_semantic_within(
  p_embedding extensions.vector, p_embedding_model_key text, p_jurisdiction_code text, p_as_of_date date,
  p_language_codes text[], p_authority_ids uuid[], p_limit integer default 12
) returns table (
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, semantic_score real
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.legal_retrieval_check(p_embedding, p_embedding_model_key, p_jurisdiction_code, p_as_of_date, p_language_codes, p_limit);
  if coalesce(cardinality(p_authority_ids), 0) = 0 or cardinality(p_authority_ids) > 20 then
    raise exception 'LEGAL_RETRIEVAL_AUTHORITIES_INVALID' using errcode = '22023';
  end if;
  return query
  select passage.id, authority.id, version.id, authority.title, authority.citation,
    authority.jurisdiction_code, authority.authority_type, authority.language_code,
    authority.legal_status, version.valid_from, version.valid_until,
    coalesce(version.source_uri, authority.canonical_uri), version.source_content_hash, passage.content,
    passage.page_number, passage.section_path, source.source_key,
    (1 - (passage.embedding operator(extensions.<=>) p_embedding))::real
  from private.legal_authority_passages as passage
  join private.legal_authority_versions as version on version.id = passage.authority_version_id
  join private.legal_authorities as authority on authority.id = version.authority_id
  join private.legal_sources as source on source.id = authority.source_id
  where authority.id = any(p_authority_ids)
    and authority.jurisdiction_code = p_jurisdiction_code
    and authority.language_code = any(p_language_codes)
    and authority.legal_status not in ('repealed', 'expired', 'overruled')
    and (version.valid_from is null or version.valid_from <= p_as_of_date)
    and (version.valid_until is null or p_as_of_date < version.valid_until)
    and source.rights_status = 'approved' and source.status = 'active' and source.ingestion_enabled
    and passage.embedding is not null and passage.embedding_model_key = p_embedding_model_key
  order by passage.embedding operator(extensions.<=>) p_embedding, authority.id, passage.id
  limit p_limit;
end;
$$;
revoke all on function private.search_legal_passages_semantic_within(extensions.vector, text, text, date, text[], uuid[], integer) from public, anon, authenticated;

-- Trusted worker / evaluation (service role).
create or replace function public.legal_route_authorities(
  p_embedding extensions.vector, p_embedding_model_key text, p_jurisdiction_code text, p_as_of_date date,
  p_language_codes text[], p_authority_types text[] default '{}'::text[], p_limit integer default 5
) returns table (authority_id uuid, authority_version_id uuid, route_score real)
language sql stable security definer set search_path = '' as $$
  select * from private.route_legal_authorities(p_embedding, p_embedding_model_key, p_jurisdiction_code, p_as_of_date,
    p_language_codes, p_authority_types, p_limit)
$$;
create or replace function public.legal_search_passages_semantic_within(
  p_embedding extensions.vector, p_embedding_model_key text, p_jurisdiction_code text, p_as_of_date date,
  p_language_codes text[], p_authority_ids uuid[], p_limit integer default 12
) returns table (
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, semantic_score real
) language sql stable security definer set search_path = '' as $$
  select * from private.search_legal_passages_semantic_within(p_embedding, p_embedding_model_key, p_jurisdiction_code,
    p_as_of_date, p_language_codes, p_authority_ids, p_limit)
$$;
revoke all on function public.legal_route_authorities(extensions.vector, text, text, date, text[], text[], integer) from public, anon, authenticated;
revoke all on function public.legal_search_passages_semantic_within(extensions.vector, text, text, date, text[], uuid[], integer) from public, anon, authenticated;
grant execute on function public.legal_route_authorities(extensions.vector, text, text, date, text[], text[], integer) to service_role;
grant execute on function public.legal_search_passages_semantic_within(extensions.vector, text, text, date, text[], uuid[], integer) to service_role;

-- Research engine (workspace-scoped; re-checks research.create for the caller).
create or replace function public.research_route_authorities(
  p_organization_id uuid, p_workspace_id uuid, p_embedding extensions.vector, p_embedding_model_key text,
  p_jurisdiction_code text, p_as_of_date date, p_language_codes text[], p_authority_types text[] default '{}'::text[],
  p_limit integer default 5
) returns table (authority_id uuid, authority_version_id uuid, route_score real)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  return query select * from private.route_legal_authorities(p_embedding, p_embedding_model_key, p_jurisdiction_code,
    p_as_of_date, p_language_codes, p_authority_types, p_limit);
end;
$$;
create or replace function public.research_search_semantic_within(
  p_organization_id uuid, p_workspace_id uuid, p_embedding extensions.vector, p_embedding_model_key text,
  p_jurisdiction_code text, p_as_of_date date, p_language_codes text[], p_authority_ids uuid[], p_limit integer default 12
) returns table (
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, semantic_score real
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  return query select * from private.search_legal_passages_semantic_within(p_embedding, p_embedding_model_key,
    p_jurisdiction_code, p_as_of_date, p_language_codes, p_authority_ids, p_limit);
end;
$$;
revoke all on function public.research_route_authorities(uuid, uuid, extensions.vector, text, text, date, text[], text[], integer) from public, anon;
revoke all on function public.research_search_semantic_within(uuid, uuid, extensions.vector, text, text, date, text[], uuid[], integer) from public, anon;
grant execute on function public.research_route_authorities(uuid, uuid, extensions.vector, text, text, date, text[], text[], integer) to authenticated, service_role;
grant execute on function public.research_search_semantic_within(uuid, uuid, extensions.vector, text, text, date, text[], uuid[], integer) to authenticated, service_role;
