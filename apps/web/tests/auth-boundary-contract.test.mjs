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
  assert.ok(authActions.includes('export async function signIn(formData: FormData)'));
  assert.ok(authActions.includes("redirect('/dashboard')"));
  for (const input of ['redirectTo', 'returnTo', 'callbackUrl', "searchParams.get('next"]) {
    assert.ok(!authActions.includes(input), `unexpected return URL input: ${input}`);
  }
  assert.ok(!authActions.includes('new URL('));
});

test('protected workspace boundary verifies the current provider user', () => {
  assert.ok(workspaceLayout.includes('supabase.auth.getUser()'));
  assert.ok(workspaceLayout.includes("redirect('/sign-in')"));
  assert.ok(!workspaceLayout.includes('supabase.auth.getClaims()'));
});

test('server Supabase client is server-only and uses no privileged key', () => {
  assert.ok(serverClient.includes("import 'server-only'"));
  assert.ok(serverClient.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
  for (const key of ['SERVICE_ROLE', 'service_role', 'SUPABASE_SECRET_KEY']) {
    assert.ok(!serverClient.includes(key));
  }
});

test('sign-in errors do not disclose provider details or reveal account existence', () => {
  assert.ok(authActions.includes("redirect('/sign-in?error=credentials')"));
  assert.ok(!authActions.includes('console.log'));
  assert.ok(!authActions.includes('console.error'));
  assert.ok(!authActions.includes('error.message'));
  assert.ok(!authActions.includes('error.code'));
});

test('sign-out ends only the current session and distinguishes unconfirmed revocation', () => {
  assert.ok(authActions.includes("signOut({ scope: 'local' })"));
  assert.ok(authActions.includes('warning=revocation-unconfirmed'));
  assert.ok(authActions.includes('error=signout'));
});

test('SSR cookie adapters enforce HttpOnly, production Secure, SameSite=Lax and root path', () => {
  for (const source of [serverClient, proxyClient]) {
    assert.ok(source.includes('httpOnly: true'));
    assert.ok(source.includes("secure: process.env.NODE_ENV === 'production'"));
    assert.ok(source.includes("sameSite: 'lax'"));
    assert.ok(source.includes("path: '/'"));
  }
});

test('Proxy forwards refreshed request cookies, response cookies and Supabase cache headers', () => {
  assert.ok(proxyClient.includes('request.cookies.set(name, value)'));
  assert.ok(proxyClient.includes('NextResponse.next({ request })'));
  assert.ok(proxyClient.includes('supabaseResponse.cookies.set'));
  assert.ok(proxyClient.includes('supabaseResponse.headers.set(key, value)'));
  assert.ok(proxyClient.includes('await supabase.auth.getClaims()'));
});
