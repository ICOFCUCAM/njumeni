-- Phase 1.7: scoped role catalogue, permission evaluator and role bindings.
-- Customer-facing role and permission mutations are restricted to narrow RPCs.

create table private.permission_catalog (
  permission_key text primary key,
  scope text not null check (scope in ('organization', 'workspace')),
  description text not null,
  created_at timestamptz not null default now()
);

create table private.role_catalog (
  role_key text primary key,
  scope text not null check (scope in ('organization', 'workspace')),
  display_name text not null,
  description text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.role_permissions (
  role_key text not null references private.role_catalog(role_key) on delete restrict,
  permission_key text not null references private.permission_catalog(permission_key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table private.organization_role_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  principal_id uuid not null references private.principals(id) on delete restrict,
  role_key text not null references private.role_catalog(role_key) on delete restrict,
  assigned_by_principal_id uuid not null references private.principals(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint organization_role_binding_role_scope
    check (role_key in ('org_admin', 'org_member', 'org_billing_manager', 'org_auditor')),
  unique (organization_id, principal_id, role_key)
);

create index organization_role_bindings_principal_idx
  on private.organization_role_bindings (principal_id, organization_id);
create index organization_role_bindings_org_role_idx
  on private.organization_role_bindings (organization_id, role_key);

create table private.workspace_role_bindings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  principal_id uuid not null references private.principals(id) on delete restrict,
  role_key text not null references private.role_catalog(role_key) on delete restrict,
  assigned_by_principal_id uuid not null references private.principals(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint workspace_role_binding_role_scope
    check (role_key in ('workspace_manager', 'workspace_editor', 'workspace_reviewer', 'workspace_viewer')),
  unique (workspace_id, principal_id, role_key)
);

create index workspace_role_bindings_principal_idx
  on private.workspace_role_bindings (principal_id, workspace_id);
create index workspace_role_bindings_workspace_role_idx
  on private.workspace_role_bindings (workspace_id, role_key);

create table private.role_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_principal_id uuid references private.principals(id) on delete set null,
  target_principal_id uuid references private.principals(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  role_key text,
  action text not null check (action in ('assigned', 'revoked')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index role_audit_events_org_time_idx
  on private.role_audit_events (organization_id, occurred_at desc);
create index role_audit_events_target_time_idx
  on private.role_audit_events (target_principal_id, occurred_at desc);

create or replace function private.record_role_binding_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid;
  v_target uuid;
  v_organization uuid;
  v_workspace uuid;
  v_role text;
  v_action text;
begin
  v_actor := private.current_principal_id();

  if tg_op = 'INSERT' then
    v_target := new.principal_id;
    v_role := new.role_key;
    v_action := 'assigned';
    if tg_table_name = 'organization_role_bindings' then
      v_organization := new.organization_id;
    else
      v_workspace := new.workspace_id;
      select workspace.organization_id into v_organization
      from public.workspaces as workspace
      where workspace.id = new.workspace_id;
    end if;
  else
    v_target := old.principal_id;
    v_role := old.role_key;
    v_action := 'revoked';
    if tg_table_name = 'organization_role_bindings' then
      v_organization := old.organization_id;
    else
      v_workspace := old.workspace_id;
      select workspace.organization_id into v_organization
      from public.workspaces as workspace
      where workspace.id = old.workspace_id;
    end if;
  end if;

  insert into private.role_audit_events (
    actor_principal_id, target_principal_id, organization_id,
    workspace_id, role_key, action
  )
  values (v_actor, v_target, v_organization, v_workspace, v_role, v_action);

  return coalesce(new, old);
end;
$;

revoke all on function private.record_role_binding_event() from public, anon, authenticated;

create trigger organization_role_bindings_record_event
  after insert or delete on private.organization_role_bindings
  for each row execute function private.record_role_binding_event();

create trigger workspace_role_bindings_record_event
  after insert or delete on private.workspace_role_bindings
  for each row execute function private.record_role_binding_event();

alter table private.permission_catalog enable row level security;
alter table private.role_catalog enable row level security;
alter table private.role_permissions enable row level security;
alter table private.organization_role_bindings enable row level security;
alter table private.workspace_role_bindings enable row level security;
alter table private.role_audit_events enable row level security;

revoke all on private.permission_catalog, private.role_catalog, private.role_permissions,
  private.organization_role_bindings, private.workspace_role_bindings, private.role_audit_events
  from public, anon, authenticated;

insert into private.permission_catalog (permission_key, scope, description) values
  ('profile.read_own', 'organization', 'Read the authenticated principal own profile'),
  ('profile.update_own', 'organization', 'Update the authenticated principal own profile'),
  ('organization.read', 'organization', 'Read organisation context and metadata'),
  ('organization.update', 'organization', 'Update organisation metadata'),
  ('organization.manage_members', 'organization', 'Invite, suspend and revoke organisation members'),
  ('organization.manage_roles', 'organization', 'Assign and revoke permitted organisation roles'),
  ('organization.manage_workspaces', 'organization', 'Create and administer workspaces in the organisation'),
  ('workspace.create', 'organization', 'Create a workspace in the organisation'),
  ('workspace.read', 'workspace', 'Read a workspace and its permitted content'),
  ('workspace.update', 'workspace', 'Update workspace metadata'),
  ('workspace.manage_members', 'workspace', 'Manage membership in a workspace'),
  ('workspace.manage_roles', 'workspace', 'Assign and revoke permitted workspace roles'),
  ('matter.create', 'workspace', 'Create a matter in a workspace'),
  ('matter.read', 'workspace', 'Read matters in a workspace'),
  ('matter.update', 'workspace', 'Update matters in a workspace'),
  ('matter.archive', 'workspace', 'Archive matters in a workspace'),
  ('matter.delete', 'workspace', 'Delete matters in a workspace'),
  ('document.upload', 'workspace', 'Upload documents to a workspace'),
  ('document.read', 'workspace', 'Read documents in a workspace'),
  ('document.annotate', 'workspace', 'Annotate documents in a workspace'),
  ('document.export', 'workspace', 'Export documents from a workspace'),
  ('document.delete', 'workspace', 'Delete documents in a workspace'),
  ('evidence.manage', 'workspace', 'Manage evidence records in a workspace'),
  ('research.create', 'workspace', 'Create legal research in a workspace'),
  ('research.read', 'workspace', 'Read legal research in a workspace'),
  ('research.share', 'workspace', 'Share legal research within permitted scope'),
  ('research.export', 'workspace', 'Export legal research from a workspace'),
  ('argument.manage', 'workspace', 'Manage structured legal arguments in a workspace'),
  ('draft.create', 'workspace', 'Create legal drafts in a workspace'),
  ('draft.update', 'workspace', 'Update legal drafts in a workspace'),
  ('draft.review', 'workspace', 'Review legal drafts in a workspace'),
  ('draft.approve', 'workspace', 'Approve legal drafts in a workspace'),
  ('draft.publish', 'workspace', 'Publish approved legal drafts'),
  ('audit.read', 'organization', 'Read permitted organisation audit records'),
  ('billing.read', 'organization', 'Read organisation billing information'),
  ('billing.manage', 'organization', 'Manage organisation billing settings')
on conflict (permission_key) do nothing;

insert into private.role_catalog (role_key, scope, display_name, description) values
  ('org_admin', 'organization', 'Organisation administrator', 'Administers organisation metadata, members, invitations, workspaces and limited role assignment; cannot transfer ownership or grant privileged organisation roles.'),
  ('org_member', 'organization', 'Organisation member', 'Reads organisation context; workspace access requires separate active workspace membership.'),
  ('org_billing_manager', 'organization', 'Billing manager', 'Manages billing context without matter or document access.'),
  ('org_auditor', 'organization', 'Organisation auditor', 'Reads permitted organisation audit records without mutation authority.'),
  ('workspace_manager', 'workspace', 'Workspace manager', 'Administers a workspace and its members and roles.'),
  ('workspace_editor', 'workspace', 'Workspace editor', 'Creates and edits matters, documents, evidence, research and drafts.'),
  ('workspace_reviewer', 'workspace', 'Workspace reviewer', 'Reads workspace material and reviews drafts and arguments.'),
  ('workspace_viewer', 'workspace', 'Workspace viewer', 'Read-only access to explicitly assigned workspace material.')
on conflict (role_key) do nothing;

insert into private.role_permissions (role_key, permission_key)
select 'org_admin', permission_key
from private.permission_catalog
where permission_key in (
  'organization.read', 'organization.update', 'organization.manage_members',
  'organization.manage_roles', 'organization.manage_workspaces', 'workspace.create',
  'workspace.update', 'workspace.manage_members', 'workspace.manage_roles'
)
on conflict do nothing;

insert into private.role_permissions (role_key, permission_key) values
  ('org_member', 'organization.read'),
  ('org_billing_manager', 'organization.read'),
  ('org_billing_manager', 'billing.read'),
  ('org_billing_manager', 'billing.manage'),
  ('org_auditor', 'organization.read'),
  ('org_auditor', 'audit.read')
on conflict do nothing;

insert into private.role_permissions (role_key, permission_key)
select 'workspace_manager', permission_key
from private.permission_catalog
where permission_key in (
  'workspace.read', 'workspace.update', 'workspace.manage_members', 'workspace.manage_roles',
  'matter.create', 'matter.read', 'matter.update', 'matter.archive', 'matter.delete',
  'document.upload', 'document.read', 'document.annotate', 'document.export', 'document.delete',
  'evidence.manage', 'research.create', 'research.read', 'research.share', 'research.export',
  'argument.manage', 'draft.create', 'draft.update', 'draft.review', 'draft.approve'
)
on conflict do nothing;

insert into private.role_permissions (role_key, permission_key)
select 'workspace_editor', permission_key
from private.permission_catalog
where permission_key in (
  'workspace.read', 'matter.create', 'matter.read', 'matter.update',
  'document.upload', 'document.read', 'document.annotate', 'evidence.manage',
  'research.create', 'research.read', 'research.share', 'research.export',
  'argument.manage', 'draft.create', 'draft.update'
)
on conflict do nothing;

insert into private.role_permissions (role_key, permission_key) values
  ('workspace_reviewer', 'workspace.read'),
  ('workspace_reviewer', 'matter.read'),
  ('workspace_reviewer', 'document.read'),
  ('workspace_reviewer', 'research.read'),
  ('workspace_reviewer', 'argument.manage'),
  ('workspace_reviewer', 'draft.review'),
  ('workspace_viewer', 'workspace.read'),
  ('workspace_viewer', 'matter.read'),
  ('workspace_viewer', 'document.read'),
  ('workspace_viewer', 'research.read')
on conflict do nothing;

create or replace function private.has_permission(
  p_permission_key text,
  p_organization_id uuid,
  p_workspace_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_principal_id uuid;
  v_organization_id uuid;
  v_owner_principal_id uuid;
  v_permission_scope text;
begin
  v_principal_id := private.current_principal_id();
  if v_principal_id is null or p_permission_key is null then
    return false;
  end if;

  select permission.scope
    into v_permission_scope
  from private.permission_catalog as permission
  where permission.permission_key = p_permission_key;

  if v_permission_scope is null then
    return false;
  end if;

  v_organization_id := p_organization_id;
  if p_workspace_id is not null then
    select workspace.organization_id
      into v_organization_id
    from public.workspaces as workspace
    where workspace.id = p_workspace_id
      and workspace.status = 'active';

    if v_organization_id is null
       or (p_organization_id is not null and p_organization_id <> v_organization_id)
       or v_permission_scope <> 'workspace' then
      return false;
    end if;
  elsif v_permission_scope = 'workspace' then
    return false;
  end if;

  if v_organization_id is null then
    return false;
  end if;

  select organization.owner_principal_id
    into v_owner_principal_id
  from public.organizations as organization
  where organization.id = v_organization_id
    and organization.status = 'active';

  if v_owner_principal_id is null then
    return false;
  end if;

  if v_owner_principal_id = v_principal_id then
    return true;
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = v_organization_id
      and membership.principal_id = v_principal_id
      and membership.status = 'active'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from private.organization_role_bindings as binding
    join private.role_permissions as grant_row
      on grant_row.role_key = binding.role_key
    where binding.organization_id = v_organization_id
      and binding.principal_id = v_principal_id
      and grant_row.permission_key = p_permission_key
  ) then
    return true;
  end if;

  if p_workspace_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.principal_id = v_principal_id
      and membership.status = 'active'
  ) then
    return false;
  end if;

  return exists (
    select 1
    from private.workspace_role_bindings as binding
    join private.role_permissions as grant_row
      on grant_row.role_key = binding.role_key
    where binding.workspace_id = p_workspace_id
      and binding.principal_id = v_principal_id
      and grant_row.permission_key = p_permission_key
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function private.has_permission(text, uuid, uuid) from public, anon, authenticated;
grant execute on function private.has_permission(text, uuid, uuid) to authenticated;

create or replace function private.can_assign_role(
  p_role_key text,
  p_organization_id uuid,
  p_workspace_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_principal_id uuid;
  v_owner_principal_id uuid;
begin
  v_principal_id := private.current_principal_id();
  if v_principal_id is null then
    return false;
  end if;

  select organization.owner_principal_id
    into v_owner_principal_id
  from public.organizations as organization
  where organization.id = p_organization_id
    and organization.status = 'active';

  if v_owner_principal_id is null then
    return false;
  end if;

  if v_owner_principal_id = v_principal_id then
    return exists (
      select 1 from private.role_catalog as role
      where role.role_key = p_role_key
        and role.scope = case when p_workspace_id is null then 'organization' else 'workspace' end
    );
  end if;

  if p_workspace_id is null then
    return p_role_key = 'org_member'
      and private.has_permission('organization.manage_roles', p_organization_id, null);
  end if;

  return p_role_key in ('workspace_editor', 'workspace_reviewer', 'workspace_viewer')
    and (
      private.has_permission('organization.manage_roles', p_organization_id, null)
      or private.has_permission('workspace.manage_roles', p_organization_id, p_workspace_id)
    );
end;
$$;

revoke all on function private.can_assign_role(text, uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_assign_role(text, uuid, uuid) to authenticated;

create or replace function public.has_permission(
  p_permission_key text,
  p_organization_id uuid,
  p_workspace_id uuid default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_permission(p_permission_key, p_organization_id, p_workspace_id);
$$;

revoke all on function public.has_permission(text, uuid, uuid) from public, anon;
grant execute on function public.has_permission(text, uuid, uuid) to authenticated;

create or replace function public.list_assignable_roles(
  p_organization_id uuid,
  p_workspace_id uuid default null
)
returns table (
  role_key text,
  scope text,
  display_name text,
  description text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_manage_permission text;
begin
  if p_workspace_id is null then
    v_manage_permission := 'organization.manage_roles';
  else
    v_manage_permission := 'workspace.manage_roles';
  end if;

  if not private.has_permission(v_manage_permission, p_organization_id, p_workspace_id) then
    raise exception 'Roles are not available in this scope'
      using errcode = '42501';
  end if;

  return query
  select role.role_key, role.scope, role.display_name, role.description
  from private.role_catalog as role
  where role.scope = case when p_workspace_id is null then 'organization' else 'workspace' end
    and private.can_assign_role(role.role_key, p_organization_id, p_workspace_id)
  order by role.display_name;
end;
$$;

revoke all on function public.list_assignable_roles(uuid, uuid) from public, anon;
grant execute on function public.list_assignable_roles(uuid, uuid) to authenticated;

create or replace function public.list_role_bindings(
  p_organization_id uuid,
  p_workspace_id uuid default null
)
returns table (
  binding_id uuid,
  principal_id uuid,
  role_key text,
  role_name text,
  assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null then
    if not private.has_permission('organization.manage_roles', p_organization_id, null) then
      raise exception 'Role bindings are not available in this scope'
        using errcode = '42501';
    end if;

    return query
    select binding.id, binding.principal_id, role.role_key, role.display_name, binding.created_at
    from private.organization_role_bindings as binding
    join private.role_catalog as role on role.role_key = binding.role_key
    where binding.organization_id = p_organization_id
    order by role.display_name, binding.created_at;
  else
    if not private.has_permission('workspace.manage_roles', p_organization_id, p_workspace_id) then
      raise exception 'Role bindings are not available in this scope'
        using errcode = '42501';
    end if;

    return query
    select binding.id, binding.principal_id, role.role_key, role.display_name, binding.created_at
    from private.workspace_role_bindings as binding
    join private.role_catalog as role on role.role_key = binding.role_key
    where binding.workspace_id = p_workspace_id
    order by role.display_name, binding.created_at;
  end if;
end;
$$;

revoke all on function public.list_role_bindings(uuid, uuid) from public, anon;
grant execute on function public.list_role_bindings(uuid, uuid) to authenticated;

create or replace function public.assign_organization_role(
  p_organization_id uuid,
  p_principal_id uuid,
  p_role_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_binding_id uuid;
  v_owner uuid;
begin
  v_actor := private.current_principal_id();
  if v_actor is null or p_principal_id is null
     or not private.can_assign_role(p_role_key, p_organization_id, null) then
    raise exception 'Role cannot be assigned'
      using errcode = '42501';
  end if;

  select organization.owner_principal_id
    into v_owner
  from public.organizations as organization
  where organization.id = p_organization_id
    and organization.status = 'active';

  if v_owner is null or p_principal_id = v_owner then
    raise exception 'Role cannot be assigned'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_memberships as membership
    where membership.organization_id = p_organization_id
      and membership.principal_id = p_principal_id
      and membership.status = 'active'
  ) then
    raise exception 'Role cannot be assigned'
      using errcode = '42501';
  end if;

  insert into private.organization_role_bindings (
    organization_id, principal_id, role_key, assigned_by_principal_id
  )
  values (p_organization_id, p_principal_id, p_role_key, v_actor)
  on conflict (organization_id, principal_id, role_key) do nothing
  returning id into v_binding_id;

  if v_binding_id is null then
    select binding.id into v_binding_id
    from private.organization_role_bindings as binding
    where binding.organization_id = p_organization_id
      and binding.principal_id = p_principal_id
      and binding.role_key = p_role_key;
  else
  end if;

  return v_binding_id;
end;
$$;

revoke all on function public.assign_organization_role(uuid, uuid, text) from public, anon;
grant execute on function public.assign_organization_role(uuid, uuid, text) to authenticated;

create or replace function public.revoke_organization_role(p_binding_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_binding private.organization_role_bindings%rowtype;
begin
  v_actor := private.current_principal_id();
  if v_actor is null then
    raise exception 'Role cannot be revoked'
      using errcode = '42501';
  end if;

  select binding.* into v_binding
  from private.organization_role_bindings as binding
  where binding.id = p_binding_id
  for update;

  if not found
     or not private.can_assign_role(v_binding.role_key, v_binding.organization_id, null) then
    raise exception 'Role cannot be revoked'
      using errcode = '42501';
  end if;

  delete from private.organization_role_bindings where id = v_binding.id;

  return true;
end;
$$;

revoke all on function public.revoke_organization_role(uuid) from public, anon;
grant execute on function public.revoke_organization_role(uuid) to authenticated;

create or replace function public.assign_workspace_role(
  p_organization_id uuid,
  p_workspace_id uuid,
  p_principal_id uuid,
  p_role_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_binding_id uuid;
begin
  v_actor := private.current_principal_id();
  if v_actor is null or p_principal_id is null
     or not private.can_assign_role(p_role_key, p_organization_id, p_workspace_id) then
    raise exception 'Role cannot be assigned'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspaces as workspace
    join public.organizations as organization
      on organization.id = workspace.organization_id
    where workspace.id = p_workspace_id
      and workspace.organization_id = p_organization_id
      and workspace.status = 'active'
      and organization.status = 'active'
  ) then
    raise exception 'Role cannot be assigned'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_memberships as membership
    where membership.organization_id = p_organization_id
      and membership.principal_id = p_principal_id
      and membership.status = 'active'
  ) or not exists (
    select 1 from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.principal_id = p_principal_id
      and membership.status = 'active'
  ) then
    raise exception 'Role cannot be assigned'
      using errcode = '42501';
  end if;

  insert into private.workspace_role_bindings (
    workspace_id, principal_id, role_key, assigned_by_principal_id
  )
  values (p_workspace_id, p_principal_id, p_role_key, v_actor)
  on conflict (workspace_id, principal_id, role_key) do nothing
  returning id into v_binding_id;

  if v_binding_id is null then
    select binding.id into v_binding_id
    from private.workspace_role_bindings as binding
    where binding.workspace_id = p_workspace_id
      and binding.principal_id = p_principal_id
      and binding.role_key = p_role_key;
  else
  end if;

  return v_binding_id;
end;
$$;

revoke all on function public.assign_workspace_role(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.assign_workspace_role(uuid, uuid, uuid, text) to authenticated;

create or replace function public.revoke_workspace_role(p_binding_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_binding private.workspace_role_bindings%rowtype;
  v_organization_id uuid;
begin
  v_actor := private.current_principal_id();
  if v_actor is null then
    raise exception 'Role cannot be revoked'
      using errcode = '42501';
  end if;

  select binding.* into v_binding
  from private.workspace_role_bindings as binding
  where binding.id = p_binding_id
  for update;

  if not found then
    raise exception 'Role cannot be revoked'
      using errcode = '42501';
  end if;

  select workspace.organization_id into v_organization_id
  from public.workspaces as workspace
  where workspace.id = v_binding.workspace_id;

  if not private.can_assign_role(v_binding.role_key, v_organization_id, v_binding.workspace_id) then
    raise exception 'Role cannot be revoked'
      using errcode = '42501';
  end if;

  delete from private.workspace_role_bindings where id = v_binding.id;

  return true;
end;
$$;

revoke all on function public.revoke_workspace_role(uuid) from public, anon;
grant execute on function public.revoke_workspace_role(uuid) to authenticated;

-- Replace owner-only membership/invitation RPCs with scoped permission checks.
create or replace function public.set_organization_membership_status(
  p_membership_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.organization_memberships%rowtype;
begin
  if private.current_principal_id() is null
     or p_status is null or p_status not in ('suspended', 'revoked') then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  select membership.* into v_membership
  from public.organization_memberships as membership
  where membership.id = p_membership_id
    and private.has_permission('organization.manage_members', membership.organization_id, null)
    and membership.principal_id <> (
      select organization.owner_principal_id
      from public.organizations as organization
      where organization.id = membership.organization_id
    )
  for update;

  if not found then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  update public.organization_memberships
  set status = p_status
  where id = v_membership.id;

  update public.workspace_memberships
  set status = p_status
  where principal_id = v_membership.principal_id
    and workspace_id in (
      select workspace.id from public.workspaces as workspace
      where workspace.organization_id = v_membership.organization_id
    );

  if p_status = 'revoked' then
    delete from private.workspace_role_bindings as binding
    using public.workspaces as workspace
    where binding.workspace_id = workspace.id
      and workspace.organization_id = v_membership.organization_id
      and binding.principal_id = v_membership.principal_id;
    delete from private.organization_role_bindings as binding
    where binding.organization_id = v_membership.organization_id
      and binding.principal_id = v_membership.principal_id;
  end if;

  return true;
end;
$$;

revoke all on function public.set_organization_membership_status(uuid, text) from public, anon;
grant execute on function public.set_organization_membership_status(uuid, text) to authenticated;

create or replace function public.set_workspace_membership_status(
  p_membership_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.workspace_memberships%rowtype;
  v_organization_id uuid;
begin
  if private.current_principal_id() is null
     or p_status is null or p_status not in ('suspended', 'revoked') then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  select membership.* into v_membership
  from public.workspace_memberships as membership
  join public.workspaces as workspace
    on workspace.id = membership.workspace_id
  where membership.id = p_membership_id
    and private.has_permission('workspace.manage_members', workspace.organization_id, workspace.id)
    and membership.principal_id <> (
      select organization.owner_principal_id
      from public.organizations as organization
      where organization.id = workspace.organization_id
    )
  for update;

  if not found then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  update public.workspace_memberships
  set status = p_status
  where id = v_membership.id;

  if p_status = 'revoked' then
    delete from private.workspace_role_bindings as binding
    where binding.workspace_id = v_membership.workspace_id
      and binding.principal_id = v_membership.principal_id;
  end if;

  return true;
end;
$$;

revoke all on function public.set_workspace_membership_status(uuid, text) from public, anon;
grant execute on function public.set_workspace_membership_status(uuid, text) to authenticated;

create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_invitation public.organization_invitations%rowtype;
begin
  v_actor := private.current_principal_id();
  if v_actor is null then
    raise exception 'Invitation cannot be revoked'
      using errcode = '42501';
  end if;

  select invitation.* into v_invitation
  from public.organization_invitations as invitation
  where invitation.id = p_invitation_id
  for update;

  if not found
     or not private.has_permission('organization.manage_members', v_invitation.organization_id, null)
     or v_invitation.status <> 'pending'
     or v_invitation.expires_at <= now() then
    raise exception 'Invitation cannot be revoked'
      using errcode = '42501';
  end if;

  update public.organization_invitations
  set status = 'revoked',
      revoked_at = now()
  where id = v_invitation.id;

  return true;
end;
$$;

revoke all on function public.revoke_organization_invitation(uuid) from public, anon;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;

-- Allow organisation administrators to update metadata and create workspaces.
create policy "Organisation administrators can update organisation metadata"
  on public.organizations
  for update
  to authenticated
  using (private.has_permission('organization.update', id, null))
  with check (private.has_permission('organization.update', id, null));

create policy "Organisation administrators can create workspaces"
  on public.workspaces
  for insert
  to authenticated
  with check (
    created_by_principal_id = private.current_principal_id()
    and kind <> 'personal'
    and status = 'active'
    and private.has_permission('workspace.create', organization_id, null)
  );

create policy "Organisation administrators can update workspace metadata"
  on public.workspaces
  for update
  to authenticated
  using (private.has_permission('workspace.update', organization_id, id))
  with check (private.has_permission('workspace.update', organization_id, id));

create policy "Workspace managers can read workspace administration metadata"
  on public.workspaces
  for select
  to authenticated
  using (
    private.has_permission('workspace.manage_members', organization_id, id)
    or private.has_permission('workspace.manage_roles', organization_id, id)
  );

-- Expand existing read/insert policies to the scoped role evaluator.
drop policy if exists "Principals can read their own organisation memberships"
  on public.organization_memberships;
create policy "Principals can read their own organisation memberships"
  on public.organization_memberships
  for select
  to authenticated
  using (
    principal_id = private.current_principal_id()
    or private.has_permission('organization.manage_members', organization_id, null)
  );

drop policy if exists "Principals can read their own workspace memberships"
  on public.workspace_memberships;
create policy "Principals can read their own workspace memberships"
  on public.workspace_memberships
  for select
  to authenticated
  using (
    principal_id = private.current_principal_id()
    or exists (
      select 1 from public.workspaces as workspace
      where workspace.id = workspace_memberships.workspace_id
        and private.has_permission('workspace.manage_members', workspace.organization_id, workspace.id)
    )
  );

drop policy if exists "Organisation owners can read invitations"
  on public.organization_invitations;
create policy "Organisation managers can read invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (private.has_permission('organization.manage_members', organization_id, null));

drop policy if exists "Organisation owners can create scoped invitations"
  on public.organization_invitations;
create policy "Organisation managers can create scoped invitations"
  on public.organization_invitations
  for insert
  to authenticated
  with check (
    created_by_principal_id = private.current_principal_id()
    and status = 'pending'
    and accepted_by_principal_id is null
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
    and private.has_permission('organization.manage_members', organization_id, null)
    and (
      workspace_id is null
      or exists (
        select 1 from public.workspaces as workspace
        where workspace.id = organization_invitations.workspace_id
          and workspace.organization_id = organization_invitations.organization_id
          and workspace.status = 'active'
      )
    )
  );

comment on table private.permission_catalog is
  'Stable named Njumeni permissions. Permission definitions are system-managed.';
comment on table private.role_catalog is
  'Built-in organisation and workspace roles. Customer role editing is not enabled.';
comment on table private.role_permissions is
  'System-managed grants mapping built-in roles to explicit permission keys.';
comment on table private.organization_role_bindings is
  'Private organisation-scoped role assignments; effective only with active membership.';
comment on table private.workspace_role_bindings is
  'Private workspace-scoped role assignments; effective only with active organisation and workspace membership.';
comment on table private.role_audit_events is
  'Private append-only role assignment/revocation events. Not the final central audit store.';
