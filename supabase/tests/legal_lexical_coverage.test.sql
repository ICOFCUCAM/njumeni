begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into private.legal_sources (
  id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri,
  access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status
) values (
  'd1000000-0000-4000-8000-000000000001', 'NO', 'test-coverage-source', 'Synthetic coverage source',
  'Synthetic authority', 'legislation', 'https://example.invalid', 'api', 'approved',
  'TEST-LICENCE', 'Synthetic attribution', true, 'active'
);
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code, legal_status)
values
  ('d1000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-000000000001', 'NO', 'acc', 'SYN-ACC', 'Ulykkesloven', 'act', 'nb', 'in_force'),
  ('d1000000-0000-4000-8000-0000000000a2', 'd1000000-0000-4000-8000-000000000001', 'NO', 'gen', 'SYN-GEN', 'Generell lov', 'act', 'nb', 'in_force');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash)
values
  ('d1000000-0000-4000-8000-0000000000b1', 'd1000000-0000-4000-8000-0000000000a1', 1, '2020-01-01', repeat('1', 64)),
  ('d1000000-0000-4000-8000-0000000000b2', 'd1000000-0000-4000-8000-0000000000a2', 1, '2020-01-01', repeat('2', 64));
insert into private.legal_authority_passages (authority_version_id, ordinal, content, content_hash)
values
  ('d1000000-0000-4000-8000-0000000000b1', 0, 'Arbeidsgiver skal straks varsle om ulykker.', repeat('a', 64)),
  ('d1000000-0000-4000-8000-0000000000b2', 0, 'Arbeidsgiver skal føre register.', repeat('b', 64));

select is(
  (select citation from private.search_legal_passages_lexical(
    'Når må arbeidsgiver varsle om en ulykke?', 'NO', '2023-01-01', array['nb']) limit 1),
  'SYN-ACC',
  'a natural-language question finds the statute even though not every word appears'
);
select is(
  (select lexical_score from private.search_legal_passages_lexical(
    'Når må arbeidsgiver varsle om en ulykke?', 'NO', '2023-01-01', array['nb']) where citation = 'SYN-ACC'),
  0.75::real,
  'score is lexeme coverage: three of four meaningful terms'
);
select ok(
  (select lexical_score from private.search_legal_passages_lexical(
    'Når må arbeidsgiver varsle om en ulykke?', 'NO', '2023-01-01', array['nb']) where citation = 'SYN-GEN')
  < (select lexical_score from private.search_legal_passages_lexical(
    'Når må arbeidsgiver varsle om en ulykke?', 'NO', '2023-01-01', array['nb']) where citation = 'SYN-ACC'),
  'a passage sharing fewer terms ranks lower'
);
select is(
  (select lexical_score from private.search_legal_passages_lexical(
    'varsle ulykker', 'NO', '2023-01-01', array['nb']) limit 1),
  1::real,
  'full coverage scores 1.0'
);
select ok(
  (select bool_and(lexical_score between 0 and 1) from private.search_legal_passages_lexical(
    'arbeidsgiver register ulykke', 'NO', '2023-01-01', array['nb'])),
  'scores are calibrated to the 0..1 range'
);
select is(
  (select count(*)::integer from private.search_legal_passages_lexical(
    'romfartsavgift for asteroider', 'NO', '2023-01-01', array['nb'])),
  0,
  'an out-of-scope question returns nothing (abstention)'
);
select is(
  (select count(*)::integer from private.search_legal_passages_lexical(
    'en og om', 'NO', '2023-01-01', array['nb'])),
  0,
  'a query of stop-words only returns nothing'
);
select is(
  (select count(*)::integer from private.search_legal_passages_lexical(
    'ulykke', 'NO', '2019-01-01', array['nb'])),
  0,
  'effective-date filtering still applies'
);

select * from finish();
rollback;
