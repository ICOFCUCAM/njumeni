-- Phase 7: document intelligence (Master Plan v2.0 Module E, journey §15.5).
-- Templates with required sections; documents with append-only, content-hashed versions;
-- citations checked by the database (authority passages: existence, source rights, quotation
-- fidelity; evidence: same workspace); a review and approval workflow under draft.* permissions
-- with four-eyes in team organisations; approved versions are locked; exports are recorded.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Templates
-- ---------------------------------------------------------------------------------------------
create table private.document_templates (
  template_key text primary key check (template_key ~ '^[a-z][a-z0-9_]{2,59}$'),
  name text not null check (char_length(name) between 3 and 120),
  document_type text not null,
  version integer not null default 1 check (version >= 1),
  sections jsonb not null check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) between 1 and 40),
  status text not null default 'active' check (status in ('active', 'retired'))
);
alter table private.document_templates enable row level security;
revoke all on private.document_templates from public, anon, authenticated;

insert into private.document_templates (template_key, name, document_type, sections) values
  ('legal_memorandum', 'Legal memorandum', 'memorandum', '[
    {"key":"question","title":"Question presented","required":true,"guidance":"State the legal question and the date the law is applied."},
    {"key":"short_answer","title":"Short answer","required":true,"guidance":"Answer briefly, with its main limitation."},
    {"key":"facts","title":"Facts","required":true,"guidance":"State the facts relied on and their evidence; mark assumptions."},
    {"key":"law","title":"Applicable law","required":true,"guidance":"Quote or cite the verified authorities."},
    {"key":"analysis","title":"Analysis","required":true,"guidance":"Apply the law to the facts, including counterarguments."},
    {"key":"conclusion","title":"Conclusion","required":true,"guidance":"Conclude and list open questions."},
    {"key":"limitations","title":"Limitations","required":true,"guidance":"Disclose coverage limits and uncertainty."}]'),
  ('research_memorandum', 'Research memorandum', 'memorandum', '[
    {"key":"question","title":"Research question","required":true,"guidance":"State the question, jurisdiction and date."},
    {"key":"sources","title":"Sources searched","required":true,"guidance":"List the sources and their coverage."},
    {"key":"findings","title":"Findings","required":true,"guidance":"Verified authorities, with citations."},
    {"key":"conflicts","title":"Conflicting authority","required":false,"guidance":"Authorities pointing the other way."},
    {"key":"limitations","title":"Limitations","required":true,"guidance":"What was not covered."}]'),
  ('legal_letter', 'Legal letter', 'letter', '[
    {"key":"recipient","title":"Recipient","required":true,"guidance":"Name and address."},
    {"key":"subject","title":"Subject","required":true,"guidance":"One line."},
    {"key":"background","title":"Background","required":true,"guidance":"The facts relevant to the request."},
    {"key":"legal_basis","title":"Legal basis","required":true,"guidance":"The rules relied on, with citations."},
    {"key":"request","title":"Request","required":true,"guidance":"What the recipient is asked to do, and by when."},
    {"key":"closing","title":"Closing","required":true,"guidance":"Signature block."}]'),
  ('statement_of_facts', 'Statement of facts', 'statement', '[
    {"key":"parties","title":"Parties","required":true,"guidance":"Who is involved."},
    {"key":"chronology","title":"Chronology","required":true,"guidance":"Dated events with their evidence."},
    {"key":"disputed","title":"Disputed facts","required":false,"guidance":"Facts that are contested, and by whom."},
    {"key":"evidence","title":"Evidence relied on","required":true,"guidance":"Exhibits."}]'),
  ('complaint', 'Complaint', 'complaint', '[
    {"key":"parties","title":"Parties","required":true,"guidance":"Complainant and respondent."},
    {"key":"facts","title":"Facts","required":true,"guidance":"The facts complained of, with evidence."},
    {"key":"legal_basis","title":"Legal basis","required":true,"guidance":"The rules breached, with citations."},
    {"key":"claims","title":"Claims","required":true,"guidance":"What is claimed."},
    {"key":"evidence","title":"Evidence","required":true,"guidance":"Exhibits relied on."}]'),
  ('appeal', 'Appeal', 'appeal', '[
    {"key":"decision","title":"Decision appealed","required":true,"guidance":"Identify the decision and its date."},
    {"key":"grounds","title":"Grounds of appeal","required":true,"guidance":"Each error, with the rule it breaches."},
    {"key":"facts","title":"Relevant facts","required":true,"guidance":"With evidence."},
    {"key":"relief","title":"Relief sought","required":true,"guidance":"What the appeal body is asked to do."},
    {"key":"deadline","title":"Deadline and standing","required":true,"guidance":"Show the appeal is in time and by a party with standing."}]');

-- ---------------------------------------------------------------------------------------------
-- 2. Documents, versions, citations, approvals, exports
-- ---------------------------------------------------------------------------------------------
create table private.legal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  title text not null check (char_length(btrim(title)) between 3 and 300),
  template_key text not null references private.document_templates (template_key) on delete restrict,
  template_version integer not null,
  research_run_id uuid references private.research_runs (id) on delete restrict,
  issue_id uuid references private.legal_issues (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved')),
  current_version integer not null default 0,
  approved_version integer,
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict,
  check (case when status = 'approved' then approved_version = current_version
    else approved_version is null or approved_version < current_version end)
);
create index legal_documents_workspace_idx on private.legal_documents (workspace_id, updated_at desc);

create table private.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references private.legal_documents (id) on delete restrict,
  version_number integer not null check (version_number >= 1),
  sections jsonb not null check (jsonb_typeof(sections) = 'array'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  origin text not null check (origin in ('human', 'agent')),
  ai_execution_id uuid references private.ai_executions (id) on delete restrict,
  change_note text check (change_note is null or char_length(change_note) <= 500),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  unique (document_id, version_number),
  check ((origin = 'agent') = (ai_execution_id is not null))
);

create table private.document_citations (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.document_versions (id) on delete restrict,
  section_key text not null,
  marker integer not null check (marker between 1 and 999),
  authority_passage_id uuid references private.legal_authority_passages (id) on delete restrict,
  evidence_item_id uuid references private.evidence_items (id) on delete restrict,
  quoted_text text check (quoted_text is null or char_length(quoted_text) <= 4000),
  citation_text text not null check (char_length(citation_text) between 1 and 512),
  unique (version_id, marker),
  check ((authority_passage_id is null) <> (evidence_item_id is null))
);

create table private.document_approvals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references private.legal_documents (id) on delete restrict,
  version_number integer not null,
  decision text not null check (decision in ('submitted', 'approved', 'changes_requested', 'withdrawn')),
  note text check (note is null or char_length(note) <= 2000),
  self_review boolean not null default false,
  decided_by uuid references private.principals (id) on delete set null,
  decided_at timestamptz not null default clock_timestamp(),
  check (decision <> 'changes_requested' or char_length(btrim(coalesce(note, ''))) >= 3)
);

create table private.document_exports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references private.legal_documents (id) on delete restrict,
  version_number integer not null,
  format text not null check (format in ('docx', 'pdf')),
  final boolean not null,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  exported_by uuid references private.principals (id) on delete set null,
  exported_at timestamptz not null default clock_timestamp()
);

do $tables$
declare v_table text;
begin
  foreach v_table in array array['document_versions', 'document_citations', 'document_approvals', 'document_exports'] loop
    execute format('create trigger %I before update or delete on private.%I for each row execute function private.reject_append_only_mutation()',
      v_table || '_append_only', v_table);
  end loop;
  foreach v_table in array array['legal_documents', 'document_versions', 'document_citations', 'document_approvals', 'document_exports'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
  end loop;
end;
$tables$;

-- Documents are never deleted; their identity, scope and template never change.
create or replace function private.guard_legal_document_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Legal documents are retained' using errcode = '55000'; end if;
  if (new.id, new.organization_id, new.workspace_id, new.template_key, new.template_version, new.research_run_id,
      new.issue_id, new.created_by, new.created_at)
     is distinct from (old.id, old.organization_id, old.workspace_id, old.template_key, old.template_version,
      old.research_run_id, old.issue_id, old.created_by, old.created_at)
     or new.current_version < old.current_version then
    raise exception 'Document identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_legal_document_update() from public, anon, authenticated;
create trigger legal_documents_guard before update or delete on private.legal_documents
  for each row execute function private.guard_legal_document_update();

-- ---------------------------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_document_scope(p_organization_id uuid, p_workspace_id uuid, p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_organization_id is null or p_workspace_id is null
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or private.current_principal_id() is null
    or not private.has_permission(p_permission, p_organization_id, p_workspace_id) then
    raise exception 'DOCUMENT_NOT_AUTHORISED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_document_scope(uuid, uuid, text) from public, anon, authenticated;

create or replace function private.document_for(p_document_id uuid, p_permission text)
returns private.legal_documents language plpgsql security definer set search_path = '' as $$
declare v_document private.legal_documents;
begin
  select * into v_document from private.legal_documents where id = p_document_id;
  if not found then raise exception 'DOCUMENT_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_document_scope(v_document.organization_id, v_document.workspace_id, p_permission);
  return v_document;
end;
$$;
revoke all on function private.document_for(uuid, text) from public, anon, authenticated;

create or replace function public.document_list_templates()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', template_key, 'name', name, 'documentType', document_type,
    'version', version, 'sections', sections) order by name), '[]'::jsonb)
  from private.document_templates where status = 'active';
$$;

-- Saves a new version. Sections must be the template's sections (in any order, each at most once);
-- citations are verified here, so a client cannot store a fabricated or misquoted authority.
create or replace function private.document_append_version(
  p_document private.legal_documents, p_sections jsonb, p_citations jsonb, p_ai_execution_id uuid, p_change_note text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_template jsonb;
  v_section jsonb;
  v_citation jsonb;
  v_keys text[] := '{}';
  v_clean jsonb := '[]'::jsonb;
  v_version_id uuid;
  v_number integer := p_document.current_version + 1;
  v_passage record;
  v_quote text;
begin
  select sections into v_template from private.document_templates where template_key = p_document.template_key;
  if jsonb_typeof(coalesce(p_sections, 'null')) <> 'array' or jsonb_array_length(p_sections) > 40
    or jsonb_typeof(coalesce(p_citations, '[]')) <> 'array' or jsonb_array_length(coalesce(p_citations, '[]')) > 300 then
    raise exception 'DOCUMENT_CONTENT_INVALID' using errcode = '22023';
  end if;
  for v_section in select value from jsonb_array_elements(p_sections) loop
    if not exists (select 1 from jsonb_array_elements(v_template) t where t ->> 'key' = v_section ->> 'key')
      or (v_section ->> 'key') = any (v_keys)
      or jsonb_typeof(v_section -> 'content') <> 'string'
      or char_length(v_section ->> 'content') > 50000 then
      raise exception 'DOCUMENT_CONTENT_INVALID' using errcode = '22023';
    end if;
    v_keys := v_keys || (v_section ->> 'key');
  end loop;
  -- Store in template order, with titles from the template.
  select coalesce(jsonb_agg(jsonb_build_object('key', t.value ->> 'key', 'title', t.value ->> 'title',
      'content', coalesce((select s ->> 'content' from jsonb_array_elements(p_sections) s where s ->> 'key' = t.value ->> 'key'), ''))
      order by t.ordinality), '[]'::jsonb)
  into v_clean from jsonb_array_elements(v_template) with ordinality as t(value, ordinality);

  if p_ai_execution_id is not null and not exists (select 1 from private.ai_executions
    where id = p_ai_execution_id and workspace_id = p_document.workspace_id and status = 'succeeded' and agent_key = 'drafting') then
    raise exception 'DOCUMENT_EXECUTION_INVALID' using errcode = '22023';
  end if;

  insert into private.document_versions (document_id, version_number, sections, content_hash, origin, ai_execution_id,
    change_note, created_by)
  values (p_document.id, v_number, v_clean, encode(extensions.digest(v_clean::text, 'sha256'), 'hex'),
    case when p_ai_execution_id is null then 'human' else 'agent' end, p_ai_execution_id, nullif(btrim(p_change_note), ''),
    private.current_principal_id())
  returning id into v_version_id;

  for v_citation in select value from jsonb_array_elements(coalesce(p_citations, '[]')) loop
    if not ((v_citation ->> 'section_key') = any (v_keys)) then
      raise exception 'DOCUMENT_CITATION_SECTION_UNKNOWN' using errcode = '22023';
    end if;
    if v_citation ? 'authority_passage_id' then
      select p.content, a.citation, a.jurisdiction_code, s.rights_status, s.status as source_status,
        coalesce((e.permissions ->> 'display')::boolean, false) as display_ok,
        coalesce((e.permissions ->> 'quote')::boolean, false) as quote_ok
      into v_passage
      from private.legal_authority_passages p
      join private.legal_authority_versions v on v.id = p.authority_version_id
      join private.legal_authorities a on a.id = v.authority_id
      join private.legal_sources s on s.id = a.source_id
      left join private.legal_source_rights_evidence e on e.source_id = s.id
      where p.id = (v_citation ->> 'authority_passage_id')::uuid;
      if not found then raise exception 'DOCUMENT_CITATION_NOT_FOUND' using errcode = '22023'; end if;
      if v_passage.rights_status <> 'approved' or v_passage.source_status <> 'active' or not v_passage.display_ok then
        raise exception 'DOCUMENT_CITATION_NOT_PERMITTED' using errcode = '22023';
      end if;
      v_quote := nullif(private.normalise_quotation(v_citation ->> 'quoted_text'), '');
      if v_quote is not null and (not v_passage.quote_ok
        or position(v_quote in private.normalise_quotation(v_passage.content)) = 0) then
        raise exception 'DOCUMENT_QUOTATION_MISMATCH' using errcode = '22023';
      end if;
      insert into private.document_citations (version_id, section_key, marker, authority_passage_id, quoted_text, citation_text)
      values (v_version_id, v_citation ->> 'section_key', (v_citation ->> 'marker')::integer,
        (v_citation ->> 'authority_passage_id')::uuid, v_quote, v_passage.citation);
    elsif v_citation ? 'evidence_item_id' then
      if not exists (select 1 from private.evidence_items where id = (v_citation ->> 'evidence_item_id')::uuid
        and workspace_id = p_document.workspace_id and status = 'active') then
        raise exception 'DOCUMENT_EVIDENCE_OUT_OF_SCOPE' using errcode = '42501';
      end if;
      insert into private.document_citations (version_id, section_key, marker, evidence_item_id, citation_text)
      select v_version_id, v_citation ->> 'section_key', (v_citation ->> 'marker')::integer, i.id, 'Exhibit: ' || i.title
      from private.evidence_items i where i.id = (v_citation ->> 'evidence_item_id')::uuid;
    else
      raise exception 'DOCUMENT_CITATION_INVALID' using errcode = '22023';
    end if;
  end loop;

  update private.legal_documents set current_version = v_number, updated_at = now(),
    status = case when status = 'approved' then 'draft' else status end
  where id = p_document.id;
  return v_number;
end;
$$;
revoke all on function private.document_append_version(private.legal_documents, jsonb, jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.document_create(
  p_organization_id uuid, p_workspace_id uuid, p_title text, p_template_key text,
  p_research_run_id uuid default null, p_issue_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_document private.legal_documents; v_template private.document_templates;
begin
  perform private.require_document_scope(p_organization_id, p_workspace_id, 'draft.create');
  select * into v_template from private.document_templates where template_key = p_template_key and status = 'active';
  if not found then raise exception 'DOCUMENT_TEMPLATE_UNKNOWN' using errcode = '22023'; end if;
  if p_research_run_id is not null and not exists (select 1 from private.research_runs where id = p_research_run_id
    and workspace_id = p_workspace_id and organization_id = p_organization_id) then
    raise exception 'DOCUMENT_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_issue_id is not null and not exists (select 1 from private.legal_issues where id = p_issue_id
    and workspace_id = p_workspace_id and organization_id = p_organization_id) then
    raise exception 'DOCUMENT_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.legal_documents (organization_id, workspace_id, title, template_key, template_version,
    research_run_id, issue_id, created_by)
  values (p_organization_id, p_workspace_id, btrim(p_title), v_template.template_key, v_template.version,
    p_research_run_id, p_issue_id, private.current_principal_id())
  returning * into v_document;
  perform private.document_append_version(v_document,
    (select jsonb_agg(jsonb_build_object('key', t ->> 'key', 'content', '')) from jsonb_array_elements(v_template.sections) t),
    '[]', null, 'Created from template');
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'document.created', 'legal_document', v_document.id,
    jsonb_build_object('template', p_template_key));
  return v_document.id;
end;
$$;

create or replace function public.document_save_version(
  p_document_id uuid, p_expected_version integer, p_sections jsonb, p_citations jsonb default '[]',
  p_ai_execution_id uuid default null, p_change_note text default null
)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_document private.legal_documents; v_number integer;
begin
  v_document := private.document_for(p_document_id, 'draft.update');
  select * into v_document from private.legal_documents where id = p_document_id for update;
  if v_document.status = 'in_review' then
    raise exception 'DOCUMENT_IN_REVIEW' using errcode = '55000';
  end if;
  if p_expected_version is distinct from v_document.current_version then
    raise exception 'DOCUMENT_VERSION_CONFLICT' using errcode = '40001';
  end if;
  v_number := private.document_append_version(v_document, p_sections, p_citations, p_ai_execution_id, p_change_note);
  perform private.record_evidence_audit(v_document.organization_id, v_document.workspace_id, 'document.version_saved',
    'legal_document', v_document.id, jsonb_build_object('version', v_number, 'agent', p_ai_execution_id is not null));
  return v_number;
end;
$$;

create or replace function public.document_submit(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_document private.legal_documents;
begin
  v_document := private.document_for(p_document_id, 'draft.update');
  if v_document.status <> 'draft' then raise exception 'DOCUMENT_STATE_INVALID' using errcode = '55000'; end if;
  update private.legal_documents set status = 'in_review', updated_at = now() where id = p_document_id;
  insert into private.document_approvals (document_id, version_number, decision, decided_by)
  values (p_document_id, v_document.current_version, 'submitted', private.current_principal_id());
  perform private.record_evidence_audit(v_document.organization_id, v_document.workspace_id, 'document.submitted',
    'legal_document', p_document_id, jsonb_build_object('version', v_document.current_version));
end;
$$;

create or replace function public.document_withdraw(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_document private.legal_documents;
begin
  v_document := private.document_for(p_document_id, 'draft.update');
  if v_document.status <> 'in_review' then raise exception 'DOCUMENT_STATE_INVALID' using errcode = '55000'; end if;
  update private.legal_documents set status = 'draft', updated_at = now() where id = p_document_id;
  insert into private.document_approvals (document_id, version_number, decision, decided_by)
  values (p_document_id, v_document.current_version, 'withdrawn', private.current_principal_id());
end;
$$;

-- Approval: draft.approve; four-eyes in team organisations (the author of the submitted version and
-- the submitter cannot approve); required sections must be filled.
create or replace function public.document_decide(p_document_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_document private.legal_documents;
  v_principal uuid := private.current_principal_id();
  v_personal boolean;
  v_involved boolean;
  v_missing text[];
begin
  v_document := private.document_for(p_document_id, case when p_decision = 'approved' then 'draft.approve' else 'draft.review' end);
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'DOCUMENT_DECISION_INVALID' using errcode = '22023';
  end if;
  if v_document.status <> 'in_review' then raise exception 'DOCUMENT_STATE_INVALID' using errcode = '55000'; end if;
  select kind = 'personal' into v_personal from public.organizations where id = v_document.organization_id;
  select exists (select 1 from private.document_versions where document_id = p_document_id
      and version_number = v_document.current_version and created_by = v_principal)
    or exists (select 1 from private.document_approvals where document_id = p_document_id
      and version_number = v_document.current_version and decision = 'submitted' and decided_by = v_principal)
  into v_involved;
  if v_involved and not coalesce(v_personal, false) then
    raise exception 'DOCUMENT_FOUR_EYES_REQUIRED' using errcode = '42501';
  end if;
  if p_decision = 'approved' then
    select array_agg(t ->> 'title') into v_missing
    from private.document_versions dv, jsonb_array_elements((select sections from private.document_templates
      where template_key = v_document.template_key)) t
    where dv.document_id = p_document_id and dv.version_number = v_document.current_version
      and (t ->> 'required')::boolean
      and char_length(btrim(coalesce((select s ->> 'content' from jsonb_array_elements(dv.sections) s
        where s ->> 'key' = t ->> 'key'), ''))) = 0;
    if v_missing is not null then
      raise exception 'DOCUMENT_REQUIRED_SECTIONS_MISSING' using errcode = '23514',
        detail = array_to_string(v_missing, ', ');
    end if;
  end if;
  insert into private.document_approvals (document_id, version_number, decision, note, self_review, decided_by)
  values (p_document_id, v_document.current_version, p_decision, nullif(btrim(p_note), ''), v_involved, v_principal);
  update private.legal_documents
  set status = case when p_decision = 'approved' then 'approved' else 'draft' end,
    approved_version = case when p_decision = 'approved' then v_document.current_version else approved_version end,
    updated_at = now()
  where id = p_document_id;
  perform private.record_evidence_audit(v_document.organization_id, v_document.workspace_id, 'document.' || p_decision,
    'legal_document', p_document_id, jsonb_build_object('version', v_document.current_version, 'selfReview', v_involved));
end;
$$;

create or replace function public.document_get(p_document_id uuid, p_version integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_document private.legal_documents; v_version private.document_versions;
begin
  v_document := private.document_for(p_document_id, 'document.read');
  select * into v_version from private.document_versions where document_id = p_document_id
    and version_number = coalesce(p_version, v_document.current_version);
  if not found then raise exception 'DOCUMENT_VERSION_UNKNOWN' using errcode = '22023'; end if;
  return jsonb_build_object(
    'id', v_document.id, 'organizationId', v_document.organization_id, 'workspaceId', v_document.workspace_id,
    'title', v_document.title, 'status', v_document.status, 'currentVersion', v_document.current_version,
    'approvedVersion', v_document.approved_version, 'researchRunId', v_document.research_run_id, 'issueId', v_document.issue_id,
    'template', (select jsonb_build_object('key', template_key, 'name', name, 'version', version, 'sections', sections)
      from private.document_templates where template_key = v_document.template_key),
    'version', jsonb_build_object('number', v_version.version_number, 'sections', v_version.sections,
      'contentHash', v_version.content_hash, 'origin', v_version.origin, 'changeNote', v_version.change_note,
      'createdAt', v_version.created_at),
    'citations', coalesce((select jsonb_agg(jsonb_build_object('sectionKey', c.section_key, 'marker', c.marker,
      'citation', c.citation_text, 'quotedText', c.quoted_text, 'authorityPassageId', c.authority_passage_id,
      'evidenceItemId', c.evidence_item_id, 'sourceUri', coalesce(av.source_uri, a.canonical_uri),
      'validFrom', av.valid_from, 'validUntil', av.valid_until) order by c.marker)
      from private.document_citations c
      left join private.legal_authority_passages p on p.id = c.authority_passage_id
      left join private.legal_authority_versions av on av.id = p.authority_version_id
      left join private.legal_authorities a on a.id = av.authority_id
      where c.version_id = v_version.id), '[]'::jsonb),
    'versions', (select jsonb_agg(jsonb_build_object('number', version_number, 'origin', origin, 'changeNote', change_note,
      'contentHash', content_hash, 'createdAt', created_at) order by version_number desc)
      from private.document_versions where document_id = p_document_id),
    'approvals', coalesce((select jsonb_agg(jsonb_build_object('version', version_number, 'decision', decision, 'note', note,
      'selfReview', self_review, 'decidedAt', decided_at) order by decided_at desc)
      from private.document_approvals where document_id = p_document_id), '[]'::jsonb),
    'canEdit', private.has_permission('draft.update', v_document.organization_id, v_document.workspace_id),
    'canApprove', private.has_permission('draft.approve', v_document.organization_id, v_document.workspace_id));
end;
$$;

create or replace function public.document_list(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_document_scope(p_organization_id, p_workspace_id, 'document.read');
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'status', d.status,
    'currentVersion', d.current_version, 'approvedVersion', d.approved_version, 'template', t.name, 'updatedAt', d.updated_at)
    order by d.updated_at desc)
    from private.legal_documents d join private.document_templates t on t.template_key = d.template_key
    where d.organization_id = p_organization_id and d.workspace_id = p_workspace_id), '[]'::jsonb);
end;
$$;

create or replace function public.document_record_export(p_document_id uuid, p_version integer, p_format text, p_sha256 text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_document private.legal_documents; v_final boolean;
begin
  v_document := private.document_for(p_document_id, 'document.export');
  if not exists (select 1 from private.document_versions where document_id = p_document_id and version_number = p_version) then
    raise exception 'DOCUMENT_VERSION_UNKNOWN' using errcode = '22023';
  end if;
  v_final := v_document.status = 'approved' and v_document.approved_version = p_version;
  insert into private.document_exports (document_id, version_number, format, final, file_sha256, exported_by)
  values (p_document_id, p_version, p_format, v_final, p_sha256, private.current_principal_id());
  perform private.record_evidence_audit(v_document.organization_id, v_document.workspace_id, 'document.exported',
    'legal_document', p_document_id, jsonb_build_object('version', p_version, 'format', p_format, 'final', v_final, 'sha256', p_sha256));
  return v_final;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.document_list_templates()',
    'public.document_create(uuid, uuid, text, text, uuid, uuid)',
    'public.document_save_version(uuid, integer, jsonb, jsonb, uuid, text)',
    'public.document_submit(uuid)',
    'public.document_withdraw(uuid)',
    'public.document_decide(uuid, text, text)',
    'public.document_get(uuid, integer)',
    'public.document_list(uuid, uuid)',
    'public.document_record_export(uuid, integer, text, text)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
