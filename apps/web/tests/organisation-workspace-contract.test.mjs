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
const shell = await readFile(
  new URL('../src/components/workspace-shell.tsx', import.meta.url),
  'utf8',
);
const layout = await readFile(
  new URL('../src/app/(workspace)/layout.tsx', import.meta.url),
  'utf8',
);

test('organisation and workspace actions resolve the authenticated principal server-side', () => {
  assert.ok(actions.includes('supabase.auth.getUser()'));
  assert.ok(actions.includes(".from('organizations')"));
  assert.ok(actions.includes(".from('workspaces')"));
  assert.ok(actions.includes('createSlug'));
  assert.ok(!actions.includes("formData.get('owner_principal_id')"));
  assert.ok(!actions.includes("formData.get('created_by_principal_id')"));
  assert.ok(!actions.includes("formData.get('user_id')"));
  assert.ok(!actions.includes("formData.get('role')"));
  assert.ok(actions.includes("formData.get('status')"));
  assert.ok(actions.includes("status !== 'suspended' && status !== 'revoked'"));
  assert.ok(!actions.includes("formData.get('role')"));
  assert.ok(!actions.includes('service_role'));
});

test('organisation and workspace actions accept only bounded domain fields', () => {
  for (const field of ['name', 'kind', 'organization_id']) {
    assert.ok(actions.includes("'" + field + "'"), 'missing validated field: ' + field);
  }
  assert.ok(actions.includes('ORGANISATION_KINDS'));
  assert.ok(actions.includes('WORKSPACE_KINDS'));
  assert.ok(actions.includes('revalidatePath'));
});

test('workspace settings page reads only caller-visible organisations and nested workspaces', () => {
  assert.ok(page.includes("export const dynamic = 'force-dynamic'"));
  assert.ok(page.includes(".from('organizations')"));
  assert.ok(page.includes(".from('workspaces')"));
  assert.ok(page.includes('.in('));
  assert.ok(page.includes("'organization_id'"));
  assert.ok(page.includes('action={createOrganization}'));
  assert.ok(page.includes('action={createWorkspace}'));
  assert.ok(!page.includes('owner_principal_id'));
  assert.ok(!page.includes('created_by_principal_id'));
});

test('workspace shell and protected layout display the server-resolved personal tenant', () => {
  assert.ok(shell.includes("href: '/settings/workspaces'"));
  assert.ok(shell.includes('organizationName'));
  assert.ok(shell.includes('workspaceName'));
  assert.ok(layout.includes(".from('organizations')"));
  assert.ok(layout.includes(".from('workspaces')"));
  assert.ok(layout.includes("eq('kind', 'personal')"));
});
