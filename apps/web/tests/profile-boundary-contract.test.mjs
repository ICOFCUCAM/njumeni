import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const action = await readFile(
  new URL('../src/app/(workspace)/settings/profile/actions.ts', import.meta.url),
  'utf8',
);
const page = await readFile(
  new URL('../src/app/(workspace)/settings/profile/page.tsx', import.meta.url),
  'utf8',
);
const shell = await readFile(
  new URL('../src/components/workspace-shell.tsx', import.meta.url),
  'utf8',
);
const databaseTypes = await readFile(
  new URL('../src/lib/supabase/database.types.ts', import.meta.url),
  'utf8',
);
const supabaseServer = await readFile(
  new URL('../src/lib/supabase/server.ts', import.meta.url),
  'utf8',
);

test('profile updates require a verified Supabase user and resolve the principal server-side', () => {
  assert.ok(action.includes('supabase.auth.getUser()'));
  assert.ok(action.includes(".select('principal_id')"));
  assert.ok(action.includes(".eq('principal_id', profile.principal_id)"));
  assert.ok(!action.includes("formData.get('principal_id')"));
  assert.ok(!action.includes("formData.get('role')"));
  assert.ok(!action.includes("formData.get('status')"));
});

test('profile updates accept only bounded presentation fields', () => {
  for (const name of [
    'display_name',
    'given_name',
    'family_name',
    'avatar_url',
    'locale',
    'timezone',
  ]) {
    assert.ok(action.includes("'" + name + "'"), 'missing field validation: ' + name);
  }
  assert.ok(action.includes('normalizeProfileLocale'));
  assert.ok(action.includes('isValidHttpsUrl'));
  assert.ok(action.includes('isValidTimeZone'));
  assert.ok(!action.includes('user_metadata'));
});

test('profile page is dynamic and reads only profile fields', () => {
  assert.ok(page.includes("export const dynamic = 'force-dynamic'"));
  assert.ok(page.includes(".from('user_profiles')"));
  assert.ok(!page.includes('principal_id'));
  assert.ok(!page.includes(".select('role')"));
  assert.ok(!page.includes(".select('status')"));
});

test('workspace navigation exposes the profile settings route', () => {
  assert.ok(shell.includes("href: '/settings/profile'"));
});


test('profile schema is represented by generated database types and used by the server client', () => {
  assert.ok(databaseTypes.includes('user_profiles'));
  for (const field of ['principal_id', 'display_name', 'given_name', 'family_name', 'avatar_url', 'locale', 'timezone']) {
    assert.ok(databaseTypes.includes(field), 'missing generated profile field: ' + field);
  }
  assert.ok(supabaseServer.includes('createServerClient<Database>'));
  assert.ok(supabaseServer.includes("import type { Database } from './database.types'"));
});
