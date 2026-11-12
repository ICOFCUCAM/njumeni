begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('b2000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'billing-owner@example.invalid', now(), now()),
  ('b2000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'billing-operator@example.invalid', now(), now());
create temporary table b (key text primary key, value text) on commit drop;
grant all on b to authenticated, anon;
insert into b select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'b2000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into b select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from b where key = 'org') limit 1;
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'platform_admin' from private.principal_identities pi where pi.auth_user_id = 'b2000000-0000-4000-8000-0000000000c1';
insert into private.billing_provider_settings (provider, webhook_secret, enabled) values ('stripe', 'whsec_test_' || repeat('k', 32), true);
create or replace function pg_temp.signed(p_payload text, p_age integer default 0) returns text language sql as $$
  select format('t=%s,v1=%s', extract(epoch from now())::bigint - p_age,
    encode(extensions.hmac((extract(epoch from now())::bigint - p_age)::text || '.' || p_payload, 'whsec_test_' || repeat('k', 32), 'sha256'), 'hex'));
$$;

-- ------------------------------------------------------------------ catalogue and free plan
set local role anon;
select is(jsonb_array_length(public.billing_plans()), 8, 'the plan catalogue is public');
select is((public.billing_plans() -> 0 ->> 'priceMinor')::int, 0, 'the free plan costs nothing');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000a1';
select is(public.billing_overview((select value::uuid from b where key='org')) #>> '{plan,key}', 'free', 'an organisation without a subscription is on the free plan');
select is((public.billing_overview((select value::uuid from b where key='org')) #>> '{meters,1,limit}')::int, 30, 'the free plan allows 30 research runs a month');

-- ------------------------------------------------------------------ metering and hard stops
reset role;
insert into private.research_runs (organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, engine_version)
select (select value::uuid from b where key='org'), (select value::uuid from b where key='ws'), 'Metered question ' || n, 'NO', '2026-01-01', '{en}', 'lexical', 'abstained', 'pilot', 'extractive-1.0.0'
from generate_series(1, 30) n;
select is((select sum(quantity)::int from private.usage_records where organization_id = (select value::uuid from b where key='org') and usage_key = 'research.runs'), 30,
  'every research run is metered');
select throws_ok($$insert into private.research_runs (organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, engine_version)
  values ((select value::uuid from b where key='org'), (select value::uuid from b where key='ws'), 'One too many', 'NO', '2026-01-01', '{en}', 'lexical', 'abstained', 'pilot', 'extractive-1.0.0')$$,
  '53400', 'QUOTA_EXCEEDED: research runs', 'the free plan stops at its research allowance');
insert into private.legal_documents (organization_id, workspace_id, title, template_key, template_version, status, current_version, approved_version)
select (select value::uuid from b where key='org'), (select value::uuid from b where key='ws'), 'Metered document ' || n, 'legal_letter', 1, 'approved', 1, 1
from generate_series(1, 6) n;
insert into private.document_exports (document_id, version_number, format, final, file_sha256)
select id, 1, 'pdf', true, repeat('d', 64) from private.legal_documents where title in ('Metered document 1', 'Metered document 2', 'Metered document 3', 'Metered document 4', 'Metered document 5');
select lives_ok($$insert into private.document_exports (document_id, version_number, format, final, file_sha256)
  select id, 1, 'docx', true, repeat('e', 64) from private.legal_documents where title = 'Metered document 1'$$, 're-exporting an already generated version is free');
select throws_ok($$insert into private.document_exports (document_id, version_number, format, final, file_sha256)
  select id, 1, 'pdf', true, repeat('d', 64) from private.legal_documents where title = 'Metered document 6'$$,
  '53400', 'QUOTA_EXCEEDED: generated documents', 'the free plan stops at its generated-document allowance');
select lives_ok($$insert into private.document_exports (document_id, version_number, format, final, file_sha256)
  select id, 1, 'pdf', false, repeat('d', 64) from private.legal_documents where title = 'Metered document 6'$$, 'draft exports are never metered');

-- AI credits come from provider cost; mock executions are free.
update private.ai_providers set status = 'enabled' where provider_key = 'anthropic';
insert into private.workspace_ai_settings (workspace_id, organization_id, allowed_providers, allowed_egress, monthly_token_budget)
values ((select value::uuid from b where key='ws'), (select value::uuid from b where key='org'), '{mock,anthropic}', '{public_legal}', 100000000);
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000a1';
select lives_ok($$select public.ai_record_execution((select value::uuid from b where key='org'), (select value::uuid from b where key='ws'),
  'reasoning', 'anthropic', 'test-model', 'r1', array['public_legal'], '{}', '[]', 800, 200, 10, 'succeeded', null, '{}', null);
  select public.ai_record_execution((select value::uuid from b where key='org'), (select value::uuid from b where key='ws'),
  'reasoning', 'mock', 'mock-deterministic-1', 'r1', array['public_legal'], '{}', '[]', 800, 200, 10, 'succeeded', null, '{}', null)$$,
  'paid and mock executions are recorded');
reset role;
select is((select sum(quantity)::int from private.usage_records where organization_id = (select value::uuid from b where key='org') and usage_key = 'ai.credits'), 1,
  'the paid execution used one credit (USD 0.0072); the mock used none');
insert into private.usage_records (organization_id, usage_key, quantity, unit, idempotency_key)
values ((select value::uuid from b where key='org'), 'ai.credits', 49, 'credit', 'test-consumption-1');
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000a1';
select is(public.ai_authorise_execution((select value::uuid from b where key='org'), (select value::uuid from b where key='ws'), 'reasoning', 'anthropic', array['public_legal'], 100000) ->> 'reason',
  'AI_PLAN_QUOTA_EXCEEDED', 'paid AI stops when the plan''s credits are used (U-23)');
select is(public.ai_authorise_execution((select value::uuid from b where key='org'), (select value::uuid from b where key='ws'), 'reasoning', 'mock', '{}', 100000) ->> 'allowed',
  'true', 'the free built-in provider is never blocked by credits');

-- ------------------------------------------------------------------ signed provider webhooks
reset role;
insert into b values ('sub_payload', jsonb_build_object('id', 'evt_sub_1', 'type', 'customer.subscription.created', 'data', jsonb_build_object('object', jsonb_build_object(
  'id', 'sub_123', 'customer', 'cus_123', 'status', 'active', 'cancel_at_period_end', false,
  'current_period_start', extract(epoch from now() - interval '1 day')::bigint, 'current_period_end', extract(epoch from now() + interval '29 days')::bigint,
  'metadata', jsonb_build_object('organization_id', (select value from b where key='org'), 'plan_key', 'professional'))))::text);
set local role anon;
select throws_ok($$select public.billing_webhook('stripe', (select value from b where key='sub_payload'), 't=1700000000,v1=' || repeat('0', 64))$$,
  '28000', 'BILLING_SIGNATURE_INVALID', 'a forged signature is rejected');
select throws_ok($$select public.billing_webhook('stripe', (select value from b where key='sub_payload'), pg_temp.signed((select value from b where key='sub_payload'), 3600))$$,
  '28000', 'BILLING_SIGNATURE_EXPIRED', 'a replayed old delivery is rejected');
select throws_ok($$select public.billing_webhook('stripe', (select value from b where key='sub_payload') || ' ', pg_temp.signed((select value from b where key='sub_payload')))$$,
  '28000', 'BILLING_SIGNATURE_INVALID', 'a tampered body is rejected');
select throws_ok($$select public.billing_webhook('paypal', '{}', 't=1,v1=' || repeat('0', 64))$$, '42501', 'BILLING_WEBHOOK_DISABLED', 'unconfigured providers are refused');
select is(public.billing_webhook('stripe', (select value from b where key='sub_payload'), pg_temp.signed((select value from b where key='sub_payload'))) ->> 'outcome',
  'processed', 'a correctly signed subscription event is applied');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000a1';
select is(public.billing_overview((select value::uuid from b where key='org')) #>> '{plan,key}', 'professional', 'the organisation is now on the Professional plan');
select is((public.billing_overview((select value::uuid from b where key='org')) #>> '{plan,overage}')::boolean, true, 'paid plans bill overage instead of stopping');
reset role;
select lives_ok($$insert into private.research_runs (organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, engine_version)
  values ((select value::uuid from b where key='org'), (select value::uuid from b where key='ws'), 'After upgrade', 'NO', '2026-01-01', '{en}', 'lexical', 'abstained', 'pilot', 'extractive-1.0.0')$$,
  'research continues after the upgrade');
insert into b values ('credit_payload', jsonb_build_object('id', 'evt_credits_1', 'type', 'checkout.session.completed', 'data', jsonb_build_object('object', jsonb_build_object(
  'id', 'cs_1', 'metadata', jsonb_build_object('kind', 'credits', 'organization_id', (select value from b where key='org'), 'credits', '500'))))::text);
set local role anon;
select is(public.billing_webhook('stripe', (select value from b where key='credit_payload'), pg_temp.signed((select value from b where key='credit_payload'))) ->> 'outcome',
  'processed', 'purchased AI credits are granted');
select is(public.billing_webhook('stripe', (select value from b where key='credit_payload'), pg_temp.signed((select value from b where key='credit_payload'))) ->> 'outcome',
  'duplicate', 'a redelivered event is not applied twice');
reset role;
select is((select count(*)::int from private.credit_grants where organization_id = (select value::uuid from b where key='org')), 1, 'one top-up exists');
select is(private.entitlement_limit((select value::uuid from b where key='org'), 'ai.credits.monthly'), 4500::bigint,
  'the AI allowance is the plan''s 4,000 credits plus the 500 purchased');

-- ------------------------------------------------------------------ invoices and analytics
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000a1';
select throws_ok($$select public.billing_generate_invoice((select value::uuid from b where key='org'), now() - interval '1 day', now())$$,
  '42501', 'BILLING_NOT_AUTHORISED', 'customers cannot issue their own invoices');
select throws_ok($$select public.platform_commercial_analytics()$$, '42501', 'BILLING_NOT_AUTHORISED', 'customers cannot see platform revenue');
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000c1';
select lives_ok($$insert into b values ('invoice', public.billing_generate_invoice((select value::uuid from b where key='org'), now() - interval '1 day', now(), 25)::text)$$,
  'a platform administrator issues the period''s invoice');
select is((public.billing_invoice_get((select value::uuid from b where key='invoice')) ->> 'totalMinor')::int, 9875, 'Professional plan 79.00 plus 25% VAT is 98.75');
select is((public.platform_commercial_analytics() ->> 'mrrMinor')::int, 7900, 'commercial analytics report monthly recurring revenue');
reset role;
select throws_ok($$update private.invoices set total_minor = 1 where id = (select value::uuid from b where key='invoice')$$, '55000', null, 'issued invoices are immutable');
insert into b select 'paid_payload', jsonb_build_object('id', 'evt_inv_1', 'type', 'invoice.paid', 'data', jsonb_build_object('object', jsonb_build_object(
  'id', 'in_1', 'metadata', jsonb_build_object('njumeni_invoice_number', i.invoice_number))))::text from private.invoices i where i.id = (select value::uuid from b where key='invoice');
set local role anon;
select is(public.billing_webhook('stripe', (select value from b where key='paid_payload'), pg_temp.signed((select value from b where key='paid_payload'))) ->> 'outcome',
  'processed', 'the provider confirms payment');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-0000000000a1';
select is(public.billing_invoice_get((select value::uuid from b where key='invoice')) ->> 'status', 'paid', 'the customer sees the invoice as paid');
select is((public.billing_overview((select value::uuid from b where key='org')) -> 'invoices' -> 0 ->> 'status'), 'paid', 'the billing overview lists the invoice');

select * from finish();
rollback;
