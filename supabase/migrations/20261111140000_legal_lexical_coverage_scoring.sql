-- Phase 2 Task 2.10 finding: lexical retrieval was unusable for natural-language questions.
--  1. websearch_to_tsquery requires every term, so "Når må arbeidsgiver varsle om en ulykke?"
--     missed a statute saying "Arbeidsgiver skal straks varsle om ulykker" (no "må").
--  2. Raw ts_rank_cd values (about 0.03) always fell below the application's 0.12 relevance floor.
-- Fix: match passages containing ANY meaningful query lexeme (after language-specific stemming and
-- stop-word removal), and score them by lexeme coverage: the share of distinct query lexemes present
-- in the passage, a calibrated 0..1 value. ts_rank_cd breaks ties. A query whose terms appear nowhere
-- returns no rows, so the system abstains.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

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
  query_terms as (
    select configs.config,
      array(select distinct lexeme
            from unnest(tsvector_to_array(to_tsvector(configs.config, p_query))) as lexeme
            order by lexeme) as lexemes
    from configs
  ),
  queries as (
    select query_terms.config, query_terms.lexemes,
      (select string_agg(quote_literal(lexeme), ' | ')
       from unnest(query_terms.lexemes) as lexeme)::tsquery as query
    from query_terms
    where cardinality(query_terms.lexemes) > 0
  ),
  matches as (
    select passage.id as matched_passage_id,
      (cardinality(array(
        select unnest(tsvector_to_array(passage.search_vector))
        intersect
        select unnest(queries.lexemes)))::real / cardinality(queries.lexemes))::real as coverage,
      ts_rank_cd(passage.search_vector, queries.query)::real as tie_break
    from queries
    join private.legal_authority_passages as passage
      on passage.search_config = queries.config and passage.search_vector @@ queries.query
  )
  select
    passage.id, authority.id, version.id, authority.title, authority.citation,
    authority.jurisdiction_code, authority.authority_type, authority.language_code,
    authority.legal_status, version.valid_from, version.valid_until,
    coalesce(version.source_uri, authority.canonical_uri),
    version.source_content_hash, passage.content, passage.page_number, passage.section_path,
    source.source_key, matches.coverage
  from matches
  join private.legal_authority_passages as passage on passage.id = matches.matched_passage_id
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
  order by matches.coverage desc, matches.tie_break desc, authority.id, passage.id
  limit p_limit;
end;
$function$;

comment on function private.search_legal_passages_lexical(text, text, date, text[], text[], integer) is
  'Language-aware lexical retrieval. Matches any meaningful query lexeme and scores by lexeme coverage (0..1); ts_rank_cd breaks ties. Rights-gated and effective-date filtered.';
