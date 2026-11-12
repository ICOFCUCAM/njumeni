begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('ab000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'research-owner@example.invalid', now(), now()),
  ('ab000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'research-outsider@example.invalid', now(), now());

create temporary table rs (key text primary key, value text) on commit drop;
grant all on rs to authenticated;
insert into rs select 'org', o.id::text from public.organizations o
  join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'ab000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into rs select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from rs where key = 'org') limit 1;

-- Legal fixtures: an approved source (display + quote), a display-only source, an unapproved source.
insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri,
  access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status) values
  ('ab100000-0000-4000-8000-000000000001', 'NO', 'research-approved', 'Approved', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('ab100000-0000-4000-8000-000000000002', 'NO', 'research-display-only', 'Display only', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('ab100000-0000-4000-8000-000000000003', 'NO', 'research-unapproved', 'Unapproved', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'review_required', null, null, false, 'planned');
insert into private.legal_source_rights_evidence (source_id, terms_uri, reviewed_by, reviewed_at, permissions) values
  ('ab100000-0000-4000-8000-000000000001', 'https://example.invalid/terms', 'reviewer', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":true}'),
  ('ab100000-0000-4000-8000-000000000002', 'https://example.invalid/terms', 'reviewer', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":false}');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code, legal_status) values
  ('ab200000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', 'NO', 'a1', 'SYN-LOV-1', 'Arbeidsmiljøloven (syntetisk)', 'act', 'nb', 'in_force'),
  ('ab200000-0000-4000-8000-000000000002', 'ab100000-0000-4000-8000-000000000002', 'NO', 'a2', 'SYN-LOV-2', 'Visningslov (syntetisk)', 'act', 'nb', 'in_force'),
  ('ab200000-0000-4000-8000-000000000003', 'ab100000-0000-4000-8000-000000000003', 'NO', 'a3', 'SYN-LOV-3', 'Ugodkjent lov (syntetisk)', 'act', 'nb', 'in_force'),
  ('ab200000-0000-4000-8000-000000000004', 'ab100000-0000-4000-8000-000000000001', 'NO', 'a4', 'SYN-LOV-4', 'Endringslov (syntetisk)', 'act', 'nb', 'in_force');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, valid_until, source_content_hash, is_current_source_version) values
  ('ab300000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001', 1, '2010-01-01', '2015-01-01', repeat('1', 64), false),
  ('ab300000-0000-4000-8000-000000000002', 'ab200000-0000-4000-8000-000000000001', 2, '2015-01-01', null, repeat('2', 64), true),
  ('ab300000-0000-4000-8000-000000000003', 'ab200000-0000-4000-8000-000000000002', 1, '2015-01-01', null, repeat('3', 64), true),
  ('ab300000-0000-4000-8000-000000000004', 'ab200000-0000-4000-8000-000000000003', 1, '2015-01-01', null, repeat('4', 64), true);
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash) values
  ('ab400000-0000-4000-8000-000000000001', 'ab300000-0000-4000-8000-000000000001', 0, 'Arbeidsgiver skal varsle om ulykker innen tre dager.', repeat('a', 64)),
  ('ab400000-0000-4000-8000-000000000002', 'ab300000-0000-4000-8000-000000000002', 0, 'Arbeidsgiver skal straks varsle om ulykker.', repeat('b', 64)),
  ('ab400000-0000-4000-8000-000000000003', 'ab300000-0000-4000-8000-000000000003', 0, 'Arbeidsgiver skal føre register over ulykker.', repeat('c', 64)),
  ('ab400000-0000-4000-8000-000000000004', 'ab300000-0000-4000-8000-000000000004', 0, 'Arbeidsgiver skal melde ulykker til tilsynet.', repeat('d', 64));
insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type, effective_from) values
  ('ab200000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000004', 'amended_by', '2027-01-01');

-- ----------------------------------------------------------------------------- search
set local role authenticated;
set local request.jwt.claim.sub = 'ab000000-0000-4000-8000-0000000000a1';
select is(
  (select count(*)::integer from public.research_search_lexical((select value::uuid from rs where key='org'),
    (select value::uuid from rs where key='ws'), 'varsle ulykke', 'NO', '2023-06-01', array['nb'])),
  2, 'workspace-scoped search returns only rights-approved, in-force passages');
select is(
  (select passage_id from public.research_search_lexical((select value::uuid from rs where key='org'),
    (select value::uuid from rs where key='ws'), 'varsle ulykke', 'NO', '2012-06-01', array['nb']) limit 1),
  'ab400000-0000-4000-8000-000000000001'::uuid, 'a 2012 question retrieves the version in force in 2012');
select is(
  (select count(*)::integer from public.research_authority_context((select value::uuid from rs where key='org'),
    (select value::uuid from rs where key='ws'), array['ab200000-0000-4000-8000-000000000001'::uuid], '2023-06-01') where after_as_of),
  1, 'an amendment taking effect after the research date is reported');
select ok((select count(*) from public.research_list_jurisdictions() where code = 'NO') = 1,
  'jurisdictions and their coverage level are listed for signed-in users');

-- ----------------------------------------------------------------------------- record + verify
select lives_ok($$
  insert into rs values ('run1', public.research_record_run(
    (select value::uuid from rs where key='org'), (select value::uuid from rs where key='ws'),
    'Når må arbeidsgiver varsle om en ulykke?', 'NO', '2023-06-01', array['nb'], 'lexical',
    '["Synthetic test"]'::jsonb, 'test-1',
    '[{"rank":1,"passage_id":"ab400000-0000-4000-8000-000000000002","score":0.75}]'::jsonb,
    '[{"category":"verified_authority","statement":"Arbeidsgiver skal straks varsle.","passage_id":"ab400000-0000-4000-8000-000000000002","citation_text":"SYN-LOV-1 § 1","quoted_text":"Arbeidsgiver skal  straks varsle om ulykker."},
      {"category":"verified_authority","statement":"Forged quote.","passage_id":"ab400000-0000-4000-8000-000000000002","quoted_text":"Arbeidsgiver kan vente en måned."},
      {"category":"verified_authority","statement":"Unapproved source.","passage_id":"ab400000-0000-4000-8000-000000000004"},
      {"category":"verified_authority","statement":"Old version.","passage_id":"ab400000-0000-4000-8000-000000000001"},
      {"category":"verified_authority","statement":"Wrong citation.","passage_id":"ab400000-0000-4000-8000-000000000002","citation_text":"SYN-LOV-9"},
      {"category":"verified_authority","statement":"Invented passage.","passage_id":"ab400000-0000-4000-8000-0000000000ff"},
      {"category":"verified_authority","statement":"Display-only quote.","passage_id":"ab400000-0000-4000-8000-000000000003","quoted_text":"Arbeidsgiver skal føre register"},
      {"category":"verified_authority","statement":"Display-only citation.","passage_id":"ab400000-0000-4000-8000-000000000003","citation_text":"SYN-LOV-2"},
      {"category":"unresolved_question","statement":"Whether the deadline differs for contractors is not covered."}]'::jsonb)::text)
$$, 'a run with mixed claims is recorded');

reset role;
select is((select verification_status from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 0),
  'verified', 'a correct citation with a verbatim (whitespace-normalised) quotation verifies');
select is((select failure_codes from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 1),
  array['QUOTATION_MISMATCH'], 'a forged quotation fails');
select is((select failure_codes from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 2),
  array['SOURCE_NOT_PERMITTED'], 'a passage from a source without approved rights fails');
select is((select failure_codes from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 3),
  array['AUTHORITY_NOT_IN_FORCE_ON_DATE'], 'a version not in force on the research date fails (no silent substitution)');
select is((select failure_codes from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 4),
  array['CITATION_MISMATCH'], 'a citation that does not match the passage''s authority fails');
select is((select failure_codes from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 5),
  array['CITATION_NOT_FOUND'], 'a fabricated passage fails existence');
select is((select failure_codes from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 6),
  array['QUOTATION_NOT_PERMITTED'], 'quoting a display-only source fails');
select is((select verification_status from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 7),
  'verified', 'citing a display-only source without quoting verifies');
select is((select verification_status from private.research_claims where run_id = (select value::uuid from rs where key='run1') and ordinal = 8),
  'not_applicable', 'an unresolved question needs no citation check');
select is((select status from private.research_runs where id = (select value::uuid from rs where key='run1')),
  'answered', 'a run with a verified law claim is answered');
select is((select count(*)::integer from private.citation_checks c join private.research_claims k on k.id = c.claim_id
  where c.run_id = (select value::uuid from rs where key='run1') and k.ordinal = 0), 5,
  'existence, resolution, currency, source-rights and quotation checks are recorded');
select is((select authority_id from private.research_findings where run_id = (select value::uuid from rs where key='run1')),
  'ab200000-0000-4000-8000-000000000001'::uuid, 'finding authority is derived from the passage, not trusted from input');

set local role authenticated;
set local request.jwt.claim.sub = 'ab000000-0000-4000-8000-0000000000a1';
select lives_ok($$
  insert into rs values ('run2', public.research_record_run(
    (select value::uuid from rs where key='org'), (select value::uuid from rs where key='ws'),
    'Forged answer', 'NO', '2023-06-01', array['nb'], 'lexical', '[]'::jsonb, 'test-1', '[]'::jsonb,
    '[{"category":"verified_authority","statement":"Invented law.","passage_id":"ab400000-0000-4000-8000-0000000000ff"}]'::jsonb)::text)
$$, 'a run whose only law claim is invented is recorded');
select is((public.research_get_run((select value::uuid from rs where key='run2')) ->> 'status'), 'abstained',
  'verified-or-abstain: with no verified law claim the run abstains');
select is(jsonb_array_length(public.research_get_run((select value::uuid from rs where key='run1')) -> 'claims'), 9,
  'the full claim ledger is returned to an authorised reader');
select is((select count(*)::integer from public.research_list_runs((select value::uuid from rs where key='org'), (select value::uuid from rs where key='ws'))),
  2, 'research history lists both runs');

-- ----------------------------------------------------------------------------- isolation and immutability
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'ab000000-0000-4000-8000-0000000000b1';
select throws_ok($$select * from public.research_search_lexical((select value::uuid from rs where key='org'), (select value::uuid from rs where key='ws'), 'ulykke', 'NO', '2023-06-01', array['nb'])$$,
  '42501', 'RESEARCH_NOT_AUTHORISED', 'an outsider cannot search in another tenant''s workspace');
select throws_ok($$select public.research_get_run((select value::uuid from rs where key='run1'))$$,
  '42501', 'RESEARCH_NOT_AUTHORISED', 'an outsider cannot read another tenant''s research');
select throws_ok($$select public.research_record_run((select value::uuid from rs where key='org'), (select value::uuid from rs where key='ws'), 'x y z', 'NO', '2023-06-01', array['nb'], 'lexical', '[]', 't', '[]', '[]')$$,
  '42501', 'RESEARCH_NOT_AUTHORISED', 'an outsider cannot record research in another tenant');
select ok(not has_table_privilege('authenticated', 'private.research_claims', 'SELECT'), 'research tables are not directly readable');

reset role;
select throws_ok($$update private.research_runs set status = 'answered' where id = (select value::uuid from rs where key='run2')$$,
  '55000', null, 'a run cannot be upgraded to answered after recording');
select throws_ok($$update private.research_claims set verification_status = 'verified'$$,
  '55000', null, 'claims cannot be re-marked as verified');

select * from finish();
rollback;
