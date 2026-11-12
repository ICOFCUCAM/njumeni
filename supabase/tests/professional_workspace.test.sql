begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('b0000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'firm-partner@example.invalid', now(), now()),
  ('b0000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'firm-lawyer@example.invalid', now(), now()),
  ('b0000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'firm-barred@example.invalid', now(), now()),
  ('b0000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'firm-outsider@example.invalid', now(), now());
create temporary table f (key text primary key, value text) on commit drop;
grant all on f to authenticated;
insert into f select 'p_' || right(pi.auth_user_id::text, 2), pi.principal_id::text from private.principal_identities pi
  where pi.auth_user_id::text like 'b0000000%';
insert into f select 'outsider_org', o.id::text from public.organizations o where o.owner_principal_id = (select value::uuid from f where key='p_d1') and o.kind = 'personal';
insert into f select 'outsider_ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from f where key='outsider_org') limit 1;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000a1';
insert into public.organizations (name, slug, kind) values ('Firm Test', 'firm-test-phase9', 'law_firm');
insert into public.workspaces (organization_id, name, slug, kind)
  values ((select id from public.organizations where slug = 'firm-test-phase9'), 'Litigation', 'firm-litigation-phase9', 'team');
reset role;
insert into f select 'org', id::text from public.organizations where slug = 'firm-test-phase9';
insert into f select 'ws', id::text from public.workspaces where slug = 'firm-litigation-phase9';
insert into public.organization_memberships (organization_id, principal_id)
select (select value::uuid from f where key='org'), value::uuid from f where key in ('p_b1', 'p_c1');
insert into private.organization_role_bindings (organization_id, principal_id, role_key, assigned_by_principal_id)
select (select value::uuid from f where key='org'), value::uuid, 'org_member', (select value::uuid from f where key='p_a1') from f where key in ('p_b1', 'p_c1');
insert into public.workspace_memberships (workspace_id, principal_id)
select (select value::uuid from f where key='ws'), value::uuid from f where key in ('p_b1', 'p_c1');
insert into private.workspace_role_bindings (workspace_id, principal_id, role_key, assigned_by_principal_id)
select (select value::uuid from f where key='ws'), value::uuid, 'workspace_editor', (select value::uuid from f where key='p_a1') from f where key in ('p_b1', 'p_c1');
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, engine_version)
values ('b0500000-0000-4000-8000-000000000001', (select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Notice periods for dismissal', 'NO', '2026-01-01', '{en}', 'lexical', 'answered', 'pilot', 'extractive-1.0.0');

-- ------------------------------------------------------------------ settings and clients
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000a1';
select is(public.organization_get_settings((select value::uuid from f where key='org')) ->> 'requireConflictCheck', 'true',
  'law firms require conflict checks by default');
select throws_ok($$select public.matter_create((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'), 'Unchecked', 'contract', 'NO')$$,
  '55000', 'MATTER_CONFLICT_CHECK_REQUIRED', 'a firm cannot open a matter without a conflict check');
select lives_ok($$insert into f values ('client', public.client_create((select value::uuid from f where key='org'), 'Kari Nordmann', 'individual')::text)$$,
  'the partner registers a client');

-- ------------------------------------------------------------------ conflict check → clear → open
select lives_ok($$insert into f values ('check1', public.conflict_check_run((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'New matter for Kari Nordmann against Acme', array['Acme AS'])::text)$$, 'a conflict check runs');
select is(jsonb_array_length((public.conflict_check_list((select value::uuid from f where key='org')) -> 0 -> 'hits')), 0, 'no hits for a new adverse party');
select throws_ok($$select public.matter_open_checked((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Kari v Acme', 'employment', 'NO', (select value::uuid from f where key='check1'))$$, '22023', 'MATTER_CONFLICT_CHECK_INVALID',
  'an undecided check cannot open a matter');
select lives_ok($$select public.conflict_check_decide((select value::uuid from f where key='check1'), 'clear')$$, 'the check is cleared');
select lives_ok($$insert into f select 'matter1', public.matter_open_checked((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Kari v Acme', 'employment', 'NO', (select value::uuid from f where key='check1'), (select value::uuid from f where key='client')) ->> 'id'$$,
  'the matter opens with the cleared check and the client');
select is((select jsonb_agg(p ->> 'role') from jsonb_array_elements(public.matter_get((select value::uuid from f where key='matter1')) -> 'parties') p),
  '["client"]'::jsonb, 'the client becomes a party');
select throws_ok($$select public.matter_open_checked((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Second use', 'employment', 'NO', (select value::uuid from f where key='check1'))$$, '22023', 'MATTER_CONFLICT_CHECK_INVALID',
  'a check is used once');
select lives_ok($$select public.matter_add_party((select value::uuid from f where key='matter1'), 'Acme AS', 'opposing_party')$$, 'the adverse party is recorded');

-- ------------------------------------------------------------------ hits, conflict, waiver
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000b1';
select lives_ok($$insert into f values ('check2', public.conflict_check_run((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Acme wants us to act for them', array['ACME', 'Kari  NORDMANN'])::text)$$, 'a lawyer runs a check for a prospective client');
select is((select count(*)::integer from jsonb_array_elements((select c -> 'hits' from jsonb_array_elements(public.conflict_check_list((select value::uuid from f where key='org'))) c where c ->> 'id' = (select value from f where key='check2'))) h
  where h ->> 'name' in ('Acme AS', 'Kari Nordmann')), 3, 'hits cover the client register and matter parties, ignoring case and company suffixes');
select throws_ok($$select public.conflict_check_decide((select value::uuid from f where key='check2'), 'clear')$$, '22023', 'CONFLICT_DECISION_INVALID',
  'a check with hits cannot be cleared');
select lives_ok($$select public.conflict_check_decide((select value::uuid from f where key='check2'), 'conflict', 'We act against Acme.')$$, 'the conflict is recorded');
select throws_ok($$select public.matter_open_checked((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Acme matter', 'contract', 'NO', (select value::uuid from f where key='check2'))$$, '22023', 'MATTER_CONFLICT_CHECK_INVALID', 'a conflicted check cannot open a matter');
select lives_ok($$insert into f values ('check3', public.conflict_check_run((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'),
  'Acme Holding unrelated advice', array['Acme Holding'])::text)$$, 'another check finds Acme in a longer name');
select is(jsonb_array_length((select c -> 'hits' from jsonb_array_elements(public.conflict_check_list((select value::uuid from f where key='org'))) c where c ->> 'id' = (select value from f where key='check3'))), 1, 'a partial name match is a hit');
select throws_ok($$select public.conflict_check_decide((select value::uuid from f where key='check3'), 'waived', 'Informed consent obtained from both clients.')$$,
  '42501', 'CONFLICT_WAIVER_NOT_AUTHORISED', 'a lawyer without organisation authority cannot waive');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000a1';
select throws_ok($$select public.conflict_check_decide((select value::uuid from f where key='check3'), 'waived', 'ok')$$, '23514', null,
  'a waiver needs a recorded justification');
select lives_ok($$select public.conflict_check_decide((select value::uuid from f where key='check3'), 'waived', 'Informed consent obtained from both clients.')$$,
  'the partner waives with a justification');
reset role;
select throws_ok($$update private.conflict_checks set decision = 'clear' where id = (select value::uuid from f where key='check3')$$, '55000', null,
  'a decided check is immutable');

-- ------------------------------------------------------------------ information barriers and team
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000c1';
select is(public.matter_get((select value::uuid from f where key='matter1')) ->> 'title', 'Kari v Acme', 'before the barrier, a workspace editor can read the matter');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.matter_add_barrier((select value::uuid from f where key='matter1'), (select value::uuid from f where key='p_c1'), 'Previously advised Acme')$$,
  '42501', 'MATTER_NOT_AUTHORISED', 'an editor cannot impose barriers');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000a1';
select throws_ok($$select public.matter_add_barrier((select value::uuid from f where key='matter1'), (select value::uuid from f where key='p_a1'), 'Self')$$,
  '22023', 'MATTER_BARRIER_SELF', 'nobody bars themselves');
select lives_ok($$select public.matter_assign((select value::uuid from f where key='matter1'), (select value::uuid from f where key='p_c1'), 'team_member');
  select public.matter_add_barrier((select value::uuid from f where key='matter1'), (select value::uuid from f where key='p_c1'), 'Previously advised Acme')$$,
  'the partner bars a lawyer who previously advised the other side');
select is((public.matter_professional((select value::uuid from f where key='matter1')) -> 'team'), '[]'::jsonb, 'a barred person loses their assignment');
select throws_ok($$select public.matter_assign((select value::uuid from f where key='matter1'), (select value::uuid from f where key='p_c1'), 'team_member')$$,
  '42501', 'MATTER_ASSIGNEE_BARRED', 'a barred person cannot be assigned');
select lives_ok($$select public.matter_assign((select value::uuid from f where key='matter1'), (select value::uuid from f where key='p_b1'), 'responsible_lawyer')$$,
  'a responsible lawyer is assigned');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000c1';
select throws_ok($$select public.matter_get((select value::uuid from f where key='matter1'))$$, '42501', 'MATTER_NOT_AUTHORISED',
  'the barrier overrides the editor role');
select ok(not exists (select 1 from jsonb_array_elements(public.matter_list((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'))) m
  where m ->> 'title' = 'Kari v Acme'), 'the barred matter is hidden from the list');

-- ------------------------------------------------------------------ knowledge and templates
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.knowledge_publish((select value::uuid from f where key='org'), 'saved_research', 'Notice periods', 'Body')$$,
  '42501', 'PROFESSIONAL_NOT_AUTHORISED', 'a lawyer cannot promote work into firm knowledge');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000a1';
select lives_ok($$insert into f values ('knowledge', public.knowledge_publish((select value::uuid from f where key='org'), 'saved_research',
  'Notice periods in dismissal cases', 'Summary of verified authorities on notice periods.', array['Employment', 'notice'],
  'research_run', 'b0500000-0000-4000-8000-000000000001', current_date - 1)::text)$$, 'the partner promotes research into firm knowledge');
select throws_ok($$select public.knowledge_publish((select value::uuid from f where key='org'), 'precedent', 'Bad', 'Body', '{}', 'legal_document', gen_random_uuid())$$,
  '22023', 'KNOWLEDGE_SOURCE_INVALID', 'only approved sources from the organisation can be promoted');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000b1';
select is((public.knowledge_search((select value::uuid from f where key='org'), 'notice dismissal') -> 0 ->> 'reviewOverdue'), 'true',
  'members find published knowledge, with its review status');
select lives_ok($$insert into f values ('tpl', public.document_templates_for((select value::uuid from f where key='org')) -> 0 ->> 'key')$$, 'members list templates');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000a1';
select lives_ok($$insert into f values ('org_tpl', public.document_template_create((select value::uuid from f where key='org'), 'Firm engagement letter', 'letter',
  '[{"key":"scope","title":"Scope of work","required":true},{"key":"fees","title":"Fees","required":true}]'))$$, 'the partner creates a firm template');
select ok(not exists (select 1 from jsonb_array_elements(public.document_list_templates()) t where t ->> 'key' = (select value from f where key='org_tpl')),
  'firm templates are not public');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000b1';
select lives_ok($$select public.document_create((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'), 'Engagement for Kari',
  (select value from f where key='org_tpl'))$$, 'a firm lawyer drafts from the firm template');
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-0000000000d1';
select throws_ok($$select public.document_create((select value::uuid from f where key='outsider_org'), (select value::uuid from f where key='outsider_ws'), 'Stolen template',
  (select value from f where key='org_tpl'))$$, '22023', 'DOCUMENT_TEMPLATE_UNKNOWN', 'another organisation cannot use the firm template');
select throws_ok($$select public.knowledge_search((select value::uuid from f where key='org'))$$, '42501', 'PROFESSIONAL_NOT_AUTHORISED',
  'outsiders cannot read firm knowledge');
select throws_ok($$select public.conflict_check_run((select value::uuid from f where key='org'), (select value::uuid from f where key='ws'), 'Fishing', array['Kari'])$$,
  '42501', 'PROFESSIONAL_NOT_AUTHORISED', 'outsiders cannot run conflict checks against the firm');

select * from finish();
rollback;
