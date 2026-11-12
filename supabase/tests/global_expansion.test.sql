begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('b3000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'global-user@example.invalid', now(), now());
create temporary table g (key text primary key, value text) on commit drop;
grant all on g to authenticated, anon;
insert into g select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'b3000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into g select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from g where key = 'org') limit 1;

-- ------------------------------------------------------------------ jurisdiction model
select is((select count(*)::int from private.jurisdictions where code in ('EEA', 'OHADA', 'NG', 'KE', 'ZA', 'GH', 'SN')), 7,
  'the EEA, OHADA and five more African jurisdictions are catalogued');
select is((select count(*)::int from private.jurisdictions where code in ('EEA', 'OHADA', 'NG', 'KE', 'ZA', 'GH', 'SN') and status = 'catalogued'), 7,
  'new jurisdictions start as catalogued, never marketed');
select is((select parent_code from private.jurisdictions where code = 'CM'), 'OHADA', 'Cameroon sits under OHADA, whose Uniform Acts apply directly');
select is((select parent_code from private.jurisdictions where code = 'NO'), null, 'Norway is not placed under the EU');
select is((select relationship from private.jurisdiction_relationships where from_code = 'NO' and to_code = 'EU'), 'incorporates_by_treaty',
  'Norway incorporates EU law by treaty (EEA)');
select is((select citation_style from private.jurisdictions where code = 'GB'), 'uk', 'each jurisdiction records its citation convention');

-- ------------------------------------------------------------------ sources held for rights review
select is((select count(*)::int from private.legal_sources where source_key in ('efta-eea-lex', 'govinfo', 'ohada-official', 'nigerialii', 'kenya-law', 'saflii', 'ghalii', 'senegal-official-journal')
  and rights_status = 'review_required' and not ingestion_enabled and status = 'planned'), 8,
  'new official sources are registered but inactive until their rights are reviewed');
select throws_ok($$update private.jurisdictions set status = 'pilot' where code = 'NG'$$, null, null,
  'a jurisdiction cannot be promoted to pilot without a live, rights-approved source');

-- ------------------------------------------------------------------ glossary and readiness
set local role anon;
select throws_ok($$select * from public.legal_glossary_terms(array['nb'])$$, '42501', null, 'the glossary is for signed-in users');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b3000000-0000-4000-8000-0000000000a1';
select ok(exists (select 1 from public.legal_glossary_terms(array['nb', 'en', 'fr']) a join public.legal_glossary_terms(array['nb', 'en', 'fr']) b using (concept_key)
  where a.term = 'arbeidsgiver' and b.term = 'employeur'), 'Norwegian and French legal terms are aligned by concept');
select ok((select count(distinct concept_key) from public.legal_glossary_terms(array['en'])) >= 50, 'at least fifty legal concepts are covered');
select is((select count(*)::int from jsonb_array_elements(public.jurisdiction_readiness()) r where (r ->> 'meetsPartial')::boolean), 0,
  'no jurisdiction is reported at partial coverage before real content is evaluated (P8)');
select is((select r ->> 'marketedAs' from jsonb_array_elements(public.jurisdiction_readiness()) r where r ->> 'code' = 'NO'), 'Coming',
  'Norway (planned: no live source yet) is only described as coming');
select is((select r ->> 'marketedAs' from jsonb_array_elements(public.jurisdiction_readiness()) r where r ->> 'code' = 'KE'), 'Not marketed',
  'catalogued jurisdictions are not marketed');
select ok((select (r -> 'glossaryLanguages') ? 'fr' from jsonb_array_elements(public.jurisdiction_readiness()) r where r ->> 'code' = 'CM'),
  'readiness reports glossary support for the jurisdiction''s languages');

-- ------------------------------------------------------------------ OHADA law fits Cameroonian research
reset role;
insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status)
values ('b3100000-0000-4000-8000-000000000001', 'OHADA', 'ohada-test', 'OHADA test', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active');
insert into private.legal_source_rights_evidence (source_id, terms_uri, reviewed_by, reviewed_at, permissions)
values ('b3100000-0000-4000-8000-000000000001', 'https://example.invalid/t', 'r', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":true}');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code)
values ('b3200000-0000-4000-8000-000000000001', 'b3100000-0000-4000-8000-000000000001', 'OHADA', 'auscgie', 'AUSCGIE', 'Acte uniforme relatif au droit des sociétés commerciales', 'act', 'fr');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash)
values ('b3300000-0000-4000-8000-000000000001', 'b3200000-0000-4000-8000-000000000001', 1, '2014-05-05', repeat('7', 64));
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
values ('b3400000-0000-4000-8000-000000000001', 'b3300000-0000-4000-8000-000000000001', 0, 'La société anonyme est administrée par un conseil d''administration.', repeat('a', 64));
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, limitations, engine_version)
values ('b3500000-0000-4000-8000-000000000001', (select value::uuid from g where key='org'), (select value::uuid from g where key='ws'),
  'Comment est administrée une société anonyme au Cameroun ?', 'CM', '2026-01-01', '{fr}', 'lexical', 'answered', 'planned', '["Coverage is planned."]', 'extractive-1.0.0');
insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, verification_status)
values ('b3500000-0000-4000-8000-000000000001', 0, 'verified_authority', 'Conseil d''administration.', 'b3400000-0000-4000-8000-000000000001', 'verified');
set local role authenticated;
set local request.jwt.claim.sub = 'b3000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.verification_check_research_run('b3500000-0000-4000-8000-000000000001', '2026-06-01')$$, 'the Cameroonian run is re-verified');
select ok(not jsonb_path_exists(public.verification_get_run_quality('b3500000-0000-4000-8000-000000000001'),
  '$.latestReport.findings[*] ? (@.code == "JURISDICTION_MISMATCH")'), 'an OHADA Uniform Act fits research in Cameroon');
select is((select coverage_level from public.research_list_jurisdictions_profile() where code = 'SN'), 'catalogued', 'the research profile lists the new jurisdictions');

select * from finish();
rollback;
