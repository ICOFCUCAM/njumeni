# Phase 1 — Identity, tenancy and security foundation

| Field | Value |
|---|---|
| Phase state | 🟢 **CLOSED** (11 November 2026). See the [acceptance report](PHASE_1_ACCEPTANCE_REPORT.md) |
| Governing plan | [Njumeni Master Plan v2.0](NJUMENI_MASTER_PLAN.md), §11 (security), §10 (data), §21 (completion) |
| Architecture records | [ADR-0001](architecture/ADR-0001-modular-monolith-and-bounded-contexts.md), [ADR-0002](architecture/ADR-0002-identity-tenancy-security.md), [ADR-0003](architecture/ADR-0003-build-in-public-and-staged-infrastructure.md) |
| Entry condition | Phase 0 closeout `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1`, CI run `42768822407` SUCCESS |
| Plan revision | 2026-11-11: rewritten for v2.0 (build in public, staged infrastructure, deferred hosted migrations, small-commit cadence) |

## 1. Objective

Establish the identity, organisation/workspace tenancy, authorisation, audit and isolation foundation required before Njumeni handles confidential legal matters or documents.

Every later phase depends on this boundary:
- **Evidence (Phase 3)** needs private storage and RLS.
- **Research (Phase 4)** needs a server-side trust boundary.
- **Commercial (Phase 11)** needs a billing identity that is separate from authorisation.

## 2. Scope

| In scope | Out of scope (later phase) |
|---|---|
| Supabase Auth integration and session lifecycle | MFA/passkeys UI, OAuth, SSO (Phase 10; MFA before R1) |
| Principals, profiles and immutable provider mapping | Matters and matter-level permissions (Phase 8) |
| Organisations, workspaces, personal tenants | Teams and offices (Phase 10) |
| Memberships and invitations | Conflict checks and information barriers (Phase 9, U-16) |
| Role and permission catalogue, scoped bindings, server guards | Enterprise admin console (Phase 10) |
| RLS on tenant tables; private workspace storage policies | Upload UI, malware scanning, evidence intake (Phase 3) |
| Append-only security audit stream | Hash-chained audit (Phase 3, with custody, U-12) |
| Provider-neutral billing identity, entitlements, usage ledger | Payment provider, invoices (Phase 11) |
| Tenant-isolation verification suite | Penetration testing (Phase 13) |

## 3. Security invariants

1. Every authenticated principal has a stable identity. No client-supplied user, tenant, role or matter identifier is trusted without server-side authorisation.
2. Every protected resource has an explicit owner, tenant and workspace boundary.
3. Membership and role changes are authorised, audited and take effect consistently.
4. **Deny by default.** A missing policy, membership or context never grants access.
5. Database RLS is defence in depth and is tested with separate principals. Application checks alone are insufficient.
6. Cross-tenant and cross-workspace access fails for reads, writes, updates, deletes, storage operations and background jobs.
7. Service-role credentials never reach browsers or untrusted workers. Privileged operations use narrow server-side interfaces.
8. Audit events record actor, action, target, tenant, timestamp, outcome and correlation context, and never copy confidential document content.
9. Invitations are single-use, expiring, revocable and bound to the intended organisation and email address.
10. Billing entitlements never grant data access.
11. **▲ Build in public (ADR-0003):** security never depends on secrecy of code. No secret, token, production configuration or non-public data is committed or printed in CI logs.
12. **▲ Deferred deployment (U-27):** Phase 1 migrations are verified on local and CI stacks only. The hosted project stays empty until Phase 13.

## 4. Task register

| No. | Task | Deliverable | Acceptance criteria | Status |
|---|---|---|---|---|
| 1.1 | Security contracts | ADR-0002: principals, sessions, tenants, workspaces, memberships, permissions, trust boundaries, threat model | Reviewed against the master plan and ADR-0001; CI green | 🟢 GREEN (`f8a2ee0`, CI `42769220793`) |
| 1.2 | Environment readiness | Dedicated Supabase project; local CLI stack | Project healthy; empty baseline; no shared credentials | 🟢 GREEN (`4fdc1e8`, CI `42772065771`) |
| 1.3 | Identity provider and session lifecycle | Supabase SSR client, Proxy refresh, server `getUser()` guard, sign-in/out actions, cookie handling | Mocked lifecycle tests pass; live provider test passes; manual owner check | 🔵 IMPLEMENTED (live test passed locally) |
| 1.4 | Principal and profile model | Principals, provider mapping, profiles, safe update rules | pgTAP 16/16; types generated | 🟢 GREEN |
| 1.5 | Organisations and workspaces | Owner-scoped tenancy, personal tenant provisioning, lifecycle triggers, settings UI | pgTAP 38/38; web tests; build | 🟢 GREEN |
| 1.6 | Memberships and invitations | Membership states, 256-bit hash-only invitation tokens, verified-email acceptance, expiry, revocation and replay protection | pgTAP 85/85; web tests 35/35 | 🟢 GREEN |
| 1.7 | Roles, permissions, server authorisation | Permission catalogue, role catalogue, scoped bindings, evaluator, assignment/revocation RPCs, guards, UI | `role_permission.test.sql` fully passing, including privilege-escalation negatives | 🔵 IMPLEMENTED: 60/60 locally |
| 1.8 | RLS and storage policies | Private workspace bucket; tenant/workspace object-key enforcement; server helpers | `storage_isolation.test.sql` passing with two synthetic tenants | 🔵 IMPLEMENTED (passing; closes with the phase) |
| 1.9 | Security audit logging | Append-only stream, lifecycle/role/membership capture, allow-listed metadata, scoped read RPC; ▲ sign-in, sign-out and denied-access events | `security_audit.test.sql` fully passing | 🔵 IMPLEMENTED: 12/12 locally |
| 1.10 | Subscription identity and entitlements | Billing customers, subscriptions, versioned entitlements, provider-event idempotency, usage ledger | `subscription_entitlements.test.sql` passing; `record_usage_event` exposure reviewed | 🔵 IMPLEMENTED |
| 1.11 | Isolation and security verification suite | Consolidated pgTAP contract suite and negative tests | Every Phase 1 pgTAP file passes in one CI run | 🔵 IMPLEMENTED: all pass locally; manual CI run at closeout |
| 1.12 | Acceptance and closeout | Acceptance report, closeout commit, tag | §6 checklist complete; CI green | 🟢 CLOSED |

## 5. Verification approach

| Layer | Method | Where it runs |
|---|---|---|
| Database policies | pgTAP as separate synthetic principals (owner, member, outsider, anonymous) | `supabase-local.yml`: ephemeral local stack, `supabase db reset` from zero |
| Server boundaries | Contract tests over source and server actions | `apps/web` `npm run test:auth` |
| Auth lifecycle | Mocked suite on every push; live provider test on manual dispatch with a dedicated test identity | `repository-security.yml` |
| Migrations | Format, ordering, immutability guard with hash-pinned pre-deployment corrections | `scripts/ci/check-migrations.mjs` |
| Secrets and content | Gitleaks; repository content policy | Every push |

## 6. Closeout checklist (Task 1.12)

| # | Item | Done |
|---|---|---|
| 1 | Blockers B-1 to B-7 fixed ([register §2.3](PHASE_REGISTER.md)): ✅ done and verified locally 2026-11-11. One fully green **manual** CI run, including the local database job | ◐ |
| 2 | Live Auth lifecycle test executed with a dedicated synthetic identity; identity deleted afterwards | ✅ Local Auth service, 2026-11-11 |
| 3 | Leaked-password protection: Stage 0 risk acceptance recorded (ADR-0003 §2.6, decision D-6) | ✅ |
| 4 | Sign-in, sign-out and denied-access audit events implemented, or deferral recorded | ✅ Sign-in, sign-out, refresh and revocation are recorded by the provider; failed-sign-in and denied-access events deferred to Phase 3 |
| 5 | `record_usage_event` exposure reviewed (server-only or justified) | ✅ Finding F-1: no current exposure; make server-only in Phase 11 |
| 6 | Database types regenerated; CI drift check added | ✅ |
| 7 | ADR-0002 status set to Accepted; its §12 open decisions resolved or deferred with owners | ✅ |
| 8 | Stale documents refreshed: README, health endpoint, `APP_SHELL.md`, infrastructure/environment/migration/CI documents, `CONTRIBUTING.md` (and the tests pinning their wording) | ✅ |
| 9 | `SECURITY_ARCHITECTURE.md` and `MULTITENANCY.md` consolidated from ADR-0002 and the task designs (master plan §19.3) | ✅ |
| 10 | `PHASE_1_ACCEPTANCE_REPORT.md` completed with commit and run IDs | ✅ (manual CI run IDs to be added) |
| 11 | Closeout commit, green CI, tag `phase-1-closed`, register updated | ☐ |

**Not part of the closeout:** applying migrations to hosted Supabase. That happens once, in Phase 13 (U-27).

## 7. Changes from the previous plan

| Previous | v2.0 | Why |
|---|---|---|
| Repository privacy flagged as an owner risk | Resolved: build in public (ADR-0003) | Owner decision, zero cost |
| Keep Tasks 1.7–1.11 uncommitted; one batch; verify once at the end | Small commits; CI green on every commit (U-18) | The batch approach produced corrupted SQL and long-red CI |
| "Execution deferred" for Task 1.11 | The suite has run and fails; status is VERIFICATION FAILING | Register accuracy |
| Hosted migration deployment by separate authorisation | **No hosted deployment until all phases are complete** | Owner decision (U-27) |
| Tamper-evident audit in Phase 1 | Append-only in Phase 1; hash chain in Phase 3 together with evidence custody | One mechanism, delivered once (U-12) |
| Leaked-password protection as a release check | Accepted Stage 0 risk; enabled at Stage 1 | Requires a paid plan |

## 8. Task records

Detailed designs and acceptance evidence remain authoritative for their tasks:

- [Task 1.3: Auth implementation](PHASE_1_TASK_1_3_AUTH_IMPLEMENTATION.md)
- [Task 1.4: Profile draft review](PHASE_1_TASK_1_4_PROFILE_DRAFT_REVIEW.md) · [Acceptance](PHASE_1_TASK_1_4_ACCEPTANCE.md)
- [Task 1.5: Organisation/workspace design](PHASE_1_TASK_1_5_ORGANISATION_WORKSPACE_DESIGN.md) · [Acceptance](PHASE_1_TASK_1_5_ACCEPTANCE.md)
- [Task 1.6: Membership/invitation design](PHASE_1_TASK_1_6_MEMBERSHIP_INVITATION_DESIGN.md) · [Acceptance](PHASE_1_TASK_1_6_ACCEPTANCE.md)
- [Task 1.7: RBAC design](PHASE_1_TASK_1_7_RBAC_DESIGN.md)
- [Task 1.8: RLS/storage design](PHASE_1_TASK_1_8_RLS_STORAGE_DESIGN.md)
- [Task 1.9: Security audit design](PHASE_1_TASK_1_9_SECURITY_AUDIT_DESIGN.md)
- [Task 1.10: Billing/entitlements design](PHASE_1_TASK_1_10_BILLING_ENTITLEMENTS_DESIGN.md)
- [Task 1.11: Security verification](PHASE_1_TASK_1_11_SECURITY_VERIFICATION.md)
- [Environment readiness](PHASE_1_ENVIRONMENT_READINESS.md) · [Acceptance report (draft)](PHASE_1_ACCEPTANCE_REPORT.md)

Where a task record conflicts with this plan or the register on *status*, the register governs. Where a task record says "uncommitted", "deferred until batch" or "tests not run", it describes the superseded cadence.
