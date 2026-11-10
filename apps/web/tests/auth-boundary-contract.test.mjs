import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const authActions = await readFile(
  new URL('../src/app/(auth)/actions.ts', import.meta.url),
  'utf8',
);
const workspaceLayout = await readFile(
  new URL('../src/app/(workspace)/layout.tsx', import.meta.url),
  'utf8',
);
const serverClient = await readFile(
  new URL('../src/lib/supabase/server.ts', import.meta.url),
  'utf8',
);

test('sign-in does not accept an untrusted return URL and redirects to a fixed workspace route', () => {
  assert.match(authActions, /export async function signIn\(formData: FormData\)/);
  assert.match(authActions, /redirect\('\/dashboard'\)/);
  assert.doesNotMatch(authActions, /redirectTo|returnTo|callbackUrl|searchParams\.get\(['"]next/);
  assert.doesNotMatch(authActions, /new URL\([^\n]*(?:formData|searchParams)/);
});

test('protected workspace boundary verifies the current provider user', () => {
  assert.match(workspaceLayout, /supabase\.auth\.getUser\(\)/);
  assert.match(workspaceLayout, /if \(error \|\| !user\) redirect\('\/sign-in'\)/);
  assert.doesNotMatch(workspaceLayout, /supabase\.auth\.getClaims\(\)/);
});

test('server Supabase client is server-only and uses no privileged key', () => {
  assert.match(serverClient, /import 'server-only'/);
  assert.match(serverClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(serverClient, /SERVICE_ROLE|service_role|SUPABASE_SECRET_KEY/);
});
