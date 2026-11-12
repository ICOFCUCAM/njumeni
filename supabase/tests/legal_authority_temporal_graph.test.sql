begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Synthetic source and authorities. UUIDs are chosen so that A < B < C in text order.
insert into private.legal_sources (
  id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri,
  access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status
) values (
  'a1000000-0000-4000-8000-000000000001', 'NO', 'test-temporal-source', 'Synthetic temporal source',
  'Synthetic authority', 'legislation', 'https://example.invalid', 'api', 'approved',
  'TEST-LICENCE', 'Synthetic attribution', true, 'active'
);
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, title, authority_type, language_code)
values
  ('a1000000-0000-4000-8000-0000000000a0', 'a1000000-0000-4000-8000-000000000001', 'NO', 'root', 'Root act', 'act', 'nb'),
  ('a1000000-0000-4000-8000-0000000000a1', 'a1000000-0000-4000-8000-000000000001', 'NO', 'a', 'Act A', 'act', 'nb'),
  ('a1000000-0000-4000-8000-0000000000a2', 'a1000000-0000-4000-8000-000000000001', 'NO', 'b', 'Act B', 'act', 'nb'),
  ('a1000000-0000-4000-8000-0000000000a3', 'a1000000-0000-4000-8000-000000000001', 'NO', 'c', 'Act C', 'act', 'nb');

-- Root act: version 1 in force from 2018, recorded two days ago; an amendment in force from
-- 2022 was recorded only one day ago (Njumeni learned of it later).
insert into private.legal_authority_versions (
  id, authority_id, version_number, valid_from, valid_until, source_content_hash,
  is_current_source_version, created_at
) values
  ('a1000000-0000-4000-8000-0000000000b1', 'a1000000-0000-4000-8000-0000000000a0', 1, '2018-01-01', null,
   repeat('1', 64), false, now() - interval '2 days'),
  ('a1000000-0000-4000-8000-0000000000b2', 'a1000000-0000-4000-8000-0000000000a0', 2, '2022-01-01', null,
   repeat('2', 64), true, now() - interval '1 day');

-- As-of version selection (U-07).
select is(
  (select authority_version_id from public.legal_authority_version_as_of('a1000000-0000-4000-8000-0000000000a0', '2019-06-01')),
  'a1000000-0000-4000-8000-0000000000b1'::uuid,
  'before the amendment, the original version applies'
);
select is(
  (select authority_version_id from public.legal_authority_version_as_of('a1000000-0000-4000-8000-0000000000a0', '2023-06-01')),
  'a1000000-0000-4000-8000-0000000000b2'::uuid,
  'after the amendment, the amended version applies'
);
select is(
  (select authority_version_id from public.legal_authority_version_as_of(
    'a1000000-0000-4000-8000-0000000000a0', '2023-06-01', now() - interval '36 hours')),
  'a1000000-0000-4000-8000-0000000000b1'::uuid,
  'with knowledge as of 36 hours ago, the past answer is reproduced exactly'
);
select is(
  (select count(*)::integer from public.legal_authority_version_as_of('a1000000-0000-4000-8000-0000000000a0', '2017-01-01')),
  0,
  'no version is returned before the law existed'
);
select throws_ok(
  $$select * from public.legal_authority_version_as_of('a1000000-0000-4000-8000-0000000000a0', '2023-06-01', now() + interval '1 day')$$,
  '22023', 'LEGAL_AS_OF_KNOWN_AT_IN_FUTURE', 'knowledge time cannot be in the future'
);
select ok(
  not has_function_privilege('authenticated', 'public.legal_authority_version_as_of(uuid,date,timestamp with time zone)', 'EXECUTE'),
  'browser roles cannot call the as-of function directly'
);

-- Full relationship vocabulary (Master Plan v2.0 §6.5).
select lives_ok(
  $$insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type, effective_from)
    values ('a1000000-0000-4000-8000-0000000000a0', 'a1000000-0000-4000-8000-0000000000a1', 'amends', '2022-01-01'),
           ('a1000000-0000-4000-8000-0000000000a0', 'a1000000-0000-4000-8000-0000000000a2', 'cites', null),
           ('a1000000-0000-4000-8000-0000000000a1', 'a1000000-0000-4000-8000-0000000000a3', 'replaces', '2025-01-01'),
           ('a1000000-0000-4000-8000-0000000000a3', 'a1000000-0000-4000-8000-0000000000a0', 'related', null)$$,
  'replaces and existing relationship types are accepted'
);
select lives_ok(
  $$insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type)
    values ('a1000000-0000-4000-8000-0000000000a2', 'a1000000-0000-4000-8000-0000000000a3', 'supplements'),
           ('a1000000-0000-4000-8000-0000000000a3', 'a1000000-0000-4000-8000-0000000000a2', 'conflicts_with')$$,
  'supplements and conflicts_with are accepted'
);
select throws_ok(
  $$insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type)
    values ('a1000000-0000-4000-8000-0000000000a1', 'a1000000-0000-4000-8000-0000000000a2', 'invented_type')$$,
  '23514', null, 'unknown relationship types are rejected'
);

-- Graph traversal (Task 2.6).
select is(
  (select jsonb_array_length(public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 2, 100, array['amends','cites','replaces','related']) -> 'paths')),
  3,
  'depth-2 traversal finds root→A, root→B and root→A→C; the C→root cycle is skipped'
);
select is(
  public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 2, 100, array['amends','cites','replaces','related']) -> 'relatedAuthorityIds',
  '["a1000000-0000-4000-8000-0000000000a1","a1000000-0000-4000-8000-0000000000a2","a1000000-0000-4000-8000-0000000000a3"]'::jsonb,
  'related authorities are reported in deterministic breadth-first order'
);
select is(
  public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 2, 100, array['amends','cites','replaces','related']) -> 'paths' -> 2,
  jsonb_build_object(
    'authorityIds', jsonb_build_array('a1000000-0000-4000-8000-0000000000a0', 'a1000000-0000-4000-8000-0000000000a1', 'a1000000-0000-4000-8000-0000000000a3'),
    'relationshipTypes', jsonb_build_array('amends', 'replaces'),
    'provenanceUris', jsonb_build_array(null, null)),
  'paths carry relationship types and provenance per hop'
);
select is(
  (select jsonb_array_length(public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', '2023-01-01', 4, 100, array['amends','cites','replaces','related']) -> 'paths')),
  2,
  'as-of 2023 excludes the replacement that takes effect in 2025'
);
select is(
  public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', '2021-01-01', 4, 100, array['amends','cites','replaces','related']) -> 'relatedAuthorityIds',
  '["a1000000-0000-4000-8000-0000000000a2"]'::jsonb,
  'as-of 2021 excludes the amendment that takes effect in 2022'
);
select is(
  (select jsonb_array_length(public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 1) -> 'paths')),
  2,
  'maximum depth 1 returns only direct relationships'
);
select is(
  public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 4, 2) -> 'truncated',
  'true'::jsonb,
  'node limit reports truncation instead of silently dropping authorities'
);
select is(
  public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 4, 100, array['cites']) -> 'relatedAuthorityIds',
  '["a1000000-0000-4000-8000-0000000000a2"]'::jsonb,
  'relationship-type filter restricts traversal'
);
select throws_ok(
  $$select public.legal_authority_graph('a1000000-0000-4000-8000-0000000000ff')$$,
  'P0002', 'LEGAL_AUTHORITY_GRAPH_ROOT_NOT_FOUND', 'unknown roots are rejected'
);
select throws_ok(
  $$select public.legal_authority_graph('a1000000-0000-4000-8000-0000000000a0', null, 50)$$,
  '22023', 'LEGAL_AUTHORITY_GRAPH_LIMIT_INVALID', 'traversal limits are bounded'
);
select ok(
  not has_function_privilege('authenticated', 'public.legal_authority_graph(uuid,date,integer,integer,text[])', 'EXECUTE'),
  'browser roles cannot call the graph function directly'
);

select * from finish();
rollback;
