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
const proxyClient = await readFile(
  new URL('../src/lib/supabase/proxy.ts', import.meta.url),
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

test('sign-in errors do not disclose provider details or reveal account existence', () => {
  assert.match(authActions, /redirect\\('\\/sign-in\\?error=credentials'\\)/);
  assert.doesNotMatch(authActions, /console\\.(?:log|error|warn)/);
  assert.doesNotMatch(authActions, /error\\.message|error\\.code/);
});

test('sign-out ends only the current session and distinguishes unconfirmed revocation', () => {
  assert.match(authActions, /signOut\\(\\{ scope: 'local' \\}\\)/);
  assert.match(authActions, /warning=revocation-unconfirmed/);
  assert.match(authActions, /error=signout/);
});

test('SSR cookie adapters enforce HttpOnly, production Secure, SameSite=Lax and root path', () => {
  for (const source of [serverClient, proxyClient]) {
    assert.match(source, /httpOnly: true/);
    assert.match(source, /secure: process\\.env\\.NODE_ENV === 'production'/);
    assert.match(source, /sameSite: 'lax'/);
    assert.match(source, /path: '\\/'/);
  }
});

test('Proxy forwards refreshed request cookies, response cookies and Supabase cache headers', () => {
  assert.match(proxyClient, /request\\.cookies\\.set\\(name, value\\)/);
  assert.match(proxyClient, /NextResponse\\.next\\(\\{ request \\}\\)/);
  assert.match(proxyClient, /supabaseResponse\\.cookies\\.set/);
  assert.match(proxyClient, /supabaseResponse\\.headers\\.set\\(key, value\\)/);
  assert.match(proxyClient, /await supabase\\.auth\\.getClaims\\(\\)/);
});
