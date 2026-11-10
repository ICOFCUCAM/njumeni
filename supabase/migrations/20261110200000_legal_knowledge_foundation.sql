-- Phase 2.1: legal knowledge registry, authority versioning and retrieval substrate.
-- Additive only. No hosted migration is authorised by this change.
-- Source ingestion remains disabled until source rights and adapter policies are approved.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table private.jurisdictions (
  code text primary key check (code ~ '^[A-Z][A-Z0-9_-]{1,15}$'),
  parent_code text references private.jurisdictions(code) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  short_name text not null check (char_length(short_name) between 1 and 80),
  legal_system text not null check (legal_system in ('common_law','civil_law','mixed','supranational','international','other')),
  status text not null default 'planned' check (status in ('planned','pilot','supported','suspended')),
  official_languages text[] not null default '{}'::text[],
  court_hierarchy jsonb not null default '[]'::jsonb check (jsonb_typeof(court_hierarchy) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_code is null or parent_code <> code)
);
create index jurisdictions_parent_idx on private.jurisdictions(parent_code);
create index jurisdictions_status_idx on private.jurisdictions(status);

create table private.legal_sources (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text references private.jurisdictions(code) on delete restrict,
  source_key text not null check (source_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  name text not null check (char_length(name) between 1 and 200),
  issuing_authority text not null check (char_length(issuing_authority) between 1 and 200),
  source_type text not null check (source_type in ('legislation','case_law','regulation','treaty','official_guidance','court_portal','gazette','other')),
  base_uri text check (base_uri is null or (char_length(base_uri) <= 2048 and base_uri ~ '^https://')),
  access_method text not null default 'manual' check (access_method in ('manual','api','bulk_download','feed','mcp','web')),
  rights_status text not null default 'review_required' check (rights_status in ('review_required','approved','restricted','prohibited')),
  licence_identifier text,
  attribution_text text,
  ingestion_enabled boolean not null default false,
  status text not null default 'planned' check (status in ('planned','active','paused','retired')),
  coverage jsonb not null default '{}'::jsonb check (jsonb_typeof(coverage) = 'object'),
  adapter_key text check (adapter_key is null or adapter_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jurisdiction_code, source_key),
  check (not ingestion_enabled or (rights_status = 'approved' and status = 'active' and licence_identifier is not null and attribution_text is not null))
);
create index legal_sources_jurisdiction_status_idx on private.legal_sources(jurisdiction_code,status,source_type);

create table private.legal_authorities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  jurisdiction_code text references private.jurisdictions(code) on delete restrict,
  external_id text not null check (char_length(external_id) between 1 and 512),
  citation text check (citation is null or char_length(citation) <= 512),
  title text not null check (char_length(title) between 1 and 2000),
  authority_type text not null check (authority_type in ('constitution','act','statutory_instrument','regulation','judgment','decision','treaty','directive','regulation_eu','official_guidance','order','other')),
  issuing_body text,
  language_code text check (language_code is null or language_code ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  canonical_uri text check (canonical_uri is null or (char_length(canonical_uri) <= 2048 and canonical_uri ~ '^https://')),
  publication_date date,
  legal_status text not null default 'unknown' check (legal_status in ('in_force','amended','repealed','expired','overruled','unknown')),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index legal_authorities_jurisdiction_type_idx on private.legal_authorities(jurisdiction_code,authority_type,publication_date desc);
create index legal_authorities_citation_idx on private.legal_authorities using gin (to_tsvector('simple',coalesce(citation,'')));

create table private.legal_authority_versions (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid not null references private.legal_authorities(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  version_label text,
  valid_from date,
  valid_until date,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  source_uri text check (source_uri is null or (char_length(source_uri) <= 2048 and source_uri ~ '^https://')),
  source_content_hash text not null check (source_content_hash ~ '^[a-f0-9]{64}$'),
  normalised_content_hash text check (normalised_content_hash is null or normalised_content_hash ~ '^[a-f0-9]{64}$'),
  normalised_text text,
  storage_reference text,
  normalisation_profile text,
  is_current_source_version boolean not null default true,
  created_at timestamptz not null default now(),
  unique (authority_id,version_number),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (normalised_text is null or char_length(normalised_text) <= 50000000),
  check (normalised_text is null or normalised_content_hash is not null),
  check (normalised_text is null or storage_reference is null)
);
create unique index legal_authority_one_current_version_idx on private.legal_authority_versions(authority_id) where is_current_source_version;
create index legal_authority_versions_effective_idx on private.legal_authority_versions(authority_id,valid_from,valid_until);
create index legal_authority_versions_retrieved_idx on private.legal_authority_versions(retrieved_at desc);

create table private.legal_authority_passages (
  id uuid primary key default gen_random_uuid(),
  authority_version_id uuid not null references private.legal_authority_versions(id) on delete restrict,
  ordinal integer not null check (ordinal >= 0),
  page_number integer check (page_number is null or page_number > 0),
  section_path text[] not null default '{}'::text[],
  start_offset integer check (start_offset is null or start_offset >= 0),
  end_offset integer check (end_offset is null or end_offset >= 0),
  content text not null check (char_length(content) between 1 and 100000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig,content)) stored,
  embedding extensions.vector(1536),
  embedding_model_key text,
  created_at timestamptz not null default now(),
  unique (authority_version_id,ordinal),
  check (end_offset is null or start_offset is null or end_offset >= start_offset),
  check ((embedding is null) = (embedding_model_key is null))
);
create index legal_authority_passages_search_idx on private.legal_authority_passages using gin(search_vector);
create index legal_authority_passages_embedding_hnsw_idx on private.legal_authority_passages using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null;
create index legal_authority_passages_version_idx on private.legal_authority_passages(authority_version_id,ordinal);

create table private.legal_authority_relationships (
  id uuid primary key default gen_random_uuid(),
  from_authority_id uuid not null references private.legal_authorities(id) on delete restrict,
  to_authority_id uuid not null references private.legal_authorities(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('amends','amended_by','repeals','repealed_by','implements','implemented_by','interprets','applies','distinguishes','overrules','overruled_by','cites','related')),
  effective_from date,
  source_note text,
  provenance_uri text check (provenance_uri is null or (char_length(provenance_uri) <= 2048 and provenance_uri ~ '^https://')),
  created_at timestamptz not null default now(),
  unique (from_authority_id,to_authority_id,relationship_type),
  check (from_authority_id <> to_authority_id)
);
create index legal_authority_relationships_from_idx on private.legal_authority_relationships(from_authority_id,relationship_type);
create index legal_authority_relationships_to_idx on private.legal_authority_relationships(to_authority_id,relationship_type);

create table private.legal_source_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  adapter_key text not null,
  adapter_version text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z0-9_]{1,80}$'),
  cursor_reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);
create index legal_source_ingestion_runs_source_idx on private.legal_source_ingestion_runs(source_id,requested_at desc);

-- Priority catalogue only; no seeded jurisdiction is represented as fully supported.
insert into private.jurisdictions(code,name,short_name,legal_system,status,official_languages,metadata) values
('NO','Kingdom of Norway','Norway','civil_law','pilot',array['no','nn','se'],'{"priority":1}'::jsonb),
('EU','European Union','European Union','supranational','planned',array['bg','cs','da','de','el','en','es','et','fi','fr','ga','hr','hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'],'{"priority":2}'::jsonb),
('GB','United Kingdom','United Kingdom','mixed','planned',array['en'],'{"priority":3}'::jsonb),
('US','United States of America','United States','common_law','planned',array['en'],'{"priority":4}'::jsonb),
('INTL','Public International Law','International','international','planned',array['en','fr','es','ar','zh','ru'],'{"priority":5}'::jsonb),
('CM','Republic of Cameroon','Cameroon','mixed','planned',array['en','fr'],'{"priority":6}'::jsonb)
on conflict(code) do nothing;

insert into private.legal_sources(jurisdiction_code,source_key,name,issuing_authority,source_type,base_uri,access_method,rights_status,ingestion_enabled,status,coverage) values
('NO','lovdata-official','Lovdata — official legal information portal','Lovdata / Norwegian public authorities','legislation','https://lovdata.no/','web','review_required',false,'planned','{"scope":"Official legal texts; source-specific rights review required"}'::jsonb),
('EU','eur-lex','EUR-Lex','Publications Office of the European Union','legislation','https://eur-lex.europa.eu/','api','review_required',false,'planned','{"scope":"EU legal acts and Official Journal"}'::jsonb),
('GB','legislation-gov-uk','legislation.gov.uk','The National Archives','legislation','https://www.legislation.gov.uk/','api','review_required',false,'planned','{"scope":"UK legislation; territorial coverage varies"}'::jsonb),
('US','congress-gov','Congress.gov','Library of Congress','legislation','https://www.congress.gov/','api','review_required',false,'planned','{"scope":"US federal legislative information"}'::jsonb),
('INTL','un-treaty-collection','United Nations Treaty Collection','United Nations','treaty','https://treaties.un.org/','web','review_required',false,'planned','{"scope":"Treaty status and registration information"}'::jsonb),
('CM','cameroon-official-gazette','Cameroon official legal publications — source discovery required','Government of Cameroon','gazette',null,'manual','review_required',false,'planned','{"scope":"Source discovery and authority verification required"}'::jsonb)
on conflict(jurisdiction_code,source_key) do nothing;

alter table private.jurisdictions enable row level security;
alter table private.legal_sources enable row level security;
alter table private.legal_authorities enable row level security;
alter table private.legal_authority_versions enable row level security;
alter table private.legal_authority_passages enable row level security;
alter table private.legal_authority_relationships enable row level security;
alter table private.legal_source_ingestion_runs enable row level security;

revoke all on private.jurisdictions,private.legal_sources,private.legal_authorities,private.legal_authority_versions,private.legal_authority_passages,private.legal_authority_relationships,private.legal_source_ingestion_runs from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update on private.jurisdictions,private.legal_sources,private.legal_authorities,private.legal_authority_versions,private.legal_authority_passages,private.legal_authority_relationships,private.legal_source_ingestion_runs to service_role;

comment on table private.jurisdictions is 'Jurisdiction registry; planned or pilot does not mean full legal coverage.';
comment on table private.legal_sources is 'Legal source catalogue with explicit rights approval and ingestion gates.';
comment on table private.legal_authorities is 'Stable legal authority identity independent of source-text versions.';
comment on table private.legal_authority_versions is 'Time-aware source versions with source and normalised-content hashes.';
comment on table private.legal_authority_passages is 'Version-bound passages with stable anchors, full-text search and optional 1536-dimensional embeddings.';
comment on table private.legal_authority_relationships is 'Source-provenanced relationships between legal authorities.';
comment on table private.legal_source_ingestion_runs is 'Auditable lifecycle records for legal-source ingestion adapters.';

-- Historical authority text, passages and asserted relationships are append-only.
create or replace function private.reject_legal_knowledge_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Legal knowledge history is append-only; create a new version or relationship'
    using errcode = '55000';
end;
$$;
revoke all on function private.reject_legal_knowledge_mutation() from public,anon,authenticated;
create trigger legal_authority_versions_immutable before update or delete on private.legal_authority_versions
  for each row execute function private.reject_legal_knowledge_mutation();
create trigger legal_authority_passages_immutable before update or delete on private.legal_authority_passages
  for each row execute function private.reject_legal_knowledge_mutation();
create trigger legal_authority_relationships_immutable before update or delete on private.legal_authority_relationships
  for each row execute function private.reject_legal_knowledge_mutation();

-- Server-only lexical retrieval. The source must be explicitly rights-approved and enabled.
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
declare
  v_query tsquery;
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

  v_query := websearch_to_tsquery('simple'::regconfig, p_query);
  return query
  select
    passage.id, authority.id, version.id, authority.title, authority.citation,
    authority.jurisdiction_code, authority.authority_type, authority.language_code,
    authority.legal_status, version.valid_from, version.valid_until,
    coalesce(version.source_uri, authority.canonical_uri),
    version.source_content_hash, passage.content, passage.page_number, passage.section_path,
    source.source_key, ts_rank_cd(passage.search_vector, v_query)::real
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
    and passage.search_vector @@ v_query
  order by ts_rank_cd(passage.search_vector, v_query) desc, authority.id, passage.id
  limit p_limit;
end;
$function$;

-- Semantic retrieval is bound to an explicit embedding model key and jurisdiction scope.
create or replace function private.search_legal_passages_semantic(
  p_embedding extensions.vector(1536),
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
begin
  if p_embedding is null or p_embedding_model_key is null
    or length(btrim(p_embedding_model_key)) = 0 then
    raise exception 'LEGAL_RETRIEVAL_EMBEDDING_PROFILE_REQUIRED' using errcode = '22023';
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

revoke all on function private.search_legal_passages_lexical(text, text, date, text[], text[], integer)
  from public, anon, authenticated;
revoke all on function private.search_legal_passages_semantic(extensions.vector, text, text, date, text[], text[], integer)
  from public, anon, authenticated;
grant execute on function private.search_legal_passages_lexical(text, text, date, text[], text[], integer)
  to service_role;
grant execute on function private.search_legal_passages_semantic(extensions.vector, text, text, date, text[], text[], integer)
  to service_role;
