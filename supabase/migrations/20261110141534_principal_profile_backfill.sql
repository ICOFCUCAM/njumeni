-- Forward-only correction for the initial principal/profile migration.
-- Existing Auth users must be provisioned as well as users created after the trigger.
do $$
declare
  existing_user record;
  new_principal_id uuid;
begin
  for existing_user in
    select auth_user.id
    from auth.users as auth_user
    left join private.principal_identities as identity
      on identity.provider = 'supabase'
     and identity.auth_user_id = auth_user.id
    where identity.id is null
  loop
    insert into private.principals default values
    returning id into new_principal_id;

    insert into private.principal_identities (
      principal_id, provider, provider_subject, auth_user_id
    )
    values (
      new_principal_id, 'supabase', existing_user.id::text, existing_user.id
    );

    insert into public.user_profiles (principal_id)
    values (new_principal_id)
    on conflict (principal_id) do nothing;
  end loop;
end;
$$;

grant select (principal_id) on public.user_profiles to authenticated;
