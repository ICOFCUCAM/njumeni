-- GLCI-08: engine switch, AI call ledger and budget, Claude Code dispatches and replies.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c8000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-ai-operator@example.invalid', now(), now()),
  ('c8000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-ai-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id = 'c8000000-0000-4000-8000-0000000000a1';
create temporary table k (key text primary key, value text) on commit drop;
grant all on k to authenticated, service_role;
insert into k values ('conv', gen_random_uuid()::text), ('dispatch', gen_random_uuid()::text);

select is((select primary_engine || '/' || fallback_enabled::text || '/' || anthropic_model from private.glci_ai_settings),
  'claude_code/true/claude-opus-5-5', 'default: Claude Code first, falling back, API model Claude Opus 5.5');

set local role authenticated;
set local request.jwt.claim.sub = 'c8000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_ai_settings_get()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot see the AI settings');
select throws_ok($$select public.glci_ai_settings_set('rules', false, null, 1, 'no thanks')$$, 'GLCI_NOT_AUTHORISED', 'or change them');

set local request.jwt.claim.sub = 'c8000000-0000-4000-8000-0000000000a1';
select is(public.glci_ai_settings_set('anthropic_api', true, 'claude-opus-5-5', 40, 'Use the API first this week') ->> 'primaryEngine',
  'anthropic_api', 'the operator switches the primary engine');
select throws_ok($$select public.glci_ai_settings_set('gpt', true, null, null, 'Try another engine')$$, '23514', null, 'only the three engines exist');
select throws_ok($$select public.glci_ai_settings_set('rules', true, null, null, '')$$, 'GLCI_REASON_REQUIRED', 'switching needs a reason');

-- the operator asks; the question is handed to Claude Code
select public.glci_command_record((select value::uuid from k where key = 'conv'), 'operator', 'What changed in Norwegian immigration law?', null, null, '{}');
select lives_ok($$select public.glci_ai_record_call((select value::uuid from k where key = 'conv'), 'claude_code', null, 'dispatched', null, 0, 0, 0)$$,
  'the dispatch is recorded in the call ledger');
select is(public.glci_agent_dispatch_create((select value::uuid from k where key = 'dispatch'), (select value::uuid from k where key = 'conv'), 1,
  'https://claude.ai/code/session_x'), (select value::uuid from k where key = 'dispatch'), 'the Claude Code dispatch is recorded');
select is((public.glci_conversation_dispatches((select value::uuid from k where key = 'conv')) -> 0 ->> 'status'), 'dispatched', 'and shown as pending');
select lives_ok($$select public.glci_ai_record_call((select value::uuid from k where key = 'conv'), 'anthropic_api', 'claude-opus-5-5', 'succeeded', null, 1000, 500, 0.014)$$,
  'an API call is recorded with its cost');
select is((public.glci_ai_settings_get() ->> 'spentThisMonthUsd')::numeric, 0.014, 'spend this month is measured for the budget');
select throws_ok($$select public.glci_agent_reply((select value::uuid from k where key = 'dispatch'), 'answer')$$, '42501', null,
  'an operator session cannot impersonate Claude Code''s reply');
reset role;

-- Claude Code answers through the database connector (service role / database owner)
set local role service_role;
select is(public.glci_agent_reply((select value::uuid from k where key = 'dispatch'),
  'Two amendments to utlendingsloven were detected; one is pending commencement.', '{"sessionUrl":"https://claude.ai/code/session_x"}'), 2,
  'Claude Code''s answer joins the conversation');
select throws_ok($$select public.glci_agent_reply((select value::uuid from k where key = 'dispatch'), 'again')$$, 'GLCI_DISPATCH_NOT_OPEN',
  'a dispatch is answered once');
reset role;
select is((select engine || '/' || author_kind from private.glci_command_messages where conversation_id = (select value::uuid from k where key = 'conv')
  and sequence_number = 2), 'claude-code/assistant', 'the answer is attributed to Claude Code');

select * from finish();
rollback;
