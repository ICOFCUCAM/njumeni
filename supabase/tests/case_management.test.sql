begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('af000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'case-owner@example.invalid', now(), now()),
  ('af000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'case-viewer@example.invalid', now(), now()),
  ('af000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'case-outsider@example.invalid', now(), now());
create temporary table m (key text primary key, value text) on commit drop;
grant all on m to authenticated;
insert into m select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'af000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into m select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from m where key = 'org') limit 1;
insert into m select 'p_' || right(pi.auth_user_id::text, 2), pi.principal_id::text from private.principal_identities pi
  where pi.auth_user_id::text like 'af000000%';
insert into m select 'other_ws', w.id::text from public.workspaces w join public.organizations o on o.id = w.organization_id
  join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'af000000-0000-4000-8000-0000000000d1' and o.kind = 'personal';
insert into private.evidence_items (id, organization_id, workspace_id, title, status) values
  ('af500000-0000-4000-8000-000000000001', (select value::uuid from m where key='org'), (select value::uuid from m where key='ws'), 'Dismissal letter', 'active');
insert into private.evidence_items (id, organization_id, workspace_id, title, status)
select 'af500000-0000-4000-8000-000000000002', w.organization_id, w.id, 'Foreign letter', 'active' from public.workspaces w
where w.id = (select value::uuid from m where key='other_ws');
insert into private.evidence_events (evidence_item_id, event_date, description, origin) values
  ('af500000-0000-4000-8000-000000000001', '2026-03-14', 'Dismissal letter dated', 'extracted');
-- A viewer in the owner's personal workspace (read-only role).
insert into public.organization_memberships (organization_id, principal_id) values
  ((select value::uuid from m where key='org'), (select value::uuid from m where key='p_b1'));
insert into public.workspace_memberships (workspace_id, principal_id) values
  ((select value::uuid from m where key='ws'), (select value::uuid from m where key='p_b1'));
insert into private.workspace_role_bindings (workspace_id, principal_id, role_key, assigned_by_principal_id) values
  ((select value::uuid from m where key='ws'), (select value::uuid from m where key='p_b1'), 'workspace_viewer', (select value::uuid from m where key='p_a1'));

set local role authenticated;
set local request.jwt.claim.sub = 'af000000-0000-4000-8000-0000000000a1';

-- ------------------------------------------------------------------ creation and numbering
select lives_ok($$insert into m select 'matter', (public.matter_create((select value::uuid from m where key='org'), (select value::uuid from m where key='ws'),
  'Unfair dismissal', 'employment', 'NO', 'Dismissed after reporting an accident', '{"category":"employment","answers":{"employer":"Acme"}}') ->> 'id')$$,
  'a matter is created from guided intake');
select matches(public.matter_get((select value::uuid from m where key='matter')) ->> 'matterNumber', '^M-\d{4}-0001$', 'the first matter is numbered 0001');
select is((public.matter_create((select value::uuid from m where key='org'), (select value::uuid from m where key='ws'),
  'Deposit dispute', 'housing', 'NO') ->> 'matterNumber'), 'M-' || to_char(now(), 'YYYY') || '-0002', 'numbers are sequential per workspace');
select throws_ok($$select public.matter_create((select value::uuid from m where key='org'), (select value::uuid from m where key='ws'), 'Bad', 'employment', 'ZZ')$$,
  '22023', 'MATTER_JURISDICTION_UNKNOWN', 'an unknown jurisdiction is rejected');
select throws_ok($$select public.matter_create((select value::uuid from m where key='org'), (select value::uuid from m where key='ws'), 'Bad', 'astrology', 'NO')$$,
  '23514', null, 'an unknown legal category is rejected');

-- ------------------------------------------------------------------ parties, links, tasks, deadlines
select lives_ok($$insert into m values ('client', public.matter_add_party((select value::uuid from m where key='matter'), 'Kari Nordmann', 'client')::text)$$, 'the client is recorded');
select lives_ok($$select public.matter_add_party((select value::uuid from m where key='matter'), 'Acme AS', 'opposing_party');
  select public.matter_add_party((select value::uuid from m where key='matter'), 'Advokat Hansen', 'representative', (select value::uuid from m where key='client'))$$,
  'the opposing party and a representative are recorded');
select throws_ok($$select public.matter_add_party((select value::uuid from m where key='matter'), 'X', 'representative', gen_random_uuid())$$,
  '22023', 'MATTER_PARTY_UNKNOWN', 'a representative must represent a party of the same matter');
select lives_ok($$select public.matter_link((select value::uuid from m where key='matter'), 'evidence_item', 'af500000-0000-4000-8000-000000000001')$$,
  'own evidence is linked');
select lives_ok($$select public.matter_link((select value::uuid from m where key='matter'), 'evidence_item', 'af500000-0000-4000-8000-000000000001')$$,
  'linking twice is harmless');
select throws_ok($$select public.matter_link((select value::uuid from m where key='matter'), 'evidence_item', 'af500000-0000-4000-8000-000000000002')$$,
  '42501', 'MATTER_LINK_OUT_OF_SCOPE', 'another tenant''s evidence cannot be linked');
select lives_ok($$insert into m values ('task', public.matter_add_task((select value::uuid from m where key='matter'), 'Request the personnel file', null,
  (select value::uuid from m where key='p_a1'), current_date + 3, 'high')::text)$$, 'a task is assigned to a member');
select throws_ok($$select public.matter_add_task((select value::uuid from m where key='matter'), 'Bad', null, (select value::uuid from m where key='p_d1'))$$,
  '22023', 'MATTER_ASSIGNEE_NOT_MEMBER', 'tasks cannot be assigned outside the workspace');
select lives_ok($$insert into m values ('deadline', public.matter_add_deadline((select value::uuid from m where key='matter'), 'Claim negotiation meeting', 'response', now() + interval '10 days')::text);
  insert into m values ('hearing', public.matter_add_deadline((select value::uuid from m where key='matter'), 'Main hearing', 'hearing', now() + interval '60 days', 'Oslo tingrett')::text)$$,
  'a deadline and a hearing are recorded');
select throws_ok($$select public.matter_update_deadline((select value::uuid from m where key='deadline'), 'held')$$,
  '22023', 'MATTER_STATUS_INVALID', 'only hearings can be marked held');
select lives_ok($$select public.matter_update_task((select value::uuid from m where key='task'), 'done')$$, 'a task is completed');
select lives_ok($$select public.matter_record_event((select value::uuid from m where key='matter'), 'communication', 'Letter sent to Acme requesting the file', now() - interval '1 day')$$,
  'a communication is recorded');
select throws_ok($$select public.matter_record_event((select value::uuid from m where key='matter'), 'status_changed', 'Forged')$$,
  '22023', 'MATTER_EVENT_INVALID', 'system history cannot be written by hand');

-- ------------------------------------------------------------------ reads
select is(jsonb_array_length(public.matter_get((select value::uuid from m where key='matter')) -> 'parties'), 3, 'parties are returned');
select is(jsonb_array_length(public.matter_get((select value::uuid from m where key='matter')) -> 'links'), 1, 'the duplicate link was not stored');
select ok((select jsonb_path_exists(public.matter_get((select value::uuid from m where key='matter')),
  '$.chronology[*] ? (@.kind == "evidence" && @.date == "2026-03-14")')), 'the chronology includes linked evidence events');
select ok((select jsonb_path_exists(public.matter_get((select value::uuid from m where key='matter')),
  '$.chronology[*] ? (@.kind == "hearing")')), 'the chronology includes hearings');
select ok((select jsonb_array_length(public.matter_get((select value::uuid from m where key='matter')) -> 'history') >= 8),
  'the procedural history records every change');
select is((public.matter_list((select value::uuid from m where key='org'), (select value::uuid from m where key='ws')) -> 0 -> 'nextDeadline' ->> 'title'),
  'Claim negotiation meeting', 'the matter list shows the next deadline');
select is(jsonb_array_length(public.matter_my_agenda(30) -> 'deadlines'), 1, 'the agenda shows deadlines within the window');
select is(jsonb_array_length(public.matter_my_agenda(90) -> 'deadlines'), 2, 'a wider window includes the hearing');

-- ------------------------------------------------------------------ lifecycle and retention
select throws_ok($$select public.matter_set_status((select value::uuid from m where key='matter'), 'archived')$$,
  '22023', 'MATTER_STATUS_INVALID', 'only closed matters can be archived');
select lives_ok($$select public.matter_set_status((select value::uuid from m where key='matter'), 'closed', 'Settled')$$, 'the matter is closed');
select throws_ok($$select public.matter_add_task((select value::uuid from m where key='matter'), 'Late task')$$,
  '55000', 'MATTER_CLOSED', 'a closed matter cannot be changed');
select lives_ok($$select public.matter_record_export((select value::uuid from m where key='matter'), repeat('e', 64), 7)$$,
  'a closed matter can still be exported');
reset role;
select throws_ok($$delete from private.matters$$, '55000', null, 'matters are retained');
select throws_ok($$update private.matter_events set summary = 'rewritten'$$, '55000', null, 'the procedural history is append-only');

-- ------------------------------------------------------------------ access
set local role authenticated;
set local request.jwt.claim.sub = 'af000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.matter_create((select value::uuid from m where key='org'), (select value::uuid from m where key='ws'), 'Viewer matter', 'other', 'NO')$$,
  '42501', 'MATTER_NOT_AUTHORISED', 'a viewer cannot create matters');
set local request.jwt.claim.sub = 'af000000-0000-4000-8000-0000000000d1';
select throws_ok($$select public.matter_get((select value::uuid from m where key='matter'))$$,
  '42501', 'MATTER_NOT_AUTHORISED', 'an outsider cannot read another tenant''s matter');

select * from finish();
rollback;
