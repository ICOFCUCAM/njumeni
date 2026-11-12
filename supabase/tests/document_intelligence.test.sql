begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('ae000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'doc-owner@example.invalid', now(), now()),
  ('ae000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'doc-editor@example.invalid', now(), now()),
  ('ae000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'doc-manager@example.invalid', now(), now()),
  ('ae000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'doc-outsider@example.invalid', now(), now());
create temporary table d (key text primary key, value text) on commit drop;
grant all on d to authenticated;
insert into d select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'ae000000-0000-4000-8000-0000000000a1' and o.kind = 'personal';
insert into d select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from d where key = 'org') limit 1;
insert into d select 'other_ws', w.id::text from public.workspaces w join public.organizations o on o.id = w.organization_id
  join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'ae000000-0000-4000-8000-0000000000d1' and o.kind = 'personal';
insert into d select 'p_' || right(pi.auth_user_id::text, 2), pi.principal_id::text from private.principal_identities pi
  where pi.auth_user_id::text like 'ae000000%';

-- Legal fixtures: quotable, display-only and unapproved sources.
insert into private.legal_sources (id, jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method, rights_status, licence_identifier, attribution_text, ingestion_enabled, status) values
  ('ae100000-0000-4000-8000-000000000001', 'NO', 'doc-quotable', 'Quotable', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('ae100000-0000-4000-8000-000000000002', 'NO', 'doc-display', 'Display', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'approved', 'T', 'T', true, 'active'),
  ('ae100000-0000-4000-8000-000000000003', 'NO', 'doc-unapproved', 'Unapproved', 'Synthetic', 'legislation', 'https://example.invalid', 'api', 'review_required', null, null, false, 'planned');
insert into private.legal_source_rights_evidence (source_id, terms_uri, reviewed_by, reviewed_at, permissions) values
  ('ae100000-0000-4000-8000-000000000001', 'https://example.invalid/t', 'r', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":true}'),
  ('ae100000-0000-4000-8000-000000000002', 'https://example.invalid/t', 'r', now(), '{"retrieve":true,"store":true,"index":true,"display":true,"quote":false}');
insert into private.legal_authorities (id, source_id, jurisdiction_code, external_id, citation, title, authority_type, language_code)
select ('ae200000-0000-4000-8000-00000000000' || n)::uuid, ('ae100000-0000-4000-8000-00000000000' || n)::uuid, 'NO', 'd' || n, 'DOC-' || n, 'Doc act ' || n, 'act', 'nb'
from generate_series(1, 3) n;
insert into private.legal_authority_versions (id, authority_id, version_number, valid_from, source_content_hash)
select ('ae300000-0000-4000-8000-00000000000' || n)::uuid, ('ae200000-0000-4000-8000-00000000000' || n)::uuid, 1, '2015-01-01', repeat(n::text, 64)
from generate_series(1, 3) n;
insert into private.legal_authority_passages (id, authority_version_id, ordinal, content, content_hash)
select ('ae400000-0000-4000-8000-00000000000' || n)::uuid, ('ae300000-0000-4000-8000-00000000000' || n)::uuid, 0,
  'Arbeidsgiver skal straks   varsle tilsynet.', repeat('a', 64)
from generate_series(1, 3) n;
insert into private.evidence_items (id, organization_id, workspace_id, title, status) values
  ('ae500000-0000-4000-8000-000000000001', (select value::uuid from d where key='org'), (select value::uuid from d where key='ws'), 'Own email', 'active');
insert into private.evidence_items (id, organization_id, workspace_id, title, status)
select 'ae500000-0000-4000-8000-000000000002', w.organization_id, w.id, 'Foreign email', 'active'
from public.workspaces w where w.id = (select value::uuid from d where key = 'other_ws');

set local role authenticated;
set local request.jwt.claim.sub = 'ae000000-0000-4000-8000-0000000000a1';

-- ------------------------------------------------------------------ templates and creation
select is(jsonb_array_length(public.document_list_templates()), 6, 'six document templates are available');
select lives_ok($$insert into d values ('doc', public.document_create((select value::uuid from d where key='org'), (select value::uuid from d where key='ws'),
  'Memo on notification', 'research_memorandum')::text)$$, 'a document is created from a template');
select is((public.document_get((select value::uuid from d where key='doc')) #>> '{version,number}')::integer, 1, 'creation stores version 1');
select is(jsonb_array_length(public.document_get((select value::uuid from d where key='doc')) #> '{version,sections}'), 5,
  'version 1 has every template section');
select throws_ok($$select public.document_create((select value::uuid from d where key='org'), (select value::uuid from d where key='ws'), 'Bad', 'no_such_template')$$,
  '22023', 'DOCUMENT_TEMPLATE_UNKNOWN', 'unknown templates are rejected');

-- ------------------------------------------------------------------ saving and citation verification
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 0, '[{"key":"question","content":"Q"}]')$$,
  '40001', 'DOCUMENT_VERSION_CONFLICT', 'a stale editor cannot overwrite a newer version');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 1, '[{"key":"invented","content":"Q"}]')$$,
  '22023', 'DOCUMENT_CONTENT_INVALID', 'sections outside the template are rejected');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 1, '[{"key":"findings","content":"x [1]"}]',
  '[{"section_key":"findings","marker":1,"authority_passage_id":"ae400000-0000-4000-8000-000000000009"}]')$$,
  '22023', 'DOCUMENT_CITATION_NOT_FOUND', 'a fabricated citation is rejected');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 1, '[{"key":"findings","content":"x [1]"}]',
  '[{"section_key":"findings","marker":1,"authority_passage_id":"ae400000-0000-4000-8000-000000000003"}]')$$,
  '22023', 'DOCUMENT_CITATION_NOT_PERMITTED', 'a citation to an unapproved source is rejected');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 1, '[{"key":"findings","content":"x [1]"}]',
  '[{"section_key":"findings","marker":1,"authority_passage_id":"ae400000-0000-4000-8000-000000000001","quoted_text":"Arbeidsgiver kan varsle tilsynet."}]')$$,
  '22023', 'DOCUMENT_QUOTATION_MISMATCH', 'a misquotation is rejected');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 1, '[{"key":"findings","content":"x [1]"}]',
  '[{"section_key":"findings","marker":1,"authority_passage_id":"ae400000-0000-4000-8000-000000000002","quoted_text":"Arbeidsgiver skal straks varsle tilsynet."}]')$$,
  '22023', 'DOCUMENT_QUOTATION_MISMATCH', 'a source that forbids quotation cannot be quoted');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 1, '[{"key":"findings","content":"x [1]"}]',
  '[{"section_key":"findings","marker":1,"evidence_item_id":"ae500000-0000-4000-8000-000000000002"}]')$$,
  '42501', 'DOCUMENT_EVIDENCE_OUT_OF_SCOPE', 'evidence from another tenant cannot be cited');
select is(public.document_save_version((select value::uuid from d where key='doc'), 1,
  '[{"key":"question","content":"When must the employer notify?"},{"key":"findings","content":"The employer must notify at once [1], as the email shows [2]. A display-only act also applies [3]."}]',
  '[{"section_key":"findings","marker":1,"authority_passage_id":"ae400000-0000-4000-8000-000000000001","quoted_text":"Arbeidsgiver skal straks varsle tilsynet."},
    {"section_key":"findings","marker":2,"evidence_item_id":"ae500000-0000-4000-8000-000000000001"},
    {"section_key":"findings","marker":3,"authority_passage_id":"ae400000-0000-4000-8000-000000000002"}]',
  null, 'First draft'), 2, 'a verified save creates version 2 (whitespace-normalised quotation accepted)');
select is((select jsonb_agg(c ->> 'citation' order by (c ->> 'marker')::int) from jsonb_array_elements(public.document_get((select value::uuid from d where key='doc')) -> 'citations') c),
  '["DOC-1", "Exhibit: Own email", "DOC-2"]'::jsonb, 'citation text comes from the database, not the client');
select is((public.document_get((select value::uuid from d where key='doc'), 1) #>> '{version,number}')::integer, 1, 'earlier versions remain readable');

-- AI provenance: only a successful drafting execution may author a version.
select lives_ok($$insert into d values ('reasoning_exec', public.ai_record_execution((select value::uuid from d where key='org'), (select value::uuid from d where key='ws'),
  'reasoning', 'mock', 'mock-deterministic-1', 'r1', array['public_legal'], '{}', '[]', 10, 10, 1, 'succeeded', null, '{}', null)::text)$$, 'a reasoning execution exists');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 2, '[{"key":"question","content":"Q"}]', '[]',
  (select value::uuid from d where key='reasoning_exec'))$$, '22023', 'DOCUMENT_EXECUTION_INVALID', 'a non-drafting execution cannot author a document');
select lives_ok($$insert into d values ('drafting_exec', public.ai_record_execution((select value::uuid from d where key='org'), (select value::uuid from d where key='ws'),
  'drafting', 'mock', 'mock-deterministic-1', 'd1', array['public_legal'], '{}', '[]', 10, 10, 1, 'succeeded', null, '{}', null)::text)$$, 'a drafting execution exists');
select is(public.document_save_version((select value::uuid from d where key='doc'), 2,
  '[{"key":"question","content":"When must the employer notify?"},{"key":"findings","content":"Drafted findings."}]', '[]',
  (select value::uuid from d where key='drafting_exec'), 'Drafting agent'), 3, 'a drafting agent version is stored with its execution');
select is(public.document_get((select value::uuid from d where key='doc')) #>> '{version,origin}', 'agent', 'agent authorship is recorded');

-- ------------------------------------------------------------------ review and approval (personal organisation)
select lives_ok($$select public.document_submit((select value::uuid from d where key='doc'))$$, 'the document is submitted for review');
select throws_ok($$select public.document_save_version((select value::uuid from d where key='doc'), 3, '[{"key":"question","content":"Q"}]')$$,
  '55000', 'DOCUMENT_IN_REVIEW', 'a document under review cannot be edited');
select throws_ok($$select public.document_decide((select value::uuid from d where key='doc'), 'approved')$$,
  '23514', 'DOCUMENT_REQUIRED_SECTIONS_MISSING', 'a document with empty required sections cannot be approved');
select throws_ok($$select public.document_decide((select value::uuid from d where key='doc'), 'changes_requested', '')$$,
  '23514', null, 'requesting changes needs a reason');
select lives_ok($$select public.document_decide((select value::uuid from d where key='doc'), 'changes_requested', 'Fill every required section.')$$,
  'changes are requested');
select is(public.document_save_version((select value::uuid from d where key='doc'), 3,
  '[{"key":"question","content":"Q"},{"key":"sources","content":"Synthetic sources."},{"key":"findings","content":"F"},{"key":"limitations","content":"Pilot coverage."}]'),
  4, 'the author completes the required sections');
select lives_ok($$select public.document_submit((select value::uuid from d where key='doc'))$$, 'resubmitted');
select lives_ok($$select public.document_decide((select value::uuid from d where key='doc'), 'approved')$$,
  'in a personal organisation the owner may approve their own document');
select is(public.document_get((select value::uuid from d where key='doc')) ->> 'approvedVersion', '4', 'version 4 is the approved version');
select is(public.document_record_export((select value::uuid from d where key='doc'), 4, 'pdf', repeat('b', 64)), true, 'exporting the approved version is final');
select is(public.document_record_export((select value::uuid from d where key='doc'), 2, 'docx', repeat('c', 64)), false, 'exporting an earlier version is marked as not final');
select is(public.document_save_version((select value::uuid from d where key='doc'), 4,
  '[{"key":"question","content":"Q2"},{"key":"sources","content":"S"},{"key":"findings","content":"F"},{"key":"limitations","content":"L"}]'), 5,
  'editing an approved document creates a new draft version');
select is(public.document_get((select value::uuid from d where key='doc')) ->> 'status', 'draft', 'the approval does not carry over to the new version');
reset role;
select throws_ok($$update private.document_versions set sections = '[]'$$, '55000', null, 'document versions are append-only');
select throws_ok($$delete from private.legal_documents$$, '55000', null, 'documents are retained');

-- ------------------------------------------------------------------ team organisation: roles and four-eyes
set local role authenticated;
set local request.jwt.claim.sub = 'ae000000-0000-4000-8000-0000000000a1';
insert into public.organizations (name, slug, kind) values ('Doc Firm', 'doc-firm-test', 'law_firm');
insert into public.workspaces (organization_id, name, slug, kind)
  values ((select id from public.organizations where slug = 'doc-firm-test'), 'Doc Team', 'doc-team-test', 'team');
reset role;
insert into d select 'team_org', id::text from public.organizations where slug = 'doc-firm-test';
insert into d select 'team_ws', id::text from public.workspaces where slug = 'doc-team-test';
insert into public.organization_memberships (organization_id, principal_id)
select (select value::uuid from d where key='team_org'), value::uuid from d where key in ('p_b1', 'p_c1');
insert into public.workspace_memberships (workspace_id, principal_id)
select (select value::uuid from d where key='team_ws'), value::uuid from d where key in ('p_b1', 'p_c1');
insert into private.workspace_role_bindings (workspace_id, principal_id, role_key, assigned_by_principal_id) values
  ((select value::uuid from d where key='team_ws'), (select value::uuid from d where key='p_b1'), 'workspace_editor', (select value::uuid from d where key='p_a1')),
  ((select value::uuid from d where key='team_ws'), (select value::uuid from d where key='p_c1'), 'workspace_manager', (select value::uuid from d where key='p_a1'));

set local role authenticated;
set local request.jwt.claim.sub = 'ae000000-0000-4000-8000-0000000000b1';
select lives_ok($$insert into d values ('team_doc', public.document_create((select value::uuid from d where key='team_org'), (select value::uuid from d where key='team_ws'),
  'Team letter', 'legal_letter')::text)$$, 'an editor creates a document');
select lives_ok($$select public.document_save_version((select value::uuid from d where key='team_doc'), 1,
  '[{"key":"recipient","content":"R"},{"key":"subject","content":"S"},{"key":"background","content":"B"},{"key":"legal_basis","content":"L"},{"key":"request","content":"Q"},{"key":"closing","content":"C"}]');
  select public.document_submit((select value::uuid from d where key='team_doc'))$$, 'the editor completes and submits it');
select throws_ok($$select public.document_decide((select value::uuid from d where key='team_doc'), 'approved')$$,
  '42501', 'DOCUMENT_NOT_AUTHORISED', 'an editor cannot approve documents');
set local request.jwt.claim.sub = 'ae000000-0000-4000-8000-0000000000c1';
select lives_ok($$select public.document_decide((select value::uuid from d where key='team_doc'), 'approved', 'Reviewed.')$$,
  'a manager who did not write it approves');
select lives_ok($$select public.document_save_version((select value::uuid from d where key='team_doc'), 2,
  '[{"key":"recipient","content":"R2"},{"key":"subject","content":"S"},{"key":"background","content":"B"},{"key":"legal_basis","content":"L"},{"key":"request","content":"Q"},{"key":"closing","content":"C"}]');
  select public.document_submit((select value::uuid from d where key='team_doc'))$$, 'the manager edits and submits a new version');
select throws_ok($$select public.document_decide((select value::uuid from d where key='team_doc'), 'approved')$$,
  '42501', 'DOCUMENT_FOUR_EYES_REQUIRED', 'in a team organisation nobody approves their own version');
set local request.jwt.claim.sub = 'ae000000-0000-4000-8000-0000000000d1';
select throws_ok($$select public.document_get((select value::uuid from d where key='team_doc'))$$,
  '42501', 'DOCUMENT_NOT_AUTHORISED', 'an outsider cannot read another tenant''s document');

select * from finish();
rollback;
