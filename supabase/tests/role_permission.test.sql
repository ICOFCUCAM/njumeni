begin;

create extension if not exists pgtap with schema extensions;
select plan(55);

insert into auth.users (id, email, email_confirmed_at)
values
  ('30000000-0000-4000-8000-000000000003', 'rbac-owner@njumeni.test', now()),
  ('30000000-0000-4000-8000-000000000004', 'rbac-admin@njumeni.test', now()),
  ('30000000-0000-4000-8000-000000000005', 'rbac-member@njumeni.test', now()),
  ('30000000-0000-4000-8000-000000000006', 'rbac-manager@njumeni.test', now()),
  ('30000000-0000-4000-8000-000000000007', 'rbac-viewer@njumeni.test', now());

select set_config('njumeni.rbac.owner_user', '30000000-0000-4000-8000-000000000003', true);
select set_config('njumeni.rbac.admin_user', '30000000-0000-4000-8000-000000000004', true);
select set_config('njumeni.rbac.member_user', '30000000-0000-4000-8000-000000000005', true);
select set_config('njumeni.rbac.manager_user', '30000000-0000-4000-8000-000000000006', true);
select set_config('njumeni.rbac.viewer_user', '30000000-0000-4000-8000-000000000007', true);

select set_config(
  'njumeni.rbac.owner_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '30000000-0000-4000-8000-000000000003'),
  true
);
select set_config(
  'njumeni.rbac.admin_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '30000000-0000-4000-8000-000000000004'),
  true
);
select set_config(
  'njumeni.rbac.member_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '30000000-0000-4000-8000-000000000005'),
  true
);
select set_config(
  'njumeni.rbac.manager_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '30000000-0000-4000-8000-000000000006'),
  true
);
select set_config(
  'njumeni.rbac.viewer_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '30000000-0000-4000-8000-000000000007'),
  true
);

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';

select lives_ok(
  $$insert into public.organizations (name, slug, kind)
    values ('RBAC Test Organisation', 'rbac-test-organisation', 'law_firm')$$,
  'Owner can create an organisation for RBAC tests'
);

select set_config(
  'njumeni.rbac.organization_id',
  (select id::text from public.organizations where slug = 'rbac-test-organisation'),
  true
);

select lives_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
    values (current_setting('njumeni.rbac.organization_id')::uuid, 'RBAC Main Workspace', 'rbac-main-workspace', 'team')$sql$,
  'Owner can create the RBAC workspace'
);

select set_config(
  'njumeni.rbac.workspace_id',
  (select id::text from public.workspaces where slug = 'rbac-main-workspace'),
  true
);

select lives_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
    values (current_setting('njumeni.rbac.organization_id')::uuid, 'RBAC Other Workspace', 'rbac-other-workspace', 'team')$sql$,
  'Owner can create a second workspace for isolation tests'
);

select set_config(
  'njumeni.rbac.other_workspace_id',
  (select id::text from public.workspaces where slug = 'rbac-other-workspace'),
  true
);

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values
      (current_setting('njumeni.rbac.organization_id')::uuid, 'rbac-admin@njumeni.test', repeat('a', 64), now() + interval '7 days'),
      (current_setting('njumeni.rbac.organization_id')::uuid, 'rbac-member@njumeni.test', repeat('b', 64), now() + interval '7 days'),
      (current_setting('njumeni.rbac.organization_id')::uuid, 'rbac-manager@njumeni.test', repeat('c', 64), now() + interval '7 days'),
      (current_setting('njumeni.rbac.organization_id')::uuid, 'rbac-viewer@njumeni.test', repeat('d', 64), now() + interval '7 days')$sql$,
  'Owner can issue email-bound organisation invitations'
);

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, workspace_id, email_normalized, token_hash, expires_at)
    values
      (current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid, 'rbac-admin@njumeni.test', repeat('e', 64), now() + interval '7 days'),
      (current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid, 'rbac-member@njumeni.test', repeat('f', 64), now() + interval '7 days'),
      (current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid, 'rbac-manager@njumeni.test', repeat('1', 64), now() + interval '7 days'),
      (current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid, 'rbac-viewer@njumeni.test', repeat('2', 64), now() + interval '7 days')$sql$,
  'Owner can issue workspace-scoped invitations'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000004';
select lives_ok($$select * from public.accept_organization_invitation(repeat('a', 64))$$, 'Admin identity accepts its organisation invitation');
select lives_ok($$select * from public.accept_organization_invitation(repeat('e', 64))$$, 'Admin identity accepts its workspace invitation');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000005';
select lives_ok($$select * from public.accept_organization_invitation(repeat('b', 64))$$, 'Member identity accepts its organisation invitation');
select lives_ok($$select * from public.accept_organization_invitation(repeat('f', 64))$$, 'Member identity accepts its workspace invitation');

select lives_ok(
  $insert into public.workspaces (organization_id, name, slug, kind)
    values (current_setting('njumeni.rbac.organization_id')::uuid, 'Admin Created Workspace', 'rbac-admin-created-workspace', 'team')$,
  'Organisation administrator can create a workspace through the scoped permission policy'
);

select is(
  (select count(*) from public.workspaces where slug = 'rbac-admin-created-workspace'),
  1::bigint,
  'Organisation administrator can read workspace administration metadata'
);

select lives_ok(
  $update public.workspaces
    set name = 'Admin Updated Workspace'
    where id = current_setting('njumeni.rbac.workspace_id')::uuid$,
  'Organisation administrator can update workspace metadata without changing its immutable creator'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000006';
select lives_ok($$select * from public.accept_organization_invitation(repeat('c', 64))$$, 'Workspace manager identity accepts its organisation invitation');
select lives_ok($$select * from public.accept_organization_invitation(repeat('1', 64))$$, 'Workspace manager identity accepts its workspace invitation');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000007';
select lives_ok($$select * from public.accept_organization_invitation(repeat('d', 64))$$, 'Viewer identity accepts its organisation invitation');
select lives_ok($$select * from public.accept_organization_invitation(repeat('2', 64))$$, 'Viewer identity accepts its workspace invitation');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';

select lives_ok(
  $$select public.assign_organization_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.admin_principal')::uuid,
    'org_admin'
  )$$,
  'Owner can assign organisation administrator'
);

select lives_ok(
  $$select public.assign_organization_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.member_principal')::uuid,
    'org_member'
  )$$,
  'Owner can assign organisation member'
);

select lives_ok(
  $$select public.assign_workspace_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.workspace_id')::uuid,
    current_setting('njumeni.rbac.manager_principal')::uuid,
    'workspace_manager'
  )$$,
  'Owner can assign workspace manager'
);

select lives_ok(
  $$select public.assign_workspace_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.workspace_id')::uuid,
    current_setting('njumeni.rbac.member_principal')::uuid,
    'workspace_editor'
  )$$,
  'Owner can assign workspace editor'
);

select lives_ok(
  $$select public.assign_workspace_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.workspace_id')::uuid,
    current_setting('njumeni.rbac.viewer_principal')::uuid,
    'workspace_viewer'
  )$$,
  'Owner can assign workspace viewer'
);

select is(
  public.has_permission('organization.manage_roles', current_setting('njumeni.rbac.organization_id')::uuid),
  true,
  'Organisation owner has scoped organisation role-management authority'
);

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  true,
  'Organisation owner has scoped workspace authority'
);

select is(
  public.has_permission('permission.does_not_exist', current_setting('njumeni.rbac.organization_id')::uuid),
  false,
  'Unknown permission is denied'
);

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, null),
  false,
  'Workspace permission without workspace context is denied'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000004';

select is(
  public.has_permission('organization.manage_members', current_setting('njumeni.rbac.organization_id')::uuid),
  true,
  'Organisation administrator can manage organisation members'
);

select is(
  public.has_permission('workspace.manage_roles', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  true,
  'Organisation administrator can manage workspace roles without gaining workspace content access'
);

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  false,
  'Organisation administrator does not automatically gain workspace content access'
);

select is(
  (select count(*) from public.list_assignable_roles(current_setting('njumeni.rbac.organization_id')::uuid)),
  1::bigint,
  'Organisation administrator can assign only the non-privileged organisation member role'
);

select throws_ok(
  $$select public.assign_organization_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.member_principal')::uuid,
    'org_admin'
  )$$,
  '42501',
  'Role cannot be assigned',
  'Organisation administrator cannot grant another organisation administrator'
);

select throws_ok(
  $$select public.assign_organization_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.member_principal')::uuid,
    'org_billing_manager'
  )$$,
  '42501',
  'Role cannot be assigned',
  'Organisation administrator cannot grant billing manager'
);

select lives_ok(
  $$select public.assign_workspace_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.workspace_id')::uuid,
    current_setting('njumeni.rbac.viewer_principal')::uuid,
    'workspace_reviewer'
  )$$,
  'Organisation administrator can assign a non-privileged workspace role'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000006';

select is(
  public.has_permission('workspace.manage_roles', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  true,
  'Workspace manager has workspace-scoped role-management permission'
);

select is(
  public.has_permission('organization.manage_roles', current_setting('njumeni.rbac.organization_id')::uuid),
  false,
  'Workspace manager cannot manage organisation roles'
);

select lives_ok(
  $$select public.assign_workspace_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.workspace_id')::uuid,
    current_setting('njumeni.rbac.viewer_principal')::uuid,
    'workspace_editor'
  )$$,
  'Workspace manager can assign a lower-privilege editor role'
);

select throws_ok(
  $$select public.assign_workspace_role(
    current_setting('njumeni.rbac.organization_id')::uuid,
    current_setting('njumeni.rbac.workspace_id')::uuid,
    current_setting('njumeni.rbac.viewer_principal')::uuid,
    'workspace_manager'
  )$$,
  '42501',
  'Role cannot be assigned',
  'Workspace manager cannot grant another workspace manager'
);

select lives_ok(
  $select public.set_workspace_membership_status(
    (select id from public.workspace_memberships
     where workspace_id = current_setting('njumeni.rbac.workspace_id')::uuid
       and principal_id = current_setting('njumeni.rbac.viewer_principal')::uuid),
    'suspended'
  )$,
  'Workspace manager can suspend a member in the managed workspace'
);

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.other_workspace_id')::uuid),
  false,
  'Workspace manager cannot access a different workspace'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000007';

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  true,
  'Workspace viewer can read the assigned workspace'
);

select is(
  public.has_permission('document.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  true,
  'Workspace viewer can read documents'
);

select is(
  public.has_permission('document.upload', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  false,
  'Workspace viewer cannot upload documents'
);

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  false,
  'Suspended workspace membership immediately disables viewer permissions'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';

select is(
  public.has_permission('workspace.read', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.other_workspace_id')::uuid),
  false,
  'Workspace viewer cannot read a different workspace'
);

select throws_ok(
  $$select * from public.list_role_bindings(current_setting('njumeni.rbac.organization_id')::uuid)$$,
  '42501',
  'Role bindings are not available in this scope',
  'Viewer cannot inspect role bindings'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';

select lives_ok(
  $$select public.set_organization_membership_status(
    (select id from public.organization_memberships
     where organization_id = current_setting('njumeni.rbac.organization_id')::uuid
       and principal_id = current_setting('njumeni.rbac.manager_principal')::uuid),
    'suspended'
  )$$,
  'Owner can suspend an organisation member with assigned roles'
);

select lives_ok(
  $select public.set_organization_membership_status(
    (select id from public.organization_memberships
     where organization_id = current_setting('njumeni.rbac.organization_id')::uuid
       and principal_id = current_setting('njumeni.rbac.manager_principal')::uuid),
    'revoked'
  )$,
  'Owner can revoke a previously suspended organisation membership'
);

select is(
  (select count(*) from private.workspace_role_bindings
   where principal_id = current_setting('njumeni.rbac.manager_principal')::uuid),
  0::bigint,
  'Revoked organisation membership removes all workspace role bindings'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000006';

select is(
  public.has_permission('workspace.manage_roles', current_setting('njumeni.rbac.organization_id')::uuid, current_setting('njumeni.rbac.workspace_id')::uuid),
  false,
  'Suspended organisation membership immediately disables workspace roles'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';

select lives_ok(
  $select public.revoke_workspace_role(
    (select binding_id
     from public.list_role_bindings(
       current_setting('njumeni.rbac.organization_id')::uuid,
       current_setting('njumeni.rbac.workspace_id')::uuid
     )
     where principal_id = current_setting('njumeni.rbac.viewer_principal')::uuid
       and role_key = 'workspace_viewer')
  )$,
  'Owner can revoke a workspace role binding'
);

select ok(
  (select count(*) from private.role_audit_events) >= 8,
  'Role assignments and revocations produce private audit events'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000007';

select throws_ok(
  $$select * from private.role_catalog$$,
  '42501',
  null,
  'Authenticated users cannot directly read the private role catalogue'
);

select throws_ok(
  $$insert into private.organization_role_bindings
    (organization_id, principal_id, role_key, assigned_by_principal_id)
    values (
      current_setting('njumeni.rbac.organization_id')::uuid,
      current_setting('njumeni.rbac.viewer_principal')::uuid,
      'org_admin',
      current_setting('njumeni.rbac.viewer_principal')::uuid
    )$$,
  '42501',
  null,
  'Authenticated users cannot directly insert role bindings'
);

reset role;
select is(
  has_function_privilege('anon', 'public.has_permission(text,uuid,uuid)', 'EXECUTE'),
  false,
  'Anonymous users cannot execute the permission evaluator'
);

select is(
  has_function_privilege('authenticated', 'public.has_permission(text,uuid,uuid)', 'EXECUTE'),
  true,
  'Authenticated users can execute the caller-scoped permission evaluator'
);

select is(
  (select count(*) from private.permission_catalog where permission_key = 'draft.publish'),
  1::bigint,
  'Future permissions are registered without implying feature implementation'
);

select * from finish();
rollback;
