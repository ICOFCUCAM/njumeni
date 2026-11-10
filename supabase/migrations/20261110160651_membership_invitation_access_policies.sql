
-- Non-recursive SECURITY DEFINER predicates used by tenant and membership RLS.
-- They return only boolean decisions and never expose membership or identity rows.

create or replace function private.is_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations as organization
    where organization.id = p_organization_id
      and organization.owner_principal_id = private.current_principal_id()
      and organization.status = 'active'
  );
$$;

create or replace function private.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces as workspace
    join public.organizations as organization
      on organization.id = workspace.organization_id
    where workspace.id = p_workspace_id
      and organization.owner_principal_id = private.current_principal_id()
      and organization.status = 'active'
  );
$$;

create or replace function private.has_active_organization_membership(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.principal_id = private.current_principal_id()
      and membership.status = 'active'
      and organization.status = 'active'
  );
$$;

create or replace function private.has_active_workspace_membership(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships as workspace_membership
    join public.workspaces as workspace
      on workspace.id = workspace_membership.workspace_id
    join public.organization_memberships as organization_membership
      on organization_membership.organization_id = workspace.organization_id
     and organization_membership.principal_id = workspace_membership.principal_id
    join public.organizations as organization
      on organization.id = workspace.organization_id
    where workspace_membership.workspace_id = p_workspace_id
      and workspace_membership.principal_id = private.current_principal_id()
      and workspace_membership.status = 'active'
      and organization_membership.status = 'active'
      and workspace.status = 'active'
      and organization.status = 'active'
  );
$$;

revoke all on function private.is_organization_owner(uuid) from public, anon, authenticated;
revoke all on function private.is_workspace_owner(uuid) from public, anon, authenticated;
revoke all on function private.has_active_organization_membership(uuid) from public, anon, authenticated;
revoke all on function private.has_active_workspace_membership(uuid) from public, anon, authenticated;
grant execute on function private.is_organization_owner(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;
grant execute on function private.has_active_organization_membership(uuid) to authenticated;
grant execute on function private.has_active_workspace_membership(uuid) to authenticated;

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
  on conflict on constraint organization_memberships_org_principal_unique
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
    on conflict on constraint workspace_memberships_workspace_principal_unique
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

revoke all on function public.accept_organization_invitation(text) from public, anon, authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;

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
  if current_principal is null or p_status is null or p_status not in ('suspended', 'revoked') then
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

revoke all on function public.set_workspace_membership_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_workspace_membership_status(uuid, text) to authenticated;


-- Replace subquery-based policies with non-recursive identity predicates.
drop policy if exists "Principals can read their own organisation memberships"
  on public.organization_memberships;
drop policy if exists "Principals can read their own workspace memberships"
  on public.workspace_memberships;
drop policy if exists "Organisation owners can read invitations"
  on public.organization_invitations;
drop policy if exists "Organisation owners can create scoped invitations"
  on public.organization_invitations;

create policy "Principals can read their own organisation memberships"
  on public.organization_memberships
  for select
  to authenticated
  using (
    principal_id = (select private.current_principal_id())
    or (select private.is_organization_owner(organization_id))
  );

create policy "Principals can read their own workspace memberships"
  on public.workspace_memberships
  for select
  to authenticated
  using (
    principal_id = (select private.current_principal_id())
    or (select private.is_workspace_owner(workspace_id))
  );

create policy "Organisation owners can read invitations"
  on public.organization_invitations
  for select
  to authenticated
  using ((select private.is_organization_owner(organization_id)));

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
    and (select private.is_organization_owner(organization_id))
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

create policy "Active organisation members can read their organisation"
  on public.organizations
  for select
  to authenticated
  using ((select private.has_active_organization_membership(id)));

create policy "Active workspace members can read their workspace"
  on public.workspaces
  for select
  to authenticated
  using (
    (select private.has_active_organization_membership(organization_id))
    and (select private.has_active_workspace_membership(id))
  );

