import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const actions = await readFile(
  new URL('../src/app/(workspace)/settings/workspaces/actions.ts', import.meta.url),
  'utf8',
);
const page = await readFile(
  new URL('../src/app/(workspace)/settings/workspaces/page.tsx', import.meta.url),
  'utf8',
);
const panel = await readFile(
  new URL('../src/app/(workspace)/settings/workspaces/RoleManagementPanel.tsx', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL(
    '../../../scripts/db/migration-templates/role_permission_foundation.sql',
    import.meta.url,
  ),
  'utf8',
);

test('role assignment and revocation require authenticated scoped permission checks', () => {
  assert.ok(actions.includes('export async function assignRole'));
  assert.ok(actions.includes('export async function revokeRole'));
  assert.ok(
    actions.includes(
      "scope === 'organization' ? 'organization.manage_roles' : 'workspace.manage_roles'",
    ),
  );
  assert.ok(actions.includes("rpc('assign_organization_role'"));
  assert.ok(actions.includes("rpc('assign_workspace_role'"));
  assert.ok(actions.includes("rpc('revoke_organization_role'"));
  assert.ok(actions.includes("rpc('revoke_workspace_role'"));
  assert.ok(actions.includes('requireAuthenticatedUser()'));
  assert.ok(actions.includes('requirePermission('));
});

test('organisation, workspace, invitation and membership mutations have server-side permission guards', () => {
  assert.ok(actions.includes("requirePermission(supabase, 'workspace.create', organizationId)"));
  assert.ok(
    actions.includes("requirePermission(supabase, 'organization.manage_members', organizationId)"),
  );
  assert.ok(
    actions.includes(
      "requirePermission(supabase, 'workspace.manage_members', workspace.organization_id, membership.workspace_id)",
    ),
  );
  assert.ok(!actions.includes("formData.get('owner_principal_id')"));
  assert.ok(!actions.includes("formData.get('permissions')"));
});

test('role management UI only renders scoped catalogues and server-issued bindings', () => {
  assert.ok(page.includes("rpc('has_permission'"));
  assert.ok(page.includes("rpc('list_assignable_roles'"));
  assert.ok(page.includes("rpc('list_role_bindings'"));
  assert.ok(page.includes('<RoleManagementPanel'));
  assert.ok(panel.includes("scope: 'organization' | 'workspace'"));
  assert.ok(panel.includes('action={assignRole}'));
  assert.ok(panel.includes('action={revokeRole}'));
  assert.ok(panel.includes('role.role_key'));
});

test('permission evaluator is caller-scoped, deny-by-default and validates tenant/workspace context', () => {
  assert.ok(migration.includes('create or replace function private.has_permission'));
  assert.ok(migration.includes('private.current_principal_id()'));
  assert.ok(migration.includes("v_permission_scope <> 'workspace'"));
  assert.ok(migration.includes("and membership.status = 'active'"));
  assert.ok(migration.includes('exception\n  when others then\n    return false'));
  assert.ok(migration.includes('create or replace function public.has_permission'));
});

test('role catalog and role bindings are private and not directly writable by API roles', () => {
  for (const table of [
    'private.permission_catalog',
    'private.role_catalog',
    'private.role_permissions',
    'private.organization_role_bindings',
    'private.workspace_role_bindings',
    'private.role_audit_events',
  ]) {
    assert.ok(migration.includes(`alter table ${table} enable row level security`));
  }
  assert.ok(migration.includes('from public, anon, authenticated'));
  assert.ok(migration.includes('private.role_audit_events'));
});

test('role assignment is membership-bound and restricts privilege escalation', () => {
  assert.ok(migration.includes("membership.status = 'active'"));
  assert.ok(migration.includes("return p_role_key = 'org_member'"));
  assert.ok(
    migration.includes(
      "p_role_key in ('workspace_editor', 'workspace_reviewer', 'workspace_viewer')",
    ),
  );
  assert.ok(migration.includes('p_principal_id = v_owner'));
  assert.ok(migration.includes('on conflict (organization_id, principal_id, role_key) do nothing'));
  assert.ok(migration.includes('on conflict (workspace_id, principal_id, role_key) do nothing'));
});

test('revoked memberships remove role grants and role binding changes are audited', () => {
  assert.ok(migration.includes("if p_status = 'revoked' then"));
  assert.ok(migration.includes('delete from private.organization_role_bindings'));
  assert.ok(migration.includes('delete from private.workspace_role_bindings'));
  assert.ok(migration.includes('create trigger organization_role_bindings_record_event'));
  assert.ok(migration.includes('create trigger workspace_role_bindings_record_event'));
  assert.ok(migration.includes("v_action := 'assigned'"));
  assert.ok(migration.includes("v_action := 'revoked'"));
});

test('built-in roles are scoped and platform operations are excluded', () => {
  assert.ok(migration.includes("('org_admin', 'organization'"));
  assert.ok(migration.includes("('workspace_manager', 'workspace'"));
  assert.ok(!migration.includes("'platform_admin'"));
  assert.ok(!migration.includes("'support.break_glass'"));
  assert.ok(migration.includes("'draft.publish'"));
});
