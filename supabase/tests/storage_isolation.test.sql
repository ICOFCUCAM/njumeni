begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, email_confirmed_at)
values
  ('40000000-0000-4000-8000-000000000001', 'storage-owner-a@njumeni.test', now()),
  ('40000000-0000-4000-8000-000000000002', 'storage-owner-b@njumeni.test', now());

set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000001';

select lives_ok(
  $sql$insert into public.organizations (name, slug, kind)
    values ('Storage Tenant A', 'storage-tenant-a', 'law_firm')$sql$,
  'Tenant A owner can create a synthetic organisation'
);
select set_config(
  'njumeni.storage.organization_a',
  (select id::text from public.organizations where slug = 'storage-tenant-a'),
  true
);
select lives_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
    values (
      current_setting('njumeni.storage.organization_a')::uuid,
      'Storage Workspace A',
      'storage-workspace-a',
      'matter'
    )$sql$,
  'Tenant A owner can create a synthetic matter workspace'
);
select set_config(
  'njumeni.storage.workspace_a',
  (select id::text from public.workspaces where slug = 'storage-workspace-a'),
  true
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000002';

select lives_ok(
  $sql$insert into public.organizations (name, slug, kind)
    values ('Storage Tenant B', 'storage-tenant-b', 'law_firm')$sql$,
  'Tenant B owner can create a separate synthetic organisation'
);
select set_config(
  'njumeni.storage.organization_b',
  (select id::text from public.organizations where slug = 'storage-tenant-b'),
  true
);
select lives_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
    values (
      current_setting('njumeni.storage.organization_b')::uuid,
      'Storage Workspace B',
      'storage-workspace-b',
      'matter'
    )$sql$,
  'Tenant B owner can create a separate workspace'
);
select set_config(
  'njumeni.storage.workspace_b',
  (select id::text from public.workspaces where slug = 'storage-workspace-b'),
  true
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000001';

select is(
  (select private.storage_object_scope_allows(
    'njumeni-workspace-files',
    current_setting('njumeni.storage.organization_a') || '/' ||
      current_setting('njumeni.storage.workspace_a') ||
      '/50000000-0000-4000-8000-000000000001/original.pdf',
    'document.upload'
  )),
  true,
  'Tenant A owner is authorised for a correctly scoped workspace object'
);

select lives_ok(
  $sql$insert into storage.objects (bucket_id, name)
    values (
      'njumeni-workspace-files',
      current_setting('njumeni.storage.organization_a') || '/' ||
        current_setting('njumeni.storage.workspace_a') ||
        '/50000000-0000-4000-8000-000000000001/original.pdf'
    )$sql$,
  'Tenant A owner can insert an object under its organisation/workspace path'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'njumeni-workspace-files'
     and name = current_setting('njumeni.storage.organization_a') || '/' ||
       current_setting('njumeni.storage.workspace_a') ||
       '/50000000-0000-4000-8000-000000000001/original.pdf'),
  1::bigint,
  'Tenant A owner can read its own workspace object'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from storage.objects
   where bucket_id = 'njumeni-workspace-files'
     and name = current_setting('njumeni.storage.organization_a') || '/' ||
       current_setting('njumeni.storage.workspace_a') ||
       '/50000000-0000-4000-8000-000000000001/original.pdf'),
  0::bigint,
  'Tenant B owner cannot read Tenant A object metadata'
);

select throws_ok(
  $sql$insert into storage.objects (bucket_id, name)
    values (
      'njumeni-workspace-files',
      current_setting('njumeni.storage.organization_a') || '/' ||
        current_setting('njumeni.storage.workspace_a') ||
        '/50000000-0000-4000-8000-000000000002/forbidden.pdf'
    )$sql$,
  '42501',
  null,
  'Tenant B owner cannot write into Tenant A workspace'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000001';

select is(
  (select private.storage_object_scope_allows(
    'njumeni-workspace-files',
    current_setting('njumeni.storage.organization_a') || '/' ||
      current_setting('njumeni.storage.workspace_b') ||
      '/50000000-0000-4000-8000-000000000003/wrong-workspace.pdf',
    'document.upload'
  )),
  false,
  'An organisation/workspace mismatch is denied'
);

select is(
  (select private.storage_object_scope_allows(
    'njumeni-workspace-files',
    'not-a-tenant/not-a-workspace/not-a-file/invalid.pdf',
    'document.upload'
  )),
  false,
  'Malformed object paths are denied without UUID cast errors'
);

select is(
  (select private.storage_object_scope_allows(
    'njumeni-workspace-files',
    current_setting('njumeni.storage.organization_a') || '/' ||
      current_setting('njumeni.storage.workspace_a') ||
      '/50000000-0000-4000-8000-000000000004/original.pdf',
    'billing.manage'
  )),
  false,
  'Storage helper rejects permissions outside its fixed allow-list'
);

reset role;
select is(
  has_function_privilege(
    'anon',
    'private.storage_object_scope_allows(text,text,text)',
    'EXECUTE'
  ),
  false,
  'Anonymous users cannot execute the private storage authorisation helper'
);

select is(
  (select public from storage.buckets where id = 'njumeni-workspace-files'),
  false,
  'The Njumeni workspace file bucket is private'
);

select * from finish();
rollback;
