-- Phase 1.6: organisation/workspace membership and invitation lifecycle.
-- Membership writes are restricted to narrowly scoped authenticated RPCs.
-- Roles and permission bindings are intentionally deferred to Task 1.7.

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  principal_id uuid not null
    references private.principals(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  invited_by_principal_id uuid
    references private.principals(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_org_principal_unique
    unique (organization_id, principal_id)
);

create index organization_memberships_principal_id_idx
  on public.organization_memberships (principal_id);
create index organization_memberships_organization_status_idx
  on public.organization_memberships (organization_id, status);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete restrict,
  principal_id uuid not null
    references private.principals(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  invited_by_principal_id uuid
    references private.principals(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_memberships_workspace_principal_unique
    unique (workspace_id, principal_id)
);

create index workspace_memberships_principal_id_idx
  on public.workspace_memberships (principal_id);
create index workspace_memberships_workspace_status_idx
  on public.workspace_memberships (workspace_id, status);

alter table public.workspaces
  add constraint workspaces_id_organization_id_unique unique (id, organization_id);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  workspace_id uuid,
  email_normalized text not null
    check (
      char_length(email_normalized) between 3 and 254
      and email_normalized = lower(btrim(email_normalized))
      and email_normalized ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_by_principal_id uuid not null
    default private.current_principal_id()
    references private.principals(id) on delete restrict,
  accepted_by_principal_id uuid
    references private.principals(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_workspace_org_fkey
    foreign key (workspace_id, organization_id)
    references public.workspaces(id, organization_id) on delete restrict,
  constraint organization_invitations_expiry_range
    check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  constraint organization_invitations_acceptance_consistency
    check (
      (status = 'accepted' and accepted_by_principal_id is not null and accepted_at is not null)
      or
      (status <> 'accepted' and accepted_by_principal_id is null and accepted_at is null)
    ),
  constraint organization_invitations_revocation_consistency
    check ((status = 'revoked' and revoked_at is not null) or (status <> 'revoked' and revoked_at is null))
);

create or replace function private.expire_matching_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.organization_invitations
  set status = 'expired',
      updated_at = now()
  where organization_id = new.organization_id
    and email_normalized = new.email_normalized
    and workspace_id is not distinct from new.workspace_id
    and status = 'pending'
    and expires_at <= now();

  return new;
end;
$$;

revoke all on function private.expire_matching_invitations() from public, anon, authenticated;

create trigger organization_invitations_expire_previous
  before insert on public.organization_invitations
  for each row execute function private.expire_matching_invitations();

create index organization_invitations_organization_status_idx
  on public.organization_invitations (organization_id, status, expires_at desc);
create index organization_invitations_workspace_id_idx
  on public.organization_invitations (workspace_id)
  where workspace_id is not null;
create unique index organization_invitations_pending_scope_email_unique
  on public.organization_invitations (
    organization_id,
    email_normalized,
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pending';

create table private.membership_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_principal_id uuid references private.principals(id) on delete set null,
  target_principal_id uuid references private.principals(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  invitation_id uuid references public.organization_invitations(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index membership_events_organization_time_idx
  on private.membership_events (organization_id, occurred_at desc);
create index membership_events_target_time_idx
  on private.membership_events (target_principal_id, occurred_at desc);

revoke all on private.membership_events from public, anon, authenticated;

create or replace function private.set_membership_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_membership_updated_at() from public, anon, authenticated;

create or replace function private.record_membership_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_actor uuid;
  event_target uuid;
  event_organization uuid;
  event_workspace uuid;
  event_invitation uuid;
begin
  event_actor := private.current_principal_id();

  if tg_table_name = 'organization_invitations' then
    event_organization := coalesce(new.organization_id, old.organization_id);
    event_workspace := coalesce(new.workspace_id, old.workspace_id);
    event_invitation := coalesce(new.id, old.id);
    event_target := coalesce(new.accepted_by_principal_id, old.accepted_by_principal_id);

    if tg_op = 'INSERT' then
      event_name := 'invitation.created';
    elsif old.status is distinct from new.status and new.status = 'accepted' then
      event_name := 'invitation.accepted';
      event_target := new.accepted_by_principal_id;
    elsif old.status is distinct from new.status and new.status = 'revoked' then
      event_name := 'invitation.revoked';
    elsif old.status is distinct from new.status and new.status = 'expired' then
      event_name := 'invitation.expired';
    else
      return new;
    end if;
  elsif tg_table_name = 'organization_memberships' then
    event_organization := coalesce(new.organization_id, old.organization_id);
    event_target := coalesce(new.principal_id, old.principal_id);

    if tg_op = 'INSERT' then
      event_name := 'organization_membership.created';
    elsif old.status is distinct from new.status then
      event_name := 'organization_membership.' || new.status;
    else
      return new;
    end if;
  elsif tg_table_name = 'workspace_memberships' then
    event_target := coalesce(new.principal_id, old.principal_id);
    select workspace.organization_id
      into event_organization
    from public.workspaces as workspace
    where workspace.id = coalesce(new.workspace_id, old.workspace_id);
    event_workspace := coalesce(new.workspace_id, old.workspace_id);

    if tg_op = 'INSERT' then
      event_name := 'workspace_membership.created';
    elsif old.status is distinct from new.status then
      event_name := 'workspace_membership.' || new.status;
    else
      return new;
    end if;
  else
    return coalesce(new, old);
  end if;

  insert into private.membership_events (
    event_type,
    actor_principal_id,
    target_principal_id,
    organization_id,
    workspace_id,
    invitation_id
  )
  values (
    event_name,
    event_actor,
    event_target,
    event_organization,
    event_workspace,
    event_invitation
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.record_membership_event() from public, anon, authenticated;

create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function private.set_membership_updated_at();
create trigger workspace_memberships_set_updated_at
  before update on public.workspace_memberships
  for each row execute function private.set_membership_updated_at();
create trigger organization_invitations_set_updated_at
  before update on public.organization_invitations
  for each row execute function private.set_membership_updated_at();

create trigger organization_memberships_record_event
  after insert or update on public.organization_memberships
  for each row execute function private.record_membership_event();
create trigger workspace_memberships_record_event
  after insert or update on public.workspace_memberships
  for each row execute function private.record_membership_event();
create trigger organization_invitations_record_event
  after insert or update on public.organization_invitations
  for each row execute function private.record_membership_event();

alter table public.organization_memberships enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.organization_invitations enable row level security;

revoke all on public.organization_memberships from public, anon, authenticated;
revoke all on public.workspace_memberships from public, anon, authenticated;
revoke all on public.organization_invitations from public, anon, authenticated;

grant select (
  id, organization_id, principal_id, status, invited_by_principal_id,
  joined_at, created_at, updated_at
) on public.organization_memberships to authenticated;

grant select (
  id, workspace_id, principal_id, status, invited_by_principal_id,
  joined_at, created_at, updated_at
) on public.workspace_memberships to authenticated;

grant select (
  id, organization_id, workspace_id, email_normalized, status, expires_at,
  created_by_principal_id, accepted_by_principal_id, accepted_at, revoked_at, created_at
) on public.organization_invitations to authenticated;

grant insert (
  organization_id, workspace_id, email_normalized, token_hash, expires_at
) on public.organization_invitations to authenticated;

create policy "Principals can read their own organisation memberships"
  on public.organization_memberships
  for select
  to authenticated
  using (
    principal_id = (select private.current_principal_id())
    or exists (
      select 1
      from public.organizations as organization
      where organization.id = organization_memberships.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
    )
  );

create policy "Principals can read their own workspace memberships"
  on public.workspace_memberships
  for select
  to authenticated
  using (
    principal_id = (select private.current_principal_id())
    or exists (
      select 1
      from public.workspaces as workspace
      join public.organizations as organization
        on organization.id = workspace.organization_id
      where workspace.id = workspace_memberships.workspace_id
        and organization.owner_principal_id = (select private.current_principal_id())
    )
  );

create policy "Organisation owners can read invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization
      where organization.id = organization_invitations.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
    )
  );

create policy "Organisation owners can create scoped invitations"
  on public.organization_invitations
  for insert
  to authenticated
  with check (
    created_by_principal_id = (select private.current_principal_id())
    and status = 'pending'
    and accepted_by_principal_id is null
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = organization_invitations.organization_id
        and organization.owner_principal_id = (select private.current_principal_id())
        and organization.status = 'active'
    )
    and (
      workspace_id is null
      or exists (
        select 1
        from public.workspaces as workspace
        where workspace.id = organization_invitations.workspace_id
          and workspace.organization_id = organization_invitations.organization_id
          and workspace.status = 'active'
      )
    )
  );

create or replace function public.accept_organization_invitation(p_token_hash text)
returns table (
  organization_id uuid,
  workspace_id uuid,
  organization_membership_id uuid,
  workspace_membership_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_principal uuid;
  current_email text;
  invitation public.organization_invitations%rowtype;
  organization_membership uuid;
  workspace_membership uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation cannot be accepted'
      using errcode = '22023';
  end if;

  current_principal := private.current_principal_id();
  if current_principal is null then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  select lower(btrim(auth_user.email))
    into current_email
  from auth.users as auth_user
  where auth_user.id = (select auth.uid())
    and auth_user.email_confirmed_at is not null;

  if current_email is null then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  select *
    into invitation
  from public.organization_invitations as candidate
  where candidate.token_hash = p_token_hash
  for update;

  if not found
     or invitation.status <> 'pending'
     or invitation.expires_at <= now()
     or invitation.email_normalized <> current_email then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organizations as organization
    where organization.id = invitation.organization_id
      and organization.owner_principal_id = current_principal
  ) then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organizations as organization
    where organization.id = invitation.organization_id
      and organization.status = 'active'
  ) then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  if invitation.workspace_id is not null and not exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = invitation.workspace_id
      and workspace.organization_id = invitation.organization_id
      and workspace.status = 'active'
  ) then
    raise exception 'Invitation cannot be accepted'
      using errcode = '42501';
  end if;

  insert into public.organization_memberships (
    organization_id, principal_id, status, invited_by_principal_id, joined_at
  )
  values (
    invitation.organization_id,
    current_principal,
    'active',
    invitation.created_by_principal_id,
    now()
  )
  on conflict (organization_id, principal_id)
  do update set
    status = 'active',
    invited_by_principal_id = excluded.invited_by_principal_id,
    joined_at = now(),
    updated_at = now()
  where organization_memberships.status in ('suspended', 'revoked')
  returning id into organization_membership;

  if organization_membership is null then
    select membership.id
      into organization_membership
    from public.organization_memberships as membership
    where membership.organization_id = invitation.organization_id
      and membership.principal_id = current_principal;
  end if;

  if invitation.workspace_id is not null then
    insert into public.workspace_memberships (
      workspace_id, principal_id, status, invited_by_principal_id, joined_at
    )
    values (
      invitation.workspace_id,
      current_principal,
      'active',
      invitation.created_by_principal_id,
      now()
    )
    on conflict (workspace_id, principal_id)
    do update set
      status = 'active',
      invited_by_principal_id = excluded.invited_by_principal_id,
      joined_at = now(),
      updated_at = now()
    where workspace_memberships.status in ('suspended', 'revoked')
    returning id into workspace_membership;

    if workspace_membership is null then
      select membership.id
        into workspace_membership
      from public.workspace_memberships as membership
      where membership.workspace_id = invitation.workspace_id
        and membership.principal_id = current_principal;
    end if;
  end if;

  update public.organization_invitations
  set status = 'accepted',
      accepted_by_principal_id = current_principal,
      accepted_at = now()
  where id = invitation.id;

  return query select
    invitation.organization_id,
    invitation.workspace_id,
    organization_membership,
    workspace_membership;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;

create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_principal uuid;
  revoked_id uuid;
begin
  current_principal := private.current_principal_id();
  if current_principal is null then
    raise exception 'Invitation cannot be revoked'
      using errcode = '42501';
  end if;

  update public.organization_invitations as invitation
  set status = 'revoked',
      revoked_at = now()
  where invitation.id = p_invitation_id
    and invitation.status = 'pending'
    and invitation.expires_at > now()
    and exists (
      select 1
      from public.organizations as organization
      where organization.id = invitation.organization_id
        and organization.owner_principal_id = current_principal
        and organization.status = 'active'
    )
  returning invitation.id into revoked_id;

  if revoked_id is null then
    raise exception 'Invitation cannot be revoked'
      using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.revoke_organization_invitation(uuid) from public, anon;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;

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
  current_principal uuid;
  membership_row public.organization_memberships%rowtype;
begin
  current_principal := private.current_principal_id();
  if current_principal is null or p_status is null or p_status not in ('suspended', 'revoked') then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  select membership.*
    into membership_row
  from public.organization_memberships as membership
  join public.organizations as organization
    on organization.id = membership.organization_id
  where membership.id = p_membership_id
    and organization.owner_principal_id = current_principal
    and organization.status = 'active'
    and membership.principal_id <> organization.owner_principal_id
  for update;

  if not found then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  update public.organization_memberships
  set status = p_status
  where id = membership_row.id;

  if p_status = 'revoked' then
    update public.workspace_memberships as workspace_membership
    set status = 'revoked'
    from public.workspaces as workspace
    where workspace.id = workspace_membership.workspace_id
      and workspace.organization_id = membership_row.organization_id
      and workspace_membership.principal_id = membership_row.principal_id
      and workspace_membership.status <> 'revoked';
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
  current_principal uuid;
  membership_row public.workspace_memberships%rowtype;
begin
  current_principal := private.current_principal_id();
  if current_principal is null or p_status not in ('suspended', 'revoked') then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  select membership.*
    into membership_row
  from public.workspace_memberships as membership
  join public.workspaces as workspace
    on workspace.id = membership.workspace_id
  join public.organizations as organization
    on organization.id = workspace.organization_id
  where membership.id = p_membership_id
    and organization.owner_principal_id = current_principal
    and organization.status = 'active'
    and membership.principal_id <> organization.owner_principal_id
  for update;

  if not found then
    raise exception 'Membership cannot be changed'
      using errcode = '42501';
  end if;

  update public.workspace_memberships
  set status = p_status
  where id = membership_row.id;

  return true;
end;
$$;

revoke all on function public.set_workspace_membership_status(uuid, text) from public, anon;
grant execute on function public.set_workspace_membership_status(uuid, text) to authenticated;

comment on table public.organization_memberships is
  'Organisation membership lifecycle. Roles and permissions are managed separately in Task 1.7.';
comment on table public.workspace_memberships is
  'Workspace membership lifecycle. An active organisation membership is also required for tenant access.';
comment on table public.organization_invitations is
  'Single-use, expiring, email-bound invitations. Only token hashes are persisted.';
comment on table private.membership_events is
  'Private append-only invitation and membership lifecycle event stream; no raw tokens or legal content.';
