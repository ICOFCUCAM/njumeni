begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('b1000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'ent-admin@example.invalid', now(), now()),
  ('b1000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'ent-member@example.invalid', now(), now()),
  ('b1000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'ent-operator@example.invalid', now(), now()),
  ('b1000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'ent-outsider@example.invalid', now(), now());
create temporary table e (key text primary key, value text) on commit drop;
grant all on e to authenticated, anon;
insert into e select 'p_' || right(pi.auth_user_id::text, 2), pi.principal_id::text from private.principal_identities pi
  where pi.auth_user_id::text like 'b1000000%';
insert into private.platform_operators (principal_id, operator_role) select value::uuid, 'support' from e where key = 'p_c1';

set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
insert into public.organizations (name, slug, kind) values ('Enterprise Test', 'enterprise-test-p10', 'enterprise');
insert into public.workspaces (organization_id, name, slug, kind)
  values ((select id from public.organizations where slug = 'enterprise-test-p10'), 'Legal', 'enterprise-legal-p10', 'team');
reset role;
insert into e select 'org', id::text from public.organizations where slug = 'enterprise-test-p10';
insert into e select 'ws', id::text from public.workspaces where slug = 'enterprise-legal-p10';
insert into public.organization_memberships (organization_id, principal_id) values ((select value::uuid from e where key='org'), (select value::uuid from e where key='p_b1'));
insert into private.organization_role_bindings (organization_id, principal_id, role_key, assigned_by_principal_id)
  values ((select value::uuid from e where key='org'), (select value::uuid from e where key='p_b1'), 'org_member', (select value::uuid from e where key='p_a1'));
insert into public.workspace_memberships (workspace_id, principal_id) values ((select value::uuid from e where key='ws'), (select value::uuid from e where key='p_b1'));
insert into private.workspace_role_bindings (workspace_id, principal_id, role_key, assigned_by_principal_id)
  values ((select value::uuid from e where key='ws'), (select value::uuid from e where key='p_b1'), 'workspace_editor', (select value::uuid from e where key='p_a1'));
-- Legal fixtures: an approved source passage and an unapproved one; evidence in another tenant.
insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status) values
  ('b1100000-0000-4000-8000-000000000001', 'NO', 'ent-approved', 'Approved', 'Synthetic', 'regulation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('b1100000-0000-4000-8000-000000000002', 'NO', 'ent-unapproved', 'Unapproved', 'Synthetic', 'regulation', 'https://example.invalid', 'api', 'review_required', null, null, false, 'planned');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code)
select ('b1200000-0000-4000-8000-00000000000' || n)::uuid, ('b1100000-0000-4000-8000-00000000000' || n)::uuid, 'NO', 'en' || n, 'ENT-REG-' || n, 'Regulation ' || n, 'regulation', 'en'
from generate_series(1, 2) n;
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash)
select ('b1300000-0000-4000-8000-00000000000' || n)::uuid, ('b1200000-0000-4000-8000-00000000000' || n)::uuid, 1, '2020-01-01', repeat(n::text, 64)
from generate_series(1, 2) n;
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
select ('b1400000-0000-4000-8000-00000000000' || n)::uuid, ('b1300000-0000-4000-8000-00000000000' || n)::uuid, 0, 'Controllers shall keep a record of processing.', repeat('a', 64)
from generate_series(1, 2) n;
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, engine_version)
values ('b1500000-0000-4000-8000-000000000001', (select value::uuid from e where key='org'), (select value::uuid from e where key='ws'),
  'Record keeping duties', 'NO', '2026-01-01', '{en}', 'lexical', 'answered', 'pilot', 'extractive-1.0.0');

-- ------------------------------------------------------------------ offices and teams
set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select lives_ok($$insert into e values ('office', public.org_unit_create((select value::uuid from e where key='org'), 'office', 'Oslo office', null, 'Oslo')::text);
  insert into e values ('team', public.org_unit_create((select value::uuid from e where key='org'), 'team', 'Data protection', (select value::uuid from e where key='office'))::text)$$,
  'an administrator creates an office and a team');
select lives_ok($$select public.org_unit_add_member((select value::uuid from e where key='team'), (select value::uuid from e where key='p_b1'))$$, 'a member joins the team');
select throws_ok($$select public.org_unit_add_member((select value::uuid from e where key='team'), (select value::uuid from e where key='p_d1'))$$,
  '22023', 'ENTERPRISE_NOT_A_MEMBER', 'outsiders cannot join a team');
select lives_ok($$select public.organization_update_settings((select value::uuid from e where key='org'), false)$$, 'the enterprise opts out of mandatory conflict checks');
select lives_ok($$insert into e select 'matter', public.matter_create((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'),
  'GDPR audit', 'administrative', 'NO') ->> 'id'$$, 'a matter is opened');
select is(public.matter_assign_team((select value::uuid from e where key='matter'), (select value::uuid from e where key='team')), 1, 'the team is assigned to the matter');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.org_unit_create((select value::uuid from e where key='org'), 'team', 'Rogue team')$$, '42501', 'ENTERPRISE_NOT_AUTHORISED',
  'members cannot change the organisation structure');

-- ------------------------------------------------------------------ break-glass support access
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000c1';
select throws_ok($$select public.matter_get((select value::uuid from e where key='matter'))$$, '42501', 'MATTER_NOT_AUTHORISED',
  'platform operators have no default access to customer matters');
select ok((public.platform_overview() -> 'counts' ->> 'matters')::int >= 1, 'operators see platform metadata');
select lives_ok($$insert into e values ('grant', public.support_access_request((select value::uuid from e where key='org'), 'Customer ticket 1234: export fails', 30)::text)$$,
  'an operator requests support access');
select throws_ok($$select public.support_access_decide((select value::uuid from e where key='grant'), 'approved')$$, '42501', 'ENTERPRISE_NOT_AUTHORISED',
  'an operator cannot approve their own access');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.support_access_decide((select value::uuid from e where key='grant'), 'approved')$$, '42501', 'ENTERPRISE_NOT_AUTHORISED',
  'an ordinary member cannot grant support access');
select throws_ok($$select public.platform_overview()$$, '42501', 'ENTERPRISE_NOT_AUTHORISED', 'customers cannot use the back office');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.support_access_decide((select value::uuid from e where key='grant'), 'approved')$$, 'the customer administrator approves');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000c1';
select is(public.matter_get((select value::uuid from e where key='matter')) ->> 'title', 'GDPR audit', 'with an approved grant the operator can read');
select throws_ok($$select public.matter_add_task((select value::uuid from e where key='matter'), 'Operator task')$$, '42501', 'MATTER_NOT_AUTHORISED',
  'support access is read-only');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.support_access_decide((select value::uuid from e where key='grant'), 'revoked')$$, 'the customer revokes access');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000c1';
select throws_ok($$select public.matter_get((select value::uuid from e where key='matter'))$$, '42501', 'MATTER_NOT_AUTHORISED', 'revoked access ends immediately');
reset role;
insert into private.support_access_requests (organization_id, operator_principal_id, reason, requested_minutes, status, decided_at, expires_at)
values ((select value::uuid from e where key='org'), (select value::uuid from e where key='p_c1'), 'Expired grant for testing', 15, 'approved', now() - interval '2 hours', now() - interval '1 hour');
set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000c1';
select throws_ok($$select public.matter_get((select value::uuid from e where key='matter'))$$, '42501', 'MATTER_NOT_AUTHORISED', 'expired grants give no access');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select is((select count(*)::integer from jsonb_array_elements(public.support_access_list((select value::uuid from e where key='org'))) r where r ->> 'status' = 'expired'),
  1, 'the customer sees expired grants as expired');

-- ------------------------------------------------------------------ retention and compliance
select lives_ok($$select public.retention_set_policy((select value::uuid from e where key='org'), 'closed_matters', 10)$$, 'a retention policy is set');
select is(public.retention_report((select value::uuid from e where key='org')) -> 'policies' ->> 'closed_matters', '10', 'the retention report shows the policy');
select throws_ok($$select public.compliance_add_obligation((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'Bad', 'b1400000-0000-4000-8000-000000000002')$$,
  '22023', 'COMPLIANCE_SOURCE_INVALID', 'obligations must rest on an approved source');
select lives_ok($$insert into e values ('obligation', public.compliance_add_obligation((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'),
  'Keep a record of processing', 'b1400000-0000-4000-8000-000000000001')::text)$$, 'an obligation is registered against its authority');
select is(public.compliance_register((select value::uuid from e where key='org'), (select value::uuid from e where key='ws')) -> 0 ->> 'reviewRequired', 'true',
  'an unassessed obligation needs review');
select lives_ok($$select public.compliance_assess((select value::uuid from e where key='obligation'), 'compliant', 'Register maintained in the DPO system.')$$, 'it is assessed');
select is(public.compliance_register((select value::uuid from e where key='org'), (select value::uuid from e where key='ws')) -> 0 ->> 'reviewRequired', 'false',
  'an assessed, current obligation does not need review');
reset role;
-- A later ingestion of an amended version (created after the assessment).
insert into private.legal_authority_versions (authority_id, version_number, valid_from, source_content_hash, is_current_source_version, created_at)
values ('b1200000-0000-4000-8000-000000000001', 2, current_date - 1, repeat('9', 64), false, now() + interval '1 minute');
select throws_ok($$update private.compliance_assessments set note = 'rewritten'$$, '55000', null, 'assessments are append-only');
set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select is(public.compliance_register((select value::uuid from e where key='org'), (select value::uuid from e where key='ws')) -> 0 ->> 'lawChanged', 'true',
  'a new version of the law after the assessment is detected');

-- ------------------------------------------------------------------ EU AI Act classification
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.ai_set_risk_classification((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'standard')$$,
  '42501', 'ENTERPRISE_NOT_AUTHORISED', 'members cannot change the AI risk classification');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.ai_set_risk_classification((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'high_risk_justice')$$,
  'the workspace is classified high-risk (administration of justice)');
select is(public.ai_authorise_execution((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'reasoning', 'mock', '{}', 0) ->> 'reason',
  'AI_CONFORMITY_REQUIRED', 'no agent runs in a high-risk workspace without a conformity record');
select throws_ok($$select private.ai_authorise_execution_base((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'reasoning', 'mock', '{}', 0)$$,
  '42501', null, 'the unchecked authoriser cannot be called directly');
select lives_ok($$select public.ai_set_risk_classification((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'high_risk_justice', 'CONF-2026-001 (internal assessment)')$$,
  'a conformity assessment is recorded');
select is(public.ai_authorise_execution((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'), 'reasoning', 'mock', '{}', 0) ->> 'allowed',
  'true', 'with the conformity record, governed agents may run');
select is((select w ->> 'aiRiskClass' from jsonb_array_elements(public.institutional_report((select value::uuid from e where key='org')) -> 'workspaces') w
  where w ->> 'name' = 'Legal'), 'high_risk_justice',
  'the institutional report shows each workspace''s AI classification');

-- ------------------------------------------------------------------ SSO readiness
select throws_ok($$select public.sso_configure((select value::uuid from e where key='org'), 'saml', 'https://idp.example.invalid', null, true)$$,
  '55000', 'SSO_DOMAIN_NOT_VERIFIED', 'SSO cannot be enforced before a domain is verified');
select lives_ok($$select public.sso_add_domain((select value::uuid from e where key='org'), 'Enterprise-Test.example')$$, 'a domain is registered for verification');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000c1';
select lives_ok($$select public.platform_verify_sso_domain('enterprise-test.example')$$, 'a platform operator verifies the domain after checking DNS');
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.sso_configure((select value::uuid from e where key='org'), 'saml', 'https://idp.example.invalid', 'https://idp.example.invalid/metadata', true)$$,
  'SSO is configured and enforced');
reset role;
set local role anon;
select is(public.sso_discover('someone@enterprise-test.example'), '{"sso": true, "protocol": "saml"}'::jsonb, 'sign-in discovers SSO for the domain without naming the organisation');

-- ------------------------------------------------------------------ enterprise API keys
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-4000-8000-0000000000a1';
select lives_ok($$insert into e select 'api_key', public.api_key_create((select value::uuid from e where key='org'), (select value::uuid from e where key='ws'),
  'Reporting integration', array['research.read'], 30) ->> 'key'$$, 'an API key is issued once');
reset role;
select ok(not exists (select 1 from private.api_keys where key_hash = (select value from e where key='api_key')), 'only the key''s hash is stored');
set local role anon;
select is(public.api_key_research_get_run((select value from e where key='api_key'), 'b1500000-0000-4000-8000-000000000001') ->> 'question', 'Record keeping duties',
  'the key reads research in its workspace without a session');
select throws_ok($$select public.api_key_matter_list((select value from e where key='api_key'))$$, '42501', 'API_KEY_SCOPE', 'a key cannot exceed its scopes');
select throws_ok($$select public.api_key_matter_list('njk_00000000_' || repeat('0', 48))$$, '28000', 'API_KEY_INVALID', 'unknown keys are refused');

select * from finish();
rollback;
