begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Profile registry (decision D-3).
select has_table('private', 'legal_embedding_profiles', 'embedding profiles are registered');
select is(
  (select dimensions from private.legal_embedding_profiles where profile_key = 'multilingual-e5-small-v1'),
  384,
  'multilingual-e5-small profile has 384 dimensions'
);
select ok(
  (select format_type(atttypid, atttypmod) from pg_attribute
   where attrelid = 'private.legal_authority_passages'::regclass and attname = 'embedding')
    ~ '(^|\.)vector\(384\)$',
  'passage embedding column matches the active profile dimension'
);
select ok(
  not has_table_privilege('authenticated', 'private.legal_embedding_profiles', 'SELECT'),
  'browser roles cannot read embedding profiles'
);

-- Language-aware search configuration (U-22).
select is(private.legal_text_search_config('nb')::text, 'norwegian', 'Bokmål uses Norwegian stemming');
select is(private.legal_text_search_config('nn-NO')::text, 'norwegian', 'Nynorsk with region uses Norwegian stemming');
select is(private.legal_text_search_config('en')::text, 'english', 'English uses English stemming');
select is(private.legal_text_search_config('fr')::text, 'french', 'French uses French stemming');
select is(private.legal_text_search_config('xx')::text, 'simple', 'unknown languages fall back to simple');

-- Synthetic, rights-approved source with one Norwegian and one English authority.
insert into private.legal_sources (
  id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri,
  access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status
) values (
  'e0000000-0000-4000-8000-000000000001', 'NO', 'test-embedding-source', 'Synthetic test source',
  'Synthetic authority', 'legislation', 'https://example.invalid', 'api', 'approved',
  'TEST-LICENCE', 'Synthetic attribution', true, 'active'
);
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, title, authority_type, language_code, legal_status)
values
  ('e0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'NO', 'syn-no-1', 'Syntetisk lov', 'act', 'nb', 'in_force'),
  ('e0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000001', 'NO', 'syn-en-1', 'Synthetic act', 'act', 'en', 'in_force');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash)
values
  ('e0000000-0000-4000-8000-000000000021', 'e0000000-0000-4000-8000-000000000011', 1, '2020-01-01', repeat('a', 64)),
  ('e0000000-0000-4000-8000-000000000022', 'e0000000-0000-4000-8000-000000000012', 1, '2020-01-01', repeat('b', 64));
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
values
  ('e0000000-0000-4000-8000-000000000031', 'e0000000-0000-4000-8000-000000000021', 0,
   'Arbeidsgiveren skal varsle om alle ulykker innen fristen.', repeat('c', 64)),
  ('e0000000-0000-4000-8000-000000000032', 'e0000000-0000-4000-8000-000000000022', 0,
   'The employer must report all accidents within the deadline.', repeat('d', 64));

select is(
  (select search_config::text from private.legal_authority_passages where id = 'e0000000-0000-4000-8000-000000000031'),
  'norwegian',
  'passage search configuration follows the authority language'
);
select is(
  (select count(*)::integer from private.search_legal_passages_lexical('ulykke', 'NO', '2026-01-01', array['nb'])),
  1,
  'Norwegian stemming matches an inflected form (ulykke finds ulykker)'
);
select is(
  (select count(*)::integer from private.search_legal_passages_lexical('accident reporting', 'NO', '2026-01-01', array['en'])),
  1,
  'English stemming matches inflected forms (accident/report find accidents/report)'
);
select is(
  (select count(*)::integer from private.search_legal_passages_lexical('ulykke', 'NO', '2026-01-01', array['en'])),
  0,
  'language filter excludes passages in other languages'
);

-- Append-only legal content; only derived embedding fields may change.
select throws_ok(
  $$update private.legal_authority_passages set content = 'altered' where id = 'e0000000-0000-4000-8000-000000000031'$$,
  '55000', null, 'passage content remains immutable'
);
select throws_ok(
  $$delete from private.legal_authority_passages where id = 'e0000000-0000-4000-8000-000000000031'$$,
  '55000', null, 'passages cannot be deleted'
);

-- Embedding backfill RPCs.
select is(
  (select count(*)::integer from public.legal_embedding_pending_passages('multilingual-e5-small-v1', 10)),
  2,
  'both eligible passages are pending embedding'
);
select throws_ok(
  $$select public.legal_embedding_store('multilingual-e5-small-v1',
    jsonb_build_array(jsonb_build_object('passage_id', 'e0000000-0000-4000-8000-000000000031',
      'embedding', to_jsonb(array_fill(0.1::real, array[1536])))))$$,
  '22023', 'LEGAL_EMBEDDING_DIMENSION_MISMATCH', 'wrong-dimension embeddings are rejected'
);
select is(
  public.legal_embedding_store('multilingual-e5-small-v1',
    jsonb_build_array(jsonb_build_object('passage_id', 'e0000000-0000-4000-8000-000000000031',
      'embedding', to_jsonb(array_fill(0.1::real, array[384]))))),
  1,
  'a correctly dimensioned embedding is stored'
);
select is(
  (select count(*)::integer from public.legal_embedding_pending_passages('multilingual-e5-small-v1', 10)),
  1,
  'stored embeddings leave the pending queue'
);
select is(
  (select count(*)::integer from private.search_legal_passages_semantic(
    array_fill(0.1::real, array[384])::extensions.vector, 'multilingual-e5-small-v1',
    'NO', '2026-01-01', array['nb'])),
  1,
  'semantic search returns the embedded passage under its profile'
);
select throws_ok(
  $$select * from private.search_legal_passages_semantic(
    array_fill(0.1::real, array[384])::extensions.vector, 'unknown-profile', 'NO', '2026-01-01', array['nb'])$$,
  '22023', 'LEGAL_RETRIEVAL_EMBEDDING_PROFILE_UNKNOWN', 'semantic search rejects unregistered profiles'
);
select ok(
  not has_function_privilege('authenticated', 'public.legal_embedding_store(text,jsonb)', 'EXECUTE'),
  'browser roles cannot write embeddings'
);

select * from finish();
rollback;
