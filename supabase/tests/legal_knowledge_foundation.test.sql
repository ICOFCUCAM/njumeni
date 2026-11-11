begin;
create extension if not exists pgtap with schema extensions;
select plan(69);
select has_table('private','jurisdictions','jurisdiction registry exists');
select has_table('private','legal_sources','legal source registry exists');
select has_table('private','legal_authorities','stable authority identities exist');
select has_table('private','legal_authority_versions','historical authority versions exist');
select has_table('private','legal_authority_passages','version-bound passages exist');
select has_table('private','legal_authority_relationships','authority relationships exist');
select has_table('private','legal_source_ingestion_runs','source ingestion runs exist');
select is((select count(*) from private.jurisdictions where code in ('NO','EU','GB','US','INTL','CM')),6::bigint,'initial jurisdiction priority set is seeded');
select is((select count(*) from private.legal_sources),6::bigint,'initial legal-source discovery catalogue is seeded');
select is((select count(*) from private.legal_sources where ingestion_enabled),0::bigint,'no source ingestion is enabled before rights approval');
select is((select count(*) from private.jurisdictions where status='supported'),0::bigint,'no jurisdiction is represented as fully supported by seed data');
select ok((select relrowsecurity from pg_class where oid='private.jurisdictions'::regclass),'jurisdictions have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.legal_sources'::regclass),'sources have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.legal_authorities'::regclass),'authorities have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.legal_authority_versions'::regclass),'versions have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.legal_authority_passages'::regclass),'passages have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.legal_authority_relationships'::regclass),'relationships have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.legal_source_ingestion_runs'::regclass),'ingestion runs have RLS enabled');
select ok(not has_table_privilege('authenticated','private.legal_authorities','SELECT'),'authenticated users cannot directly query private legal authorities');
select ok(not has_table_privilege('anon','private.legal_sources','SELECT'),'anonymous users cannot query private legal sources');
select ok(has_table_privilege('service_role','private.legal_authorities','INSERT'),'trusted ingestion role can create authority records');
select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='legal_authority_passages' and column_name='search_vector' and udt_name='tsvector' and is_generated='ALWAYS'),'passages include a generated full-text vector');
select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='legal_authority_passages' and column_name='embedding' and udt_name='vector'),'passages include the pgvector embedding contract');
select ok(not has_table_privilege('service_role','private.legal_authority_versions','DELETE'),'service role cannot delete historical authority versions');
select ok(exists(select 1 from pg_trigger where tgname='legal_authority_versions_immutable' and not tgisinternal),'historical versions have append-only trigger');
select ok(exists(select 1 from pg_trigger where tgname='legal_authority_passages_immutable' and not tgisinternal),'passages have append-only trigger');
select ok(exists(select 1 from pg_trigger where tgname='legal_authority_relationships_immutable' and not tgisinternal),'authority relationships have append-only trigger');
select ok(exists(select 1 from pg_constraint where conrelid='private.legal_sources'::regclass and pg_get_constraintdef(oid) like '%licence_identifier%'),'source ingestion requires a recorded licence identifier');
select ok(to_regprocedure('private.search_legal_passages_lexical(text,text,date,text[],text[],integer)') is not null,'server-side lexical retrieval function exists');
select ok(to_regprocedure('private.search_legal_passages_semantic(extensions.vector,text,text,date,text[],text[],integer)') is not null,'server-side semantic retrieval function exists');
select ok(not has_function_privilege('authenticated','private.search_legal_passages_lexical(text,text,date,text[],text[],integer)','EXECUTE'),'authenticated users cannot execute lexical retrieval directly');
select ok(has_function_privilege('service_role','private.search_legal_passages_semantic(extensions.vector,text,text,date,text[],text[],integer)','EXECUTE'),'trusted server role can execute semantic retrieval');

select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='legal_authority_versions' and column_name='is_current_source_version'),'authority versions identify the current source snapshot');
select ok(to_regprocedure('public.legal_ingestion_claim_job(text,integer)') is not null,'durable ingestion claim RPC exists');
select ok(to_regprocedure('public.legal_ingestion_heartbeat(uuid,uuid,integer)') is not null,'durable ingestion heartbeat RPC exists');
select ok(to_regprocedure('public.legal_ingestion_save_checkpoint(uuid,uuid,text,text[],integer,integer,integer,integer,integer)') is not null,'durable ingestion checkpoint RPC exists');
select ok(to_regprocedure('public.legal_ingestion_finish_job(uuid,uuid,text,text,integer)') is not null,'durable ingestion completion RPC exists');
select ok(to_regprocedure('public.legal_ingestion_begin_run(text,text,text,text,text)') is not null,'trusted source run creation RPC exists');
select ok(to_regprocedure('public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb)') is null,'no unleased authority append RPC remains (append requires a live worker lease)');
select ok(to_regprocedure('public.legal_ingestion_persist_run_result(uuid,text,integer,integer,integer,integer,text,text[])') is not null,'source run result RPC exists');
select ok(to_regprocedure('public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb,uuid,uuid)') is not null,'authority append requires a live worker lease');
select ok(has_function_privilege('service_role','public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb,uuid,uuid)','EXECUTE'),'trusted worker can append authority under its lease');
select has_table('private','legal_source_ingestion_jobs','durable ingestion queue jobs exist');
select has_table('private','legal_source_ingestion_checkpoints','durable ingestion checkpoints exist');
select has_table('private','legal_source_ingestion_failures','durable ingestion failure records exist');
select has_table('private','legal_source_rights_evidence','explicit source rights review evidence is stored separately');
select ok(to_regprocedure('public.legal_worker_source_config(uuid)') is not null,'trusted worker source config RPC exists');
select ok(has_function_privilege('service_role','public.legal_worker_source_config(uuid)','EXECUTE'),'worker role can resolve source rights evidence');
select ok(to_regprocedure('public.legal_search_passages_lexical(text,text,date,text[],text[],integer)') is not null,'PostgREST lexical retrieval wrapper exists');
select ok(to_regprocedure('public.legal_search_passages_semantic(extensions.vector,text,text,date,text[],text[],integer)') is not null,'PostgREST semantic retrieval wrapper exists');
select ok(to_regprocedure('public.legal_jurisdiction_coverage_snapshot(text)') is not null,'jurisdiction coverage snapshot RPC exists');
select has_table('private','legal_source_rights_review_audit','rights reviews are retained in an append-only audit');
select ok(to_regprocedure('public.legal_source_record_rights_review(uuid,text,text,text,text,text,timestamptz,timestamptz,jsonb,text[])') is not null,'trusted rights review RPC exists');
select ok(to_regprocedure('public.legal_ingestion_enqueue_job(uuid,text,text,text,integer)') is not null,'rights-gated ingestion enqueue RPC exists');
select ok(exists(select 1 from information_schema.columns where table_schema='private' and table_name='legal_sources' and column_name='adapter_version'),'source registry pins adapter versions');
select lives_ok($$select public.legal_source_record_rights_review(
  (select id from private.legal_sources where source_key='lovdata-official'),
  'test-reviewer','test-licence','1','https://example.org/terms','Test attribution',
  now(),null,
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":false}'::jsonb,
  '{}'::text[]
)$$,'rights review can be recorded without source activation');
select is((select status from private.legal_sources where source_key='lovdata-official'),'planned'::text,'rights review does not activate a planned source');
select is((select ingestion_enabled from private.legal_sources where source_key='lovdata-official'),false,'rights review does not enable ingestion');
select is((select count(*) from private.legal_source_rights_review_audit),1::bigint,'rights review creates an immutable audit record');
select ok(to_regprocedure('public.legal_citation_source_metadata(text[])') is not null,'rights-aware citation metadata RPC exists');
select ok(to_regprocedure('public.legal_ingestion_append_relationship(text,text,text,text,date,text,text,uuid,uuid)') is not null,'lease-bound authority relationship append RPC exists');
select has_table('private','legal_source_activation_audit','source activation changes have an immutable operator audit');
select ok(to_regprocedure('public.legal_source_set_activation(uuid,text,text,text,boolean,text,text)') is not null,'explicit source activation RPC exists');
select has_table('private','legal_source_activation_audit','source activation is append-only audited');
select ok(to_regprocedure('public.legal_source_set_activation(uuid,text,text,text,boolean,text,text)') is not null,'source activation RPC remains present');
select has_table('private','legal_source_coverage_review_audit','source coverage reviews are audited append-only');
select ok(to_regprocedure('public.legal_source_record_coverage_review(uuid,text,text,text[],text[],date,date,timestamptz,text[])') is not null,'trusted source coverage review RPC exists');
select has_table('private','legal_jurisdiction_coverage_scope_audit','jurisdiction coverage scope changes are audited');
select ok(to_regprocedure('public.legal_jurisdiction_record_coverage_scope(text,text,text,text[],integer)') is not null,'jurisdiction coverage scope RPC exists');
select * from finish();
rollback;

