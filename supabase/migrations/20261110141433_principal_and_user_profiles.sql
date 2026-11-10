-- Phase 1.4: internal principal identity and self-service profile.
-- Authenticated users never write principal or provider identity records directly.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.principals (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.principal_identities (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references private.principals(id) on delete cascade,
  provider text not null check (provider = 'supabase'),
  provider_subject text not null,
  auth_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint principal_identities_provider_subject_unique unique (provider, provider_subject),
  constraint principal_identities_provider_auth_user_unique unique (provider, auth_user_id),
  constraint principal_identities_supabase_user_required
    check (provider <> 'supabase' or auth_user_id is not null)
);

create index principal_identities_principal_id_idx
  on private.principal_identities (principal_id);

create table public.user_profiles (
  principal_id uuid primary key references private.principals(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  given_name text check (given_name is null or char_length(given_name) <= 80),
  family_name text check (family_name is null or char_length(family_name) <= 80),
  avatar_url text check (
    avatar_url is null or
    (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')
  ),
  locale text not null default 'en'
    check (locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  timezone text not null default 'UTC'
    check (char_length(timezone) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.current_principal_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select identity.principal_id
  from private.principal_identities as identity
  where identity.provider = 'supabase'
    and identity.auth_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.current_principal_id() from public, anon;
grant execute on function private.current_principal_id() to authenticated;

create or replace function private.provision_auth_principal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_principal_id uuid;
begin
  insert into private.principals default values
  returning id into new_principal_id;

  insert into private.principal_identities (
    principal_id, provider, provider_subject, auth_user_id
  )
  values (
    new_principal_id, 'supabase', new.id::text, new.id
  );

  insert into public.user_profiles (principal_id)
  values (new_principal_id);

  return new;
end;
$$;

revoke all on function private.provision_auth_principal() from public, anon, authenticated;

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
    delete from private.principals
    where id = existing_principal_id;
  end if;

  return old;
end;
$$;

revoke all on function private.remove_auth_principal() from public, anon, authenticated;

create or replace function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_profile_updated_at() from public, anon, authenticated;

create trigger on_auth_user_created_create_principal
  after insert on auth.users
  for each row execute function private.provision_auth_principal();

create trigger on_auth_user_deleted_remove_principal
  before delete on auth.users
  for each row execute function private.remove_auth_principal();

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function private.set_profile_updated_at();

alter table private.principals enable row level security;
alter table private.principal_identities enable row level security;
alter table public.user_profiles enable row level security;

revoke all on private.principals from public, anon, authenticated;
revoke all on private.principal_identities from public, anon, authenticated;
revoke all on public.user_profiles from public, anon, authenticated;

grant select (
  display_name, given_name, family_name, avatar_url, locale, timezone, created_at, updated_at
) on public.user_profiles to authenticated;

grant update (
  display_name, given_name, family_name, avatar_url, locale, timezone
) on public.user_profiles to authenticated;

create policy "Users can read their own profile"
  on public.user_profiles
  for select
  to authenticated
  using (
    (select private.current_principal_id()) is not null
    and principal_id = (select private.current_principal_id())
  );

create policy "Users can update their own profile fields"
  on public.user_profiles
  for update
  to authenticated
  using (
    (select private.current_principal_id()) is not null
    and principal_id = (select private.current_principal_id())
  )
  with check (
    (select private.current_principal_id()) is not null
    and principal_id = (select private.current_principal_id())
  );

comment on schema private is
  'Non-API identity infrastructure. Direct Data API access is not granted.';
comment on table private.principals is
  'Njumeni internal principal; separate from external authentication-provider identities.';
comment on table private.principal_identities is
  'Server-managed mapping between internal principals and external identity-provider subjects.';
comment on table public.user_profiles is
  'Self-service presentation profile. Profile attributes never grant permissions or tenant access.';

-- CLI migration generation request refreshed after pinning Supabase CLI.
