-- Phase 1.5: organisation and workspace tenant ownership.
-- Task 1.5 deliberately supports owner-only access; memberships arrive in Task 1.6.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_principal_id uuid not null
    default private.current_principal_id()
    references private.principals(id) on delete restrict,
  name text not null
    check (char_length(name) between 1 and 160),
  slug text not null
    check (char_length(slug) between 3 and 63 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null
    check (kind in ('personal', 'law_firm', 'enterprise', 'institution')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_slug_lower_unique
  on public.organizations (lower(slug));
create unique index organizations_one_personal_per_owner
  on public.organizations (owner_principal_id)
  where kind = 'personal';
create index organizations_owner_principal_id_idx
  on public.organizations (owner_principal_id);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  created_by_principal_id uuid not null
    default private.current_principal_id()
    references private.principals(id) on delete restrict,
  name text not null
    check (char_length(name) between 1 and 160),
  slug text not null
    check (char_length(slug) between 3 and 63 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null
    check (kind in ('personal', 'general', 'team', 'matter', 'research')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspaces_organization_slug_lower_unique
  on public.workspaces (organization_id, lower(slug));
create index workspaces_organization_id_idx
  on public.workspaces (organization_id);
create index workspaces_created_by_principal_id_idx
  on public.workspaces (created_by_principal_id);

create or replace function private.validate_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_principal_id is distinct from old.owner_principal_id then
    raise exception 'Organisation ownership is immutable'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and new.kind = 'personal' and current_user <> 'postgres' then
    raise exception 'Personal organisations are provisioned by the identity lifecycle'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_organization() from public, anon, authenticated;

create or replace function private.validate_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.created_by_principal_id is distinct from old.created_by_principal_id
  ) then
    raise exception 'Workspace organisation and creator are immutable'
      using errcode = '42501';
  end if;

  if new.status not in ('active', 'archived') and current_user <> 'postgres' then
    raise exception 'Workspace status may only be active or archived through the user interface'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_workspace() from public, anon, authenticated;

create or replace function private.provision_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspaces (
    organization_id,
    created_by_principal_id,
    name,
    slug,
    kind
  )
  values (
    new.id,
    new.owner_principal_id,
    case when new.kind = 'personal' then 'Personal workspace' else 'General workspace' end,
    case when new.kind = 'personal' then 'personal' else 'general' end,
    case when new.kind = 'personal' then 'personal' else 'general' end
  )
  on conflict (organization_id, lower(slug)) do nothing;

  return new;
end;
$$;

revoke all on function private.provision_default_workspace() from public, anon, authenticated;

create or replace function private.provision_personal_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    insert into public.organizations (
      owner_principal_id,
      name,
      slug,
      kind
    )
    values (
      new.id,
      'Personal workspace',
      'personal-' || left(replace(new.id::text, '-', ''), 12),
      'personal'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.provision_personal_organization() from public, anon, authenticated;

create trigger organizations_validate
  before insert or update on public.organizations
  for each row execute function private.validate_organization();

create trigger workspaces_validate
  before insert or update on public.workspaces
  for each row execute function private.validate_workspace();

create trigger organizations_provision_default_workspace
  after insert on public.organizations
  for each row execute function private.provision_default_workspace();

create trigger principals_provision_personal_organization
  after insert on private.principals
  for each row execute function private.provision_personal_organization();

alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;

revoke all on public.organizations from public, anon, authenticated;
revoke all on public.workspaces from public, anon, authenticated;

grant select on public.organizations to authenticated;
grant insert (name, slug, kind) on public.organizations to authenticated;
grant update (name, slug) on public.organizations to authenticated;

grant select on public.workspaces to authenticated;
grant insert (organization_id, name, slug, kind) on public.workspaces to authenticated;
grant update (name, slug, status) on public.workspaces to authenticated;

create policy "Owners can read their organisations"
  on public.organizations
  for select
  to authenticated
  using (
    (select private.current_principal_id()) is not null
    and owner_principal_id = (select private.current_principal_id())
  );

create policy "Owners can create non-personal organisations"
  on public.organizations
  for insert
  to authenticated
  with check (
    (select private.current_principal_id()) is not null
    and owner_principal_id = (select private.current_principal_id())
    and kind <> 'personal'
    and status = 'active'
  );

create policy "Owners can update their organisation details"
  on public.organizations
  for update
  to authenticated
  using (
    (select private.current_principal_id()) is not null
    and owner_principal_id = (select private.current_principal_id())
  )
  with check (
    (select private.current_principal_id()) is not null
    and owner_principal_id = (select private.current_principal_id())
  );

create policy "Owners can read workspaces in their active organisations"
  on public.workspaces
  for select
  to authenticated
  using (
    (select private.current_principal_id()) is not null
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = workspaces.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
        and organization.status = 'active'
    )
  );

create policy "Owners can create workspaces in their active organisations"
  on public.workspaces
  for insert
  to authenticated
  with check (
    (select private.current_principal_id()) is not null
    and created_by_principal_id = (select private.current_principal_id())
    and kind <> 'personal'
    and status = 'active'
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = workspaces.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
        and organization.status = 'active'
    )
  );

create policy "Owners can update workspaces in their active organisations"
  on public.workspaces
  for update
  to authenticated
  using (
    (select private.current_principal_id()) is not null
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = workspaces.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
        and organization.status = 'active'
    )
  )
  with check (
    (select private.current_principal_id()) is not null
    and created_by_principal_id = (select private.current_principal_id())
    and status in ('active', 'archived')
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = workspaces.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
        and organization.status = 'active'
    )
  );

-- Existing principals were created in Task 1.4 before personal-tenant provisioning existed.
insert into public.organizations (owner_principal_id, name, slug, kind)
select
  principal.id,
  'Personal workspace',
  'personal-' || left(replace(principal.id::text, '-', ''), 12),
  'personal'
from private.principals as principal
where principal.status = 'active'
  and not exists (
    select 1
    from public.organizations as organization
    where organization.owner_principal_id = principal.id
      and organization.kind = 'personal'
  )
on conflict do nothing;

-- Retain tenant/workspace records when an Auth identity is deleted. Remove the
-- provider link and anonymise presentation fields instead of deleting a tenant.
create or replace function private.remove_auth_principal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_principal_id uuid;
begin
  select identity.principal_id
    into existing_principal_id
  from private.principal_identities as identity
  where identity.provider = 'supabase'
    and identity.auth_user_id = old.id
  limit 1;

  if existing_principal_id is not null then
    update private.principals
    set status = 'deactivated',
        updated_at = now()
    where id = existing_principal_id;

    update public.user_profiles
    set display_name = null,
        given_name = null,
        family_name = null,
        avatar_url = null
    where principal_id = existing_principal_id;
  end if;

  return old;
end;
$$;

revoke all on function private.remove_auth_principal() from public, anon, authenticated;

comment on table public.organizations is
  'Tenant/account boundary. Task 1.5 uses owner-only access until membership is implemented.';
comment on table public.workspaces is
  'Organisation-owned working area. Membership and role access are added in later Phase 1 tasks.';
comment on function private.provision_personal_organization() is
  'Creates one personal organisation for each newly provisioned active principal.';
comment on function private.remove_auth_principal() is
  'Deactivates and anonymises a principal on Auth-user deletion while retaining tenant records.';
