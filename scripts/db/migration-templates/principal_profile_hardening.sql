-- Phase 1.4 hardening: active-principal resolution, immutable identity links,
-- strict profile validation, and immutable profile ownership.

create or replace function private.current_principal_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select identity.principal_id
  from private.principal_identities as identity
  join private.principals as principal
    on principal.id = identity.principal_id
  where identity.provider = 'supabase'
    and identity.auth_user_id = (select auth.uid())
    and principal.status = 'active'
    and (select auth.uid()) is not null
  limit 1;
$$;

revoke all on function private.current_principal_id() from public, anon;
grant execute on function private.current_principal_id() to authenticated;

create or replace function private.reject_principal_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.principal_id is distinct from old.principal_id
     or new.provider is distinct from old.provider
     or new.provider_subject is distinct from old.provider_subject
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Provider identity mappings are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_principal_identity_update() from public, anon, authenticated;

drop trigger if exists principal_identity_mapping_immutable on private.principal_identities;
create trigger principal_identity_mapping_immutable
  before update on private.principal_identities
  for each row execute function private.reject_principal_identity_update();

create or replace function private.validate_user_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.principal_id is distinct from old.principal_id then
    raise exception 'Profile ownership is immutable'
      using errcode = '42501';
  end if;

  if new.avatar_url is not null then
    if char_length(new.avatar_url) > 2048
       or new.avatar_url ~ '[[:space:]]'
       or new.avatar_url !~* '^https://[^/?#]+([/?#]|$)'
       or new.avatar_url ~* '^https://[^/]*@' then
      raise exception 'Avatar URL must be a valid HTTPS URL without embedded credentials'
        using errcode = '23514';
    end if;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names as timezone
    where timezone.name = new.timezone
  ) then
    raise exception 'Timezone must be a supported IANA time-zone identifier'
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_user_profile() from public, anon, authenticated;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_validate_and_timestamp
  before insert or update on public.user_profiles
  for each row execute function private.validate_user_profile();

comment on function private.current_principal_id() is
  'Returns only the active principal mapped to the current authenticated Supabase user.';
comment on function private.reject_principal_identity_update() is
  'Prevents mutation of provider-subject to internal-principal identity bindings.';
comment on function private.validate_user_profile() is
  'Enforces immutable profile ownership, HTTPS avatar URL rules, IANA time zones and update timestamps.';
