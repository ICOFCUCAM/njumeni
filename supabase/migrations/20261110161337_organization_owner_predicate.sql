-- Narrow caller-scoped ownership predicate for owner-only settings controls.
-- The private SECURITY DEFINER predicate returns a boolean only and is not exposed directly.

create or replace function public.is_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_organization_owner(p_organization_id);
$$;

revoke all on function public.is_organization_owner(uuid) from public, anon, authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

comment on function public.is_organization_owner(uuid) is
  'Returns whether the current authenticated principal owns the supplied active organisation; reveals no principal identifiers.';
