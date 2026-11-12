-- Source-specific licence policy (Lovdata, NLOD 2.0), dataset synchronisation and item retries.
-- Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

create temporary table lov on commit drop as select id from private.legal_sources where source_key = 'lovdata-official';
grant select on lov to authenticated, anon;

-- ------------------------------------------------------------------ the policy
select is((select count(*)::int from private.legal_source_licence_policies), 1, 'exactly one licence policy exists: Lovdata');
select is((select licence_identifier from private.legal_source_licence_policies where source_id = (select id from lov)), 'NLOD-2.0',
  'Lovdata API data is licensed under NLOD 2.0');
select is((select acquisition_hosts from private.legal_source_licence_policies where source_id = (select id from lov)), array['api.lovdata.no'],
  'data may be acquired only from the official API host');
select is((select permitted_datasets from private.legal_source_licence_policies where source_id = (select id from lov)),
  array['gjeldende-lover.tar.bz2', 'gjeldende-sentrale-forskrifter.tar.bz2'], 'only the current-laws and central-regulations datasets are licensed');
select ok(private.legal_source_permits_use((select id from lov), 'retrieval_augmented_generation')
  and private.legal_source_permits_use((select id from lov), 'commercial_use'), 'RAG and commercial use are permitted for Lovdata API data');
select ok(not private.legal_source_permits_use((select id from lov), 'model_training')
  and not private.legal_source_permits_use((select id from lov), 'model_fine_tuning')
  and not private.legal_source_permits_use((select id from lov), 'website_scraping'),
  'training, fine-tuning and website scraping are not permitted');
select ok((select attribution_text from private.legal_source_licence_policies where source_id = (select id from lov)) like '%NLOD%Lovdata%',
  'the attribution names NLOD and Lovdata');
select is((select access_method from private.legal_sources where id = (select id from lov)), 'bulk_download',
  'the Lovdata source acquires API datasets, not the website');
select is((select rights_status || '/' || status || '/' || ingestion_enabled::text from private.legal_sources where id = (select id from lov)),
  'review_required/planned/false', 'the migration neither approves nor activates Lovdata');

-- The Lovdata policy does not reach other sources.
select is((select count(*)::int from private.legal_source_licence_policies p join private.legal_sources s on s.id = p.source_id
  where s.source_key <> 'lovdata-official'), 0, 'no other source inherits the Lovdata licence');
select ok((select bool_and(private.legal_source_permits_use(id, 'retrieval_augmented_generation')
    and not private.legal_source_permits_use(id, 'model_training')) from private.legal_sources where source_key <> 'lovdata-official'),
  'sources without a policy keep their own rights rules and are never permitted for training');
select is(public.legal_source_licence_policy_get('eur-lex'), null, 'an unrelated source reports no licence policy');
select is(public.legal_source_licence_policy_get('lovdata-official') ->> 'licenceIdentifier', 'NLOD-2.0', 'the policy is readable by the service role');

select throws_ok($$update private.legal_source_licence_policies set licence_identifier = 'X'$$, null, null, 'licence policies are append-only');
select is(public.legal_source_record_licence_policy('lovdata-official', 'pgTAP', 'NLOD-2.0', 'https://data.norge.no/nlod/en/2.0',
  (select attribution_text from private.legal_source_licence_policies where source_id = (select id from lov)), array['api.lovdata.no'],
  array['gjeldende-lover.tar.bz2'], (select permitted_uses from private.legal_source_licence_policies where source_id = (select id from lov)),
  '{}', array['https://api.lovdata.no/'], 'Synthetic narrower policy for the test'), 2, 'a new policy is a new version');
select is((private.legal_source_licence_policy((select id from lov))).permitted_datasets, array['gjeldende-lover.tar.bz2'],
  'the latest version applies');

set local role authenticated;
select throws_ok($$select public.legal_source_licence_policy_get('lovdata-official')$$, '42501', null, 'browser roles cannot read licence policies');
reset role;

-- ------------------------------------------------------------------ activation under the policy
select lives_ok($$select public.legal_source_record_rights_review((select id from lov), 'pgTAP reviewer', 'NLOD-2.0', '2.0',
  'https://api.lovdata.no/', 'Wrong attribution', now() - interval '1 minute', now() + interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":true}'::jsonb)$$,
  'a rights review can be recorded');
select throws_ok($$select public.legal_source_set_activation((select id from lov), 'pgTAP operator', 'Activation with the wrong attribution',
  'active', true, 'lovdata-public-data', '1.1.0')$$, 'LEGAL_SOURCE_LICENCE_POLICY_MISMATCH', 'ingestion cannot be enabled under a different attribution');
select lives_ok(format($$select public.legal_source_record_rights_review((select id from lov), 'pgTAP reviewer', 'NLOD-2.0', '2.0',
  'https://api.lovdata.no/', %L, now() - interval '1 minute', now() + interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":true}'::jsonb)$$,
  (select attribution_text from private.legal_source_licence_policies where source_id = (select id from lov) and policy_version = 1)),
  'the review records the policy attribution');
select lives_ok($$select public.legal_source_set_activation((select id from lov), 'pgTAP operator', 'Activation under the NLOD 2.0 policy',
  'active', true, 'lovdata-public-data', '1.1.0')$$, 'ingestion is enabled under the policy');
select throws_ok($$update private.legal_sources set access_method = 'web' where id = (select id from lov)$$,
  'LEGAL_SOURCE_SCRAPING_NOT_PERMITTED', 'an enabled Lovdata source cannot switch to website scraping');

create temporary table licence_job on commit drop as
  select public.legal_ingestion_enqueue_job((select id from lov), 'lovdata-public-data', '1.1.0', 'pgtap-licence-1') as job_id;
create temporary table lease on commit drop as select * from public.legal_ingestion_claim_job('pgtap-worker', 60);

create function pg_temp.append(p_external_id text, p_dataset text, p_uri text) returns text language sql as $$
  select public.legal_ingestion_append_authority('lovdata-official', 'NO',
    jsonb_build_object('externalId', p_external_id, 'title', 'Synthetic act ' || p_external_id, 'authorityType', 'act',
      'languageCode', 'nb', 'legalStatus', 'in_force', 'metadata', jsonb_build_object('dataset', p_dataset),
      'sourceContentHash', md5(p_external_id) || md5(p_external_id), 'normalisedContentHash', md5(p_external_id) || md5(p_external_id),
      'normalisedText', 'Synthetic act ' || p_external_id),
    p_uri, now(), 'lovdata-nl-html-v1',
    jsonb_build_array(jsonb_build_object('ordinal', 0, 'startOffset', 0, 'endOffset', 5, 'content', 'Synth', 'contentHash', repeat('c', 64))),
    (select job_id from lease), (select lease_token from lease))
$$;
select is(pg_temp.append('NL/lov/2000-01-01-1', 'gjeldende-lover.tar.bz2',
  'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2#a.xml'), 'created', 'a licensed dataset from the API host is ingested');
select throws_ok($$select pg_temp.append('NL/lov/2000-01-01-2', 'gjeldende-lover.tar.bz2', 'https://lovdata.no/dokument/NL/lov/2000-01-01-2')$$,
  'LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED', 'website content is refused');
select throws_ok($$select pg_temp.append('NL/lov/2000-01-01-3', 'gjeldende-sentrale-forskrifter.tar.bz2',
  'https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2#b.xml')$$,
  'LEGAL_SOURCE_LICENCE_DATASET_NOT_PERMITTED', 'a dataset outside the current policy version is refused');
select is(pg_temp.append('NL/lov/2000-01-01-4', 'gjeldende-lover.tar.bz2',
  'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2#c.xml'), 'created', 'a second act is ingested');

-- ------------------------------------------------------------------ dataset synchronisation
select is(public.legal_ingestion_complete_dataset_sync('lovdata-official', 'gjeldende-lover.tar.bz2', repeat('f', 64), 1000,
  now() - interval '1 day', now(), 'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2',
  array['NL/lov/2000-01-01-1'], (select job_id from lease), (select lease_token from lease)) ->> 'authoritiesAbsent', '1',
  'a complete listing flags the act it no longer contains');
select is((select legal_status || '/' || (source_metadata ? 'absentFromDatasetSince')::text from private.legal_authorities
  where external_id = 'NL/lov/2000-01-01-4'), 'unknown/true', 'the absent act is flagged, not deleted');
select is(public.legal_ingestion_last_dataset_sync('lovdata-official', 'gjeldende-lover.tar.bz2') ->> 'datasetSha256', repeat('f', 64),
  'the last synchronised archive is recorded for incremental runs');

-- ------------------------------------------------------------------ item retries
select is(public.legal_ingestion_record_item_outcome('lovdata-official', 'NL/lov/2000-01-01-9', false, 'NETWORK_TIMEOUT', 'retryable',
  (select job_id from lease), (select lease_token from lease)), 'pending', 'a retryable item failure is kept for retry');
update private.legal_ingestion_item_failures set next_attempt_at = now() - interval '1 second' where external_id = 'NL/lov/2000-01-01-9';
select is(public.legal_ingestion_due_item_retries('lovdata-official'), array['NL/lov/2000-01-01-9'], 'due retries are listed for the next job');
select is((select string_agg(public.legal_ingestion_record_item_outcome('lovdata-official', 'NL/lov/2000-01-01-8', false, 'LOVDATA_DOCUMENT_INVALID',
  'terminal', (select job_id from lease), (select lease_token from lease)), ',') from generate_series(1, 3)), 'pending,pending,abandoned',
  'a terminal failure is abandoned for review after three attempts');

select throws_ok($$select public.legal_ingestion_record_item_outcome('lovdata-official', 'NL/lov/x', false, 'X_FAILED', null,
  (select job_id from lease), (select lease_token from lease))$$, 'LEGAL_INGESTION_ITEM_OUTCOME_INVALID', 'a failure without a class is refused');

-- ------------------------------------------------------------------ reranking traceability
select has_column('private', 'research_findings', 'ranking_trace', 'research findings keep the reranking trace');
select is(private.research_ranking_trace('{"rerankerVersion":"legal-rerank-1.0.0","firstStageRank":3,"score":0.8,
  "features":{"provision":1,"citation":0.5,"secret":"x"},"reasons":["Matches the provision named in the question."],"other":"dropped"}'::jsonb),
  '{"rerankerVersion":"legal-rerank-1.0.0","firstStageRank":3,"score":0.8,"features":{"provision":1,"citation":0.5},"reasons":["Matches the provision named in the question."]}'::jsonb,
  'only documented trace fields are stored');
select is(private.research_ranking_trace('{"score":1}'::jsonb), null, 'a trace without a reranker version is not stored');
select ok(position('ranking_trace' in pg_get_functiondef('public.research_record_run(uuid,uuid,text,text,date,text[],text,jsonb,text,jsonb,jsonb)'::regprocedure)) > 0
  and position('rankingTrace' in pg_get_functiondef('public.research_get_run(uuid)'::regprocedure)) > 0,
  'runs record and return the trace');

select * from finish();
rollback;
