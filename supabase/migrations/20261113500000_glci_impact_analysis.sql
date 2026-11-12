-- GLCI-04: legal change impact analysis (docs/GLCI_SPECIFICATION.md §2 engine 3, §3 step 3).
--
-- For every legal change that is news (not a baseline), Njumeni records which of its own records
-- depend on the changed text, with the dependency path that connects them:
--   passage → research finding / research claim → research run → legal document / legal issue
--   → matter (matter_links), and evidence linked to the passage; plus the legal graph: authorities
--   that cite or amend the changed authority.
-- Which passages count as "changed": an amendment's amended, removed and renumbered sections
-- (their passages in the previous version); a withdrawal: every passage of the latest version.
-- Severity: high when the text relied on was amended, removed or withdrawn, or a verified claim
-- quotes it; medium for dependent authorities; low for renumbering (same text, new label).
-- Impacts are append-only evidence. Analysis runs automatically when a change is detected (at commit), and
-- operators can re-run it (idempotent).

create table private.glci_change_impacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.glci_change_events(id) on delete restrict,
  impact_type text not null check (impact_type in ('research_finding', 'research_claim', 'research_run', 'legal_document',
    'legal_issue', 'matter', 'evidence_link', 'dependent_authority')),
  subject_id uuid not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  severity text not null check (severity in ('high', 'medium', 'low')),
  section_key text,
  dependency_path jsonb not null check (jsonb_typeof(dependency_path) = 'array'),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  analysed_at timestamptz not null default now(),
  unique (event_id, impact_type, subject_id)
);
create index glci_change_impacts_event_idx on private.glci_change_impacts(event_id, severity);
create index glci_change_impacts_org_idx on private.glci_change_impacts(organization_id);
create index glci_change_impacts_ws_idx on private.glci_change_impacts(workspace_id);
create index glci_change_impacts_subject_idx on private.glci_change_impacts(impact_type, subject_id);
alter table private.glci_change_impacts enable row level security;
revoke all on private.glci_change_impacts from public, anon, authenticated;
grant select on private.glci_change_impacts to service_role;
create trigger glci_change_impacts_append_only before update or delete on private.glci_change_impacts
  for each row execute function private.reject_append_only_mutation();

-- The passages whose text a change affects, with the section and the kind of change.
create or replace function private.glci_changed_passages(p_event_id uuid)
returns table (passage_id uuid, section_key text, change text)
language sql stable security definer set search_path = '' as $$
  select unnest(s.old_passage_ids), coalesce(s.previous_section_key, s.section_key), s.change
  from private.glci_change_sections s where s.event_id = p_event_id and s.change in ('amended', 'removed', 'renumbered')
  union
  select p.id, coalesce(nullif(array_to_string(p.section_path, ' > '), ''), 'ordinal:' || p.ordinal), 'withdrawn'
  from private.glci_change_events e join private.legal_authority_passages p on p.authority_version_id = e.from_version_id
  where e.id = p_event_id and e.change_type = 'withdrawn'
$$;
revoke all on function private.glci_changed_passages(uuid) from public, anon, authenticated;

create or replace function private.glci_analyse_change(p_event_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_event private.glci_change_events;
  v_before integer;
  v_after integer;
begin
  select * into v_event from private.glci_change_events where id = p_event_id;
  if v_event.id is null then raise exception 'GLCI_CHANGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_event.is_baseline or v_event.change_type not in ('amended', 'withdrawn') then return 0; end if;
  select count(*) into v_before from private.glci_change_impacts where event_id = p_event_id;

  -- Research findings that retrieved the changed text.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, section_key, dependency_path, detail)
  select p_event_id, 'research_finding', f.id, r.organization_id, r.workspace_id,
    case when c.change = 'renumbered' then 'low' else 'high' end, c.section_key,
    jsonb_build_array(jsonb_build_object('passage', c.passage_id), jsonb_build_object('researchFinding', f.id), jsonb_build_object('researchRun', r.id)),
    jsonb_build_object('change', c.change, 'rank', f.rank)
  from private.glci_changed_passages(p_event_id) c join private.research_findings f on f.passage_id = c.passage_id
  join private.research_runs r on r.id = f.run_id
  on conflict do nothing;

  -- Claims that cite (and may quote) the changed text: high unless only renumbered.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, section_key, dependency_path, detail)
  select p_event_id, 'research_claim', k.id, r.organization_id, r.workspace_id,
    case when c.change = 'renumbered' then 'low' else 'high' end, c.section_key,
    jsonb_build_array(jsonb_build_object('passage', c.passage_id), jsonb_build_object('researchClaim', k.id), jsonb_build_object('researchRun', r.id)),
    jsonb_build_object('change', c.change, 'category', k.category, 'verificationStatus', k.verification_status)
  from private.glci_changed_passages(p_event_id) c join private.research_claims k on k.cited_passage_id = c.passage_id
  join private.research_runs r on r.id = k.run_id
  on conflict do nothing;

  -- Each affected research run once, at the highest severity of its findings and claims.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, dependency_path, detail)
  select p_event_id, 'research_run', (i.dependency_path -> 2 ->> 'researchRun')::uuid, min(i.organization_id::text)::uuid, min(i.workspace_id::text)::uuid,
    case when bool_or(i.severity = 'high') then 'high' else 'low' end,
    jsonb_build_array(jsonb_build_object('changeEvent', p_event_id), jsonb_build_object('researchRun', (i.dependency_path -> 2 ->> 'researchRun')::uuid)),
    jsonb_build_object('findings', count(*) filter (where i.impact_type = 'research_finding'),
      'claims', count(*) filter (where i.impact_type = 'research_claim'))
  from private.glci_change_impacts i where i.event_id = p_event_id and i.impact_type in ('research_finding', 'research_claim')
  group by (i.dependency_path -> 2 ->> 'researchRun')
  on conflict do nothing;

  -- Documents and legal issues built on an affected run.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, dependency_path, detail)
  select p_event_id, 'legal_document', d.id, d.organization_id, d.workspace_id, i.severity,
    jsonb_build_array(jsonb_build_object('researchRun', i.subject_id), jsonb_build_object('legalDocument', d.id)),
    jsonb_build_object('title', d.title, 'status', d.status)
  from private.glci_change_impacts i join private.legal_documents d on d.research_run_id = i.subject_id
  where i.event_id = p_event_id and i.impact_type = 'research_run'
  on conflict do nothing;
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, dependency_path, detail)
  select p_event_id, 'legal_issue', l.id, l.organization_id, l.workspace_id, i.severity,
    jsonb_build_array(jsonb_build_object('researchRun', i.subject_id), jsonb_build_object('legalIssue', l.id)),
    jsonb_build_object('title', l.title)
  from private.glci_change_impacts i join private.legal_issues l on l.research_run_id = i.subject_id
  where i.event_id = p_event_id and i.impact_type = 'research_run'
  on conflict do nothing;

  -- Matters linked to any affected run, document or issue.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, dependency_path, detail)
  select p_event_id, 'matter', m.id, m.organization_id, m.workspace_id,
    case when bool_or(i.severity = 'high') then 'high' else 'low' end,
    jsonb_build_array(jsonb_build_object('linkedRecords', jsonb_agg(jsonb_build_object(i.impact_type, i.subject_id))), jsonb_build_object('matter', m.id)),
    jsonb_build_object('title', m.title)
  from private.glci_change_impacts i
  join private.matter_links ml on ml.target_id = i.subject_id
    and ml.link_type = case i.impact_type when 'research_run' then 'research_run' when 'legal_document' then 'legal_document' when 'legal_issue' then 'legal_issue' end
  join private.matters m on m.id = ml.matter_id
  where i.event_id = p_event_id and i.impact_type in ('research_run', 'legal_document', 'legal_issue')
  group by m.id, m.organization_id, m.workspace_id, m.title
  on conflict do nothing;

  -- Evidence explicitly linked to the changed text.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, organization_id, workspace_id, severity, section_key, dependency_path, detail)
  select p_event_id, 'evidence_link', e.id, ei.organization_id, ei.workspace_id, case when c.change = 'renumbered' then 'low' else 'high' end,
    c.section_key,
    jsonb_build_array(jsonb_build_object('passage', c.passage_id), jsonb_build_object('evidencePropositionLink', e.id),
      jsonb_build_object('evidenceItem', ei.id)),
    jsonb_build_object('change', c.change, 'relation', e.relation)
  from private.glci_changed_passages(p_event_id) c join private.evidence_proposition_links e on e.passage_id = c.passage_id
  join private.evidence_items ei on ei.id = e.evidence_item_id
  on conflict do nothing;

  -- The legal graph: authorities that cite or amend the changed authority depend on it.
  insert into private.glci_change_impacts (event_id, impact_type, subject_id, severity, dependency_path, detail)
  select p_event_id, 'dependent_authority', rel.from_authority_id, 'medium',
    jsonb_build_array(jsonb_build_object('authority', rel.from_authority_id), jsonb_build_object(rel.relationship_type, v_event.authority_id)),
    jsonb_build_object('relationshipType', rel.relationship_type, 'citation', a.citation, 'title', a.title)
  from private.legal_authority_relationships rel join private.legal_authorities a on a.id = rel.from_authority_id
  where rel.to_authority_id = v_event.authority_id
  on conflict do nothing;

  select count(*) into v_after from private.glci_change_impacts where event_id = p_event_id;
  if v_after > v_before then
    perform private.glci_audit('impact.analysed', 'change_event', p_event_id::text,
      jsonb_build_object('impacts', v_after, 'high', (select count(*) from private.glci_change_impacts where event_id = p_event_id and severity = 'high')),
      'system');
  end if;
  return v_after;
end;
$$;
revoke all on function private.glci_analyse_change(uuid) from public, anon, authenticated;

create or replace function private.glci_on_change_detected()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_analyse_change(new.id);
  return null;
end;
$$;
revoke all on function private.glci_on_change_detected() from public, anon, authenticated;
-- Deferred to commit: the detector writes the event first and its section differences after it.
create constraint trigger glci_change_events_analyse after insert on private.glci_change_events deferrable initially deferred
  for each row when (not new.is_baseline and new.change_type in ('amended', 'withdrawn'))
  execute function private.glci_on_change_detected();

-- ------------------------------------------------------------------ operator API
create or replace function public.glci_reanalyse_change(p_event_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return private.glci_analyse_change(p_event_id);
end;
$$;

create or replace function public.glci_change_impacts(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return jsonb_build_object(
    'summary', (select jsonb_object_agg(t.impact_type, t.n) from (select impact_type, count(*) as n from private.glci_change_impacts
      where event_id = p_event_id group by impact_type) t),
    'organizationsAffected', (select count(distinct organization_id) from private.glci_change_impacts where event_id = p_event_id),
    'impacts', coalesce((select jsonb_agg(jsonb_build_object('impactType', i.impact_type, 'subjectId', i.subject_id, 'severity', i.severity,
        'sectionKey', i.section_key, 'organizationId', i.organization_id, 'workspaceId', i.workspace_id,
        'dependencyPath', i.dependency_path, 'detail', i.detail) order by i.severity, i.impact_type)
      from private.glci_change_impacts i where i.event_id = p_event_id), '[]'::jsonb));
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_reanalyse_change(uuid)', 'public.glci_change_impacts(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
