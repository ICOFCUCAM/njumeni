-- GLCI-04: impact analysis. A synthetic act is ingested, a customer researches it (finding and
-- verified claim), builds a document and an issue on the run and links them to a matter; another
-- act cites it. The act is then amended. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c4000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-impact-operator@example.invalid', now(), now()),
  ('c4000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-impact-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'c4000000-0000-4000-8000-0000000000a1';
create temporary table g (key text primary key, value text) on commit drop;
grant all on g to authenticated;
insert into g select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'c4000000-0000-4000-8000-0000000000b1' and o.kind = 'personal';
insert into g select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from g where key = 'org') limit 1;

insert into private.legal_sources (jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method)
values ('NO', 'glci-impact-source', 'Synthetic impact source', 'Synthetic issuer', 'legislation', 'https://laws.example.test/', 'bulk_download');
select public.legal_source_record_rights_review((select id from private.legal_sources where source_key = 'glci-impact-source'), 'pgTAP reviewer',
  'TEST-LICENCE', '1', 'https://laws.example.test/terms', 'Synthetic attribution', now() - interval '1 minute', now() + interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":false}'::jsonb);
select public.legal_source_set_activation((select id from private.legal_sources where source_key = 'glci-impact-source'), 'pgTAP operator',
  'Synthetic activation for impact analysis', 'active', true, 'glci-impact-adapter', '1.0.0');
select public.legal_ingestion_enqueue_job((select id from private.legal_sources where source_key = 'glci-impact-source'), 'glci-impact-adapter', '1.0.0', 'glci-impact-1');
create temporary table claim on commit drop as select * from public.legal_ingestion_claim_job('pgtap-worker', 60);

create function pg_temp.append(p_external_id text, p_hash text, p_sections text[][]) returns text language plpgsql as $$
declare
  v_passages jsonb := '[]';
  v_i integer;
begin
  for v_i in 1 .. array_length(p_sections, 1) loop
    v_passages := v_passages || jsonb_build_array(jsonb_build_object('ordinal', v_i - 1, 'startOffset', 0, 'endOffset', 1,
      'content', p_sections[v_i][2], 'contentHash', encode(extensions.digest(p_sections[v_i][2], 'sha256'), 'hex'),
      'sectionPath', jsonb_build_array(p_sections[v_i][1])));
  end loop;
  return public.legal_ingestion_append_authority('glci-impact-source', 'NO',
    jsonb_build_object('externalId', p_external_id, 'title', 'Synthetic act ' || p_external_id, 'authorityType', 'act', 'languageCode', 'nb',
      'legalStatus', 'in_force', 'validFrom', '2020-01-01', 'metadata', '{}'::jsonb,
      'sourceContentHash', repeat(p_hash, 64), 'normalisedContentHash', repeat(p_hash, 64), 'normalisedText', 'Synthetic act'),
    'https://laws.example.test/archive#' || p_hash, now(), 'test-profile', v_passages, (select job_id from claim), (select lease_token from claim));
end;
$$;

select pg_temp.append('TEST/lov/impact', 'a', array[['§ 1', '§ 1. Formål.'], ['§ 2', '§ 2. Fristen for klage er tre uker.'], ['§ 3', '§ 3. Gebyr.']]);
select pg_temp.append('TEST/lov/citing', 'b', array[['§ 1', '§ 1. Se lov om impact § 2.']]);
set constraints private.legal_authority_versions_glci_detect immediate;
set constraints private.legal_authority_versions_glci_detect deferred;
insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type)
values ((select id from private.legal_authorities where external_id = 'TEST/lov/citing'), (select id from private.legal_authorities where external_id = 'TEST/lov/impact'), 'cites');
insert into private.legal_source_dataset_syncs (source_id, dataset, dataset_sha256, dataset_size_bytes, retrieved_at, source_uri, authorities_listed)
values ((select id from private.legal_sources where source_key = 'glci-impact-source'), 'synthetic.tar.bz2', repeat('e', 64), 10, now(), 'https://laws.example.test/archive', 2);

-- A customer's research relies on § 2 (the deadline) and § 3 (unchanged).
create temporary table p on commit drop as select p.id, p.section_path[1] as section from private.legal_authority_passages p
  join private.legal_authority_versions v on v.id = p.authority_version_id join private.legal_authorities a on a.id = v.authority_id
  where a.external_id = 'TEST/lov/impact';
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, limitations, engine_version)
values ('c4500000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'Hva er klagefristen?', 'NO', '2026-01-01', '{nb}', 'lexical', 'answered', 'pilot', '[]', 'extractive-1.1.0');
insert into private.research_findings (run_id, rank, passage_id, authority_version_id, authority_id, score)
select 'c4500000-0000-4000-8000-000000000001', row_number() over (order by p.section), p.id, v.id, v.authority_id, 0.8
from p join private.legal_authority_passages lp on lp.id = p.id join private.legal_authority_versions v on v.id = lp.authority_version_id
where p.section in ('§ 2', '§ 3');
insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, verification_status)
values ('c4500000-0000-4000-8000-000000000001', 0, 'verified_authority', 'Fristen for klage er tre uker.', (select id from p where section = '§ 2'), 'verified');
insert into private.legal_documents (id, organization_id, workspace_id, title, template_key, template_version, research_run_id, status, current_version)
values ('c4600000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'Klage', 'legal_letter', 1, 'c4500000-0000-4000-8000-000000000001', 'draft', 1);
insert into private.legal_issues (id, organization_id, workspace_id, research_run_id, title)
values ('c4700000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'c4500000-0000-4000-8000-000000000001', 'Klagefrist');
insert into private.matters (id, organization_id, workspace_id, matter_number, title, legal_category, jurisdiction_code)
values ('c4800000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'M-2026-9001', 'Klage på vedtak', 'administrative', 'NO');
insert into private.matter_links (matter_id, link_type, target_id) values
  ('c4800000-0000-4000-8000-000000000001', 'research_run', 'c4500000-0000-4000-8000-000000000001'),
  ('c4800000-0000-4000-8000-000000000001', 'legal_document', 'c4600000-0000-4000-8000-000000000001');

-- The act is amended: the deadline in § 2 changes; § 3 is unchanged.
select pg_temp.append('TEST/lov/impact', 'c', array[['§ 1', '§ 1. Formål.'], ['§ 2', '§ 2. Fristen for klage er seks uker.'], ['§ 3', '§ 3. Gebyr.']]);
-- What commit does, in order: detection, then the analysis it queues.
set constraints private.legal_authority_versions_glci_detect immediate;
set constraints private.glci_change_events_analyse immediate;
create temporary table ev on commit drop as select id from private.glci_change_events where change_type = 'amended'
  and authority_id = (select id from private.legal_authorities where external_id = 'TEST/lov/impact');
grant select on ev to authenticated;

select is((select count(*)::int from ev), 1, 'the amendment is detected');
select is((select count(*)::int from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'research_finding'), 1,
  'only the finding that relied on the amended section is affected (not § 3)');
select is((select severity from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'research_claim'), 'high',
  'the verified claim quoting the old text is a high impact');
select is((select detail ->> 'verificationStatus' from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'research_claim'),
  'verified', 'the claim''s verification status is recorded');
select is((select subject_id from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'research_run'),
  'c4500000-0000-4000-8000-000000000001'::uuid, 'the research run is affected once');
select is((select subject_id from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'legal_document'),
  'c4600000-0000-4000-8000-000000000001'::uuid, 'the document built on the run is affected');
select is((select subject_id from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'legal_issue'),
  'c4700000-0000-4000-8000-000000000001'::uuid, 'the legal issue built on the run is affected');
select is((select subject_id from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'matter'),
  'c4800000-0000-4000-8000-000000000001'::uuid, 'the matter linked to the run and document is affected, once');
select is((select jsonb_array_length(dependency_path -> 0 -> 'linkedRecords') from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'matter'),
  2, 'the matter''s dependency path names both linked records');
select is((select detail ->> 'relationshipType' from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'dependent_authority'),
  'cites', 'the act that cites the amended act depends on it');
select is((select organization_id from private.glci_change_impacts where event_id = (select id from ev) and impact_type = 'matter'),
  (select value::uuid from g where key = 'org'), 'impacts carry the affected tenant');
select is((select count(*)::int from private.glci_audit_events where event_type = 'impact.analysed'), 1, 'the analysis is audited');
select throws_ok($$delete from private.glci_change_impacts$$, '55000', null, 'impacts are append-only evidence');

set local role authenticated;
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_change_impacts((select id from ev))$$, 'GLCI_NOT_AUTHORISED', 'customers cannot read the impact analysis');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-0000000000a1';
select is(public.glci_reanalyse_change((select id from ev)), 7, 're-running the analysis is idempotent (7 impacts)');
select is((public.glci_change_impacts((select id from ev)) -> 'summary' ->> 'research_claim'), '1', 'operators see the impact summary');
reset role;

select * from finish();
rollback;
