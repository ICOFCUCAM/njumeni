-- Authority routing (legal-route-1.0.0): centroids, routing by date and eligibility, routed search, access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.v(p_first real, p_second real) returns extensions.vector language sql as $$
  select (array[p_first, p_second] || array_fill(0.001::real, array[382]))::extensions.vector
$$;

insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri,
  access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status)
values ('f0000000-0000-4000-8000-000000000001', 'NO', 'test-routing-source', 'Synthetic routing source', 'Synthetic',
  'legislation', 'https://example.invalid', 'api', 'approved', 'TEST', 'Synthetic', true, 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'NO', 'test-routing-unapproved', 'Unapproved source', 'Synthetic',
  'legislation', 'https://example.invalid', 'api', 'review_required', null, null, false, 'planned');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, title, authority_type, language_code, legal_status) values
  ('f0000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001', 'NO', 'craft', 'Håndverkerloven', 'act', 'nb', 'in_force'),
  ('f0000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000001', 'NO', 'noise', 'Annen lov', 'act', 'nb', 'in_force'),
  ('f0000000-0000-4000-8000-000000000013', 'f0000000-0000-4000-8000-000000000001', 'NO', 'future', 'Fremtidig lov', 'act', 'nb', 'in_force'),
  ('f0000000-0000-4000-8000-000000000014', 'f0000000-0000-4000-8000-000000000002', 'NO', 'unapproved', 'Ikke godkjent', 'act', 'nb', 'in_force');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash) values
  ('f0000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000011', 1, '2000-01-01', repeat('a', 64)),
  ('f0000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000012', 1, '2000-01-01', repeat('b', 64)),
  ('f0000000-0000-4000-8000-000000000023', 'f0000000-0000-4000-8000-000000000013', 1, '2030-01-01', repeat('c', 64)),
  ('f0000000-0000-4000-8000-000000000024', 'f0000000-0000-4000-8000-000000000014', 1, '2000-01-01', repeat('d', 64));
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash, embedding, embedding_model_key) values
  ('f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000021', 0, 'Mangel ved tjenesten.', repeat('1', 64), pg_temp.v(1, 0.1), 'multilingual-e5-small-v1'),
  ('f0000000-0000-4000-8000-000000000032', 'f0000000-0000-4000-8000-000000000021', 1, 'Prisavslag og heving.', repeat('2', 64), pg_temp.v(0.9, 0.2), 'multilingual-e5-small-v1'),
  ('f0000000-0000-4000-8000-000000000033', 'f0000000-0000-4000-8000-000000000022', 0, 'Noe helt annet.', repeat('3', 64), pg_temp.v(0.1, 1), 'multilingual-e5-small-v1'),
  ('f0000000-0000-4000-8000-000000000034', 'f0000000-0000-4000-8000-000000000023', 0, 'Fremtidig regel.', repeat('4', 64), pg_temp.v(1, 0.1), 'multilingual-e5-small-v1'),
  ('f0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000024', 0, 'Ikke godkjent tekst.', repeat('5', 64), pg_temp.v(1, 0.1), 'multilingual-e5-small-v1');

select ok(public.legal_refresh_authority_centroids('multilingual-e5-small-v1') >= 4, 'centroids are computed per authority version');
select is((select passage_count from private.legal_authority_centroids where authority_version_id = 'f0000000-0000-4000-8000-000000000021'), 2,
  'a centroid averages all embedded passages of the version');
select throws_ok($$select public.legal_refresh_authority_centroids('unknown-profile')$$, '22023', 'LEGAL_EMBEDDING_PROFILE_UNKNOWN', 'unknown profiles are refused');

create temporary table routed on commit drop as
  select * from public.legal_route_authorities(pg_temp.v(1, 0), 'multilingual-e5-small-v1', 'NO', '2026-11-12', array['nb'], '{}', 5);
select is((select authority_id from routed order by route_score desc limit 1), 'f0000000-0000-4000-8000-000000000011'::uuid,
  'the act whose passages are about the question routes first');
select ok(not exists (select 1 from routed where authority_id = 'f0000000-0000-4000-8000-000000000013'), 'acts not yet in force are not routed');
select ok(not exists (select 1 from routed where authority_id = 'f0000000-0000-4000-8000-000000000014'), 'acts from unapproved sources are not routed');
select ok((select bool_and(route_score between -1 and 1) from routed), 'route scores are cosine similarities');
select is((select count(*)::int from public.legal_route_authorities(pg_temp.v(1, 0), 'multilingual-e5-small-v1', 'NO', '2031-01-01', array['nb'], '{}', 5)
  where authority_id = 'f0000000-0000-4000-8000-000000000013'), 1, 'a later as-of date routes the act in force then');

select is((select array_agg(distinct authority_id) from public.legal_search_passages_semantic_within(pg_temp.v(1, 0), 'multilingual-e5-small-v1',
  'NO', '2026-11-12', array['nb'], array['f0000000-0000-4000-8000-000000000011'::uuid, 'f0000000-0000-4000-8000-000000000014'::uuid], 10)),
  array['f0000000-0000-4000-8000-000000000011'::uuid], 'routed search stays within the given, eligible authorities');
select throws_ok($$select * from public.legal_search_passages_semantic_within(pg_temp.v(1, 0), 'multilingual-e5-small-v1', 'NO', '2026-11-12',
  array['nb'], '{}'::uuid[], 10)$$, '22023', 'LEGAL_RETRIEVAL_AUTHORITIES_INVALID', 'routed search needs authorities');

select ok(not has_function_privilege('authenticated', 'public.legal_route_authorities(extensions.vector,text,text,date,text[],text[],integer)', 'EXECUTE'),
  'browser roles cannot call the service-role routing');
select ok(not has_function_privilege('authenticated', 'public.legal_refresh_authority_centroids(text)', 'EXECUTE'),
  'browser roles cannot refresh centroids');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000ff';
select throws_ok($$select * from public.research_route_authorities('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  pg_temp.v(1, 0), 'multilingual-e5-small-v1', 'NO', '2026-11-12', array['nb'], '{}', 5)$$, '42501', null,
  'research routing re-checks the caller''s research scope');
reset role;

select * from finish();
rollback;
