-- GLCI-06: the full lifecycle of spec §3 (J-GLCI-1) on top of the GLCI-04 scenario, plus monitoring issues.
-- Original scenario: GLCI-04 impact analysis. A synthetic act is ingested, a customer researches it (finding and
-- verified claim), builds a document and an issue on the run and links them to a matter; another
-- act cites it. The act is then amended. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c4000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-impact-operator@example.invalid', now(), now()),
  ('c4000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'glci-second-operator@example.invalid', now(), now()),
  ('c4000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'glci-outsider@example.invalid', now(), now()),
  ('c4000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-impact-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi where pi.auth_user_id in ('c4000000-0000-4000-8000-0000000000a1', 'c4000000-0000-4000-8000-0000000000a2');
create temporary table g (key text primary key, value text) on commit drop;
grant all on g to authenticated;
insert into g select 'org', o.id::text from public.organizations o join private.principal_identities pi on pi.principal_id = o.owner_principal_id
  where pi.auth_user_id = 'c4000000-0000-4000-8000-0000000000b1' and o.kind = 'personal';
insert into g select 'ws', w.id::text from public.workspaces w where w.organization_id = (select value::uuid from g where key = 'org') limit 1;

insert into private.legal_sources (jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method)
values ('NO', 'glci-impact-source', 'Synthetic impact source', 'Synthetic issuer', 'legislation', 'https://laws.example.test/', 'bulk_download');
select public.legal_source_record_rights_review((select id from private.legal_sources where source_key = 'glci-impact-source'), 'pgTAP reviewer',
  'TEST-LICENCE', '1', 'https://laws.example.test/terms', 'Synthetic attribution', now() - interval '1 minute', now() + interval '1 day',
  '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":false}'::jsonb);
select public.legal_source_set_activation((select id from private.legal_sources where source_key = 'glci-impact-source'), 'pgTAP operator',
  'Synthetic activation for impact analysis', 'active', true, 'glci-impact-adapter', '1.0.0');
select public.legal_ingestion_enqueue_job((select id from private.legal_sources where source_key = 'glci-impact-source'), 'glci-impact-adapter', '1.0.0', 'glci-impact-1');
create temporary table claim on commit drop as select * from public.legal_ingestion_claim_job('pgtap-worker', 60);

create function pg_temp.append(p_external_id text, p_hash text, p_sections text[][]) returns text language plpgsql as $$
declare
  v_passages jsonb := '[]';
  v_i integer;
begin
  for v_i in 1 .. array_length(p_sections, 1) loop
    v_passages := v_passages || jsonb_build_array(jsonb_build_object('ordinal', v_i - 1, 'startOffset', 0, 'endOffset', 1,
      'content', p_sections[v_i][2], 'contentHash', encode(extensions.digest(p_sections[v_i][2], 'sha256'), 'hex'),
      'sectionPath', jsonb_build_array(p_sections[v_i][1])));
  end loop;
  return public.legal_ingestion_append_authority('glci-impact-source', 'NO',
    jsonb_build_object('externalId', p_external_id, 'title', 'Synthetic act ' || p_external_id, 'authorityType', 'act', 'languageCode', 'nb',
      'legalStatus', 'in_force', 'validFrom', '2020-01-01', 'metadata', '{}'::jsonb,
      'sourceContentHash', repeat(p_hash, 64), 'normalisedContentHash', repeat(p_hash, 64), 'normalisedText', 'Synthetic act'),
    'https://laws.example.test/archive#' || p_hash, now(), 'test-profile', v_passages, (select job_id from claim), (select lease_token from claim));
end;
$$;

select pg_temp.append('TEST/lov/impact', 'a', array[['§ 1', '§ 1. Formål.'], ['§ 2', '§ 2. Fristen for klage er tre uker.'], ['§ 3', '§ 3. Gebyr.']]);
select pg_temp.append('TEST/lov/citing', 'b', array[['§ 1', '§ 1. Se lov om impact § 2.']]);
set constraints private.legal_authority_versions_glci_detect immediate;
set constraints private.legal_authority_versions_glci_detect deferred;
insert into private.legal_authority_relationships (from_authority_id, to_authority_id, relationship_type)
values ((select id from private.legal_authorities where external_id = 'TEST/lov/citing'), (select id from private.legal_authorities where external_id = 'TEST/lov/impact'), 'cites');
insert into private.legal_source_dataset_syncs (source_id, dataset, dataset_sha256, dataset_size_bytes, retrieved_at, source_uri, authorities_listed)
values ((select id from private.legal_sources where source_key = 'glci-impact-source'), 'synthetic.tar.bz2', repeat('e', 64), 10, now(), 'https://laws.example.test/archive', 2);

-- A customer's research relies on § 2 (the deadline) and § 3 (unchanged).
create temporary table p on commit drop as select p.id, p.section_path[1] as section from private.legal_authority_passages p
  join private.legal_authority_versions v on v.id = p.authority_version_id join private.legal_authorities a on a.id = v.authority_id
  where a.external_id = 'TEST/lov/impact';
insert into private.research_runs (id, organization_id, workspace_id, question, jurisdiction_code, as_of_date, language_codes, retrieval_mode, status, coverage_level, limitations, engine_version)
values ('c4500000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'Hva er klagefristen?', 'NO', '2026-01-01', '{nb}', 'lexical', 'answered', 'pilot', '[]', 'extractive-1.1.0');
insert into private.research_findings (run_id, rank, passage_id, authority_version_id, authority_id, score)
select 'c4500000-0000-4000-8000-000000000001', row_number() over (order by p.section), p.id, v.id, v.authority_id, 0.8
from p join private.legal_authority_passages lp on lp.id = p.id join private.legal_authority_versions v on v.id = lp.authority_version_id
where p.section in ('§ 2', '§ 3');
insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, verification_status)
values ('c4500000-0000-4000-8000-000000000001', 0, 'verified_authority', 'Fristen for klage er tre uker.', (select id from p where section = '§ 2'), 'verified');
insert into private.legal_documents (id, organization_id, workspace_id, title, template_key, template_version, research_run_id, status, current_version)
values ('c4600000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'Klage', 'legal_letter', 1, 'c4500000-0000-4000-8000-000000000001', 'draft', 1);
insert into private.legal_issues (id, organization_id, workspace_id, research_run_id, title)
values ('c4700000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'c4500000-0000-4000-8000-000000000001', 'Klagefrist');
insert into private.matters (id, organization_id, workspace_id, matter_number, title, legal_category, jurisdiction_code)
values ('c4800000-0000-4000-8000-000000000001', (select value::uuid from g where key = 'org'), (select value::uuid from g where key = 'ws'),
  'M-2026-9001', 'Klage på vedtak', 'administrative', 'NO');
insert into private.matter_links (matter_id, link_type, target_id) values
  ('c4800000-0000-4000-8000-000000000001', 'research_run', 'c4500000-0000-4000-8000-000000000001'),
  ('c4800000-0000-4000-8000-000000000001', 'legal_document', 'c4600000-0000-4000-8000-000000000001');

-- The act is amended: the deadline in § 2 changes; § 3 is unchanged.
select pg_temp.append('TEST/lov/impact', 'c', array[['§ 1', '§ 1. Formål.'], ['§ 2', '§ 2. Fristen for klage er seks uker.'], ['§ 3', '§ 3. Gebyr.']]);
-- What commit does, in order: detection, then the analysis it queues.
set constraints private.legal_authority_versions_glci_detect immediate;
set constraints private.glci_change_events_analyse immediate;
create temporary table ev on commit drop as select id from private.glci_change_events where change_type = 'amended'
  and authority_id = (select id from private.legal_authorities where external_id = 'TEST/lov/impact');
grant select on ev to authenticated;


-- The scheduled worker reconciles with the service role.
create function pg_temp.reconcile() returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v := public.glci_reconcile_issues();
  perform set_config('request.jwt.claim.role', '', true);
  return v;
end;
$$;

-- ------------------------------------------------------------------ steps 1–5: detect, compare, analyse, report
select is((select count(*)::int from ev), 1, 'step 2: the amendment is detected and compared');
select ok((select count(*) from private.glci_change_impacts where event_id = (select id from ev)) > 0, 'step 3: its impact is analysed');
select is((pg_temp.reconcile() ->> 'openConditions')::integer, 1, 'step 5: reconciliation opens an issue for the change');
create temporary table iss on commit drop as select * from private.glci_issues where issue_key = 'change:' || (select id from ev);
grant select on iss, ev to authenticated;
select is((select severity || '/' || kind from iss), 'high/legal_change_review', 'the issue is high: a verified claim relied on the text');
select is((select array_agg(action_type order by action_type) from private.glci_remediation_proposals where issue_id = (select id from iss)),
  array['notify_affected', 'review_change'], 'step 6: remediation is proposed (review, notify affected workspaces)');
select is((pg_temp.reconcile() ->> 'openConditions')::integer, 1, 'reconciliation is idempotent');
select is((select count(*)::int from private.glci_issues where issue_key like 'change:%'), 1, 'no duplicate issue');

-- ------------------------------------------------------------------ step 7: human approval
create temporary table props on commit drop as select id, action_type from private.glci_remediation_proposals where issue_id = (select id from iss);
grant select on props to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_issues_list()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot see the issue queue');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-0000000000a1';
select throws_ok($$select public.glci_execute_proposal((select id from props where action_type = 'notify_affected'))$$,
  'GLCI_PROPOSAL_NOT_APPROVED', 'nothing executes before approval');
select is(public.glci_decide_proposal((select id from props where action_type = 'notify_affected'), 'approved', 'Deadline changed; notify'), 'approved',
  'an operator approves the notification');
select is(public.glci_decide_proposal((select id from props where action_type = 'review_change'), 'approved', 'Confirmed against Lovdata'), 'approved',
  'and the review');

-- ------------------------------------------------------------------ step 8: publish and notify
select is((public.glci_execute_proposal((select id from props where action_type = 'notify_affected')) ->> 'noticesCreated')::integer, 1,
  'the affected research run receives a currency notice');
select is((public.glci_execute_proposal((select id from props where action_type = 'review_change')) ->> 'reviewStatus'), 'confirmed',
  'the change is confirmed');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-0000000000b1';
select ok((public.research_run_currency_notices('c4500000-0000-4000-8000-000000000001') -> 0 ->> 'message') like '%has been amended%Re-verify%',
  'the customer sees the notice on their research');
select is((public.research_run_currency_notices('c4500000-0000-4000-8000-000000000001') -> 0 -> 'sections'), '["§ 2"]'::jsonb,
  'the notice names the changed section');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-0000000000c1';
select throws_ok($$select public.research_run_currency_notices('c4500000-0000-4000-8000-000000000001')$$, '42501', null,
  'another tenant cannot read it');
reset role;
select is((pg_temp.reconcile() ->> 'resolved')::integer, 1, 'the confirmed change resolves its issue automatically');

-- ------------------------------------------------------------------ monitoring issues (J-GLCI-2, J-GLCI-3)
update private.glci_monitoring_targets set status = 'active' where target_key = 'no-lovdata-current-laws';
create function pg_temp.check(p_fingerprint text, p_failure text default null, p_class text default null) returns text language plpgsql as $$
declare v_lease uuid;
begin
  update private.glci_target_state set next_check_at = now() - interval '1 second'
    where target_id = (select id from private.glci_monitoring_targets where target_key = 'no-lovdata-current-laws');
  select lease_token into v_lease from public.glci_monitor_claim('pgtap', 10, 60) where target_key = 'no-lovdata-current-laws';
  return public.glci_monitor_record('no-lovdata-current-laws', v_lease,
    case when p_failure is null then encode(extensions.digest(p_fingerprint, 'sha256'), 'hex') end, '{}', p_failure, p_class, 10);
end;
$$;
select pg_temp.check(null, 'LOVDATA_LISTING_SCHEMA_CHANGED', 'integration_failure');
select pg_temp.reconcile();
select is((select severity || '/' || kind from private.glci_issues where issue_key = 'integration:no-lovdata-current-laws'), 'critical/integration_failure',
  'a format change opens a critical integration issue');
select is((select action_type from private.glci_remediation_proposals p join private.glci_issues i on i.id = p.issue_id
  where i.issue_key = 'integration:no-lovdata-current-laws'), 'engineering_task', 'with an engineering task for the agent');
select pg_temp.check('v1');
select pg_temp.check(null, 'UPSTREAM_5XX', 'unreachable');
select pg_temp.check(null, 'UPSTREAM_5XX', 'unreachable');
select pg_temp.check(null, 'UPSTREAM_5XX', 'unreachable');
select pg_temp.reconcile();
select is((select status from private.glci_issues where issue_key = 'unreachable:no-lovdata-current-laws'), 'open', 'three failed checks in a row open an unreachable-source issue');
select is((select status from private.glci_issues where issue_key = 'integration:no-lovdata-current-laws'), 'resolved',
  'the integration issue resolved itself once the source was understood again');
select is((select action_type from private.glci_remediation_proposals p join private.glci_issues i on i.id = p.issue_id
  where i.issue_key = 'lag:no-lovdata-current-laws'), 'resync_source', 'the unprocessed upstream change has a re-sync proposal');

select * from finish();
rollback;
