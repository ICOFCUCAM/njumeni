# Phase 1.6 — Membership and invitation lifecycle design

- **Status:** Design approved for implementation under the Phase 1 owner-directed autonomous build instruction
- **Date:** 10 November 2026
- **Depends on:** Tasks 1.1–1.5 (principal, organisation, workspace and owner-only RLS foundations)
- **Architecture authority:** ADR-0001, ADR-0002, Phase 1 security invariants
- **Hosted database:** no schema change is authorised by this design; local replay first, hosted deployment remains separate

## 1. Scope and explicit boundaries

Task 1.6 introduces explicit organisation and workspace membership, plus invitations that establish those relationships. It does not introduce role assignment or permission evaluation; those remain Task 1.7. The organisation owner remains the immutable owner principal on `organizations` and is not represented as a normal member row.

The initial model supports:
- Organisation membership for access to organisation-level context.
- Workspace membership for access to a particular workspace.
- An invitation scoped either to an organisation or to one workspace.
- Workspace invitation acceptance also creates the required organisation membership, but does not grant membership to any other workspace.
- Owner-only invitation administration until the role/permission engine exists.
- Membership states: `active`, `suspended`, `revoked`.
- Invitation states: `pending`, `accepted`, `revoked`; expiry is enforced by timestamp and displayed as expired without requiring a background scheduler.

No user may choose their own tenant, membership status, role or permissions.

## 2. Database contracts

### `public.organization_memberships`

- UUID primary key.
- Organisation and internal principal foreign keys.
- Immutable organisation/principal binding.
- Status `active | suspended | revoked`.
- Inviter principal, joined timestamp, created/updated timestamps.
- Unique organisation/principal pair.
- Owner and member can read permitted rows; no direct user INSERT/UPDATE/DELETE grants.

### `public.workspace_memberships`

- UUID primary key.
- Workspace and internal principal foreign keys.
- Status `active | suspended | revoked`.
- Inviter principal, joined timestamp, created/updated timestamps.
- Unique workspace/principal pair.
- Read visibility is scoped to the member or the owning organisation owner.
- No direct user INSERT/UPDATE/DELETE grants.

### `public.organization_invitations`

- UUID primary key.
- Organisation foreign key; optional workspace foreign key constrained to the same organisation.
- Normalised target email address.
- SHA-256 hash of a cryptographically random, high-entropy token; never store the raw token.
- Status, expiry, creator principal, accepted principal/time, revoked time and creation time.
- Unique token hash; prevent duplicate pending invitations for the same organisation/email/scope.
- The token hash is not selectable by ordinary users.
- Owners can create/read/revoke invitations only within their own active organisations.

### `private.membership_events`

Append-only, non-API event record for invitation and membership lifecycle transitions. It records actor, target principal, organisation/workspace, invitation, event type, outcome and timestamp. It excludes raw invitation tokens, passwords, access tokens and legal content. Ordinary users have no direct privileges.

## 3. Invitation security and acceptance protocol

1. The owner submits a target email, organisation and optional workspace.
2. The server validates the authenticated user, normalises the email, creates a 32-byte cryptographically random token and stores only its SHA-256 hash.
3. The raw token is returned once to the owner and rendered into a URL fragment (`#token=...`), so it is not sent in the HTTP request or server access logs.
4. The owner shares the one-time link out of band. No SMTP or email-delivery provider is assumed or fabricated.
5. The invitee opens the link, signs in separately, and accepts while authenticated.
6. The server hashes the supplied token and calls a narrow database RPC. The RPC verifies:
   - The caller maps to an active Njumeni principal.
   - The Auth user's email is confirmed and matches the invitation email after normalisation.
   - The invitation is pending and unexpired.
   - The target organisation is active.
   - If workspace-scoped, the workspace belongs to that organisation and is active.
7. In one transaction, the RPC creates/reactivates the organisation membership and optional workspace membership, marks the invitation accepted, and writes lifecycle events.
8. A row lock and pending-state check make acceptance single-use and race-safe. Reuse, expiry, revocation, wrong-email and unknown-token attempts fail closed.
9. The client cannot submit an owner principal, accepted principal, membership state, role or permission.

The invitation link contains the raw token only in the URL fragment. The acceptance page removes the fragment from browser history after reading it. The raw token is never persisted in the database or written to logs.

## 4. Lifecycle operations

- Create invitation: owner-only, 1–30 day expiry, default 7 days.
- Revoke pending invitation: owner-only; revocation is transactional and audited.
- Accept invitation: authenticated, confirmed-email match, atomic and single-use.
- Suspend/revoke organisation membership: owner-only; owner cannot revoke or suspend their own immutable owner relationship.
- Suspend/revoke workspace membership: owner-only; cannot mutate a membership in another organisation.
- Re-invite a previously revoked member: a new invitation may reactivate the existing membership only after valid acceptance.
- Expired invitations remain non-accepting even if their persisted status remains pending; UI derives the expired display state from `expires_at`.

## 5. RLS and privilege boundaries

- RLS is enabled on every exposed membership and invitation table.
- A principal can read their own memberships.
- An organisation owner can read memberships and invitations for their own organisation.
- No user has direct membership mutation grants.
- Invitation INSERT is restricted to owner-controlled columns and active owned organisations.
- Invitation revocation and membership state changes use narrowly scoped SECURITY DEFINER RPCs with `search_path = ''`, fully qualified names, explicit `auth.uid()`/active-principal checks, owner checks and grants only to `authenticated`.
- RPCs do not accept caller-selected actor, principal, owner, status or role values.
- Workspace-scoped invitation and revocation operations verify the workspace's organisation in the same transaction.
- Role and permission fields are deliberately absent; Task 1.7 will add the role binding model.

## 6. Application routes and UI

- Extend `/settings/workspaces` to list organisation members, workspace members and pending/expired invitations for the caller-visible organisations.
- Add a server action for owner-only invitation creation and revocation.
- Add a one-time invite-link component that displays the URL only after successful creation and supports copying it.
- Add a public `/invitations/accept` page. It extracts the fragment token in the browser, clears the fragment from history, requires a signed-in account and submits acceptance through a server action.
- If the visitor is not signed in, explain that they must sign in and reopen the original invitation link. No untrusted redirect URL is added to the sign-in flow.
- Generic invitation errors avoid disclosing whether an email or token exists.
- Membership UI displays status, not permissions; role controls are deferred to Task 1.7.

## 7. Verification and acceptance

Local pgTAP tests must cover:
- Organisation owner can create/read/revoke invitations only in owned organisations.
- Non-owner cannot create/revoke invitations or inspect another organisation's invitations.
- Invitee cannot accept using a different email or an unconfirmed email.
- Valid organisation invitation creates exactly one active organisation membership.
- Valid workspace invitation creates organisation membership plus only the selected workspace membership.
- Wrong-tenant workspace, inactive organisation/workspace, expired, revoked and unknown tokens fail.
- Token replay and concurrent acceptance cannot create duplicate memberships or reuse an accepted invitation.
- Revoked/suspended membership denies membership-based RLS.
- Member can read only their own membership; owner can read memberships in their organisation.
- Owner cannot revoke or suspend their immutable owner relationship.
- Cross-organisation and cross-workspace access is denied.
- Membership/invitation events are written for create, accept, revoke, suspend and expiry/denial outcomes without secrets.

Application tests must cover validation, authentication, generic error handling, link-fragment handling, server-side token hashing, invitation acceptance and revocation UI contracts. CI must pass format, lint, strict TypeScript, application tests, local clean migration replay, database lint and pgTAP.

## 8. Explicit non-goals and dependencies

- Role catalogue, role assignment, permission matrix and use-case policy engine: Task 1.7.
- Central audit event store and tamper-evidence/retention: Task 1.9. The private membership event stream is the domain event foundation and will be integrated with the audit context later.
- SMTP, email templates, delivery retries and sender-domain configuration: deferred until an email provider is selected and configured; owners share generated links out of band in this task.
- Hosted migration deployment and production invitation enablement: separate release operation after Phase 1 gates.
- No confidential legal matter, evidence or customer data is used in tests.
