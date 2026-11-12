-- GLCI-05: currency verdicts for Norway, step by step. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c5000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-currency-operator@example.invalid', now(), now()),
  ('c5000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-currency-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'c5000000-0000-4000-8000-0000000000a1';
create temporary table k (key text primary key, value text) on commit drop;
create function pg_temp.verdict() returns text language sql as $$ select private.glci_jurisdiction_currency('NO') ->> 'verdict' $$;
create function pg_temp.check(p_fingerprint text, p_failure text default null) returns text language plpgsql as $$
declare v_lease uuid;
begin
  update private.glci_target_state set next_check_at = now() - interval '1 second'
    where target_id = (select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws');
  select lease_token into v_lease from public.glci_monitor_claim('pgtap', 10, 60) where target_key = 'no-lovdata-current-laws';
  return public.glci_monitor_record('no-lovdata-current-laws', v_lease,
    case when p_failure is null then encode(extensions.digest(p_fingerprint, 'sha256'), 'hex') end, '{}',
    p_failure, case when p_failure is not null then 'unreachable' end, 10);
end;
$$;

select is(pg_temp.verdict(), 'not_monitored', 'with no active target, Njumeni does not claim currency');
update private.glci_monitoring_targets set status = 'active' where target_key = 'no-lovdata-current-laws';
select is(pg_temp.verdict(), 'unverified', 'an active target that was never checked is unverified');
select ok((private.glci_jurisdiction_currency('NO') -> 'reasons' ->> 0) like '%not verified%', 'the reason says why');

select pg_temp.check('dataset-v1');
select is(pg_temp.verdict(), 'behind', 'a newly seen dataset that was never ingested: behind');
select is(jsonb_array_length(private.glci_jurisdiction_currency('NO') -> 'knowledgeLag'), 1, 'the knowledge lag names the target');

-- Ingest: one act, from the licensed dataset, completed after the change was seen.
insert into private.legal_source_ingestion_runs (source_id, adapter_key, adapter_version, status, started_at, finished_at)
values ((select id from private.legal_sources where source_key = 'lovdata-official'), 'lovdata-public-data', '1.1.0', 'succeeded', now(), now() + interval '1 second');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, title, authority_type, language_code, legal_status, source_metadata)
values ('c5100000-0000-4000-8000-000000000001', (select id from private.legal_sources where source_key = 'lovdata-official'), 'NO', 'NL/lov/2005-06-17-62',
  'Arbeidsmiljøloven', 'act', 'nb', 'in_force', '{"dataset":"gjeldende-lover.tar.bz2"}');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_uri, source_content_hash)
values ('c5200000-0000-4000-8000-000000000001', 'c5100000-0000-4000-8000-000000000001', 1, '2024-01-01',
  'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2#nl-20050617-062.xml', repeat('1', 64));
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
values ('c5300000-0000-4000-8000-000000000001', 'c5200000-0000-4000-8000-000000000001', 0, '§ 15-3. Oppsigelsesfrister.', repeat('2', 64));
insert into private.legal_source_dataset_syncs (source_id, dataset, dataset_sha256, dataset_size_bytes, retrieved_at, source_uri, authorities_listed)
values ((select id from private.legal_sources where source_key = 'lovdata-official'), 'gjeldende-lover.tar.bz2', repeat('a', 64), 5809848, now(),
  'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2', 2);

select is(jsonb_array_length(private.glci_jurisdiction_currency('NO') -> 'knowledgeLag'), 0, 'after ingestion there is no knowledge lag');
select is(pg_temp.verdict(), 'behind', 'but one listed act is missing and a passage is not indexed: behind');
select is((private.glci_jurisdiction_currency('NO') -> 'completeness' -> 0 ->> 'missing') || '/' ||
  (private.glci_jurisdiction_currency('NO') -> 'completeness' -> 0 ->> 'passagesWithoutEmbedding'), '1/1', 'completeness names both gaps');

-- Complete: the listing has one act, and the passage is embedded.
insert into private.legal_source_dataset_syncs (source_id, dataset, dataset_sha256, dataset_size_bytes, retrieved_at, source_uri, authorities_listed, completed_at)
values ((select id from private.legal_sources where source_key = 'lovdata-official'), 'gjeldende-lover.tar.bz2', repeat('b', 64), 5809848, now(),
  'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2', 1, now() + interval '1 minute');
update private.legal_authority_passages set embedding = array_fill(0.01::real, array[384])::extensions.vector,
  embedding_model_key = (select profile_key from private.legal_embedding_profiles limit 1) where id = 'c5300000-0000-4000-8000-000000000001';
select pg_temp.check('dataset-v1');
select is(pg_temp.verdict(), 'current', 'verified, ingested, complete and indexed: current');

-- A customer cites text that is later superseded.
update private.legal_authority_versions set is_current_source_version = false where id = 'c5200000-0000-4000-8000-000000000001';
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_uri, source_content_hash)
values ('c5200000-0000-4000-8000-000000000002', 'c5100000-0000-4000-8000-000000000001', 2, '2026-01-01',
  'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2#nl-20050617-062.xml', repeat('3', 64));
insert into private.legal_authority_passages (authority_version_id, ordinal, content, content_hash, embedding, embedding_model_key)
values ('c5200000-0000-4000-8000-000000000002', 0, '§ 15-3. Nye oppsigelsesfrister.', repeat('4', 64),
  array_fill(0.01::real, array[384])::extensions.vector, (select profile_key from private.legal_embedding_profiles limit 1));
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, limitations, engine_version)
select 'c5400000-0000-4000-8000-000000000001', o.id, w.id, 'Oppsigelsesfrist?', 'NO', '2026-01-01', '{nb}', 'lexical', 'answered', 'pilot', '[]', 'extractive-1.1.0'
from public.organizations o join public.workspaces w on w.organization_id = o.id join private.principal_identities pi on pi.principal_id = o.owner_principal_id
where pi.auth_user_id = 'c5000000-0000-4000-8000-0000000000b1' and o.kind = 'personal' limit 1;
insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, verification_status)
values ('c5400000-0000-4000-8000-000000000001', 0, 'verified_authority', 'Oppsigelsesfrister.', 'c5300000-0000-4000-8000-000000000001', 'verified');
select is(pg_temp.verdict(), 'behind', 'a research claim citing superseded text puts Norway behind');
select is((private.glci_jurisdiction_currency('NO') -> 'citationAccuracy' ->> 'claimsCitingSupersededText'), '1', 'citation accuracy counts it');

-- The source goes dark: currency can no longer be claimed (J-GLCI-2).
select ok((private.glci_jurisdiction_currency('NO') -> 'reasons') @> '["1 research claim(s) cite superseded text."]',
  'it stays behind until the claim is re-verified (claims are append-only evidence)');
select pg_temp.check(null, 'UPSTREAM_5XX');
select is(pg_temp.verdict(), 'unverified', 'an unreachable source makes the jurisdiction unverified, never current');

-- Recorded verifications.
set local role authenticated;
set local request.jwt.claim.sub = 'c5000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_currency_overview()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot read currency reports');
set local request.jwt.claim.sub = 'c5000000-0000-4000-8000-0000000000a1';
select is((select r ->> 'verdict' from jsonb_array_elements(public.glci_run_currency_verification('NO')) r), 'unverified', 'operators record a verification');
reset role;
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select is(jsonb_array_length(public.glci_run_currency_verification()), 9, 'the scheduled worker verifies every profiled jurisdiction');
reset role;
select is((select count(*)::int from private.glci_audit_events where event_type = 'currency.verdict_changed'), 9,
  'the first verdict of each jurisdiction is audited (later repeats are not)');

select * from finish();
rollback;
