begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Two synthetic users; each receives a personal organisation and default workspace.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('ee000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'evidence-owner@example.invalid', now(), now()),
  ('ee000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'evidence-outsider@example.invalid', now(), now());

create temporary table ev (key text primary key, value text) on commit drop;
grant all on ev to authenticated, service_role;
insert into ev
select 'org', o.id::text from public.organizations o
join private.principal_identities pi on pi.principal_id = o.owner_principal_id
where pi.auth_user_id = 'ee000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into ev
select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from ev where key = 'org') limit 1;
insert into ev values ('object1', (select value from ev where key = 'org') || '/' || (select value from ev where key = 'ws')
  || '/ee000000-0000-4000-8000-0000000000f1/letter.txt');
insert into ev values ('object2', (select value from ev where key = 'org') || '/' || (select value from ev where key = 'ws')
  || '/ee000000-0000-4000-8000-0000000000f2/copy.txt');
insert into storage.objects (bucket_id, name) values
  ('njumeni-workspace-files', (select value from ev where key = 'object1')),
  ('njumeni-workspace-files', (select value from ev where key = 'object2'));

-- ---------------- Owner: create and register --------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'ee000000-0000-4000-8000-0000000000a1';
set local request.headers = '{"x-correlation-id": "phase3-test"}';

select lives_ok(
  $$insert into ev values ('item', public.evidence_create_item((select value::uuid from ev where key='org'),
    (select value::uuid from ev where key='ws'), 'Employer letter, 14 March', 'correspondence')::text)$$,
  'owner creates an evidence item'
);
select throws_ok(
  $$select public.evidence_register_file((select value::uuid from ev where key='item'),
    (select value from ev where key='org') || '/' || (select value from ev where key='ws') || '/ee000000-0000-4000-8000-0000000000ff/missing.txt',
    repeat('a', 64), 10, 'text/plain', 'missing.txt')$$,
  '22023', 'EVIDENCE_OBJECT_NOT_FOUND', 'a file cannot be registered before it is uploaded'
);
select lives_ok(
  $$insert into ev values ('file1', public.evidence_register_file((select value::uuid from ev where key='item'),
    (select value from ev where key='object1'), repeat('a', 64), 120, 'text/plain', 'letter.txt')::text)$$,
  'an uploaded object is registered as version 1'
);
select is((select count(*)::integer from public.evidence_list_items((select value::uuid from ev where key='org'),
  (select value::uuid from ev where key='ws'))), 1, 'owner lists the item');
select is((select status from public.evidence_list_items((select value::uuid from ev where key='org'),
  (select value::uuid from ev where key='ws'))), 'quarantined', 'new evidence stays quarantined until scanned');
select throws_ok(
  $$select * from public.evidence_read_passages((select value::uuid from ev where key='item'))$$,
  '55000', 'EVIDENCE_NOT_AVAILABLE', 'quarantined evidence cannot be read'
);
select throws_ok(
  $$select public.evidence_worker_record_scan((select value::uuid from ev where key='file1'), 'clean', null, repeat('a', 64))$$,
  '42501', null, 'users cannot record their own scan verdict'
);

-- ---------------- Outsider: denied everywhere ------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'ee000000-0000-4000-8000-0000000000b1';
select throws_ok(
  $$select * from public.evidence_list_items((select value::uuid from ev where key='org'), (select value::uuid from ev where key='ws'))$$,
  '42501', 'EVIDENCE_NOT_AUTHORISED', 'an outsider cannot list another tenant''s evidence'
);
select throws_ok(
  $$select * from public.evidence_custody_log((select value::uuid from ev where key='item'))$$,
  '42501', 'EVIDENCE_NOT_AUTHORISED', 'an outsider cannot read another tenant''s custody log'
);
select throws_ok(
  $$select public.evidence_create_item((select value::uuid from ev where key='org'), (select value::uuid from ev where key='ws'), 'Planted')$$,
  '42501', 'EVIDENCE_NOT_AUTHORISED', 'an outsider cannot plant evidence in another tenant'
);
select ok(not has_table_privilege('authenticated', 'private.evidence_items', 'SELECT'),
  'evidence tables are not directly readable');

-- ---------------- Worker: scan and extract ---------------------------------------------------
reset role;
set local role service_role;
select is((select count(*)::integer from public.evidence_worker_pending_files(10)
  where evidence_file_id = (select value::uuid from ev where key='file1')), 1, 'the worker sees the pending file');
select lives_ok(
  $$select public.evidence_worker_record_scan((select value::uuid from ev where key='file1'), 'clean', null, repeat('a', 64))$$,
  'the worker records a clean scan with matching bytes'
);
select lives_ok(
  $$select public.evidence_worker_record_extraction((select value::uuid from ev where key='file1'), 'evidence-text', '1.0.0',
    'succeeded', null, repeat('b', 64), 1,
    '[{"ordinal":0,"page_number":1,"start_offset":0,"end_offset":55,"content":"On 14 March 2024 the employer received notice of the incident.","content_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},
      {"ordinal":1,"page_number":1,"start_offset":56,"end_offset":110,"content":"Contact hr@example.invalid about invoice NOK 12 500.","content_hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]'::jsonb,
    '[{"passage_ordinal":0,"entity_type":"date","raw_value":"14 March 2024","normalised_value":"2024-03-14","start_offset":3,"end_offset":16},
      {"passage_ordinal":1,"entity_type":"email","raw_value":"hr@example.invalid","normalised_value":"hr@example.invalid","start_offset":8,"end_offset":26}]'::jsonb,
    '[{"passage_ordinal":0,"event_date":"2024-03-14","date_precision":"day","description":"The employer received notice of the incident."}]'::jsonb)$$,
  'the worker records an extraction with passages, entities and events'
);
select throws_ok(
  $$select public.evidence_worker_record_extraction((select value::uuid from ev where key='file1'), 'evidence-text', '1.0.0',
    'succeeded', null, repeat('b', 64), 1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)$$,
  '55000', 'EVIDENCE_ALREADY_EXTRACTED', 'an extraction cannot be replaced'
);

-- ---------------- Owner: read, redact, analyse ----------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'ee000000-0000-4000-8000-0000000000a1';
select lives_ok(
  $$insert into ev values ('file2', public.evidence_register_file((select value::uuid from ev where key='item'),
    (select value from ev where key='object2'), repeat('e', 64), 120, 'text/plain', 'copy.txt')::text)$$,
  'a second version is registered'
);
reset role;
set local role service_role;
select lives_ok(
  $$select public.evidence_worker_record_scan((select value::uuid from ev where key='file2'), 'clean', null, repeat('0', 64))$$,
  'a scan of mismatched bytes is recorded'
);
reset role;
select is((select scan_status from private.evidence_files where id = (select value::uuid from ev where key='file2')),
  'rejected', 'bytes that do not match the declared SHA-256 are rejected, not trusted');

set local role authenticated;
set local request.jwt.claim.sub = 'ee000000-0000-4000-8000-0000000000a1';
select is((select count(*)::integer from public.evidence_read_passages((select value::uuid from ev where key='item'))), 2,
  'active evidence passages are readable');
select is((select count(*)::integer from public.evidence_chronology((select value::uuid from ev where key='org'),
  (select value::uuid from ev where key='ws'))), 1, 'the chronology contains the extracted event');
select lives_ok(
  $$select public.evidence_add_redaction((select passage_id from public.evidence_read_passages((select value::uuid from ev where key='item')) where ordinal = 1),
    8, 26, 'personal_data')$$,
  'a personal-data redaction is added'
);
select ok(
  (select content like 'Contact ██████████████████ about%' from public.evidence_read_passages((select value::uuid from ev where key='item')) where ordinal = 1),
  'redacted text is masked on read'
);
select is((select count(*)::integer from public.evidence_list_entities((select value::uuid from ev where key='item')) where entity_type = 'email'), 0,
  'entities inside redacted ranges are withheld');
select lives_ok(
  $$insert into ev values ('prop', public.evidence_create_proposition((select value::uuid from ev where key='org'),
    (select value::uuid from ev where key='ws'), 'The employer received notification of the incident')::text)$$,
  'a factual proposition is created'
);
select lives_ok(
  $$select public.evidence_link_proposition((select value::uuid from ev where key='prop'), (select value::uuid from ev where key='item'), 'supports');
    select public.evidence_link_proposition((select value::uuid from ev where key='prop'), (select value::uuid from ev where key='item'), 'contradicts', null, 'Later letter disputes receipt')$$,
  'evidence supports and contradicts the proposition'
);
select is((select count(*)::integer from public.evidence_proposition_conflicts((select value::uuid from ev where key='org'),
  (select value::uuid from ev where key='ws'))), 1, 'the contradiction is detected');

-- Legal hold blocks deletion.
select lives_ok($$select public.evidence_set_legal_hold((select value::uuid from ev where key='item'), true, 'Litigation reasonably anticipated')$$,
  'a legal hold is set');
select throws_ok($$select public.evidence_request_deletion((select value::uuid from ev where key='item'), 'Tidy up')$$,
  '55000', 'EVIDENCE_UNDER_LEGAL_HOLD', 'deletion is refused under legal hold');

-- Custody chain is intact before tampering.
select is((public.evidence_verify_custody((select value::uuid from ev where key='item')) ->> 'valid'), 'true',
  'the custody chain verifies');

-- ---------------- Tamper evidence ------------------------------------------------------------
reset role;
select throws_ok($$update private.evidence_passages set content = 'altered'$$, '55000', null, 'passages are append-only');
alter table private.evidence_custody_events disable trigger evidence_custody_events_immutable;
update private.evidence_custody_events set details = '{"reason":"forged"}'
where evidence_item_id = (select value::uuid from ev where key='item') and event_type = 'legal_hold_set';
alter table private.evidence_custody_events enable trigger evidence_custody_events_immutable;
set local role authenticated;
set local request.jwt.claim.sub = 'ee000000-0000-4000-8000-0000000000a1';
select is((public.evidence_verify_custody((select value::uuid from ev where key='item')) ->> 'valid'), 'false',
  'a silently altered custody record is detected');

reset role;
set local role service_role;
select is((public.verify_security_audit_chain() ->> 'valid'), 'true', 'the security audit chain verifies');
reset role;
alter table private.security_audit_events disable trigger security_audit_events_immutable;
update private.security_audit_events set outcome = 'success' where event_key = 'evidence.scan_completed' and outcome = 'failure';
alter table private.security_audit_events enable trigger security_audit_events_immutable;
set local role service_role;
select is((public.verify_security_audit_chain() ->> 'valid'), 'false', 'a silently altered audit record is detected');
reset role;
select is((select count(*)::integer from private.security_audit_events where correlation_id = 'phase3-test' and event_key like 'evidence.%') > 0,
  true, 'evidence audit events carry the request correlation id');

select * from finish();
rollback;
