-- Phase 9: professional workspace (Master Plan v2.0 Module I, Module M, journey §15.2, U-16).
-- Clients; configurable conflict checks that gate matter opening; information barriers that exclude
-- named people from a matter whatever their role (exclusion overrides grant); matter team
-- assignments; organisation knowledge with explicit, permissioned and audited promotion from matter
-- work; organisation document templates; professional reporting.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Permissions and organisation settings
-- ---------------------------------------------------------------------------------------------
insert into private.permission_catalog (permission_key, scope, description) values
  ('client.read', 'organization', 'Read the organisation client register'),
  ('client.manage', 'organization', 'Create and update clients'),
  ('conflict.check', 'organization', 'Run and decide conflict checks across the organisation'),
  ('knowledge.read', 'organization', 'Read published organisation knowledge'),
  ('knowledge.publish', 'organization', 'Promote work into organisation knowledge and retire it'),
  ('template.manage', 'organization', 'Create organisation document templates')
on conflict (permission_key) do nothing;
insert into private.role_permissions (role_key, permission_key) values
  ('org_admin', 'client.read'), ('org_admin', 'client.manage'), ('org_admin', 'conflict.check'),
  ('org_admin', 'knowledge.read'), ('org_admin', 'knowledge.publish'), ('org_admin', 'template.manage'),
  ('org_member', 'client.read'), ('org_member', 'conflict.check'), ('org_member', 'knowledge.read')
on conflict do nothing;

create table private.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  require_conflict_check boolean not null,
  conflict_check_validity_days integer not null default 30 check (conflict_check_validity_days between 1 and 365),
  updated_by uuid references private.principals (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table private.organization_settings enable row level security;
revoke all on private.organization_settings from public, anon, authenticated;

-- Firms check conflicts by default; individuals do not.
create or replace function private.conflict_check_required(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select require_conflict_check from private.organization_settings where organization_id = p_organization_id),
    (select kind in ('law_firm', 'enterprise') from public.organizations where id = p_organization_id), false);
$$;
revoke all on function private.conflict_check_required(uuid) from public, anon, authenticated;

create or replace function public.organization_update_settings(p_organization_id uuid, p_require_conflict_check boolean,
  p_validity_days integer default 30)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission('organization.update', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.organization_settings (organization_id, require_conflict_check, conflict_check_validity_days, updated_by)
  values (p_organization_id, p_require_conflict_check, coalesce(p_validity_days, 30), private.current_principal_id())
  on conflict (organization_id) do update set require_conflict_check = excluded.require_conflict_check,
    conflict_check_validity_days = excluded.conflict_check_validity_days, updated_by = excluded.updated_by, updated_at = now();
  perform private.record_evidence_audit(p_organization_id, null, 'organization.settings_updated', 'organization', p_organization_id,
    jsonb_build_object('requireConflictCheck', p_require_conflict_check));
end;
$$;

create or replace function public.organization_get_settings(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission('organization.read', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object('requireConflictCheck', private.conflict_check_required(p_organization_id),
    'validityDays', coalesce((select conflict_check_validity_days from private.organization_settings where organization_id = p_organization_id), 30),
    'canUpdate', private.has_permission('organization.update', p_organization_id, null));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Clients
-- ---------------------------------------------------------------------------------------------
create table private.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 300),
  client_kind text not null check (client_kind in ('individual', 'organisation')),
  identifier text check (identifier is null or char_length(identifier) <= 60),
  contact_note text check (contact_note is null or char_length(contact_note) <= 2000),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now()
);
create index clients_org_idx on private.clients (organization_id, lower(name));
alter table private.clients enable row level security;
revoke all on private.clients from public, anon, authenticated;

alter table private.matters add column client_id uuid references private.clients (id) on delete restrict;
alter table private.matters add column conflict_check_id uuid;

create or replace function public.client_create(p_organization_id uuid, p_name text, p_kind text,
  p_identifier text default null, p_contact_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if private.current_principal_id() is null or not private.has_permission('client.manage', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.clients (organization_id, name, client_kind, identifier, contact_note, created_by)
  values (p_organization_id, btrim(p_name), p_kind, nullif(btrim(p_identifier), ''), nullif(btrim(p_contact_note), ''),
    private.current_principal_id())
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, null, 'client.created', 'client', v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Information barriers (U-16): exclusion overrides grant
-- ---------------------------------------------------------------------------------------------
create table private.matter_barriers (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references private.matters (id) on delete restrict,
  principal_id uuid not null references private.principals (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (matter_id, principal_id)
);
alter table private.matter_barriers enable row level security;
revoke all on private.matter_barriers from public, anon, authenticated;
create trigger matter_barriers_append_only before update or delete on private.matter_barriers
  for each row execute function private.reject_append_only_mutation();

create or replace function private.matter_barred(p_matter_id uuid, p_principal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.matter_barriers where matter_id = p_matter_id and principal_id = p_principal_id);
$$;
revoke all on function private.matter_barred(uuid, uuid) from public, anon, authenticated;

-- Every matter function goes through matter_for, so a barrier applies everywhere.
create or replace function private.matter_for(p_matter_id uuid, p_permission text)
returns private.matters language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters; v_principal uuid := private.current_principal_id();
begin
  select * into v_matter from private.matters where id = p_matter_id;
  if not found or v_principal is null
    or private.matter_barred(p_matter_id, v_principal)
    or not private.has_permission(p_permission, v_matter.organization_id, v_matter.workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return v_matter;
end;
$$;
revoke all on function private.matter_for(uuid, text) from public, anon, authenticated;

create or replace function public.matter_add_barrier(p_matter_id uuid, p_principal_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, 'workspace.manage_members');
  if p_principal_id = private.current_principal_id() then
    raise exception 'MATTER_BARRIER_SELF' using errcode = '22023';
  end if;
  if not exists (select 1 from private.principals where id = p_principal_id) then
    raise exception 'MATTER_BARRIER_INVALID' using errcode = '22023';
  end if;
  insert into private.matter_barriers (matter_id, principal_id, reason, created_by)
  values (p_matter_id, p_principal_id, btrim(p_reason), private.current_principal_id())
  on conflict (matter_id, principal_id) do nothing;
  -- A barred person loses any assignment on the matter.
  delete from private.matter_assignments where matter_id = p_matter_id and principal_id = p_principal_id;
  perform private.matter_log(p_matter_id, 'procedural_step', 'Information barrier added', jsonb_build_object('reason', btrim(p_reason)));
  perform private.record_evidence_audit(v_matter.organization_id, v_matter.workspace_id, 'matter.barrier_added', 'matter', p_matter_id,
    jsonb_build_object('principal', p_principal_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Matter team
-- ---------------------------------------------------------------------------------------------
create table private.matter_assignments (
  matter_id uuid not null references private.matters (id) on delete restrict,
  principal_id uuid not null references private.principals (id) on delete restrict,
  assignment_role text not null check (assignment_role in ('responsible_lawyer', 'team_member', 'supervisor')),
  assigned_by uuid references private.principals (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (matter_id, principal_id)
);
alter table private.matter_assignments enable row level security;
revoke all on private.matter_assignments from public, anon, authenticated;

create or replace function public.matter_assign(p_matter_id uuid, p_principal_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_writable(p_matter_id);
  if private.matter_barred(p_matter_id, p_principal_id) then
    raise exception 'MATTER_ASSIGNEE_BARRED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspace_memberships where workspace_id = v_matter.workspace_id
      and principal_id = p_principal_id and status = 'active')
    and not exists (select 1 from public.organizations where id = v_matter.organization_id and owner_principal_id = p_principal_id) then
    raise exception 'MATTER_ASSIGNEE_NOT_MEMBER' using errcode = '22023';
  end if;
  insert into private.matter_assignments (matter_id, principal_id, assignment_role, assigned_by)
  values (p_matter_id, p_principal_id, p_role, private.current_principal_id())
  on conflict (matter_id, principal_id) do update set assignment_role = excluded.assignment_role,
    assigned_by = excluded.assigned_by, assigned_at = now();
  perform private.matter_log(p_matter_id, 'procedural_step', format('Team: %s', replace(p_role, '_', ' ')),
    jsonb_build_object('principal', p_principal_id, 'role', p_role));
end;
$$;

-- Workspace members a matter can be assigned to (excluding barred people), with display names.
create or replace function public.matter_team_candidates(p_matter_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, 'matter.read');
  return coalesce((select jsonb_agg(jsonb_build_object('principalId', c.principal_id, 'name', c.name,
      'assignment', (select assignment_role from private.matter_assignments a where a.matter_id = p_matter_id and a.principal_id = c.principal_id),
      'barred', private.matter_barred(p_matter_id, c.principal_id)) order by c.name)
    from (
      select m.principal_id, coalesce(p.display_name, 'Member') as name from public.workspace_memberships m
      left join public.user_profiles p on p.principal_id = m.principal_id
      where m.workspace_id = v_matter.workspace_id and m.status = 'active'
      union
      select o.owner_principal_id, coalesce(p.display_name, 'Owner') from public.organizations o
      left join public.user_profiles p on p.principal_id = o.owner_principal_id where o.id = v_matter.organization_id
    ) c), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Conflict checks
-- ---------------------------------------------------------------------------------------------
create table private.conflict_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  workspace_id uuid not null,
  subject text not null check (char_length(btrim(subject)) between 3 and 300),
  searched_names text[] not null check (cardinality(searched_names) between 1 and 30),
  hits jsonb not null check (jsonb_typeof(hits) = 'array'),
  decision text not null default 'pending' check (decision in ('pending', 'clear', 'conflict', 'waived')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  run_by uuid references private.principals (id) on delete set null,
  run_at timestamptz not null default now(),
  decided_by uuid references private.principals (id) on delete set null,
  decided_at timestamptz,
  used_by_matter_id uuid references private.matters (id) on delete restrict,
  check (decision <> 'waived' or char_length(btrim(coalesce(decision_note, ''))) >= 10),
  check ((decision = 'pending') = (decided_at is null))
);
alter table private.conflict_checks enable row level security;
revoke all on private.conflict_checks from public, anon, authenticated;

-- A decided check can only gain the matter it was used for.
create or replace function private.guard_conflict_check_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Conflict checks are retained' using errcode = '55000'; end if;
  if (new.id, new.organization_id, new.workspace_id, new.subject, new.searched_names, new.hits, new.run_by, new.run_at)
     is distinct from (old.id, old.organization_id, old.workspace_id, old.subject, old.searched_names, old.hits, old.run_by, old.run_at)
     or (old.decision <> 'pending' and (new.decision, new.decision_note, new.decided_by, new.decided_at)
       is distinct from (old.decision, old.decision_note, old.decided_by, old.decided_at))
     or (old.used_by_matter_id is not null and new.used_by_matter_id is distinct from old.used_by_matter_id) then
    raise exception 'Conflict checks are immutable once decided' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_conflict_check_update() from public, anon, authenticated;
create trigger conflict_checks_guard before update or delete on private.conflict_checks
  for each row execute function private.guard_conflict_check_update();

create or replace function private.normalise_name(p_name text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(lower(normalize(coalesce(p_name, ''), NFKC)),
    '\m(as|asa|ab|ltd|limited|inc|llc|gmbh|sa|sarl|plc|da|ans|ks)\M|[^[:alnum:] ]', ' ', 'g'), '\s+', ' ', 'g'));
$$;
revoke all on function private.normalise_name(text) from public, anon, authenticated;

-- Searches clients and matter parties across the whole organisation. Results reveal only what a
-- conflict decision needs (name, role, matter number and status), not matter content.
create or replace function public.conflict_check_run(p_organization_id uuid, p_workspace_id uuid, p_subject text, p_names text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_hits jsonb; v_terms text[];
begin
  if private.current_principal_id() is null or not private.has_permission('conflict.check', p_organization_id, null)
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  select array_agg(distinct private.normalise_name(n)) into v_terms from unnest(p_names) n
  where char_length(private.normalise_name(n)) >= 2;
  if v_terms is null or cardinality(v_terms) > 30 then raise exception 'CONFLICT_NAMES_INVALID' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(h order by h ->> 'name'), '[]'::jsonb) into v_hits from (
    select distinct jsonb_build_object('name', c.name, 'source', 'client', 'role', 'client',
      'matterNumber', null, 'matterStatus', null, 'matched', t) as h
    from private.clients c, unnest(v_terms) t
    where c.organization_id = p_organization_id
      and (private.normalise_name(c.name) = t or position(t in private.normalise_name(c.name)) > 0
        or (char_length(private.normalise_name(c.name)) >= 4 and position(private.normalise_name(c.name) in t) > 0))
    union
    select distinct jsonb_build_object('name', p.name, 'source', 'matter_party', 'role', p.party_role,
      'matterNumber', m.matter_number, 'matterStatus', m.status, 'matched', t)
    from private.matter_parties p join private.matters m on m.id = p.matter_id, unnest(v_terms) t
    where m.organization_id = p_organization_id
      and (private.normalise_name(p.name) = t or position(t in private.normalise_name(p.name)) > 0
        or (char_length(private.normalise_name(p.name)) >= 4 and position(private.normalise_name(p.name) in t) > 0))
  ) hits;
  insert into private.conflict_checks (organization_id, workspace_id, subject, searched_names, hits, run_by)
  values (p_organization_id, p_workspace_id, btrim(p_subject), p_names, v_hits, private.current_principal_id())
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'conflict.checked', 'conflict_check', v_id,
    jsonb_build_object('names', cardinality(v_terms), 'hits', jsonb_array_length(v_hits)));
  return v_id;
end;
$$;

-- Decisions: no hits → clear; hits → conflict, or waived with a recorded justification
-- (waivers need organisation authority and cannot be granted by the person who ran the check
-- in a team organisation).
create or replace function public.conflict_check_decide(p_check_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_check private.conflict_checks; v_personal boolean;
begin
  select * into v_check from private.conflict_checks where id = p_check_id;
  if not found or private.current_principal_id() is null
    or not private.has_permission('conflict.check', v_check.organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if v_check.decision <> 'pending' then raise exception 'CONFLICT_ALREADY_DECIDED' using errcode = '55000'; end if;
  if p_decision not in ('clear', 'conflict', 'waived')
    or (p_decision = 'clear' and jsonb_array_length(v_check.hits) > 0) then
    raise exception 'CONFLICT_DECISION_INVALID' using errcode = '22023';
  end if;
  if p_decision = 'waived' then
    select kind = 'personal' into v_personal from public.organizations where id = v_check.organization_id;
    if not private.has_permission('organization.update', v_check.organization_id, null)
      or (v_check.run_by = private.current_principal_id() and not coalesce(v_personal, false)) then
      raise exception 'CONFLICT_WAIVER_NOT_AUTHORISED' using errcode = '42501';
    end if;
  end if;
  update private.conflict_checks set decision = p_decision, decision_note = nullif(btrim(p_note), ''),
    decided_by = private.current_principal_id(), decided_at = now()
  where id = p_check_id;
  perform private.record_evidence_audit(v_check.organization_id, v_check.workspace_id, 'conflict.decided', 'conflict_check', p_check_id,
    jsonb_build_object('decision', p_decision));
end;
$$;

create or replace function public.conflict_check_list(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission('conflict.check', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'workspaceId', c.workspace_id, 'subject', c.subject,
    'names', to_jsonb(c.searched_names), 'hits', c.hits, 'decision', c.decision, 'decisionNote', c.decision_note,
    'runAt', c.run_at, 'decidedAt', c.decided_at, 'ranByMe', c.run_by = private.current_principal_id(),
    'usedByMatter', (select matter_number from private.matters where id = c.used_by_matter_id)) order by c.run_at desc)
    from private.conflict_checks c where c.organization_id = p_organization_id), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Matter opening with conflict checks (replaces Phase 8 matter_create)
-- ---------------------------------------------------------------------------------------------
create or replace function private.matter_insert(
  p_organization_id uuid, p_workspace_id uuid, p_title text, p_legal_category text, p_jurisdiction_code text,
  p_description text, p_intake jsonb, p_client_id uuid, p_conflict_check_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_year text := to_char(now(), 'YYYY'); v_number text;
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
  if p_client_id is not null and not exists (select 1 from private.clients where id = p_client_id
    and organization_id = p_organization_id and status = 'active') then
    raise exception 'MATTER_CLIENT_UNKNOWN' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('matter-number:' || p_workspace_id::text, 0));
  select format('M-%s-%s', v_year, lpad((count(*) + 1)::text, 4, '0')) into v_number
  from private.matters where workspace_id = p_workspace_id and matter_number like 'M-' || v_year || '-%';
  insert into private.matters (organization_id, workspace_id, matter_number, title, legal_category, jurisdiction_code,
    description, intake, client_id, conflict_check_id, created_by)
  values (p_organization_id, p_workspace_id, v_number, btrim(p_title), p_legal_category, p_jurisdiction_code,
    nullif(btrim(p_description), ''), coalesce(p_intake, '{}'), p_client_id, p_conflict_check_id, private.current_principal_id())
  returning id into v_id;
  perform private.matter_log(v_id, 'created', format('Matter %s opened', v_number),
    jsonb_build_object('category', p_legal_category, 'jurisdiction', p_jurisdiction_code, 'conflictCheck', p_conflict_check_id));
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'matter.created', 'matter', v_id,
    jsonb_build_object('number', v_number));
  return jsonb_build_object('id', v_id, 'matterNumber', v_number);
end;
$$;
revoke all on function private.matter_insert(uuid, uuid, text, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;

create or replace function public.matter_create(
  p_organization_id uuid, p_workspace_id uuid, p_title text, p_legal_category text, p_jurisdiction_code text,
  p_description text default null, p_intake jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if private.conflict_check_required(p_organization_id) then
    raise exception 'MATTER_CONFLICT_CHECK_REQUIRED' using errcode = '55000';
  end if;
  return private.matter_insert(p_organization_id, p_workspace_id, p_title, p_legal_category, p_jurisdiction_code,
    p_description, p_intake, null, null);
end;
$$;

create or replace function public.matter_open_checked(
  p_organization_id uuid, p_workspace_id uuid, p_title text, p_legal_category text, p_jurisdiction_code text,
  p_conflict_check_id uuid, p_client_id uuid default null, p_description text default null, p_intake jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_check private.conflict_checks; v_validity integer; v_result jsonb;
begin
  select * into v_check from private.conflict_checks where id = p_conflict_check_id for update;
  select coalesce((select conflict_check_validity_days from private.organization_settings where organization_id = p_organization_id), 30)
  into v_validity;
  if not found or v_check.organization_id <> p_organization_id or v_check.workspace_id <> p_workspace_id then
    raise exception 'MATTER_CONFLICT_CHECK_INVALID' using errcode = '22023';
  end if;
  if v_check.decision not in ('clear', 'waived') or v_check.used_by_matter_id is not null
    or v_check.decided_at < now() - make_interval(days => v_validity) then
    raise exception 'MATTER_CONFLICT_CHECK_INVALID' using errcode = '22023';
  end if;
  v_result := private.matter_insert(p_organization_id, p_workspace_id, p_title, p_legal_category, p_jurisdiction_code,
    p_description, p_intake, p_client_id, p_conflict_check_id);
  update private.conflict_checks set used_by_matter_id = (v_result ->> 'id')::uuid where id = p_conflict_check_id;
  if p_client_id is not null then
    insert into private.matter_parties (matter_id, name, party_role, created_by)
    select (v_result ->> 'id')::uuid, name, 'client', private.current_principal_id() from private.clients where id = p_client_id;
  end if;
  return v_result;
end;
$$;

-- Barred matters disappear from lists and agendas.
create or replace function public.matter_list(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_principal uuid := private.current_principal_id();
begin
  if v_principal is null or not exists (select 1 from public.workspaces
      where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission('matter.read', p_organization_id, p_workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'matterNumber', m.matter_number, 'title', m.title,
    'legalCategory', m.legal_category, 'jurisdictionCode', m.jurisdiction_code, 'status', m.status, 'updatedAt', m.updated_at,
    'client', (select name from private.clients where id = m.client_id),
    'openTasks', (select count(*) from private.matter_tasks t where t.matter_id = m.id and t.status in ('open', 'in_progress')),
    'nextDeadline', (select jsonb_build_object('title', d.title, 'dueAt', d.due_at, 'type', d.deadline_type)
      from private.matter_deadlines d where d.matter_id = m.id and d.status = 'pending' order by d.due_at limit 1))
    order by (m.status in ('closed', 'archived')), m.updated_at desc)
    from private.matters m where m.organization_id = p_organization_id and m.workspace_id = p_workspace_id
      and not private.matter_barred(m.id, v_principal)), '[]'::jsonb);
end;
$$;

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
        and not private.matter_barred(m.id, v_principal)
        and private.has_permission('matter.read', m.organization_id, m.workspace_id)), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('matterId', m.id, 'matterNumber', m.matter_number,
      'title', t.title, 'dueDate', t.due_date, 'priority', t.priority, 'status', t.status,
      'assignedToMe', t.assignee_principal_id = v_principal) order by t.due_date nulls last)
      from private.matter_tasks t join private.matters m on m.id = t.matter_id
      where (t.assignee_principal_id = v_principal or t.assignee_principal_id is null) and t.status in ('open', 'in_progress')
        and m.status in ('open', 'on_hold') and not private.matter_barred(m.id, v_principal)
        and private.has_permission('matter.read', m.organization_id, m.workspace_id)), '[]'::jsonb));
end;
$$;

-- Matter details for professionals: client, team and barriers.
create or replace function public.matter_professional(p_matter_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_matter private.matters;
begin
  v_matter := private.matter_for(p_matter_id, 'matter.read');
  return jsonb_build_object(
    'client', (select jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.client_kind) from private.clients c where c.id = v_matter.client_id),
    'conflictCheck', (select jsonb_build_object('id', k.id, 'decision', k.decision, 'decidedAt', k.decided_at, 'hits', jsonb_array_length(k.hits))
      from private.conflict_checks k where k.id = v_matter.conflict_check_id),
    'team', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(p.display_name, 'Member'), 'role', a.assignment_role)
      order by a.assignment_role, p.display_name)
      from private.matter_assignments a left join public.user_profiles p on p.principal_id = a.principal_id
      where a.matter_id = p_matter_id), '[]'::jsonb),
    'barrierCount', (select count(*) from private.matter_barriers where matter_id = p_matter_id),
    'canManageBarriers', private.has_permission('workspace.manage_members', v_matter.organization_id, v_matter.workspace_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Organisation knowledge (Module M)
-- ---------------------------------------------------------------------------------------------
create or replace function private.tags_text(p_tags text[])
returns text language sql immutable set search_path = '' as $$
  select coalesce(array_to_string(p_tags, ' '), '');
$$;
revoke all on function private.tags_text(text[]) from public, anon, authenticated;

create table private.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  kind text not null check (kind in ('saved_research', 'precedent', 'opinion', 'approved_argument', 'note', 'template_guidance')),
  title text not null check (char_length(btrim(title)) between 3 and 300),
  body text not null check (char_length(btrim(body)) between 1 and 50000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  source_type text check (source_type in ('research_run', 'legal_document', 'legal_issue')),
  source_id uuid,
  source_workspace_id uuid,
  version integer not null default 1,
  status text not null default 'published' check (status in ('published', 'retired')),
  review_due date,
  published_by uuid references private.principals (id) on delete set null,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  search tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || private.tags_text(tags))) stored
);
create index knowledge_items_search_idx on private.knowledge_items using gin (search);
alter table private.knowledge_items enable row level security;
revoke all on private.knowledge_items from public, anon, authenticated;

-- Promotion is explicit: a snapshot of approved work, never live client data. The publisher must be
-- able to read the source and hold knowledge.publish; the act is audited.
create or replace function public.knowledge_publish(p_organization_id uuid, p_kind text, p_title text, p_body text,
  p_tags text[] default '{}', p_source_type text default null, p_source_id uuid default null, p_review_due date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_source_ws uuid;
begin
  if private.current_principal_id() is null or not private.has_permission('knowledge.publish', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_source_type is not null then
    v_source_ws := case p_source_type
      when 'research_run' then (select workspace_id from private.research_runs where id = p_source_id and organization_id = p_organization_id and status = 'answered')
      when 'legal_document' then (select workspace_id from private.legal_documents where id = p_source_id and organization_id = p_organization_id and status = 'approved')
      when 'legal_issue' then (select workspace_id from private.legal_issues where id = p_source_id and organization_id = p_organization_id) end;
    if v_source_ws is null or not private.has_permission('research.read', p_organization_id, v_source_ws) then
      raise exception 'KNOWLEDGE_SOURCE_INVALID' using errcode = '22023';
    end if;
  end if;
  insert into private.knowledge_items (organization_id, kind, title, body, tags, source_type, source_id, source_workspace_id,
    review_due, published_by)
  values (p_organization_id, p_kind, btrim(p_title), btrim(p_body),
    coalesce((select array_agg(distinct lower(btrim(t))) from unnest(p_tags) t where char_length(btrim(t)) between 1 and 40), '{}'),
    p_source_type, p_source_id, v_source_ws, p_review_due, private.current_principal_id())
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, null, 'knowledge.published', 'knowledge_item', v_id,
    jsonb_build_object('kind', p_kind, 'sourceType', p_source_type, 'sourceId', p_source_id));
  return v_id;
end;
$$;

create or replace function public.knowledge_retire(p_item_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item private.knowledge_items;
begin
  select * into v_item from private.knowledge_items where id = p_item_id;
  if not found or private.current_principal_id() is null or not private.has_permission('knowledge.publish', v_item.organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  update private.knowledge_items set status = 'retired', retired_at = now() where id = p_item_id and status = 'published';
  perform private.record_evidence_audit(v_item.organization_id, null, 'knowledge.retired', 'knowledge_item', p_item_id);
end;
$$;

create or replace function public.knowledge_search(p_organization_id uuid, p_query text default null, p_kind text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_query tsquery;
begin
  if private.current_principal_id() is null or not private.has_permission('knowledge.read', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if nullif(btrim(p_query), '') is not null then v_query := websearch_to_tsquery('simple', left(p_query, 300)); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'kind', k.kind, 'title', k.title,
    'excerpt', left(k.body, 300), 'tags', to_jsonb(k.tags), 'publishedAt', k.published_at, 'reviewDue', k.review_due,
    'reviewOverdue', k.review_due is not null and k.review_due < current_date, 'sourceType', k.source_type)
    order by case when v_query is null then 0 else -ts_rank(k.search, v_query) end, k.published_at desc)
    from private.knowledge_items k
    where k.organization_id = p_organization_id and k.status = 'published'
      and (p_kind is null or k.kind = p_kind) and (v_query is null or k.search @@ v_query)), '[]'::jsonb);
end;
$$;

create or replace function public.knowledge_get(p_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_item private.knowledge_items;
begin
  select * into v_item from private.knowledge_items where id = p_item_id;
  if not found or private.current_principal_id() is null or not private.has_permission('knowledge.read', v_item.organization_id, null)
    or (v_item.status = 'retired' and not private.has_permission('knowledge.publish', v_item.organization_id, null)) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object('id', v_item.id, 'organizationId', v_item.organization_id, 'kind', v_item.kind, 'title', v_item.title,
    'body', v_item.body, 'tags', to_jsonb(v_item.tags), 'status', v_item.status, 'reviewDue', v_item.review_due,
    'publishedAt', v_item.published_at, 'sourceType', v_item.source_type,
    -- The source link is shown only to people who can read the source workspace.
    'sourceId', case when v_item.source_workspace_id is not null
      and private.has_permission('research.read', v_item.organization_id, v_item.source_workspace_id) then v_item.source_id end,
    'canRetire', private.has_permission('knowledge.publish', v_item.organization_id, null));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Organisation templates
-- ---------------------------------------------------------------------------------------------
alter table private.document_templates add column organization_id uuid references public.organizations (id) on delete restrict;

create or replace function public.document_template_create(p_organization_id uuid, p_name text, p_document_type text, p_sections jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare v_key text; v_section jsonb; v_keys text[] := '{}';
begin
  if private.current_principal_id() is null or not private.has_permission('template.manage', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) not between 1 and 40 then
    raise exception 'TEMPLATE_INVALID' using errcode = '22023';
  end if;
  for v_section in select value from jsonb_array_elements(p_sections) loop
    if coalesce(v_section ->> 'key', '') !~ '^[a-z][a-z0-9_]{1,39}$' or (v_section ->> 'key') = any (v_keys)
      or char_length(btrim(coalesce(v_section ->> 'title', ''))) not between 1 and 120
      or jsonb_typeof(coalesce(v_section -> 'required', 'false')) <> 'boolean' then
      raise exception 'TEMPLATE_INVALID' using errcode = '22023';
    end if;
    v_keys := v_keys || (v_section ->> 'key');
  end loop;
  v_key := 'org_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) || '_'
    || left(trim(both '_' from regexp_replace(lower(p_name), '[^a-z0-9]+', '_', 'g')), 30);
  insert into private.document_templates (template_key, name, document_type, sections, organization_id)
  values (v_key, btrim(p_name), coalesce(nullif(btrim(p_document_type), ''), 'custom'),
    (select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'title', btrim(s ->> 'title'),
      'required', coalesce((s ->> 'required')::boolean, false), 'guidance', left(coalesce(s ->> 'guidance', ''), 500)))
     from jsonb_array_elements(p_sections) s),
    p_organization_id);
  perform private.record_evidence_audit(p_organization_id, null, 'template.created', 'document_template', null,
    jsonb_build_object('key', v_key));
  return v_key;
end;
$$;

create or replace function public.document_templates_for(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.has_permission('organization.read', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', template_key, 'name', name, 'documentType', document_type,
    'version', version, 'sections', sections, 'organisation', organization_id is not null) order by organization_id nulls first, name)
    from private.document_templates where status = 'active' and (organization_id is null or organization_id = p_organization_id)), '[]'::jsonb);
end;
$$;

-- Global templates stay public; organisation templates are visible only inside their organisation.
create or replace function public.document_list_templates()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', template_key, 'name', name, 'documentType', document_type,
    'version', version, 'sections', sections) order by name), '[]'::jsonb)
  from private.document_templates where status = 'active' and organization_id is null;
$$;

-- A template must be a system template or belong to the document's organisation.
create or replace function private.guard_document_template_scope()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from private.document_templates where template_key = new.template_key
    and organization_id is not null and organization_id <> new.organization_id) then
    raise exception 'DOCUMENT_TEMPLATE_UNKNOWN' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_document_template_scope() from public, anon, authenticated;
create trigger legal_documents_template_scope before insert on private.legal_documents
  for each row execute function private.guard_document_template_scope();

-- ---------------------------------------------------------------------------------------------
-- 9. Professional reporting
-- ---------------------------------------------------------------------------------------------
create or replace function public.professional_report(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_principal uuid := private.current_principal_id();
begin
  if v_principal is null or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or not private.has_permission('matter.read', p_organization_id, p_workspace_id) then
    raise exception 'MATTER_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'mattersByStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from private.matters
      where workspace_id = p_workspace_id and not private.matter_barred(id, v_principal) group by status) s), '{}'::jsonb),
    'mattersByCategory', coalesce((select jsonb_object_agg(legal_category, n) from (select legal_category, count(*) n from private.matters
      where workspace_id = p_workspace_id and status in ('open', 'on_hold') and not private.matter_barred(id, v_principal) group by legal_category) s), '{}'::jsonb),
    'overdueDeadlines', (select count(*) from private.matter_deadlines d join private.matters m on m.id = d.matter_id
      where m.workspace_id = p_workspace_id and d.status = 'pending' and d.due_at < now() and not private.matter_barred(m.id, v_principal)),
    'deadlinesNext14Days', (select count(*) from private.matter_deadlines d join private.matters m on m.id = d.matter_id
      where m.workspace_id = p_workspace_id and d.status = 'pending' and d.due_at between now() and now() + interval '14 days'
        and not private.matter_barred(m.id, v_principal)),
    'openTasks', (select count(*) from private.matter_tasks t join private.matters m on m.id = t.matter_id
      where m.workspace_id = p_workspace_id and t.status in ('open', 'in_progress') and not private.matter_barred(m.id, v_principal)),
    'documentsInReview', (select count(*) from private.legal_documents where workspace_id = p_workspace_id and status = 'in_review'),
    'documentsApproved', (select count(*) from private.legal_documents where workspace_id = p_workspace_id and status = 'approved'),
    'pendingReviews', (select count(*) from private.review_requests where workspace_id = p_workspace_id and status = 'pending'),
    'researchRuns30Days', (select count(*) from private.research_runs where workspace_id = p_workspace_id and created_at > now() - interval '30 days'),
    'aiExecutions30Days', (select count(*) from private.ai_executions where workspace_id = p_workspace_id and created_at > now() - interval '30 days'));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 10. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.organization_update_settings(uuid, boolean, integer)',
    'public.organization_get_settings(uuid)',
    'public.client_create(uuid, text, text, text, text)',
    'public.matter_add_barrier(uuid, uuid, text)',
    'public.matter_assign(uuid, uuid, text)',
    'public.matter_team_candidates(uuid)',
    'public.conflict_check_run(uuid, uuid, text, text[])',
    'public.conflict_check_decide(uuid, text, text)',
    'public.conflict_check_list(uuid)',
    'public.matter_open_checked(uuid, uuid, text, text, text, uuid, uuid, text, jsonb)',
    'public.matter_professional(uuid)',
    'public.knowledge_publish(uuid, text, text, text, text[], text, uuid, date)',
    'public.knowledge_retire(uuid)',
    'public.knowledge_search(uuid, text, text)',
    'public.knowledge_get(uuid)',
    'public.document_template_create(uuid, text, text, jsonb)',
    'public.document_templates_for(uuid)',
    'public.professional_report(uuid, uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;

-- A client list for the conflict and client pages.
create or replace function public.client_list(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_principal uuid := private.current_principal_id();
begin
  if v_principal is null or not private.has_permission('client.read', p_organization_id, null) then
    raise exception 'PROFESSIONAL_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.client_kind,
    'identifier', c.identifier, 'status', c.status,
    'matters', (select count(*) from private.matters m where m.client_id = c.id and not private.matter_barred(m.id, v_principal)))
    order by lower(c.name))
    from private.clients c where c.organization_id = p_organization_id), '[]'::jsonb);
end;
$$;
revoke all on function public.client_list(uuid) from public, anon;
grant execute on function public.client_list(uuid) to authenticated, service_role;
