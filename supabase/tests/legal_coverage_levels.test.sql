begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Vocabulary and seeds.
select is(
  (select status from private.jurisdictions where code = 'NO'),
  'planned',
  'Norway is planned, not pilot, while no Norwegian source is live'
);
select lives_ok(
  $$update private.jurisdictions set status = 'catalogued' where code = 'CM'$$,
  'a jurisdiction can be marked catalogued'
);
select throws_ok(
  $$update private.jurisdictions set status = 'complete' where code = 'CM'$$,
  '23514', null, 'unknown levels are rejected'
);

-- Evidence gate: pilot requires a live source.
select throws_ok(
  $$update private.jurisdictions set status = 'pilot' where code = 'NO'$$,
  '23514', 'LEGAL_COVERAGE_LEVEL_REQUIRES_LIVE_SOURCE', 'pilot is refused without a live source'
);
insert into private.legal_sources (
  id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri,
  access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status
) values (
  'e2000000-0000-4000-8000-000000000001', 'NO', 'test-coverage-live', 'Synthetic live source',
  'Synthetic authority', 'legislation', 'https://example.invalid', 'api', 'approved',
  'TEST-LICENCE', 'Synthetic attribution', true, 'active'
);
select lives_ok(
  $$update private.jurisdictions set status = 'pilot' where code = 'NO'$$,
  'pilot is accepted once a live, rights-approved source exists'
);

-- Partial requires a recent passing evaluation.
select throws_ok(
  $$update private.jurisdictions set status = 'partial' where code = 'NO'$$,
  '23514', 'LEGAL_COVERAGE_LEVEL_REQUIRES_PASSING_EVALUATION', 'partial is refused without an evaluation'
);
select throws_ok(
  $$select public.legal_record_retrieval_evaluation('NO', 'synthetic-no-v1', 1, 'synthetic', 4, true,
    '{"recallAt10": 0.5}'::jsonb, '[{"metric": "recallAt10", "passed": false}]'::jsonb, null, 'test reviewer')$$,
  '22023', 'LEGAL_EVALUATION_PASS_INCONSISTENT', 'a run cannot be recorded as passed when a gate failed'
);
select lives_ok(
  $$select public.legal_record_retrieval_evaluation('NO', 'synthetic-no-v1', 1, 'synthetic', 4, false,
    '{"recallAt10": 0.5}'::jsonb, '[{"metric": "recallAt10", "passed": false}]'::jsonb, null, 'test reviewer')$$,
  'a failing run is recorded'
);
select throws_ok(
  $$update private.jurisdictions set status = 'partial' where code = 'NO'$$,
  '23514', 'LEGAL_COVERAGE_LEVEL_REQUIRES_PASSING_EVALUATION', 'partial is refused when the latest run failed'
);
-- A passing run recorded a moment later becomes the latest evaluation.
insert into private.legal_retrieval_evaluations (
  jurisdiction_code, dataset_key, dataset_version, content_licence, case_count, passed, metrics, gates,
  recorded_by, evaluated_at
) values (
  'NO', 'synthetic-no-v1', 1, 'synthetic', 4, true, '{"recallAt10": 1}'::jsonb,
  '[{"metric": "recallAt10", "passed": true}]'::jsonb, 'test reviewer', now() + interval '1 second'
);
select lives_ok(
  $$update private.jurisdictions set status = 'partial' where code = 'NO'$$,
  'partial is accepted after a recent passing evaluation'
);

-- Supported is refused until verification evidence exists (Phases 4 and 6).
select throws_ok(
  $$update private.jurisdictions set status = 'supported' where code = 'NO'$$,
  '23514', 'LEGAL_COVERAGE_SUPPORTED_REQUIRES_VERIFICATION_EVIDENCE', 'supported is refused for now'
);

-- Evaluations are append-only and private.
select throws_ok(
  $$update private.legal_retrieval_evaluations set passed = true$$,
  '55000', null, 'evaluation records cannot be altered'
);
select ok(
  not has_function_privilege('authenticated', 'public.legal_record_retrieval_evaluation(text,text,integer,text,integer,boolean,jsonb,jsonb,text,text)', 'EXECUTE'),
  'browser roles cannot record evaluations'
);

-- Snapshot reports level, roadmap flag and latest evaluation.
select is(
  public.legal_jurisdiction_coverage_snapshot('NO') ->> 'publishedStatus',
  'partial',
  'snapshot reports the published level'
);
select is(
  (public.legal_jurisdiction_coverage_snapshot('NO') -> 'latestEvaluation' ->> 'passed'),
  'true',
  'snapshot reports the latest evaluation'
);
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, title, authority_type)
values
  ('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000001', 'NO', 'r1', 'Act one', 'act'),
  ('e2000000-0000-4000-8000-0000000000a2', 'e2000000-0000-4000-8000-000000000001', 'NO', 'r2', 'Act two', 'act');
insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type)
values ('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-0000000000a2', 'amends');
select throws_ok(
  $$delete from private.legal_authority_relationships where from_authority_id = 'e2000000-0000-4000-8000-0000000000a1'$$,
  '55000', null, 'relationship history now fails with the append-only error (previously 42703)'
);

select * from finish();
rollback;
