# Phase 1.5 — Organisation, workspace and tenant ownership acceptance

- **Status:** GREEN — implementation and isolated local acceptance complete
- **Date:** 10 November 2026
- **Repository:** `ICOFCUCAM/njumeni`
- **Branch:** `claude/wonderful-franklin-lt09d7`
- **Database:** dedicated Njumeni Supabase project `vvjpsejeeffykaozfbik` (Stockholm / `eu-north-1`)
- **Hosted deployment:** no migration or schema change was applied to the hosted project

## 1. Delivered database model

Two tenant tables are implemented in `public`:

- `organizations` — tenant/account boundary, immutable owner principal, unique normalized slug, organisation kind and lifecycle status.
- `workspaces` — belongs to exactly one organisation, immutable organisation and creator, unique slug within its organisation, workspace kind and lifecycle status.

The implementation includes:

- One personal organisation and default personal workspace provisioned for each active principal.
- Idempotent backfill for existing active principals.
- Default workspace creation for additional organisations.
- Owner-only access in this task; memberships and invitations remain Task 1.6.
- No user-facing tenant deletion or ownership reassignment.
- Workspace archival while privileged suspension remains unavailable to ordinary users.
- Auth identity deletion deactivates and anonymises the principal while retaining organisation/workspace records for controlled retention.

## 2. Access-control design

- RLS is enabled on both exposed tables.
- Organisation and workspace reads are limited to the active owner principal.
- Organisation creation derives the owner from the active server-resolved principal; client-supplied owner IDs are not accepted.
- Workspace creation requires ownership of an active organisation.
- Update policies include both `USING` and `WITH CHECK`.
- Column grants prevent users from changing owner, creator or organisation foreign keys.
- Database triggers reject privileged attempts to reassign immutable ownership links.
- No DELETE policies or user-facing delete grants are provided.
- Application actions use a request-scoped Supabase client and authoritative `auth.getUser()`; no service-role credential is used.

## 3. Application integration

- The protected workspace layout resolves the caller's personal organisation and personal workspace through RLS-filtered queries.
- The workspace shell displays the server-resolved organisation/workspace context.
- `/settings/workspaces` lists only organisations and workspaces visible to the caller.
- Server Actions create additional organisations and workspaces after validating bounded domain fields.
- Workspace reads use an explicit organisation-ID filter; no nested relationship is assumed where generated relationship metadata is absent.
- The settings route is request-dynamic and included in the production build.

## 4. Database verification

Local database workflow: [42846849437](https://github.com/ICOFCUCAM/njumeni/actions/runs/42846849437).

Verified:

- Pinned Supabase CLI 3.1.0 and CLI-generated migration-name provenance.
- Clean local database start and replay of all four migrations.
- A second clean `supabase db reset` replay from zero.
- TypeScript database type generation from the local schema.
- `supabase db lint --level error` — no schema errors.
- `supabase test db` — 38 pgTAP assertions across profile and organisation/workspace tests; all passed.
- Organisation/workspace tests cover personal tenant provisioning, owner-only read scope, creation, foreign-tenant denial, immutable ownership links, workspace archival, privileged status denial and Auth deletion retention behaviour.

## 5. Application and CI verification

Application CI: [42848567330](https://github.com/ICOFCUCAM/njumeni/actions/runs/42848567330), commit `6321f8b8b553df3a8d78d4e403a7246dbb2a3f0f`.

All three jobs passed:

- Formatting and lint.
- Strict TypeScript validation.
- 18 foundation tests.
- 26 web contract/session tests, including the organisation/workspace server and route contracts.
- Next.js production build; `/dashboard` and `/settings/workspaces` are request-dynamic.
- Repository content/privacy-path policy.
- Gitleaks secret scan.
- Migration naming/order/immutability guard.

## 6. Hosted release boundary

The dedicated hosted Supabase project remains unchanged. The four migration files have only been replayed against the isolated local Supabase stack in CI. Deployment to the hosted project is a separate release action and is not implied by this task's GREEN implementation status.

The Task 1.3 live Auth-provider verification and plan-dependent leaked-password control remain deferred to Task 1.11/Phase 1.12 as recorded in the autonomous build sequencing decision. No confidential legal material or customer onboarding is authorised until Phase 1 closes.

## 7. Acceptance decision

**Task 1.5 — GREEN.** Tenant schema, owner-only RLS, provisioning/backfill, lifecycle triggers, application actions and UI, local clean replay, 38 pgTAP assertions, application CI and documentation evidence are complete.

**Next task:** Phase 1.6 — Membership and invitation lifecycle.
