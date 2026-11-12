-- Phase 2 Task 2.9: embedding profile (owner decision D-3, 2026-11-11) and language-aware
-- full-text search (Master Plan v2.0 U-22). Forward migration; nothing is deployed to the hosted
-- project until all phases are complete (ADR-0003 section 2.5).

-- 1. Versioned embedding profiles. Embeddings from different profiles are never mixed.
create table private.legal_embedding_profiles (
  profile_key text primary key check (profile_key ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  model_id text not null check (char_length(model_id) between 1 and 200),
  runtime_model_id text not null check (char_length(runtime_model_id) between 1 and 200),
  dimensions integer not null check (dimensions between 16 and 4096),
  distance_metric text not null default 'cosine' check (distance_metric = 'cosine'),
  normalised boolean not null default true,
  query_prefix text not null default '',
  passage_prefix text not null default '',
  max_input_tokens integer not null check (max_input_tokens > 0),
  language_codes text[] not null check (cardinality(language_codes) > 0),
  licence text not null check (char_length(licence) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);
alter table private.legal_embedding_profiles enable row level security;
revoke all on private.legal_embedding_profiles from public, anon, authenticated;
grant select on private.legal_embedding_profiles to service_role;
comment on table private.legal_embedding_profiles is
  'Versioned embedding model profiles. The passage embedding column dimension equals the active profile dimension; a profile with another dimension requires a forward migration.';

insert into private.legal_embedding_profiles (
  profile_key, model_id, runtime_model_id, dimensions, query_prefix, passage_prefix,
  max_input_tokens, language_codes, licence
) values (
  'multilingual-e5-small-v1', 'intfloat/multilingual-e5-small', 'Xenova/multilingual-e5-small',
  384, 'query: ', 'passage: ', 512, array['nb', 'nn', 'no', 'en', 'fr'], 'MIT'
);

-- 2. Re-dimension the passage embedding column from the 1536 placeholder to the selected profile.
do $guard$
begin
  if exists (select 1 from private.legal_authority_passages where embedding is not null) then
    raise exception 'Existing embeddings must be migrated explicitly before changing the profile dimension'
      using errcode = '55000';
  end if;
end;
$guard$;

drop index if exists private.legal_authority_passages_embedding_hnsw_idx;
alter table private.legal_authority_passages
  alter column embedding type extensions.vector(384);
alter table private.legal_authority_passages
  add constraint legal_authority_passages_embedding_profile_fk
  foreign key (embedding_model_key) references private.legal_embedding_profiles (profile_key);
create index legal_authority_passages_embedding_hnsw_idx
  on private.legal_authority_passages using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- 3. Language-aware full-text search. The text-search configuration follows the authority language.
create or replace function private.legal_text_search_config(p_language_code text)
returns regconfig
language sql
stable
parallel safe
set search_path = ''
as $config$
  select (case lower(split_part(coalesce(p_language_code, ''), '-', 1))
    when 'nb' then 'pg_catalog.norwegian'
    when 'nn' then 'pg_catalog.norwegian'
    when 'no' then 'pg_catalog.norwegian'
    when 'nob' then 'pg_catalog.norwegian'
    when 'nno' then 'pg_catalog.norwegian'
    when 'en' then 'pg_catalog.english'
    when 'eng' then 'pg_catalog.english'
    when 'fr' then 'pg_catalog.french'
    when 'fra' then 'pg_catalog.french'
    when 'fre' then 'pg_catalog.french'
    when 'de' then 'pg_catalog.german'
    when 'sv' then 'pg_catalog.swedish'
    when 'da' then 'pg_catalog.danish'
    else 'pg_catalog.simple'
  end)::regconfig;
$config$;
revoke all on function private.legal_text_search_config(text) from public, anon, authenticated;
grant execute on function private.legal_text_search_config(text) to service_role;

do $guard$
begin
  if exists (select 1 from private.legal_authority_passages) then
    raise exception 'Existing passages must be re-indexed explicitly before changing the search configuration'
      using errcode = '55000';
  end if;
end;
$guard$;

alter table private.legal_authority_passages drop column search_vector;
alter table private.legal_authority_passages
  add column search_config regconfig not null default 'pg_catalog.simple'::regconfig;
alter table private.legal_authority_passages
  add column search_vector tsvector generated always as (to_tsvector(search_config, content)) stored;
create index legal_authority_passages_search_idx
  on private.legal_authority_passages using gin (search_vector);
create index legal_authority_passages_search_config_idx
  on private.legal_authority_passages (search_config);

create or replace function private.set_legal_passage_search_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
begin
  select private.legal_text_search_config(authority.language_code)
    into new.search_config
  from private.legal_authority_versions as version
  join private.legal_authorities as authority on authority.id = version.authority_id
  where version.id = new.authority_version_id;
  new.search_config := coalesce(new.search_config, 'pg_catalog.simple'::regconfig);
  return new;
end;
$trigger$;
revoke all on function private.set_legal_passage_search_config() from public, anon, authenticated;
create trigger legal_authority_passages_search_config
  before insert on private.legal_authority_passages
  for each row execute function private.set_legal_passage_search_config();

-- 4. Passages stay append-only for legal content; only derived embedding fields may be written.
drop trigger if exists legal_authority_passages_immutable on private.legal_authority_passages;
create or replace function private.guard_legal_passage_mutation()
returns trigger
language plpgsql
set search_path = ''
as $guard$
begin
  if tg_op = 'DELETE'
    or (new.id, new.authority_version_id, new.ordinal, new.page_number, new.section_path,
        new.start_offset, new.end_offset, new.content, new.content_hash, new.search_config,
        new.created_at)
      is distinct from
       (old.id, old.authority_version_id, old.ordinal, old.page_number, old.section_path,
        old.start_offset, old.end_offset, old.content, old.content_hash, old.search_config,
        old.created_at) then
    raise exception 'Legal knowledge history is append-only; create a new version or relationship'
      using errcode = '55000';
  end if;
  return new;
end;
$guard$;
revoke all on function private.guard_legal_passage_mutation() from public, anon, authenticated;
create trigger legal_authority_passages_immutable
  before update or delete on private.legal_authority_passages
  for each row execute function private.guard_legal_passage_mutation();

-- 5. Lexical retrieval: one query per requested language configuration.
create or replace function private.search_legal_passages_lexical(
  p_query text,
  p_jurisdiction_code text,
  p_as_of_date date,
  p_language_codes text[],
  p_authority_types text[] default '{}'::text[],
  p_limit integer default 12
)
returns table(
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, lexical_score real
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_query is null or length(btrim(p_query)) = 0 or length(p_query) > 4000 then
    raise exception 'LEGAL_RETRIEVAL_QUERY_INVALID' using errcode = '22023';
  end if;
  if p_jurisdiction_code is null
    or p_jurisdiction_code !~ '^[A-Z][A-Z0-9_-]{1,15}$'
    or p_as_of_date is null then
    raise exception 'LEGAL_RETRIEVAL_SCOPE_INVALID' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_language_codes), 0) = 0 then
    raise exception 'LEGAL_RETRIEVAL_LANGUAGE_REQUIRED' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'LEGAL_RETRIEVAL_LIMIT_INVALID' using errcode = '22023';
  end if;

  return query
  with configs as (
    select distinct private.legal_text_search_config(code) as config
    from unnest(p_language_codes) as code
  ),
  queries as (
    select config, websearch_to_tsquery(config, p_query) as query from configs
  )
  select
    passage.id, authority.id, version.id, authority.title, authority.citation,
    authority.jurisdiction_code, authority.authority_type, authority.language_code,
    authority.legal_status, version.valid_from, version.valid_until,
    coalesce(version.source_uri, authority.canonical_uri),
    version.source_content_hash, passage.content, passage.page_number, passage.section_path,
    source.source_key, ts_rank_cd(passage.search_vector, queries.query)::real
  from queries
  join private.legal_authority_passages as passage
    on passage.search_config = queries.config and passage.search_vector @@ queries.query
  join private.legal_authority_versions as version on version.id = passage.authority_version_id
  join private.legal_authorities as authority on authority.id = version.authority_id
  join private.legal_sources as source on source.id = authority.source_id
  where authority.jurisdiction_code = p_jurisdiction_code
    and authority.language_code = any(p_language_codes)
    and (coalesce(cardinality(p_authority_types), 0) = 0
      or authority.authority_type = any(p_authority_types))
    and authority.legal_status not in ('repealed', 'expired', 'overruled')
    and (version.valid_from is null or version.valid_from <= p_as_of_date)
    and (version.valid_until is null or p_as_of_date < version.valid_until)
    and source.rights_status = 'approved'
    and source.status = 'active'
    and source.ingestion_enabled
  order by ts_rank_cd(passage.search_vector, queries.query) desc, authority.id, passage.id
  limit p_limit;
end;
$function$;

-- 6. Semantic retrieval: the profile must exist, be active and match the vector dimension.
create or replace function private.search_legal_passages_semantic(
  p_embedding extensions.vector,
  p_embedding_model_key text,
  p_jurisdiction_code text,
  p_as_of_date date,
  p_language_codes text[],
  p_authority_types text[] default '{}'::text[],
  p_limit integer default 12
)
returns table(
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, semantic_score real
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dimensions integer;
begin
  if p_embedding is null or p_embedding_model_key is null
    or length(btrim(p_embedding_model_key)) = 0 then
    raise exception 'LEGAL_RETRIEVAL_EMBEDDING_PROFILE_REQUIRED' using errcode = '22023';
  end if;
  select profile.dimensions into v_dimensions
  from private.legal_embedding_profiles as profile
  where profile.profile_key = p_embedding_model_key and profile.status = 'active';
  if v_dimensions is null then
    raise exception 'LEGAL_RETRIEVAL_EMBEDDING_PROFILE_UNKNOWN' using errcode = '22023';
  end if;
  if extensions.vector_dims(p_embedding) <> v_dimensions then
    raise exception 'LEGAL_RETRIEVAL_EMBEDDING_DIMENSION_MISMATCH' using errcode = '22023';
  end if;
  if p_jurisdiction_code is null
    or p_jurisdiction_code !~ '^[A-Z][A-Z0-9_-]{1,15}$'
    or p_as_of_date is null then
    raise exception 'LEGAL_RETRIEVAL_SCOPE_INVALID' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_language_codes), 0) = 0 then
    raise exception 'LEGAL_RETRIEVAL_LANGUAGE_REQUIRED' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'LEGAL_RETRIEVAL_LIMIT_INVALID' using errcode = '22023';
  end if;

  return query
  select
    passage.id, authority.id, version.id, authority.title, authority.citation,
    authority.jurisdiction_code, authority.authority_type, authority.language_code,
    authority.legal_status, version.valid_from, version.valid_until,
    coalesce(version.source_uri, authority.canonical_uri),
    version.source_content_hash, passage.content, passage.page_number, passage.section_path,
    source.source_key,
    (1 - (passage.embedding OPERATOR(extensions.<=>) p_embedding))::real
  from private.legal_authority_passages as passage
  join private.legal_authority_versions as version on version.id = passage.authority_version_id
  join private.legal_authorities as authority on authority.id = version.authority_id
  join private.legal_sources as source on source.id = authority.source_id
  where authority.jurisdiction_code = p_jurisdiction_code
    and authority.language_code = any(p_language_codes)
    and (coalesce(cardinality(p_authority_types), 0) = 0
      or authority.authority_type = any(p_authority_types))
    and authority.legal_status not in ('repealed', 'expired', 'overruled')
    and (version.valid_from is null or version.valid_from <= p_as_of_date)
    and (version.valid_until is null or p_as_of_date < version.valid_until)
    and source.rights_status = 'approved'
    and source.status = 'active'
    and source.ingestion_enabled
    and passage.embedding is not null
    and passage.embedding_model_key = p_embedding_model_key
  order by passage.embedding OPERATOR(extensions.<=>) p_embedding, authority.id, passage.id
  limit p_limit;
end;
$function$;

-- 7. Worker-only embedding backfill. Only passages from approved, active, enabled sources.
create or replace function public.legal_embedding_pending_passages(
  p_profile_key text,
  p_limit integer default 64
)
returns table(passage_id uuid, content text, language_code text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from private.legal_embedding_profiles as profile
    where profile.profile_key = p_profile_key and profile.status = 'active'
  ) then
    raise exception 'LEGAL_EMBEDDING_PROFILE_UNKNOWN' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 256 then
    raise exception 'LEGAL_EMBEDDING_LIMIT_INVALID' using errcode = '22023';
  end if;
  return query
  select passage.id, passage.content, authority.language_code
  from private.legal_authority_passages as passage
  join private.legal_authority_versions as version on version.id = passage.authority_version_id
  join private.legal_authorities as authority on authority.id = version.authority_id
  join private.legal_sources as source on source.id = authority.source_id
  where source.rights_status = 'approved'
    and source.status = 'active'
    and source.ingestion_enabled
    and (passage.embedding is null or passage.embedding_model_key is distinct from p_profile_key)
  order by passage.created_at, passage.id
  limit p_limit;
end;
$function$;
revoke all on function public.legal_embedding_pending_passages(text, integer)
  from public, anon, authenticated;
grant execute on function public.legal_embedding_pending_passages(text, integer) to service_role;

create or replace function public.legal_embedding_store(
  p_profile_key text,
  p_embeddings jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dimensions integer;
  v_item jsonb;
  v_passage_id uuid;
  v_vector extensions.vector;
  v_updated integer := 0;
  v_rows integer;
begin
  select profile.dimensions into v_dimensions
  from private.legal_embedding_profiles as profile
  where profile.profile_key = p_profile_key and profile.status = 'active';
  if v_dimensions is null then
    raise exception 'LEGAL_EMBEDDING_PROFILE_UNKNOWN' using errcode = '22023';
  end if;
  if p_embeddings is null or jsonb_typeof(p_embeddings) <> 'array'
    or jsonb_array_length(p_embeddings) = 0 or jsonb_array_length(p_embeddings) > 256 then
    raise exception 'LEGAL_EMBEDDING_BATCH_INVALID' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_embeddings) loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item -> 'passage_id') <> 'string'
      or jsonb_typeof(v_item -> 'embedding') <> 'array'
      or jsonb_array_length(v_item -> 'embedding') <> v_dimensions then
      raise exception 'LEGAL_EMBEDDING_DIMENSION_MISMATCH' using errcode = '22023';
    end if;
    v_passage_id := (v_item ->> 'passage_id')::uuid;
    v_vector := (v_item ->> 'embedding')::extensions.vector;

    update private.legal_authority_passages as passage
    set embedding = v_vector, embedding_model_key = p_profile_key
    from private.legal_authority_versions as version,
         private.legal_authorities as authority,
         private.legal_sources as source
    where passage.id = v_passage_id
      and version.id = passage.authority_version_id
      and authority.id = version.authority_id
      and source.id = authority.source_id
      and source.rights_status = 'approved'
      and source.status = 'active'
      and source.ingestion_enabled;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'LEGAL_EMBEDDING_PASSAGE_NOT_ELIGIBLE' using errcode = '22023';
    end if;
    v_updated := v_updated + v_rows;
  end loop;
  return v_updated;
end;
$function$;
revoke all on function public.legal_embedding_store(text, jsonb) from public, anon, authenticated;
grant execute on function public.legal_embedding_store(text, jsonb) to service_role;

comment on table private.legal_authority_passages is
  'Version-bound passages with stable anchors, language-aware full-text search and optional embeddings bound to a registered embedding profile.';
