# Phase 1.5 — Organisation, workspace and tenant ownership design

- **Status:** GREEN — implementation and local acceptance complete
- **Date:** 10 November 2026
- **Architecture authority:** ADR-0001, ADR-0002, Phase 1 security invariants
- **Depends on:** Task 1.4 principal/profile model (GREEN)

## 1. Domain decisions

1. An organisation is the tenant/account boundary. It owns workspaces and will later own matters, evidence and other tenant-scoped resources.
2. Every active principal receives one personal organisation and one default personal workspace automatically.
3. A principal may own additional organisations with kinds `law_firm`, `enterprise` or `institution`.
4. A workspace always belongs to exactly one organisation. A workspace cannot be moved between organisations by an application user.
5. Task 1.5 supports owner-only access. Multi-user organisation/workspace access is intentionally not introduced until Task 1.6 implements memberships and invitations.
6. Organisation and workspace deletion is not exposed. Users may archive workspaces; tenant lifecycle and retention are server-governed.
7. Organisation ownership and workspace creation principal are immutable. No role, membership, tenant-owner or permission field is client-editable.
8. Personal organisations use the same tenant/RLS model as firms and institutions; there is no separate personal-data access bypass.

## 2. Database model

### `public.organizations`

- UUID primary key.
- `owner_principal_id` references `private.principals`; defaults to the active current principal.
- `name`, globally unique normalized `slug`, `kind`, `status`, timestamps.
- Kinds: `personal`, `law_firm`, `enterprise`, `institution`.
- Statuses: `active`, `suspended`, `archived`.
- Unique partial constraint: at most one personal organisation per principal.
- Owner is immutable; ordinary users can update name/slug only.

### `public.workspaces`

- UUID primary key.
- `organization_id` references `public.organizations`.
- `created_by_principal_id` references `private.principals`; defaults to the active current principal.
- `name`, slug unique within organisation, `kind`, `status`, timestamps.
- Kinds: `personal`, `general`, `team`, `matter`, `research`.
- Statuses: `active`, `suspended`, `archived`.
- Organisation and creator are immutable; ordinary users can update name/slug and archive/restore an owned workspace.

## 3. Provisioning and lifecycle

- An after-insert principal trigger creates the personal organisation.
- An after-insert organisation trigger creates its default workspace. Personal organisations receive a `personal` workspace; other organisation kinds receive a `general` workspace.
- Existing active principals are backfilled idempotently.
- Auth-user deletion deactivates the internal principal and anonymises profile presentation fields. The provider identity mapping is removed by the Auth-user foreign-key cascade. The organisation/workspace tenant records are retained rather than deleted with the Auth identity; future data-retention/erasure policy will govern their disposition.
- No membership or invitation records are created in this task.

## 4. Access model for Task 1.5

- Enable RLS on both exposed tables.
- SELECT is limited to the active owner principal.
- INSERT organisation policy requires the active current principal as owner and rejects client-created `personal` organisations.
- INSERT workspace policy requires ownership of an active organisation.
- UPDATE is limited to the organisation owner and both USING/WITH CHECK conditions are enforced.
- Workspace UPDATE also requires the parent organisation to remain owned and active.
- No DELETE policies or grants are provided.
- Only necessary table/column privileges are granted to `authenticated`.
- No service-role key is used in user-facing requests.
- Membership-based access is added in Task 1.6; roles and permission evaluation are added in Task 1.7.

## 5. Application contracts

- `createOrganization` validates name/kind/slug, resolves the authenticated user on the server, inserts through the caller-scoped Supabase client and relies on RLS for ownership.
- `createWorkspace` validates the requested organisation ID/name/kind/slug, resolves the user server-side and relies on RLS to reject foreign or inactive organisations.
- Neither action accepts an owner principal, user ID, role, membership state or trusted status from form data.
- Workspace shell displays the current personal organisation and default workspace and links to organisation/workspace settings.
- Settings UI lists only organisations/workspaces visible under the caller's RLS scope.

## 6. Acceptance and tests

Acceptance evidence: local database workflow `42846849437` passed clean replay of all four migrations, generated database types, database lint and all 38 pgTAP assertions. Application CI `42848567330` passed formatting, lint, strict TypeScript, 26 web tests, production build, content policy and Gitleaks. Hosted schema remains unchanged.

- [x] Clean local replay of all migrations.
- [ ] CLI-generated TypeScript types committed and used by server clients.
- [ ] Personal organisation and workspace automatically provisioned for new principals.
- [ ] Existing active principals receive exactly one personal organisation/workspace on backfill.
- [ ] Active owner can list and update own organisation/workspace.
- [ ] Principal cannot read or update another principal's organisation/workspace.
- [ ] Workspace cannot be inserted under a foreign, suspended or archived organisation.
- [ ] Organisation owner, workspace organisation and creator cannot be reassigned.
- [ ] Ordinary user cannot create a second personal organisation or delete a tenant.
- [ ] Auth deletion deactivates principal, removes provider mapping, anonymises profile presentation fields and retains tenant records.
- [ ] pgTAP negative and lifecycle tests pass.
- [ ] Server Action and route contract tests pass.
- [ ] Application CI, strict type-check and production build pass.
- [ ] Hosted database remains unchanged until a separate approved release operation.
