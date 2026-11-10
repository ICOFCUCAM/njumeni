import assert from 'node:assert/strict';
import test from 'node:test';
import { createServerClient } from '@supabase/ssr';

const projectUrl = 'https://auth-test.invalid';
const publishableKey = 'sb_publishable_auth_test_key';
const testUser = {
  id: '2f64e9a6-6e3f-4cc5-bc2a-3a6e8c5e9a10',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'auth-test@njumeni.invalid',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00.000Z',
};

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeJwt(exp, sub = testUser.id) {
  return [
    encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64Url({ aud: 'authenticated', exp, role: 'authenticated', sub }),
    'test-signature',
  ].join('.');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createHarness({ logoutStatus = 204, tokenStatus = 200 } = {}) {
  const cookies = new Map();
  let userStatus = 200;
  const requests = [];
  const accessToken = makeJwt(Math.floor(Date.now() / 1000) + 3600);
  const rotatedAccessToken = makeJwt(Math.floor(Date.now() / 1000) + 7200);

  const fetch = async (input, init = {}) => {
    const requestUrl = new URL(input instanceof Request ? input.url : String(input));
    const method = init.method ?? (input instanceof Request ? input.method : 'GET');
    const headers = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    requests.push({
      url: requestUrl,
      method,
      body: init.body,
      authorization: headers.get('Authorization'),
    });

    if (requestUrl.pathname.endsWith('/user')) {
      return userStatus === 200
        ? jsonResponse(testUser)
        : jsonResponse({ code: 'user_not_found', message: 'User not found' }, userStatus);
    }

    if (requestUrl.pathname.endsWith('/logout')) {
      return logoutStatus === 204
        ? new Response(null, { status: 204 })
        : jsonResponse({ message: 'Auth server unavailable' }, logoutStatus);
    }

    if (requestUrl.pathname.endsWith('/token')) {
      if (tokenStatus !== 200) {
        return jsonResponse(
          { code: 'invalid_grant', message: 'Invalid Refresh Token: Refresh Token Not Found' },
          tokenStatus,
        );
      }

      return jsonResponse({
        access_token: rotatedAccessToken,
        token_type: 'bearer',
        expires_in: 7200,
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        refresh_token: 'rotated-refresh-token',
        user: testUser,
      });
    }

    return jsonResponse({ message: 'Unexpected mocked Auth request' }, 404);
  };

  const client = createServerClient(projectUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch },
    cookies: {
      getAll() {
        return Array.from(cookies, ([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          if (!value || options?.maxAge === 0) cookies.delete(name);
          else cookies.set(name, value);
        }
      },
    },
  });

  return {
    client,
    cookies,
    requests,
    accessToken,
    rotatedAccessToken,
    setUserStatus(status) {
      userStatus = status;
    },
  };
}

async function establishSession(client, accessToken) {
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: 'initial-refresh-token',
  });
  assert.equal(error, null);
  assert.equal(data.user?.id, testUser.id);
}

test('local sign-out clears SSR cookies and uses local scope', async () => {
  const harness = createHarness();
  await establishSession(harness.client, harness.accessToken);
  assert.ok(harness.cookies.size > 0, 'session cookies should be written before sign-out');

  const { error } = await harness.client.auth.signOut({ scope: 'local' });

  assert.equal(error, null);
  assert.equal(harness.cookies.size, 0, 'local sign-out should clear the SSR cookie session');
  const { data: localSession } = await harness.client.auth.getSession();
  assert.equal(localSession.session, null, 'the signed-out SSR client must have no local session');
  assert.ok(
    harness.requests.some(
      ({ url, method }) =>
        url.pathname.endsWith('/logout') &&
        url.searchParams.get('scope') === 'local' &&
        method === 'POST',
    ),
    'Auth should receive a local-scope logout request',
  );
});

test('local logout failure still clears SSR cookies', async () => {
  const harness = createHarness({ logoutStatus: 503 });
  await establishSession(harness.client, harness.accessToken);

  const { error } = await harness.client.auth.signOut({ scope: 'local' });

  assert.ok(error, 'the remote revocation failure should be returned to the caller');
  assert.equal(harness.cookies.size, 0, 'local session cookies must still be cleared');
});

test('refreshSession persists a rotated access and refresh token', async () => {
  const harness = createHarness();
  await establishSession(harness.client, harness.accessToken);

  const { data, error } = await harness.client.auth.refreshSession();

  assert.equal(error, null);
  assert.equal(data.session?.access_token, harness.rotatedAccessToken);
  assert.equal(data.session?.refresh_token, 'rotated-refresh-token');
  assert.ok(
    harness.requests.some(
      ({ url }) =>
        url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'refresh_token',
    ),
    'Auth should receive a refresh-token grant',
  );
  assert.ok(harness.cookies.size > 0, 'rotated session should remain persisted in SSR cookies');
});

test('provider-side deleted or revoked user is rejected by getUser', async () => {
  const harness = createHarness();
  await establishSession(harness.client, harness.accessToken);

  // Simulate Supabase Auth rejecting the principal on its authoritative user endpoint.
  harness.setUserStatus(401);
  const { data, error } = await harness.client.auth.getUser();

  assert.ok(error, 'provider-side user rejection must be surfaced');
  assert.equal(
    data.user,
    null,
    'a rejected provider identity must not be returned as authenticated',
  );
  assert.ok(
    harness.requests.some(({ url }) => url.pathname.endsWith('/user')),
    'the server must consult the provider user endpoint rather than trust local claims alone',
  );
});

test(
  'a tampered access token is sent for authoritative provider verification and rejected',
  async () => {
  const harness = createHarness();
  harness.setUserStatus(401);
  const tamperedAccessToken = 'tampered-access-token-not-a-valid-jwt';

    const { data, error } = await harness.client.auth.getUser(tamperedAccessToken);

    assert.ok(error, 'the Auth provider must reject a tampered access token');
    assert.equal(data.user, null, 'a rejected token must not produce an authenticated user');
    assert.ok(
      harness.requests.some(
        ({ url, authorization }) =>
          url.pathname.endsWith('/user') && authorization === `Bearer ${tamperedAccessToken}`,
      ),
      'the explicit token must be sent to the authoritative Auth user endpoint',
    );
  },
);

test('a rejected refresh token is surfaced without issuing a replacement session', async () => {
  const harness = createHarness({ tokenStatus: 400 });
  await establishSession(harness.client, harness.accessToken);
  const cookiesBeforeRefresh = Array.from(harness.cookies.entries());

  const { error } = await harness.client.auth.refreshSession();

  assert.ok(error, 'the revoked refresh token should be rejected');
  assert.deepEqual(
    Array.from(harness.cookies.entries()),
    cookiesBeforeRefresh,
    'a rejected refresh must not persist a replacement session',
  );
  assert.ok(
    harness.cookies.size > 0,
    'an unexpired access-token cookie may remain valid until its expiry even after refresh is rejected',
  );
});
