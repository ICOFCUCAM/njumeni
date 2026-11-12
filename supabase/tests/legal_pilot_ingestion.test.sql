-- Task 2.8: valid-time and section paths on append; page-by-page continuation of a source.
-- Uses a synthetic source; everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into private.legal_sources(jurisdiction_code,source_key,name,issuing_authority,source_type,base_uri,access_method)
values('NO','pilot-test-source','Synthetic pilot source','Synthetic issuer','legislation','https://laws.example.test/','bulk_download');

select lives_ok($$select public.legal_source_record_rights_review(
  (select id from private.legal_sources where source_key='pilot-test-source'),'pgTAP reviewer','TEST-LICENCE','1',
  'https://laws.example.test/terms','Synthetic attribution',now()-interval '1 minute',now()+interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":false}'::jsonb)$$,
  'rights evidence is recorded for the synthetic source');
select lives_ok($$select public.legal_source_set_activation(
  (select id from private.legal_sources where source_key='pilot-test-source'),'pgTAP operator',
  'Synthetic activation for the pilot ingestion test','active',true,'pilot-test-adapter','1.0.0')$$,
  'the synthetic source is activated with an exact adapter pin');

create temporary table pilot_job on commit drop as
  select public.legal_ingestion_enqueue_job(
    (select id from private.legal_sources where source_key='pilot-test-source'),
    'pilot-test-adapter','1.0.0','pilot-test-page-1') as job_id;
create temporary table pilot_lease on commit drop as
  select * from public.legal_ingestion_claim_job('pgtap-worker',60);
select is((select job_id from pilot_lease),(select job_id from pilot_job),'the worker leases the first page');

create temporary table pilot_append on commit drop as select public.legal_ingestion_append_authority(
  'pilot-test-source','NO',
  jsonb_build_object('externalId','TEST/lov/2020-01-01-1','citation','TEST-2020-01-01-1','title','Synthetic act',
    'authorityType','act','languageCode','nb','legalStatus','in_force','validFrom','2024-07-01',
    'sourceContentHash',repeat('a',64),'normalisedContentHash',repeat('b',64),
    'normalisedText','Synthetic act'||chr(10)||chr(10)||'§ 1. Formål'||chr(10)||'Tekst.'),
  'https://laws.example.test/archive#a.xml',now(),'test-profile',
  jsonb_build_array(jsonb_build_object('ordinal',0,'startOffset',15,'endOffset',33,
    'content','§ 1. Formål'||chr(10)||'Tekst.','contentHash',repeat('c',64),
    'sectionPath',jsonb_build_array('Kapittel 1. Innledning','§ 1'))),
  (select job_id from pilot_lease),(select lease_token from pilot_lease)) as outcome;
select is((select outcome from pilot_append),'created','an authority with validity and section paths is appended');
select is((select v.valid_from from private.legal_authority_versions v join private.legal_authorities a on a.id=v.authority_id
  where a.external_id='TEST/lov/2020-01-01-1'),'2024-07-01'::date,'the version records its valid-time start');
select is((select p.section_path from private.legal_authority_passages p
  join private.legal_authority_versions v on v.id=p.authority_version_id
  join private.legal_authorities a on a.id=v.authority_id where a.external_id='TEST/lov/2020-01-01-1'),
  array['Kapittel 1. Innledning','§ 1'],'the passage records its section path');
select is(public.legal_ingestion_append_authority(
  'pilot-test-source','NO',
  jsonb_build_object('externalId','TEST/lov/2020-01-01-1','citation','TEST-2020-01-01-1','title','Synthetic act',
    'authorityType','act','languageCode','nb','validFrom','2024-07-01',
    'sourceContentHash',repeat('a',64),'normalisedContentHash',repeat('b',64),'normalisedText','Synthetic act'),
  'https://laws.example.test/archive#a.xml',now(),'test-profile',
  jsonb_build_array(jsonb_build_object('ordinal',0,'startOffset',0,'endOffset',13,'content','Synthetic act','contentHash',repeat('c',64))),
  (select job_id from pilot_lease),(select lease_token from pilot_lease)),'unchanged','re-appending identical content creates no version');
select is((select count(*) from private.legal_authority_versions v join private.legal_authorities a on a.id=v.authority_id
  where a.external_id='TEST/lov/2020-01-01-1'),1::bigint,'still exactly one version');
select throws_ok($$select public.legal_ingestion_append_authority('pilot-test-source','NO',
  jsonb_build_object('externalId','TEST/x','title','X','authorityType','act','validFrom','1 July 2024',
    'sourceContentHash',repeat('d',64),'normalisedContentHash',repeat('d',64),'normalisedText','X'),
  'https://laws.example.test/x',now(),'p',
  '[{"ordinal":0,"startOffset":0,"endOffset":1,"content":"X","contentHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]'::jsonb,
  (select job_id from pilot_lease),(select lease_token from pilot_lease))$$,
  'LEGAL_INGESTION_AUTHORITY_INVALID','a malformed validity date is rejected');
select throws_ok($$select public.legal_ingestion_append_authority('pilot-test-source','NO',
  jsonb_build_object('externalId','TEST/y','title','Y','authorityType','act',
    'sourceContentHash',repeat('e',64),'normalisedContentHash',repeat('e',64),'normalisedText','Y'),
  'https://laws.example.test/y',now(),'p',
  '[{"ordinal":0,"startOffset":0,"endOffset":1,"content":"Y","contentHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","sectionPath":[1]}]'::jsonb,
  (select job_id from pilot_lease),(select lease_token from pilot_lease))$$,
  'LEGAL_INGESTION_PASSAGE_INVALID','a non-text section path is rejected');

select throws_ok($$select public.legal_ingestion_enqueue_continuation((select job_id from pilot_job),'pilot-test-page-2')$$,
  'LEGAL_INGESTION_NO_CONTINUATION','a job still running cannot be continued');
select ok(public.legal_ingestion_save_checkpoint((select job_id from pilot_lease),(select lease_token from pilot_lease),
  'after:TEST/lov/2020-01-01-1',array['TEST/lov/2020-01-01-1'],2,1,0,0,0),'the worker saves the next-page cursor');
select is(public.legal_ingestion_finish_job((select job_id from pilot_lease),(select lease_token from pilot_lease),'succeeded'),
  'succeeded','the first page finishes');
create temporary table pilot_next on commit drop as
  select public.legal_ingestion_enqueue_continuation((select job_id from pilot_job),'pilot-test-page-2') as job_id;
select is((select cursor_reference from private.legal_source_ingestion_jobs where id=(select job_id from pilot_next)),
  'after:TEST/lov/2020-01-01-1','the continuation starts from the saved cursor');
select is(public.legal_ingestion_enqueue_continuation((select job_id from pilot_job),'pilot-test-page-2'),
  (select job_id from pilot_next),'continuation enqueue is idempotent');

update private.legal_sources set ingestion_enabled=false where source_key='pilot-test-source';
select throws_ok($$select public.legal_ingestion_enqueue_continuation((select job_id from pilot_job),'pilot-test-page-3')$$,
  'LEGAL_INGESTION_SOURCE_NOT_READY','continuation re-checks the ingestion gate');

select ok(not has_function_privilege('anon','public.legal_ingestion_enqueue_continuation(uuid,text,integer)','EXECUTE'),
  'anonymous callers cannot enqueue continuations');
select ok(not has_function_privilege('authenticated','public.legal_ingestion_enqueue_continuation(uuid,text,integer)','EXECUTE'),
  'signed-in users cannot enqueue continuations');

select * from finish();
rollback;
