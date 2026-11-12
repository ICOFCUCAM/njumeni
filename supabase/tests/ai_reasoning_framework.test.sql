begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('ac000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'ai-owner@example.invalid', now(), now()),
  ('ac000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'ai-outsider@example.invalid', now(), now());
create temporary table ai (key text primary key, value text) on commit drop;
grant all on ai to authenticated;
insert into ai select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'ac000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into ai select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from ai where key = 'org') limit 1;
insert into ai select 'other_org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'ac000000-0000-4000-8000-0000000000b1' and o.kind = 'personal';
insert into ai select 'other_ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from ai where key = 'other_org') limit 1;

-- Fixtures: one law passage, evidence in the owner's workspace and in another tenant's workspace.
insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status)
values ('ac100000-0000-4000-8000-000000000001', 'NO', 'ai-test-source', 'AI test', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code)
values ('ac200000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001', 'NO', 'x', 'SYN-1', 'Synthetic act', 'act', 'nb');
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash)
values ('ac300000-0000-4000-8000-000000000001', 'ac200000-0000-4000-8000-000000000001', 1, '2020-01-01', repeat('1', 64));
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
values ('ac400000-0000-4000-8000-000000000001', 'ac300000-0000-4000-8000-000000000001', 0, 'Arbeidsgiver skal straks varsle.', repeat('a', 64));
insert into private.evidence_items (id, organization_id, workspace_id, title, status) values
  ('ac500000-0000-4000-8000-000000000001', (select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'Own letter', 'active'),
  ('ac500000-0000-4000-8000-000000000002', (select value::uuid from ai where key='other_org'), (select value::uuid from ai where key='other_ws'), 'Foreign letter', 'active');

-- ------------------------------------------------------------------ registries and defaults
select is((select count(*)::integer from private.ai_agents), 19, 'all nineteen agents from the master plan are registered');
select is((select status from private.ai_providers where provider_key = 'mock'), 'enabled', 'the mock provider is enabled');
select is((select status from private.ai_providers where provider_key = 'anthropic'), 'disabled', 'commercial providers are disabled until the owner decides');

set local role authenticated;
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-0000000000a1';
select is((public.ai_get_workspace_settings((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws')) -> 'allowedEgress'),
  '["public_legal"]'::jsonb, 'by default only public legal text may leave Njumeni');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'mock', array['confidential_evidence'], 1000) ->> 'allowed'),
  'true', 'the mock provider is allowed (it never leaves Njumeni)');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'anthropic', array['public_legal'], 1000) ->> 'reason'),
  'AI_PROVIDER_NOT_ENABLED', 'a disabled provider is refused');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'no-such-agent', 'mock', '{}', 0) ->> 'reason'),
  'AI_AGENT_UNKNOWN', 'unknown agents are refused');

-- Owner enables a commercial provider for the workspace (as an operator would at Stage 1).
reset role;
update private.ai_providers set status = 'enabled' where provider_key = 'anthropic';
set local role authenticated;
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-0000000000a1';
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'anthropic', array['public_legal'], 1000) ->> 'reason'),
  'AI_PROVIDER_NOT_ALLOWED_FOR_WORKSPACE', 'an enabled provider still needs the workspace''s consent');
select lives_ok($$select public.ai_update_workspace_settings((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'),
  array['mock','anthropic'], array['public_legal','user_narrative'], 0)$$, 'a workspace manager sets the AI policy');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'anthropic', array['public_legal','confidential_evidence'], 1000) ->> 'reason'),
  'AI_EGRESS_NOT_PERMITTED', 'confidential evidence is not sent to a provider the workspace did not allow it for');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'anthropic', array['public_legal'], 1000) ->> 'reason'),
  'AI_BUDGET_EXCEEDED', 'a zero budget refuses paid calls');
select lives_ok($$select public.ai_update_workspace_settings((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'),
  array['mock','anthropic'], array['public_legal'], 1500)$$, 'the budget is raised to 1,500 tokens');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'anthropic', array['public_legal'], 1000) ->> 'allowed'),
  'true', 'a call within budget, egress and consent is allowed');
select lives_ok($$insert into ai values ('exec', public.ai_record_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'),
  'reasoning', 'anthropic', 'test-model', 'reasoning-v1', array['public_legal'], '{}', '[]', 800, 200, 1200, 'succeeded', null, '{}', null)::text)$$,
  'an execution is recorded with its governance fields');
select is((public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'anthropic', array['public_legal'], 1000) ->> 'reason'),
  'AI_BUDGET_EXCEEDED', 'recorded usage counts against the monthly budget');
reset role;
select is((select estimated_cost_usd from private.ai_executions where id = (select value::uuid from ai where key='exec')),
  0.007200::numeric, 'cost is computed from provider rates (800 in, 200 out)');
select throws_ok($$update private.ai_executions set output_tokens = 0$$, '55000', null, 'execution records are append-only');

-- ------------------------------------------------------------------ argument graph
set local role authenticated;
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-0000000000a1';
select lives_ok($$insert into ai values ('issue', public.argument_create_issue((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'),
  'Was the notification duty met?')::text)$$, 'an issue is created');
select throws_ok($$select public.argument_add_graph((select value::uuid from ai where key='issue'),
  '[{"key":"r","node_type":"applicable_rule","label":"Uncited rule"}]', '[]')$$,
  '23514', null, 'a rule node without an authority passage is rejected');
select throws_ok($$select public.argument_add_graph((select value::uuid from ai where key='issue'),
  '[{"key":"f","node_type":"fact","label":"Ungrounded fact"}]', '[]')$$,
  '23514', null, 'a fact node without evidence (and not marked an assumption) is rejected');
select throws_ok($$select public.argument_add_graph((select value::uuid from ai where key='issue'),
  '[{"key":"e","node_type":"evidence","label":"Foreign","evidence_item_id":"ac500000-0000-4000-8000-000000000002"}]', '[]')$$,
  '42501', 'ARGUMENT_EVIDENCE_OUT_OF_SCOPE', 'evidence from another tenant cannot be used');
select lives_ok($$select public.argument_add_graph((select value::uuid from ai where key='issue'),
  '[{"key":"i","node_type":"legal_issue","label":"Notification duty"},
    {"key":"r","node_type":"applicable_rule","label":"SYN-1","authority_passage_id":"ac400000-0000-4000-8000-000000000001"},
    {"key":"e","node_type":"evidence","label":"Own letter","evidence_item_id":"ac500000-0000-4000-8000-000000000001"},
    {"key":"a","node_type":"fact","label":"Assumed: the incident was serious","is_assumption":true}]',
  '[{"from":"i","to":"r","edge_type":"governed_by"},{"from":"e","to":"a","edge_type":"supports"},{"from":"a","to":"i","edge_type":"raises"}]',
  (select value::uuid from ai where key='exec'))$$, 'an agent proposal with grounded nodes is stored');
reset role;
select is((select count(*)::integer from private.argument_nodes where issue_id = (select value::uuid from ai where key='issue') and review_status = 'proposed'),
  4, 'agent output is a proposal until a human reviews it');
insert into ai select 'rule_node', id::text from private.argument_nodes where issue_id = (select value::uuid from ai where key='issue') and node_type = 'applicable_rule';
set local role authenticated;
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.argument_review_node((select value::uuid from ai where key='rule_node'), 'accepted')$$,
  'a human accepts a proposed node');
select throws_ok($$select public.argument_review_node((select value::uuid from ai where key='rule_node'), 'rejected')$$,
  '55000', null, 'a reviewed node cannot be reviewed again');
select is(jsonb_array_length(public.argument_get_graph((select value::uuid from ai where key='issue')) -> 'edges'), 3, 'the graph returns its edges');

-- ------------------------------------------------------------------ isolation
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'ac000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.argument_get_graph((select value::uuid from ai where key='issue'))$$, '42501', 'AI_NOT_AUTHORISED',
  'an outsider cannot read another tenant''s argument graph');
select throws_ok($$select public.ai_authorise_execution((select value::uuid from ai where key='org'), (select value::uuid from ai where key='ws'), 'reasoning', 'mock', '{}', 0)$$,
  '42501', 'AI_NOT_AUTHORISED', 'an outsider cannot run agents in another tenant''s workspace');

select * from finish();
rollback;
