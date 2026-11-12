-- Phase 8: case management and personal workspace (Master Plan v2.0 Module D, Module H, journey §15.1).
-- Matters with numbers, jurisdiction and category; parties and representatives; links to evidence,
-- research, arguments and documents in the same workspace; tasks with assignees; deadlines and
-- hearings; an append-only procedural history (including communications and notes); a matter
-- chronology combining evidence events, history and deadlines; recorded case exports.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------
create table private.matters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  matter_number text not null check (matter_number ~ '^M-\d{4}-\d{4,6}$'),
  title text not null check (char_length(btrim(title)) between 3 and 300),
  legal_category text not null check (legal_category in ('employment', 'housing', 'consumer', 'family',
    'immigration', 'administrative', 'contract', 'tort', 'criminal', 'other')),
  jurisdiction_code text not null references private.jurisdictions (code) on delete restrict,
  description text check (description is null or char_length(description) <= 10000),
  intake jsonb not null default '{}'::jsonb check (jsonb_typeof(intake) = 'object'),
  status text not null default 'open' check (status in ('open', 'on_hold', 'closed', 'archived')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict,
  unique (workspace_id, matter_number)
);
create index matters_workspace_idx on private.matters (workspace_id, status, updated_at desc);

create table private.matter_parties (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references private.matters (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 300),
  party_role text not null check (party_role in ('client', 'opposing_party', 'representative',
    'opposing_representative', 'witness', 'court', 'authority', 'other')),
  represents_party_id uuid references private.matter_parties (id) on delete restrict,
  contact_note text check (contact_note is null or char_length(contact_note) <= 1000),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now()
);
create index matter_parties_matter_idx on private.matter_parties (matter_id);

create table private.matter_links (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references private.matters (id) on delete restrict,
  link_type text not null check (link_type in ('evidence_item', 'research_run', 'legal_issue', 'legal_document')),
  target_id uuid not null,
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (matter_id, link_type, target_id)
);

create table private.matter_tasks (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references private.matters (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 300),
  description text check (description is null or char_length(description) <= 4000),
  assignee_principal_id uuid references private.principals (id) on delete set null,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'done') = (completed_at is not null))
);
create index matter_tasks_matter_idx on private.matter_tasks (matter_id, status);

create table private.matter_deadlines (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references private.matters (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 300),
  deadline_type text not null check (deadline_type in ('limitation', 'filing', 'response', 'appeal', 'hearing', 'other')),
  due_at timestamptz not null,
  location text check (location is null or char_length(location) <= 300),
  basis text check (basis is null or char_length(basis) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'met', 'missed', 'waived', 'held')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status <> 'held' or deadline_type = 'hearing')
);
create index matter_deadlines_matter_idx on private.matter_deadlines (matter_id, due_at);

-- Procedural history, communications and notes: append-only.
create table private.matter_events (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references private.matters (id) on delete restrict,
  event_type text not null check (event_type in ('created', 'status_changed', 'party_added', 'link_added',
    'task_created', 'task_updated', 'deadline_added', 'deadline_updated', 'note', 'communication',
    'procedural_step', 'exported')),
  occurred_at timestamptz not null default clock_timestamp(),
  summary text not null check (char_length(btrim(summary)) between 1 and 2000),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
create index matter_events_matter_idx on private.matter_events (matter_id, occurred_at);

do $tables$
declare v_table text;
begin
  execute 'create trigger matter_events_append_only before update or delete on private.matter_events
    for each row execute function private.reject_append_only_mutation()';
  execute 'create trigger matter_links_append_only before update or delete on private.matter_links
    for each row execute function private.reject_append_only_mutation()';
  foreach v_table in array array['matters', 'matter_parties', 'matter_links', 'matter_tasks', 'matter_deadlines', 'matter_events'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
  end loop;
end;
$tables$;

-- Matters are retained (archived, never deleted); identity and number never change.
create or replace function private.guard_matter_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Matters are retained' using errcode = '55000'; end if;
  if (new.id, new.organization_id, new.workspace_id, new.matter_number, new.created_by, new.created_at)
     is distinct from (old.id, old.organization_id, old.workspace_id, old.matter_number, old.created_by, old.created_at)
     or old.status = 'archived' then
    raise exception 'Matter identity is immutable and archived matters are read-only' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_matter_update() from public, anon, authenticated;
create trigger matters_guard before update or delete on private.matters
  for each row execute function private.guard_matter_update();

-- ---------------------------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function private.matter_for(p_matter_id uuid, p_permission text)
returns private.matters language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  select * into v_matter from private.matters where id = p_matter_id;
  if not found or private.current_principal_id() is null
    or not private.has_permission(p_permission, v_matter.organization_id, v_matter.workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return v_matter;
end;
$$;
revoke all on function private.matter_for(uuid, text) from public, anon, authenticated;

create or replace function private.matter_writable(p_matter_id uuid)
returns private.matters language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, 'matter.update');
  if v_matter.status in ('closed', 'archived') then
    raise exception 'MATTER_CLOSED' using errcode = '55000';
  end if;
  return v_matter;
end;
$$;
revoke all on function private.matter_writable(uuid) from public, anon, authenticated;

create or replace function private.matter_log(p_matter_id uuid, p_type text, p_summary text, p_detail jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default null)
returns void language sql security definer set search_path = '' as $$
  insert into private.matter_events (matter_id, event_type, occurred_at, summary, detail, created_by)
  values (p_matter_id, p_type, coalesce(p_occurred_at, clock_timestamp()), p_summary, coalesce(p_detail, '{}'::jsonb),
    private.current_principal_id());
$$;
revoke all on function private.matter_log(uuid, text, text, jsonb, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Matter lifecycle
-- ---------------------------------------------------------------------------------------------
create or replace function public.matter_create(
  p_organization_id uuid, p_workspace_id uuid, p_title text, p_legal_category text, p_jurisdiction_code text,
  p_description text default null, p_intake jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_year text := to_char(now(), 'YYYY');
  v_number text;
begin
  if p_organization_id is null or p_workspace_id is null or private.current_principal_id() is null
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission('matter.create', p_organization_id, p_workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if not exists (select 1 from private.jurisdictions where code = p_jurisdiction_code) then
    raise exception 'MATTER_JURISDICTION_UNKNOWN' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_intake, '{}')) <> 'object' or length(coalesce(p_intake, '{}')::text) > 20000 then
    raise exception 'MATTER_INTAKE_INVALID' using errcode = '22023';
  end if;
  -- Sequential numbers per workspace and year, without gaps from concurrent creation.
  perform pg_advisory_xact_lock(hashtextextended('matter-number:' || p_workspace_id::text, 0));
  select format('M-%s-%s', v_year, lpad((count(*) + 1)::text, 4, '0')) into v_number
  from private.matters where workspace_id = p_workspace_id and matter_number like 'M-' || v_year || '-%';
  insert into private.matters (organization_id, workspace_id, matter_number, title, legal_category, jurisdiction_code,
    description, intake, created_by)
  values (p_organization_id, p_workspace_id, v_number, btrim(p_title), p_legal_category, p_jurisdiction_code,
    nullif(btrim(p_description), ''), coalesce(p_intake, '{}'), private.current_principal_id())
  returning id into v_id;
  perform private.matter_log(v_id, 'created', format('Matter %s opened', v_number),
    jsonb_build_object('category', p_legal_category, 'jurisdiction', p_jurisdiction_code));
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'matter.created', 'matter', v_id,
    jsonb_build_object('number', v_number));
  return jsonb_build_object('id', v_id, 'matterNumber', v_number);
end;
$$;

create or replace function public.matter_set_status(p_matter_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, case when p_status = 'archived' then 'matter.archive' else 'matter.update' end);
  if p_status not in ('open', 'on_hold', 'closed', 'archived') or p_status = v_matter.status then
    raise exception 'MATTER_STATUS_INVALID' using errcode = '22023';
  end if;
  if v_matter.status = 'archived' then raise exception 'MATTER_CLOSED' using errcode = '55000'; end if;
  if p_status = 'archived' and v_matter.status <> 'closed' then
    raise exception 'MATTER_STATUS_INVALID' using errcode = '22023';
  end if;
  perform private.matter_log(p_matter_id, 'status_changed', format('Status: %s → %s', v_matter.status, p_status),
    jsonb_build_object('from', v_matter.status, 'to', p_status, 'note', p_note));
  update private.matters set status = p_status, updated_at = now(),
    closed_at = case when p_status in ('closed', 'archived') then coalesce(closed_at, now()) else null end
  where id = p_matter_id;
  perform private.record_evidence_audit(v_matter.organization_id, v_matter.workspace_id, 'matter.status_changed', 'matter',
    p_matter_id, jsonb_build_object('to', p_status));
end;
$$;

create or replace function public.matter_add_party(p_matter_id uuid, p_name text, p_role text,
  p_represents_party_id uuid default null, p_contact_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.matter_writable(p_matter_id);
  if p_represents_party_id is not null and not exists (select 1 from private.matter_parties
    where id = p_represents_party_id and matter_id = p_matter_id) then
    raise exception 'MATTER_PARTY_UNKNOWN' using errcode = '22023';
  end if;
  insert into private.matter_parties (matter_id, name, party_role, represents_party_id, contact_note, created_by)
  values (p_matter_id, btrim(p_name), p_role, p_represents_party_id, nullif(btrim(p_contact_note), ''), private.current_principal_id())
  returning id into v_id;
  perform private.matter_log(p_matter_id, 'party_added', format('%s added as %s', btrim(p_name), replace(p_role, '_', ' ')));
  update private.matters set updated_at = now() where id = p_matter_id;
  return v_id;
end;
$$;

-- Links only to artefacts of the same workspace.
create or replace function public.matter_link(p_matter_id uuid, p_link_type text, p_target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters; v_title text;
begin
  v_matter := private.matter_writable(p_matter_id);
  v_title := case p_link_type
    when 'evidence_item' then (select title from private.evidence_items where id = p_target_id and workspace_id = v_matter.workspace_id and status = 'active')
    when 'research_run' then (select question from private.research_runs where id = p_target_id and workspace_id = v_matter.workspace_id)
    when 'legal_issue' then (select title from private.legal_issues where id = p_target_id and workspace_id = v_matter.workspace_id)
    when 'legal_document' then (select title from private.legal_documents where id = p_target_id and workspace_id = v_matter.workspace_id)
    else null end;
  if v_title is null then raise exception 'MATTER_LINK_OUT_OF_SCOPE' using errcode = '42501'; end if;
  insert into private.matter_links (matter_id, link_type, target_id, created_by)
  values (p_matter_id, p_link_type, p_target_id, private.current_principal_id())
  on conflict do nothing;
  if found then
    perform private.matter_log(p_matter_id, 'link_added', format('Linked %s: %s', replace(p_link_type, '_', ' '), left(v_title, 200)),
      jsonb_build_object('type', p_link_type, 'id', p_target_id));
  end if;
  update private.matters set updated_at = now() where id = p_matter_id;
end;
$$;

create or replace function public.matter_add_task(p_matter_id uuid, p_title text, p_description text default null,
  p_assignee_principal_id uuid default null, p_due_date date default null, p_priority text default 'normal')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters; v_id uuid;
begin
  v_matter := private.matter_writable(p_matter_id);
  -- An assignee must belong to the workspace (or own the organisation).
  if p_assignee_principal_id is not null and not exists (
      select 1 from public.workspace_memberships m where m.workspace_id = v_matter.workspace_id
        and m.principal_id = p_assignee_principal_id and m.status = 'active'
      union all
      select 1 from public.organizations o where o.id = v_matter.organization_id and o.owner_principal_id = p_assignee_principal_id) then
    raise exception 'MATTER_ASSIGNEE_NOT_MEMBER' using errcode = '22023';
  end if;
  insert into private.matter_tasks (matter_id, title, description, assignee_principal_id, due_date, priority, created_by)
  values (p_matter_id, btrim(p_title), nullif(btrim(p_description), ''), p_assignee_principal_id, p_due_date, p_priority,
    private.current_principal_id())
  returning id into v_id;
  perform private.matter_log(p_matter_id, 'task_created', format('Task: %s', btrim(p_title)), jsonb_build_object('taskId', v_id));
  update private.matters set updated_at = now() where id = p_matter_id;
  return v_id;
end;
$$;

create or replace function public.matter_update_task(p_task_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task private.matter_tasks;
begin
  select * into v_task from private.matter_tasks where id = p_task_id;
  if not found then raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.matter_writable(v_task.matter_id);
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'MATTER_STATUS_INVALID' using errcode = '22023';
  end if;
  update private.matter_tasks set status = p_status,
    completed_at = case when p_status = 'done' then now() else null end
  where id = p_task_id;
  perform private.matter_log(v_task.matter_id, 'task_updated', format('Task “%s”: %s', v_task.title, replace(p_status, '_', ' ')),
    jsonb_build_object('taskId', p_task_id, 'status', p_status));
end;
$$;

create or replace function public.matter_add_deadline(p_matter_id uuid, p_title text, p_type text, p_due_at timestamptz,
  p_location text default null, p_basis text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.matter_writable(p_matter_id);
  insert into private.matter_deadlines (matter_id, title, deadline_type, due_at, location, basis, created_by)
  values (p_matter_id, btrim(p_title), p_type, p_due_at, nullif(btrim(p_location), ''), nullif(btrim(p_basis), ''),
    private.current_principal_id())
  returning id into v_id;
  perform private.matter_log(p_matter_id, 'deadline_added',
    format('%s: %s on %s', initcap(replace(p_type, '_', ' ')), btrim(p_title), to_char(p_due_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')),
    jsonb_build_object('deadlineId', v_id));
  update private.matters set updated_at = now() where id = p_matter_id;
  return v_id;
end;
$$;

create or replace function public.matter_update_deadline(p_deadline_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_deadline private.matter_deadlines;
begin
  select * into v_deadline from private.matter_deadlines where id = p_deadline_id;
  if not found then raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.matter_writable(v_deadline.matter_id);
  if p_status not in ('pending', 'met', 'missed', 'waived', 'held') or (p_status = 'held' and v_deadline.deadline_type <> 'hearing') then
    raise exception 'MATTER_STATUS_INVALID' using errcode = '22023';
  end if;
  update private.matter_deadlines set status = p_status where id = p_deadline_id;
  perform private.matter_log(v_deadline.matter_id, 'deadline_updated', format('“%s”: %s', v_deadline.title, p_status),
    jsonb_build_object('deadlineId', p_deadline_id, 'status', p_status));
end;
$$;

create or replace function public.matter_record_event(p_matter_id uuid, p_event_type text, p_summary text,
  p_occurred_at timestamptz default null, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.matter_writable(p_matter_id);
  if p_event_type not in ('note', 'communication', 'procedural_step') then
    raise exception 'MATTER_EVENT_INVALID' using errcode = '22023';
  end if;
  if p_occurred_at is not null and p_occurred_at > now() + interval '1 day' then
    raise exception 'MATTER_EVENT_INVALID' using errcode = '22023';
  end if;
  perform private.matter_log(p_matter_id, p_event_type, btrim(p_summary), coalesce(p_detail, '{}'), p_occurred_at);
  update private.matters set updated_at = now() where id = p_matter_id;
end;
$$;

create or replace function public.matter_record_export(p_matter_id uuid, p_sha256 text, p_files integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, 'matter.read');
  if not private.has_permission('document.export', v_matter.organization_id, v_matter.workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'MATTER_EXPORT_INVALID' using errcode = '22023'; end if;
  perform private.matter_log(p_matter_id, 'exported', 'Case bundle exported',
    jsonb_build_object('sha256', p_sha256, 'files', p_files));
  perform private.record_evidence_audit(v_matter.organization_id, v_matter.workspace_id, 'matter.exported', 'matter',
    p_matter_id, jsonb_build_object('sha256', p_sha256, 'files', p_files));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Reads
-- ---------------------------------------------------------------------------------------------
create or replace function public.matter_get(p_matter_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, 'matter.read');
  return jsonb_build_object(
    'id', v_matter.id, 'organizationId', v_matter.organization_id, 'workspaceId', v_matter.workspace_id,
    'matterNumber', v_matter.matter_number, 'title', v_matter.title, 'legalCategory', v_matter.legal_category,
    'jurisdictionCode', v_matter.jurisdiction_code, 'description', v_matter.description, 'intake', v_matter.intake,
    'status', v_matter.status, 'createdAt', v_matter.created_at, 'closedAt', v_matter.closed_at,
    'canEdit', v_matter.status not in ('closed', 'archived')
      and private.has_permission('matter.update', v_matter.organization_id, v_matter.workspace_id),
    'parties', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'role', p.party_role,
      'representsPartyId', p.represents_party_id, 'contactNote', p.contact_note) order by p.created_at)
      from private.matter_parties p where p.matter_id = v_matter.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('type', l.link_type, 'id', l.target_id,
      'title', case l.link_type
        when 'evidence_item' then (select title from private.evidence_items where id = l.target_id)
        when 'research_run' then (select question from private.research_runs where id = l.target_id)
        when 'legal_issue' then (select title from private.legal_issues where id = l.target_id)
        when 'legal_document' then (select title from private.legal_documents where id = l.target_id) end,
      'status', case l.link_type
        when 'legal_document' then (select status from private.legal_documents where id = l.target_id)
        when 'research_run' then (select status from private.research_runs where id = l.target_id) end)
      order by l.created_at)
      from private.matter_links l where l.matter_id = v_matter.id), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'description', t.description,
      'assigneeName', (select coalesce(pr.display_name, 'Member') from public.user_profiles pr where pr.principal_id = t.assignee_principal_id),
      'dueDate', t.due_date, 'priority', t.priority, 'status', t.status, 'completedAt', t.completed_at)
      order by (t.status in ('done', 'cancelled')), t.due_date nulls last, t.created_at)
      from private.matter_tasks t where t.matter_id = v_matter.id), '[]'::jsonb),
    'deadlines', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'type', d.deadline_type,
      'dueAt', d.due_at, 'location', d.location, 'basis', d.basis, 'status', d.status) order by d.due_at)
      from private.matter_deadlines d where d.matter_id = v_matter.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('type', e.event_type, 'occurredAt', e.occurred_at,
      'summary', e.summary, 'detail', e.detail) order by e.occurred_at desc, e.created_at desc)
      from private.matter_events e where e.matter_id = v_matter.id), '[]'::jsonb),
    -- Chronology: dated events from linked evidence, deadlines and hearings, and recorded steps.
    'chronology', coalesce((select jsonb_agg(c order by c ->> 'date', c ->> 'kind') from (
      select jsonb_build_object('date', ev.event_date::text, 'precision', ev.date_precision, 'kind', 'evidence',
        'description', ev.description, 'source', i.title) as c
      from private.matter_links l join private.evidence_events ev on ev.evidence_item_id = l.target_id
      join private.evidence_items i on i.id = ev.evidence_item_id
      where l.matter_id = v_matter.id and l.link_type = 'evidence_item' and i.status = 'active'
      union all
      select jsonb_build_object('date', to_char(d.due_at at time zone 'UTC', 'YYYY-MM-DD'), 'precision', 'day',
        'kind', d.deadline_type, 'description', d.title || ' (' || d.status || ')', 'source', 'Deadline')
      from private.matter_deadlines d where d.matter_id = v_matter.id
      union all
      select jsonb_build_object('date', to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD'), 'precision', 'day',
        'kind', e.event_type, 'description', e.summary, 'source', 'Matter record')
      from private.matter_events e where e.matter_id = v_matter.id and e.event_type in ('communication', 'procedural_step')
    ) chronology), '[]'::jsonb)
  );
end;
$$;

create or replace function public.matter_list(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not exists (select 1 from public.workspaces
      where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission('matter.read', p_organization_id, p_workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'matterNumber', m.matter_number, 'title', m.title,
    'legalCategory', m.legal_category, 'jurisdictionCode', m.jurisdiction_code, 'status', m.status, 'updatedAt', m.updated_at,
    'openTasks', (select count(*) from private.matter_tasks t where t.matter_id = m.id and t.status in ('open', 'in_progress')),
    'nextDeadline', (select jsonb_build_object('title', d.title, 'dueAt', d.due_at, 'type', d.deadline_type)
      from private.matter_deadlines d where d.matter_id = m.id and d.status = 'pending' order by d.due_at limit 1))
    order by (m.status in ('closed', 'archived')), m.updated_at desc)
    from private.matters m where m.organization_id = p_organization_id and m.workspace_id = p_workspace_id), '[]'::jsonb);
end;
$$;

-- Personal dashboard: pending deadlines (overdue and upcoming), and open tasks assigned to me or to
-- nobody, across the matters I can read.
create or replace function public.matter_my_agenda(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_principal uuid := private.current_principal_id();
begin
  if v_principal is null then raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'deadlines', coalesce((select jsonb_agg(jsonb_build_object('matterId', m.id, 'matterNumber', m.matter_number,
      'matterTitle', m.title, 'title', d.title, 'type', d.deadline_type, 'dueAt', d.due_at, 'overdue', d.due_at < now())
      order by d.due_at)
      from private.matter_deadlines d join private.matters m on m.id = d.matter_id
      where d.status = 'pending' and m.status in ('open', 'on_hold')
        and d.due_at < now() + make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
        and private.has_permission('matter.read', m.organization_id, m.workspace_id)), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('matterId', m.id, 'matterNumber', m.matter_number,
      'title', t.title, 'dueDate', t.due_date, 'priority', t.priority, 'status', t.status,
      'assignedToMe', t.assignee_principal_id = v_principal) order by t.due_date nulls last)
      from private.matter_tasks t join private.matters m on m.id = t.matter_id
      where (t.assignee_principal_id = v_principal or t.assignee_principal_id is null) and t.status in ('open', 'in_progress') and m.status in ('open', 'on_hold')
        and private.has_permission('matter.read', m.organization_id, m.workspace_id)), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.matter_create(uuid, uuid, text, text, text, text, jsonb)',
    'public.matter_set_status(uuid, text, text)',
    'public.matter_add_party(uuid, text, text, uuid, text)',
    'public.matter_link(uuid, text, uuid)',
    'public.matter_add_task(uuid, text, text, uuid, date, text)',
    'public.matter_update_task(uuid, text)',
    'public.matter_add_deadline(uuid, text, text, timestamptz, text, text)',
    'public.matter_update_deadline(uuid, text)',
    'public.matter_record_event(uuid, text, text, timestamptz, jsonb)',
    'public.matter_record_export(uuid, text, integer)',
    'public.matter_get(uuid)',
    'public.matter_list(uuid, uuid)',
    'public.matter_my_agenda(integer)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
