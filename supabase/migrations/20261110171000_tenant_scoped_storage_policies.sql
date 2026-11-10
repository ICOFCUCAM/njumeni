-- Phase 1.8: tenant/workspace-scoped private Storage access.
-- Objects must be stored under: <organization-uuid>/<workspace-uuid>/<file-uuid>/<filename>.
-- The bucket is private; all object access is evaluated against the caller's live workspace permissions.

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'njumeni-workspace-files',
  'njumeni-workspace-files',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/tiff'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Supabase Storage owns storage.objects and provisions RLS as part of its managed schema.
-- Do not ALTER this ownership-protected table from the application migration role.

create or replace function private.storage_object_scope_allows(
  p_bucket_id text,
  p_object_name text,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_text text;
  v_workspace_text text;
  v_file_id_text text;
  v_filename text;
  v_organization_id uuid;
  v_workspace_id uuid;
begin
  if private.current_principal_id() is null
     or p_bucket_id is distinct from 'njumeni-workspace-files'
     or p_object_name is null
     or p_permission_key is null
     or p_permission_key not in ('document.read', 'document.upload', 'document.delete') then
    return false;
  end if;

  -- Require exactly four path segments: organisation/workspace/file UUID/filename.
  -- Reject malformed UUIDs, empty segments, traversal and control characters before casting.
  v_organization_text := split_part(p_object_name, '/', 1);
  v_workspace_text := split_part(p_object_name, '/', 2);
  v_file_id_text := split_part(p_object_name, '/', 3);
  v_filename := split_part(p_object_name, '/', 4);

  if v_organization_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_workspace_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_file_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_filename = ''
     or array_length(string_to_array(p_object_name, '/'), 1) <> 4
     or p_object_name ~ '(^|/)\.\.?(/|$)'
     or p_object_name ~ '[[:cntrl:]]' then
    return false;
  end if;

  v_organization_id := v_organization_text::uuid;
  v_workspace_id := v_workspace_text::uuid;

  if not exists (
    select 1
    from public.workspaces as workspace
    join public.organizations as organization
      on organization.id = workspace.organization_id
    where workspace.id = v_workspace_id
      and workspace.organization_id = v_organization_id
      and workspace.status = 'active'
      and organization.status = 'active'
  ) then
    return false;
  end if;

  return private.has_permission(
    p_permission_key,
    v_organization_id,
    v_workspace_id
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function private.storage_object_scope_allows(text, text, text)
  from public, anon, authenticated;
grant execute on function private.storage_object_scope_allows(text, text, text)
  to authenticated;

drop policy if exists "Njumeni workspace files are readable by scoped members"
  on storage.objects;
create policy "Njumeni workspace files are readable by scoped members"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'njumeni-workspace-files'
    and private.storage_object_scope_allows(bucket_id, name, 'document.read')
  );

drop policy if exists "Njumeni workspace files are writable by scoped editors"
  on storage.objects;
create policy "Njumeni workspace files are writable by scoped editors"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'njumeni-workspace-files'
    and private.storage_object_scope_allows(bucket_id, name, 'document.upload')
  );

drop policy if exists "Njumeni workspace files can be renamed by scoped editors"
  on storage.objects;
create policy "Njumeni workspace files can be renamed by scoped editors"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'njumeni-workspace-files'
    and private.storage_object_scope_allows(bucket_id, name, 'document.upload')
  )
  with check (
    bucket_id = 'njumeni-workspace-files'
    and private.storage_object_scope_allows(bucket_id, name, 'document.upload')
  );

drop policy if exists "Njumeni workspace files can be deleted by scoped editors"
  on storage.objects;
create policy "Njumeni workspace files can be deleted by scoped editors"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'njumeni-workspace-files'
    and private.storage_object_scope_allows(bucket_id, name, 'document.delete')
  );

comment on function private.storage_object_scope_allows(text, text, text) is
  'Authorises private Njumeni workspace object access using an organisation/workspace path and the authenticated principal live permission grants.';
