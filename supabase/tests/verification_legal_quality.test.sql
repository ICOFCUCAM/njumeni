begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('ad000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'quality-owner@example.invalid', now(), now()),
  ('ad000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'quality-reviewer@example.invalid', now(), now()),
  ('ad000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'quality-viewer@example.invalid', now(), now()),
  ('ad000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'quality-outsider@example.invalid', now(), now());
create temporary table q (key text primary key, value text) on commit drop;
grant all on q to authenticated;
insert into q select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'ad000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into q select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from q where key = 'org') limit 1;
insert into q select 'p_' || right(pi.auth_user_id::text, 2), pi.principal_id::text from private.principal_identities pi
  where pi.auth_user_id in ('ad000000-0000-4000-8000-0000000000a1', 'ad000000-0000-4000-8000-0000000000b1', 'ad000000-0000-4000-8000-0000000000c1');

-- Jurisdictions: a child jurisdiction under a supranational parent.
insert into private.jurisdictions (code, parent_code, name, short_name, legal_system, status) values
  ('TPARENT', null, 'Test union', 'Union', 'supranational', 'planned');
insert into private.jurisdictions (code, parent_code, name, short_name, legal_system, status) values
  ('TCHILD', 'TPARENT', 'Test state', 'State', 'civil_law', 'planned');

insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status) values
  ('ad100000-0000-4000-8000-000000000001', 'TCHILD', 'quality-child', 'Child', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('ad100000-0000-4000-8000-000000000002', 'TPARENT', 'quality-parent', 'Parent', 'Synthetic', 'treaty', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('ad100000-0000-4000-8000-000000000003', 'GB', 'quality-foreign', 'Foreign', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active');
insert into private.legal_source_rights_evidence (source_id, terms_uri, reviewed_by, reviewed_at, permissions)
select id, 'https://example.invalid/terms', 'reviewer', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":true}'
from private.legal_sources where id::text like 'ad100000%';

-- A1 changed in 2025; A2 parent treaty; A3 foreign; A4 overruled in 2023; A5 overruling; A6/A7 conflict.
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code) values
  ('ad200000-0000-4000-8000-000000000001', 'ad100000-0000-4000-8000-000000000001', 'TCHILD', 'q1', 'Q-ACT-1', 'Act one', 'act', 'en'),
  ('ad200000-0000-4000-8000-000000000002', 'ad100000-0000-4000-8000-000000000002', 'TPARENT', 'q2', 'Q-TREATY-2', 'Treaty two', 'treaty', 'en'),
  ('ad200000-0000-4000-8000-000000000003', 'ad100000-0000-4000-8000-000000000003', 'GB', 'q3', 'Q-FOREIGN-3', 'Foreign act', 'act', 'en'),
  ('ad200000-0000-4000-8000-000000000004', 'ad100000-0000-4000-8000-000000000001', 'TCHILD', 'q4', 'Q-JUDG-4', 'Judgment four', 'judgment', 'en'),
  ('ad200000-0000-4000-8000-000000000005', 'ad100000-0000-4000-8000-000000000001', 'TCHILD', 'q5', 'Q-JUDG-5', 'Judgment five', 'judgment', 'en'),
  ('ad200000-0000-4000-8000-000000000006', 'ad100000-0000-4000-8000-000000000001', 'TCHILD', 'q6', 'Q-ACT-6', 'Act six', 'act', 'en'),
  ('ad200000-0000-4000-8000-000000000007', 'ad100000-0000-4000-8000-000000000001', 'TCHILD', 'q7', 'Q-ACT-7', 'Act seven', 'act', 'en');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, valid_until, source_content_hash, is_current_source_version) values
  ('ad300000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001', 1, '2010-01-01', '2025-01-01', repeat('1', 64), false),
  ('ad300000-0000-4000-8000-000000000011', 'ad200000-0000-4000-8000-000000000001', 2, '2025-01-01', null, repeat('2', 64), true),
  ('ad300000-0000-4000-8000-000000000002', 'ad200000-0000-4000-8000-000000000002', 1, '2000-01-01', null, repeat('3', 64), true),
  ('ad300000-0000-4000-8000-000000000003', 'ad200000-0000-4000-8000-000000000003', 1, '2000-01-01', null, repeat('4', 64), true),
  ('ad300000-0000-4000-8000-000000000004', 'ad200000-0000-4000-8000-000000000004', 1, '2015-01-01', null, repeat('5', 64), true),
  ('ad300000-0000-4000-8000-000000000006', 'ad200000-0000-4000-8000-000000000006', 1, '2000-01-01', null, repeat('6', 64), true),
  ('ad300000-0000-4000-8000-000000000007', 'ad200000-0000-4000-8000-000000000007', 1, '2000-01-01', null, repeat('7', 64), true);
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
select ('ad400000-0000-4000-8000-0000000000' || right(id::text, 2))::uuid, id, 0, 'Synthetic passage ' || right(id::text, 2), repeat('a', 64)
from private.legal_authority_versions where id::text like 'ad300000%';
insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type, effective_from) values
  ('ad200000-0000-4000-8000-000000000004', 'ad200000-0000-4000-8000-000000000005', 'overruled_by', '2023-01-01'),
  ('ad200000-0000-4000-8000-000000000006', 'ad200000-0000-4000-8000-000000000007', 'conflicts_with', null);

-- Research runs recorded in the owner's personal workspace (as the research engine would).
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes,
  retrieval_mode, status, coverage_level, limitations, engine_version)
select ('ad500000-0000-4000-8000-00000000000' || n)::uuid, (select value::uuid from q where key='org'), (select value::uuid from q where key='ws'),
  'Quality question ' || n, 'TCHILD', '2020-06-01', '{en}', 'lexical',
  case when n = 5 then 'abstained' else 'answered' end,
  case when n in (5, 6) then 'pilot' else 'supported' end,
  case when n = 6 then '["Coverage is pilot."]'::jsonb else '[]'::jsonb end, 'extractive-1.0.0'
from generate_series(1, 6) n;
insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, verification_status) values
  ('ad500000-0000-4000-8000-000000000001', 0, 'verified_authority', 'Treaty applies.', 'ad400000-0000-4000-8000-000000000002', 'verified'),
  ('ad500000-0000-4000-8000-000000000002', 0, 'verified_authority', 'Act one applies.', 'ad400000-0000-4000-8000-000000000001', 'verified'),
  ('ad500000-0000-4000-8000-000000000003', 0, 'verified_authority', 'Foreign act applies.', 'ad400000-0000-4000-8000-000000000003', 'verified'),
  ('ad500000-0000-4000-8000-000000000004', 0, 'verified_authority', 'Judgment four.', 'ad400000-0000-4000-8000-000000000004', 'verified'),
  ('ad500000-0000-4000-8000-000000000004', 1, 'verified_authority', 'Act six.', 'ad400000-0000-4000-8000-000000000006', 'verified'),
  ('ad500000-0000-4000-8000-000000000004', 2, 'verified_authority', 'Act seven.', 'ad400000-0000-4000-8000-000000000007', 'verified'),
  ('ad500000-0000-4000-8000-000000000006', 0, 'verified_authority', 'Act one applies.', 'ad400000-0000-4000-8000-000000000001', 'verified');

set local role authenticated;
set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-0000000000a1';

-- ------------------------------------------------------------------ verification outcomes
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000001', '2026-01-01') ->> 'outcome', 'clear',
  'law of a parent jurisdiction that is unchanged verifies clear');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000002', '2024-06-01') ->> 'outcome', 'clear',
  'before the change takes effect the run is clear');
select is(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000002') #>> '{latestReport,findings,0,code}', 'CHANGE_SCHEDULED',
  'a scheduled change is disclosed');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000002', '2026-01-01') ->> 'outcome', 'review_required',
  'after the change the run needs review');
select is(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000002') #>> '{latestReport,findings,0,code}', 'LAW_CHANGED_SINCE_RESEARCH',
  'the change since the research date is reported');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000003', '2026-01-01') ->> 'outcome', 'blocked',
  'law from a jurisdiction that does not apply blocks the run');
select is(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000003') #>> '{latestReport,findings,0,code}', 'JURISDICTION_MISMATCH',
  'the jurisdiction mismatch is reported');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000004', '2026-01-01') ->> 'outcome', 'review_required',
  'later adverse treatment and conflicts need review');
select ok((select jsonb_path_exists(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000004'),
  '$.latestReport.findings[*] ? (@.code == "ADVERSE_TREATMENT_SINCE_RESEARCH")')), 'overruling after the research date is reported');
select ok((select jsonb_path_exists(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000004'),
  '$.latestReport.findings[*] ? (@.code == "CONFLICTING_AUTHORITIES")')), 'conflicting cited authorities are detected');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000005', '2026-01-01') ->> 'outcome', 'blocked',
  'limited coverage without a disclosed limitation blocks the run');
select ok((select jsonb_path_exists(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000005'),
  '$.latestReport.findings[*] ? (@.code == "LIMITATION_NOT_DISCLOSED")')), 'the missing limitation is reported');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000006', '2026-01-01') ->> 'outcome', 'review_required',
  'disclosed limited coverage still needs review');
select throws_ok($$select public.verification_check_research_run('ad500000-0000-4000-8000-000000000001', '2019-01-01')$$,
  '22023', 'VERIFICATION_DATE_BEFORE_RESEARCH_DATE', 'a check cannot be dated before the research');

-- ------------------------------------------------------------------ review gates
select is((select jsonb_agg(r ->> 'gate' order by r ->> 'gate') from jsonb_array_elements(
  public.verification_get_run_quality('ad500000-0000-4000-8000-000000000004') -> 'reviews') r),
  '["changed_law", "conflicting_authority"]'::jsonb, 'warnings open the matching human review gates');
select is(jsonb_array_length(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000001') -> 'reviews'), 0,
  'a clear run opens no review');
select is(public.verification_check_research_run('ad500000-0000-4000-8000-000000000004', '2026-02-01') ->> 'outcome', 'review_required',
  're-checking is allowed');
select is(jsonb_array_length(public.verification_get_run_quality('ad500000-0000-4000-8000-000000000004') -> 'reviews'), 2,
  're-checking does not duplicate pending gates');
select is((select jsonb_agg(r ->> 'gate') from jsonb_array_elements(
  public.verification_get_run_quality('ad500000-0000-4000-8000-000000000003') -> 'reviews') r), '["verification_failure"]'::jsonb,
  'blocking findings open a verification-failure gate');
select is((select jsonb_agg(r ->> 'gate' order by r ->> 'gate') from jsonb_array_elements(
  public.verification_get_run_quality('ad500000-0000-4000-8000-000000000006') -> 'reviews') r),
  '["changed_law", "low_coverage"]'::jsonb, 'limited coverage opens a low-coverage gate (alongside the changed act it cites)');

insert into q select 'review_conflict', r ->> 'id' from jsonb_array_elements(
  public.verification_get_run_quality('ad500000-0000-4000-8000-000000000004') -> 'reviews') r where r ->> 'gate' = 'conflicting_authority';
select throws_ok($$select public.review_decide((select value::uuid from q where key='review_conflict'), 'rejected', '')$$,
  '23514', null, 'a rejection needs a reason');
select throws_ok($$select public.review_decide((select value::uuid from q where key='review_conflict'), 'maybe', null)$$,
  '22023', 'REVIEW_DECISION_INVALID', 'only defined decisions are accepted');
select lives_ok($$select public.review_decide((select value::uuid from q where key='review_conflict'), 'approved', 'Weighed both acts.')$$,
  'in a personal organisation the owner may decide their own gate');
select throws_ok($$select public.review_decide((select value::uuid from q where key='review_conflict'), 'rejected', 'Changed my mind')$$,
  '55000', 'REVIEW_ALREADY_DECIDED', 'a decision is final');
reset role;
select is((select self_review from private.review_requests where id = (select value::uuid from q where key='review_conflict')), true,
  'a self-review is recorded as such');
select throws_ok($$update private.verification_reports set outcome = 'clear'$$, '55000', null, 'verification reports are append-only');
select throws_ok($$delete from private.verification_findings$$, '55000', null, 'verification findings are append-only');
select throws_ok($$update private.review_requests set reason = 'rewritten' where id = (select value::uuid from q where key='review_conflict')$$,
  '55000', null, 'decided review requests are immutable');

-- ------------------------------------------------------------------ four-eyes in a team organisation
set local role authenticated;
set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-0000000000a1';
insert into public.organizations (name, slug, kind) values ('Quality Firm', 'quality-firm-test', 'law_firm');
insert into public.workspaces (organization_id, name, slug, kind)
  values ((select id from public.organizations where slug = 'quality-firm-test'), 'Quality Team', 'quality-team-test', 'team');
reset role;
insert into q select 'team_org', id::text from public.organizations where slug = 'quality-firm-test';
insert into q select 'team_ws', id::text from public.workspaces where slug = 'quality-team-test';
insert into public.organization_memberships (organization_id, principal_id)
select (select value::uuid from q where key='team_org'), value::uuid from q where key in ('p_b1', 'p_c1');
insert into public.workspace_memberships (workspace_id, principal_id)
select (select value::uuid from q where key='team_ws'), value::uuid from q where key in ('p_b1', 'p_c1');
insert into private.workspace_role_bindings (workspace_id, principal_id, role_key, assigned_by_principal_id) values
  ((select value::uuid from q where key='team_ws'), (select value::uuid from q where key='p_b1'), 'workspace_reviewer', (select value::uuid from q where key='p_a1')),
  ((select value::uuid from q where key='team_ws'), (select value::uuid from q where key='p_c1'), 'workspace_viewer', (select value::uuid from q where key='p_a1'));
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes,
  retrieval_mode, status, coverage_level, limitations, engine_version)
values ('ad500000-0000-4000-8000-000000000009', (select value::uuid from q where key='team_org'), (select value::uuid from q where key='team_ws'),
  'Team question', 'TCHILD', '2020-06-01', '{en}', 'lexical', 'answered', 'supported', '[]', 'extractive-1.0.0');

set local role authenticated;
set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-0000000000a1';
select throws_ok($$select public.review_request_create((select value::uuid from q where key='team_org'), (select value::uuid from q where key='team_ws'),
  'research_run', 'ad500000-0000-4000-8000-000000000009', 'changed_law', 'Manual')$$, '22023', 'REVIEW_GATE_NOT_MANUAL',
  'automatic gates cannot be opened by hand');
select lives_ok($$insert into q values ('team_review', public.review_request_create((select value::uuid from q where key='team_org'),
  (select value::uuid from q where key='team_ws'), 'research_run', 'ad500000-0000-4000-8000-000000000009', 'high_impact', 'Advice to a client')::text)$$,
  'a high-impact review is requested');
select throws_ok($$select public.review_decide((select value::uuid from q where key='team_review'), 'approved', null)$$,
  '42501', 'REVIEW_FOUR_EYES_REQUIRED', 'in a team organisation the requester cannot approve their own request');

set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-0000000000c1';
select throws_ok($$select public.review_decide((select value::uuid from q where key='team_review'), 'approved', null)$$,
  '42501', 'QUALITY_NOT_AUTHORISED', 'a viewer cannot decide reviews');

set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.verification_check_research_run('ad500000-0000-4000-8000-000000000009', null)$$,
  '42501', 'QUALITY_NOT_AUTHORISED', 'a reviewer cannot create verification reports');
select lives_ok($$select public.review_decide((select value::uuid from q where key='team_review'), 'approved', 'Second pair of eyes.')$$,
  'a different reviewer approves');

set local request.jwt.claim.sub = 'ad000000-0000-4000-8000-0000000000d1';
select throws_ok($$select public.verification_get_run_quality('ad500000-0000-4000-8000-000000000004')$$,
  '42501', 'QUALITY_NOT_AUTHORISED', 'an outsider cannot read verification results');
reset role;
select is((select count(*)::integer from private.security_audit_events where event_key = 'quality.review_decided'
  and resource_id in (select value::uuid from q where key in ('review_conflict', 'team_review'))), 2,
  'review decisions are written to the hash-chained audit log');

select * from finish();
rollback;
