import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizeInvitationEmail, parseInvitationExpiryDays } from '../src/lib/invitation-validation.ts';

const actions = await readFile(
  new URL('../src/app/(workspace)/settings/workspaces/actions.ts', import.meta.url),
  'utf8',
);
const invitationForm = await readFile(
  new URL('../src/app/(workspace)/settings/workspaces/InvitationForm.tsx', import.meta.url),
  'utf8',
);
const acceptForm = await readFile(
  new URL('../src/app/(auth)/invitations/accept/AcceptInvitationForm.tsx', import.meta.url),
  'utf8',
);
const acceptPage = await readFile(
  new URL('../src/app/(auth)/invitations/accept/page.tsx', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL(
    '../../../supabase/migrations/20261110155456_membership_invitation_lifecycle.sql',
    import.meta.url,
  ),
  'utf8',
);
const accessMigration = await readFile(
  new URL(
    '../../../supabase/migrations/20261110160651_membership_invitation_access_policies.sql',
    import.meta.url,
  ),
  'utf8',
);

test('invitation creation generates a high-entropy token and stores only its hash', () => {
  assert.ok(actions.includes("randomBytes(32).toString('base64url')"));
  assert.ok(actions.includes("createHash('sha256').update(token).digest('hex')"));
  assert.ok(actions.includes('token_hash: tokenHash'));
  assert.ok(actions.includes('email_normalized: email'));
  assert.ok(actions.includes('expiryDays < 1'));
  assert.ok(actions.includes('expiryDays > 30'));
  assert.ok(actions.includes('supabase.auth.getUser()'));
  assert.ok(!actions.includes('service_role'));
  assert.ok(!actions.includes('user_metadata'));
});

test('invitation acceptance requires a verified signed-in identity and hashes the raw token server-side', () => {
  assert.ok(actions.includes('export async function acceptInvitation'));
  assert.ok(
    actions.includes("const tokenHash = createHash('sha256').update(tokenValue).digest('hex')"),
  );
  assert.ok(actions.includes("rpc('accept_organization_invitation'"));
  assert.ok(actions.includes("return { error: 'sign-in-required' }"));
  assert.ok(actions.includes("return { error: 'invalid' }"));
});

test('membership changes are restricted to owner-checked lifecycle RPCs', () => {
  assert.ok(actions.includes("rpc('revoke_organization_invitation'"));
  assert.ok(actions.includes("rpc('set_organization_membership_status'"));
  assert.ok(actions.includes("rpc('set_workspace_membership_status'"));
  assert.ok(actions.includes("status !== 'suspended' && status !== 'revoked'"));
  assert.ok(!actions.includes("formData.get('role')"));
  assert.ok(!actions.includes("formData.get('owner_principal_id')"));
});

test('invitation link is delivered once in a URL fragment rather than a request query', () => {
  assert.ok(invitationForm.includes('window.location.origin'));
  assert.ok(invitationForm.includes('url.hash = new URLSearchParams'));
  assert.ok(invitationForm.includes('navigator.clipboard.writeText'));
  assert.ok(invitationForm.includes('This link contains a secret invitation token'));
  assert.ok(!invitationForm.includes('url.searchParams.set'));
});

test('acceptance page clears the invitation fragment and does not preserve an untrusted redirect', () => {
  assert.ok(acceptForm.includes('window.location.hash'));
  assert.ok(acceptForm.includes('window.history.replaceState'));
  assert.ok(acceptForm.includes('reopen the original invitation link'));
  assert.ok(acceptPage.includes("export const dynamic = 'force-dynamic'"));
  assert.ok(!acceptForm.includes('redirectTo'));
  assert.ok(!acceptForm.includes('returnTo'));
});

test('database stores only token hashes and enforces atomic email-bound single-use acceptance', () => {
  assert.ok(migration.includes('token_hash text not null unique'));
  assert.ok(migration.includes('email_confirmed_at is not null'));
  assert.ok(migration.includes('invitation.email_normalized <> current_email'));
  assert.ok(migration.includes('for update'));
  assert.ok(migration.includes("invitation.status <> 'pending'"));
  assert.ok(migration.includes('invitation.expires_at <= now()'));
  assert.ok(migration.includes('private.membership_events'));
  assert.ok(migration.includes('revoke all on private.membership_events'));
});

test('tenant access policies require active organisation and workspace membership', () => {
  assert.ok(accessMigration.includes('private.has_active_organization_membership'));
  assert.ok(accessMigration.includes('private.has_active_workspace_membership'));
  assert.ok(accessMigration.includes('Active organisation members can read their organisation'));
  assert.ok(accessMigration.includes('Active workspace members can read their workspace'));
  assert.ok(
    accessMigration.includes(
      'on conflict on constraint organization_memberships_org_principal_unique',
    ),
  );
  assert.ok(
    accessMigration.includes(
      'on conflict on constraint workspace_memberships_workspace_principal_unique',
    ),
  );
});


test('invitation email validation normalises addresses and rejects malformed input', () => {
  assert.equal(normalizeInvitationEmail('  COLLEAGUE@Example.COM  '), 'colleague@example.com');
  assert.equal(normalizeInvitationEmail('a@b.co'), 'a@b.co');
  assert.equal(normalizeInvitationEmail('missing-at-symbol'), null);
  assert.equal(normalizeInvitationEmail('person @example.com'), null);
  assert.equal(normalizeInvitationEmail('person@example'), null);
  assert.equal(normalizeInvitationEmail('x'.repeat(255) + '@example.com'), null);
  assert.equal(normalizeInvitationEmail(null), null);
});

test('invitation expiry parser preserves the selected 1, 7, 14 and 30 day values', () => {
  assert.equal(parseInvitationExpiryDays('1'), 1);
  assert.equal(parseInvitationExpiryDays('7'), 7);
  assert.equal(parseInvitationExpiryDays('14'), 14);
  assert.equal(parseInvitationExpiryDays('30'), 30);
  assert.equal(parseInvitationExpiryDays(undefined), 7);
  assert.equal(parseInvitationExpiryDays(''), 7);
  assert.equal(parseInvitationExpiryDays('0'), null);
  assert.equal(parseInvitationExpiryDays('31'), null);
  assert.equal(parseInvitationExpiryDays('14days'), null);
  assert.equal(parseInvitationExpiryDays('1.5'), null);
});
