# Phase 1 — Identity, tenancy and security foundation

**Phase objective:** establish the identity, organisation/workspace tenancy, authorisation, audit and isolation foundation required before Njumeni handles confidential legal matters or documents.

**Entry condition:** Phase 0 closeout `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1` verified by CI run `42768822407` SUCCESS.

**Architecture constraint:** follow the original Njumeni master plan and ADR-0001 modular-monolith boundaries. The original plan identifies Supabase Auth, PostgreSQL, RBAC and PostgreSQL RLS as the intended baseline. Validate implementation details against the actual dedicated Njumeni environment before provisioning. Never reuse another product's database or credentials.

## Phase 1 security invariants

1. Every authenticated principal has a stable identity; no client-supplied user, tenant, role or matter identifier is trusted without server-side authorisation.
2. Every protected resource has an explicit owner/tenant/workspace boundary.
3. Membership and role changes are authorised, audited and take effect consistently.
4. Deny by default. A missing policy, membership or context never grants access.
5. Database RLS is defence in depth and is tested using separate principals; application checks alone are insufficient.
6. Cross-tenant and cross-workspace access must fail for reads, writes, updates, deletes, storage operations and background jobs.
7. Service-role credentials never reach browsers or untrusted workers; privileged operations use narrow server-side interfaces.
8. Audit events record security-relevant actor, action, target, tenant, timestamp, outcome and correlation context without copying confidential document content into logs.
9. Invitations are single-use, expiring, revocable and bound to the intended organisation and email/identity.
10. No confidential legal content is accepted until the identity, tenancy, RLS, storage and audit controls have passed the phase gates.

## Ordered task register

| No. | Task | Required deliverable and acceptance criteria | Status |
|---|---|---|---|
| 1.1 | Define identity, authentication, tenant and workspace security contracts | Security architecture/ADR; threat model; principal, session, organisation, workspace, membership and permission concepts; trust boundaries; deny-by-default rules; explicit decisions and open dependencies. Reviewed against original plan and ADR-0001; verified by CI run `42769220793` on commit `2f22fddc14881c18a96a0cd6bcee12ad709943f8`. | 🟢 GREEN |
| 1.2 | Verify dedicated Njumeni identity/database environment readiness | Dedicated project `Njumeni` (`vvjpsejeeffykaozfbik`) provisioned in `eu-north-1`; project-level status `ACTIVE_HEALTHY`; PostgreSQL 17.11 connectivity, built-in Auth/Storage schemas, empty application schema and migration baseline verified; publishable key availability confirmed without committing key material; Supabase security/performance/health advisors returned no findings at initial readiness. Per-service Auth health/configuration is a deferred release-verification item assigned to Task 1.11/Phase 1.12. | 🟢 GREEN — commit `4fdc1e8bb70d888d0869f75e76d0726d57901e6a`; CI run `42772065771` SUCCESS |
| 1.3 | Implement identity provider integration and secure session lifecycle | Official Supabase SSR integration for Next.js 16; request-scoped server client; HttpOnly/SameSite cookie handling; Proxy refresh; sign-in/sign-out server actions; server-side protected workspace boundary; invalid, expired, revoked and tampered-session tests. See [PHASE_1_TASK_1_3_AUTH_IMPLEMENTATION.md](PHASE_1_TASK_1_3_AUTH_IMPLEMENTATION.md). | 🟡 DEVELOPMENT IMPLEMENTATION COMPLETE — owner-confirmed production sign-in, dashboard refresh persistence, sign-out, direct `/dashboard` denial after logout and cookie removal. CI run `42839971018` passed the three jobs and the mocked Auth lifecycle suite. The live provider refresh/revocation test and leaked-password protection configuration are external release-verification items; they are explicitly deferred to Task 1.11/Phase 1 closeout under the owner-directed autonomous build continuation. Task 1.4 is unlocked for development only. No confidential legal data or production customer onboarding is permitted until the Phase 1 safety gate passes. |
| 1.4 | Implement user profile and principal model | User profile schema and server-side identity mapping; immutable provider subject mapping; safe profile update rules; migrations and database integration tests. | 🟢 GREEN — profile/principal schema, immutable provider mapping, active-principal RLS resolution, safe profile updates, HTTPS/IANA validation, CLI-generated migrations, generated TypeScript database types, clean local replay, database lint and all 16 pgTAP assertions. Local run `42845114187`; application CI `42846043378`. See [Task 1.4 acceptance](PHASE_1_TASK_1_4_ACCEPTANCE.md). Hosted schema remains unchanged. |
| 1.5 | Implement organisations, workspaces and tenant ownership | Tenant/workspace schema, ownership rules, lifecycle and isolation invariants; migrations and server-side domain/application contracts. | 🟢 GREEN — owner-scoped organisation/workspace tables, personal tenant provisioning and idempotent backfill, owner-only RLS, immutable ownership, lifecycle triggers, server actions and settings UI. Local clean replay, type generation, database lint and 38/38 pgTAP assertions passed in run `42846849437`; application CI `42848567330` passed all three jobs, including 26 web tests and production build. See [Task 1.5 acceptance](PHASE_1_TASK_1_5_ACCEPTANCE.md). Hosted schema remains unchanged. |
| 1.6 | Implement membership and invitation lifecycle | Membership states, invitation creation/acceptance/revocation/expiry, identity binding, replay protection and audit events. | 🟢 GREEN — organisation/workspace memberships, email-bound single-use invitations, 256-bit token generation with hash-only persistence, verified-email acceptance, expiry/revocation/replay protection, private lifecycle events, RLS, Server Actions and UI. Clean local replay, generated types, database lint and 85/85 pgTAP assertions passed in local run `42855740183`; application CI `42855740121` passed all three jobs, including 35/35 web tests and production build. Hosted schema remains unchanged. See [Task 1.6 acceptance](PHASE_1_TASK_1_6_ACCEPTANCE.md). |
| 1.7 | Implement roles, permissions and server-side authorisation | Explicit permission catalogue, role bindings, policy evaluation and route/use-case guards; deny-by-default and privilege-escalation tests. | 🟡 IMPLEMENTATION WRITTEN — RBAC catalogue, scoped bindings, deny-by-default evaluator, assignment/revocation RPCs, server guards, UI and pgTAP/contract tests are prepared; combined batch verification deferred to owner-approved commit. |
| 1.8 | Implement PostgreSQL RLS and storage access policies | Tenant/workspace-scoped RLS policies, secure helper functions, private storage policies and tests executed as realistic non-owner principals. | 🟡 IMPLEMENTATION WRITTEN — private workspace bucket, tenant/workspace object-key enforcement, permission-checked server upload/download/delete helpers and synthetic two-tenant pgTAP/contract tests; verification deferred to approved batch. |
| 1.9 | Implement security audit logging | Append-only/tamper-evident event contract and persistence; actor/action/target/outcome/correlation metadata; redaction and access controls. | 🟡 IMPLEMENTATION WRITTEN — central append-only audit stream, lifecycle/role/membership event mirroring, allow-listed metadata, immutable trigger and permission-checked paginated read RPC; synthetic pgTAP coverage prepared, verification deferred to approved batch. |
| 1.10 | Implement subscription identity and entitlement boundary | Link billing customer/subscription identities to organisation/workspace without allowing billing state to grant data access; entitlements remain separate from authorisation. | 🟡 IMPLEMENTATION WRITTEN — provider-neutral billing customer and subscription identities, tenant-bound subscription snapshots, versioned entitlements, webhook event idempotency, usage ledger, authenticated billing read/usage RPCs and service-role-only provider snapshot ingestion prepared; verification deferred to approved batch. |

| 1.11 | Execute tenant-isolation and security verification suite | Consolidated pgTAP contract suite and task-specific negative tests across identity, tenancy, RBAC, storage, audit and billing; live Auth and release residuals documented. | 🟡 SUITE AUTHORED — consolidated database contract tests and closeout matrix prepared; execution intentionally deferred until Phase 1 batch closeout under the owner’s instruction. See [Task 1.11 verification design](PHASE_1_TASK_1_11_SECURITY_VERIFICATION.md). |
| 1.12 | Phase 1 acceptance and closeout | All 1.1–1.11 green, migration replay and CI pass, security review and acceptance report, dedicated closeout commit with successful CI. Only then unlock Phase 2. | 🔒 LOCKED |

## Owner-directed autonomous build continuation — 10 November 2026

The owner has instructed that implementation must continue sequentially through the product phases, with commits deferred until the end of Phase 1 and no repeated checks after each small change. Therefore, functional build tasks may proceed while live provider verification, plan-dependent Auth settings and final release security checks remain explicitly outstanding. These are carried into Task 1.11 and Phase 1.12 rather than used to halt implementation. This is a development sequencing decision, not a security waiver: use synthetic data only, do not onboard customers or accept confidential legal material, and do not mark the phase closed until the outstanding controls are resolved or formally accepted through the appropriate owner decision.

## Owner/environment gates

- The repository is currently public although the original plan specifies private. This remains an owner-level risk; do not place confidential deployment configuration or data in Git.
- Dedicated Njumeni Supabase project `vvjpsejeeffykaozfbik` is provisioned in `eu-north-1`. Task 1.2 records project/database readiness. Auth service-specific health and security configuration is a deferred release-verification item assigned to Task 1.11/Phase 1.12 under the owner-directed autonomous build sequence.
- Region/data residency and classification approval remain unresolved. Do not select a region based on another product's configuration.
- No real legal documents or customer matters may be used for tests; use synthetic fixtures.
- Supabase Auth is the planned identity provider from the original architecture. Any change requires a documented ADR and owner decision.
- RLS policies must be tested against the actual database semantics; static SQL inspection alone is not acceptance.

## Phase-wide completion rule

A task is GREEN only when its implementation or decision artifact is complete, reviewed, tested, documented, committed and the relevant CI checks pass. A scaffold, placeholder, unverified migration or mocked access-control test is not completion. A live-environment dependency may be marked BLOCKED with exact evidence and a safe next action; it must not be called complete.

Phase 1 does not authorise confidential production use until all phase acceptance criteria and required production controls are verified.


## Task 1.6 closeout — 10 November 2026

Task 1.6 is accepted GREEN. The implementation and evidence are recorded in [Task 1.6 acceptance](PHASE_1_TASK_1_6_ACCEPTANCE.md). Local clean migration replay, schema lint, 85 pgTAP assertions, 35 application tests, production build, repository content policy and secret scanning passed. Hosted schema remains unchanged. Tasks 1.7–1.9 implementation batches are written; combined verification is deferred until the owner approves the prepared commit batch. Task 1.10 implementation is written. Task 1.11 is the next verification gate and remains deferred until the owner approves the combined batch.

## Owner execution cadence update — 10 November 2026

The owner has directed that related implementation work continue without intermediate commits. The prepared Phase 1 implementation batch (Tasks 1.7–1.10) and the Task 1.11 verification suite are to remain uncommitted until Phase 1 is ready for its single closeout commit. Do not run intermediate test/CI checks or deploy hosted migrations. At Phase 1 closeout, run the combined verification once, resolve failures, prepare the acceptance report and present the complete phase commit. This cadence does not waive acceptance criteria or permit confidential production data before the phase gate passes.
