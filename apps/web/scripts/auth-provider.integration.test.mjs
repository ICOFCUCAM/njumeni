import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const requiredEnvironment = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NJUMENI_TEST_EMAIL',
  'NJUMENI_TEST_PASSWORD',
];

const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

test(
  'Njumeni Auth provider lifecycle rejects a refresh token after sign-out',
  {
    skip:
      missingEnvironment.length > 0
        ? `Missing required environment: ${missingEnvironment.join(', ')}`
        : false,
  },
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );

    const signIn = await supabase.auth.signInWithPassword({
      email: process.env.NJUMENI_TEST_EMAIL,
      password: process.env.NJUMENI_TEST_PASSWORD,
    });
    assert.ifError(signIn.error);
    assert.ok(signIn.data.session, 'Provider must issue an authenticated session');
    assert.ok(signIn.data.user, 'Provider must return the authenticated user');

    const verifiedUser = await supabase.auth.getUser();
    assert.ifError(verifiedUser.error);
    assert.equal(verifiedUser.data.user?.id, signIn.data.user.id);

    const refreshed = await supabase.auth.refreshSession();
    assert.ifError(refreshed.error);
    assert.ok(refreshed.data.session, 'Provider must issue a refreshed session');
    const refreshTokenToRevoke = refreshed.data.session.refresh_token;
    assert.ok(refreshTokenToRevoke, 'Refreshed session must include a refresh token');

    const signedOut = await supabase.auth.signOut({ scope: 'local' });
    assert.ifError(signedOut.error);

    const verifier = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    const reuseAttempt = await verifier.auth.refreshSession({
      refresh_token: refreshTokenToRevoke,
    });
    assert.ok(
      reuseAttempt.error,
      'A refresh token revoked by sign-out must not establish a new session',
    );
    assert.equal(reuseAttempt.data.session, null);
  },
);
