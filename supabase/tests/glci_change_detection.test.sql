-- GLCI-03: version comparison through the real ingestion path (legal_ingestion_append_authority).
-- Detection runs at commit; the test fires it with SET CONSTRAINTS ... IMMEDIATE. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c3000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-change-operator@example.invalid', now(), now()),
  ('c3000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-change-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'c3000000-0000-4000-8000-0000000000a1';

insert into private.legal_sources (jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method)
values ('NO', 'glci-change-source', 'Synthetic change source', 'Synthetic issuer', 'legislation', 'https://laws.example.test/', 'bulk_download');
select public.legal_source_record_rights_review((select id from private.legal_sources where source_key = 'glci-change-source'), 'pgTAP reviewer',
  'TEST-LICENCE', '1', 'https://laws.example.test/terms', 'Synthetic attribution', now() - interval '1 minute', now() + interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":false}'::jsonb);
select public.legal_source_set_activation((select id from private.legal_sources where source_key = 'glci-change-source'), 'pgTAP operator',
  'Synthetic activation for change detection', 'active', true, 'glci-change-adapter', '1.0.0');
create temporary table lease on commit drop as select public.legal_ingestion_enqueue_job(
  (select id from private.legal_sources where source_key = 'glci-change-source'), 'glci-change-adapter', '1.0.0', 'glci-change-1') as job_id;
create temporary table claim on commit drop as select * from public.legal_ingestion_claim_job('pgtap-worker', 60);

-- Appends one version of the synthetic act from an array of [section label, text] pairs.
create function pg_temp.append(p_hash text, p_valid_from text, p_sections text[][]) returns text language plpgsql as $$
declare
  v_passages jsonb := '[]';
  v_text text := 'Synthetic act';
  v_i integer;
begin
  for v_i in 1 .. array_length(p_sections, 1) loop
    v_passages := v_passages || jsonb_build_array(jsonb_build_object('ordinal', v_i - 1, 'startOffset', 0, 'endOffset', 1,
      'content', p_sections[v_i][2], 'contentHash', encode(extensions.digest(p_sections[v_i][2], 'sha256'), 'hex'),
      'sectionPath', jsonb_build_array('Kapittel 1', p_sections[v_i][1])));
    v_text := v_text || E'\n\n' || p_sections[v_i][2];
  end loop;
  return public.legal_ingestion_append_authority('glci-change-source', 'NO',
    jsonb_build_object('externalId', 'TEST/lov/2020-01-01-7', 'citation', 'TEST-7', 'title', 'Synthetic immigration act',
      'authorityType', 'act', 'languageCode', 'nb', 'legalStatus', 'in_force', 'validFrom', p_valid_from, 'publicationDate', '2020-01-01',
      'metadata', jsonb_build_object('dataset', 'synthetic.tar.bz2', 'enactmentDate', '2019-12-15'),
      'sourceContentHash', repeat(p_hash, 64), 'normalisedContentHash', repeat(p_hash, 64), 'normalisedText', v_text),
    'https://laws.example.test/archive#a.xml', now(), 'test-profile', v_passages,
    (select job_id from claim), (select lease_token from claim));
end;
$$;

-- ------------------------------------------------------------------ version 1 (baseline)
select is(pg_temp.append('a', '2020-02-01', array[['§ 1', '§ 1. Formål. Loven regulerer innreise.'], ['§ 2', '§ 2. Visum kreves.'],
  ['§ 4', '§ 4. Klage til direktoratet.']]), 'created', 'version 1 is ingested');
set constraints private.legal_authority_versions_glci_detect immediate;
set constraints private.legal_authority_versions_glci_detect deferred;
create temporary table ev1 on commit drop as select * from private.glci_change_events where authority_id =
  (select id from private.legal_authorities where external_id = 'TEST/lov/2020-01-01-7');
select is((select change_type from ev1), 'new_authority', 'the first version is a new authority');
select ok((select is_baseline from ev1), 'the first ingestion of a source is a baseline, not news');
select is((select sections_added from ev1), 3, 'the baseline counts its sections');
select is((select publication_date::text || '/' || enactment_date::text || '/' || effective_date::text from ev1), '2020-01-01/2019-12-15/2020-02-01',
  'publication, enactment and effective dates are recorded separately');
select is((select commencement_status from ev1), 'in_force', 'a past effective date is in force');

-- the source has now been synchronised once: later changes are news
insert into private.legal_source_dataset_syncs (source_id, dataset, dataset_sha256, dataset_size_bytes, retrieved_at, source_uri, authorities_listed)
values ((select id from private.legal_sources where source_key = 'glci-change-source'), 'synthetic.tar.bz2', repeat('e', 64), 10, now(),
  'https://laws.example.test/archive', 1);

-- ------------------------------------------------------------------ version 2 (amendment, pending commencement)
select is(pg_temp.append('b', (current_date + 30)::text, array[
  ['§ 1', '§ 1. Formål. Loven regulerer innreise og opphold.'],
  ['§ 3', '§ 3. Oppholdstillatelse kan gis for arbeid.'],
  ['§ 5', '§ 4. Klage til direktoratet.'],
  ['§ 9', '§ 9. Overgangsregler. Søknader fremmet før ikrafttredelsen behandles etter de gamle reglene.']]), 'created', 'version 2 is ingested');
set constraints private.legal_authority_versions_glci_detect immediate;
set constraints private.legal_authority_versions_glci_detect deferred;
create temporary table ev2 on commit drop as select * from private.glci_change_events where authority_id =
  (select id from private.legal_authorities where external_id = 'TEST/lov/2020-01-01-7') and change_type = 'amended';
select is((select count(*)::int from ev2), 1, 'the new version produces one amendment event');
select ok(not (select is_baseline from ev2), 'an amendment after the first synchronisation is news');
select is((select sections_amended || '/' || sections_added || '/' || sections_removed || '/' || sections_renumbered from ev2), '1/2/1/1',
  'section 1 amended; sections 3 and 9 added; section 2 removed; section 4 renumbered as 5');
select is((select change from private.glci_change_sections where event_id = (select id from ev2) and section_key = 'Kapittel 1 > § 2'), 'removed',
  'the removed section is identified exactly');
select is((select previous_section_key from private.glci_change_sections where event_id = (select id from ev2) and change = 'renumbered'),
  'Kapittel 1 > § 4', 'a renumbered section keeps its previous label');
select is((select commencement_status from ev2), 'pending_commencement', 'a future effective date is pending commencement, not in force (J-GLCI-6)');
select is((select transitional_sections from ev2), array['Kapittel 1 > § 9'], 'transitional provisions are flagged');
select is((select from_version_id is not null and to_version_id is not null from ev2), true, 'the event links both versions');

-- ------------------------------------------------------------------ withdrawal and reinstatement
update private.legal_authorities set source_metadata = source_metadata || '{"absentFromDatasetSince":"2026-11-12T00:00:00Z"}'
  where external_id = 'TEST/lov/2020-01-01-7';
select is((select count(*)::int from private.glci_change_events where change_type = 'withdrawn' and authority_id =
  (select id from private.legal_authorities where external_id = 'TEST/lov/2020-01-01-7')), 1, 'an act leaving the dataset is a withdrawal (repeal candidate)');
update private.legal_authorities set source_metadata = source_metadata - 'absentFromDatasetSince' where external_id = 'TEST/lov/2020-01-01-7';
select is((select count(*)::int from private.glci_change_events where change_type = 'reinstated'), 1, 'its return is a reinstatement');

-- ------------------------------------------------------------------ evidence integrity and audit
select throws_ok($$update private.glci_change_events set change_type = 'amended' where id = (select id from ev1)$$, '42501', null,
  'a detected change cannot be rewritten');
select lives_ok($$update private.glci_change_events set review_status = 'assessed' where id = (select id from ev2)$$, 'its review status can move');
select throws_ok($$delete from private.glci_change_sections$$, '55000', null, 'section differences are append-only');
select is((select array_agg(event_type order by sequence_number) from private.glci_audit_events where event_type like 'change.%'),
  array['change.amended', 'change.withdrawn', 'change.reinstated'], 'news is audited; the baseline is not');

-- ------------------------------------------------------------------ operator API
grant select on ev2 to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c3000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_change_events()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot read change intelligence');
set local request.jwt.claim.sub = 'c3000000-0000-4000-8000-0000000000a1';
select is((select count(*)::int from jsonb_array_elements(public.glci_change_events('NO'))), 3, 'operators see the news (baseline excluded)');
select is((select count(*)::int from jsonb_array_elements(public.glci_change_events('NO', true))), 4, 'and the baseline on request');
select is((select r ->> 'commencementStatus' from jsonb_array_elements(public.glci_change_events('NO')) r where r ->> 'changeType' = 'amended'),
  'pending_commencement', 'the change list shows commencement status');
select ok((select bool_or(s ->> 'oldText' like '%Visum kreves%') from jsonb_array_elements(public.glci_change_event_sections((select id from ev2))) s),
  'the section comparison shows the old and new text');
reset role;

select * from finish();
rollback;
