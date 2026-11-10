# Phase 1 task 1.6 — Membership and invitation acceptance

- **Status:** GREEN — implementation, clean replay, database tests and application CI passed
- **Date:** 10 November 2026
- **Repository:** `ICOFCUCAM/njumeni`
- **Branch:** `claude/wonderful-franklin-lt09d7`
- **Dedicated Supabase project:** `Njumeni` (`vvjpsejeeffykaozfbik`), Stockholm / `eu-north-1`
- **Hosted deployment:** not performed; all database verification ran against an isolated local Supabase stack.

## 1. Delivered capabilities

- Organisation and workspace memberships with `active`, `suspended` and `revoked` lifecycle states.
- Organisation-scoped and workspace-scoped invitations.
- Cryptographically random 256-bit one-time invitation tokens. Only SHA-256 token hashes are stored.
- Email-normalised, confirmed-identity-bound invitation acceptance.
- Expiry (1–30 days), owner revocation, single-use acceptance and database row locking against replay/concurrent acceptance.
- Workspace invitation acceptance provisions the corresponding organisation membership plus only the selected workspace membership.
- Reactivation of suspended/revoked membership only through a valid new invitation.
- Owner-only membership status changes; an organisation owner cannot suspend/revoke their immutable owner relationship.
- Private membership lifecycle events for invitation and membership state changes; raw tokens and legal content are excluded.
- RLS for member-visible organisations/workspaces, own memberships, owner-visible invitations and scoped invitation creation.
- Server Actions, organisation/workspace settings UI, invitation creation/revocation controls, one-time link display/copy and fragment-based acceptance page.
- Server-side invitation email and expiry validation. Redirect control-flow errors are not swallowed by invitation creation.
- Role and permission assignment are deliberately excluded and remain Task 1.7.

## 2. Migration and database verification

CLI-generated migration files:

- `20261110155456_membership_invitation_lifecycle.sql`
- `20261110160651_membership_invitation_access_policies.sql`
- `20261110161337_organization_owner_predicate.sql`

The complete migration set was applied twice in a clean isolated local Supabase environment. The local stack used a non-default port range to avoid runner conflicts and was stopped after testing.

Verification:

- Supabase CLI version: pinned at 3.1.0.
- Clean migration replay: PASS.
- TypeScript database contract generation: PASS.
- `supabase db lint --level error`: PASS — no schema errors.
- `supabase test db`: PASS — 85 pgTAP assertions across three SQL test files:
  - Membership/invitation lifecycle: 47 assertions.
  - Organisation/workspace isolation: 22 assertions.
  - Profile/principal security: 16 assertions.
- Test result: `Files=3, Tests=85, Result: PASS`.

The test suite covers owner and member visibility, wrong-email and unconfirmed-email rejection, organisation/workspace invitation acceptance, workspace scope, token replay, revocation, expiry, duplicate pending invitations, membership suspension/revocation, owner protection, private event persistence and RPC execution grants.

## 3. Application verification

GitHub Actions run `42855740121` passed all three jobs on commit `0143003dcd9b576325d566276287aaccfc7058e8`:

- Formatting: PASS.
- Lint: PASS.
- Strict TypeScript: PASS.
- Foundation and migration tests: PASS.
- Web tests: 35/35 PASS.
- Production Next.js build: PASS.
- Dynamic routes confirmed for `/invitations/accept`, `/settings/profile` and `/settings/workspaces`.
- Repository content/privacy policy: PASS.
- Gitleaks: PASS.

Local database workflow `42855740183` completed SUCCESS on the same commit. Its clean replay, type generation, database lint and 85 pgTAP assertions all passed.

## 4. Known boundaries and follow-on tasks

- Roles, permission catalogue, role bindings and central server-side permission evaluation are Task 1.7.
- The private membership event stream is not the final central tamper-evident audit system; Task 1.9 will provide that.
- SMTP/email delivery is not configured. The current workflow displays a one-time invitation link for the owner to share out of band.
- Hosted Supabase schema remains unchanged. Production migration deployment is a separate controlled release operation.
- Live provider-side session revocation and plan-dependent leaked-password protection remain release verification items assigned to Task 1.11/Phase 1.12. This task's completion does not waive those controls.
- No customer legal documents or confidential matters were used.

## 5. Acceptance decision

Task 1.6 is GREEN. Implementation, documentation, local clean replay, database lint, 85 database assertions, 35 application tests, production build, repository content policy and secret scanning passed.

**Verified implementation commit:** `0143003dcd9b576325d566276287aaccfc7058e8`  
**Application CI:** `42855740121` — SUCCESS  
**Local database CI:** `42855740183` — SUCCESS
