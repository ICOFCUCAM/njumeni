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
| 1.2 | Verify dedicated Njumeni identity/database environment readiness | Dedicated project `Njumeni` (`vvjpsejeeffykaozfbik`) provisioned in `eu-north-1`; project-level status `ACTIVE_HEALTHY`; PostgreSQL 17.11 connectivity, built-in Auth/Storage schemas, empty application schema and migration baseline verified; publishable key availability confirmed without committing key material; Supabase security/performance/health advisors returned no findings. Per-service Auth health/configuration remains a Task 1.3 verification item. | 🟢 GREEN — commit `4fdc1e8bb70d888d0869f75e76d0726d57901e6a`; CI run `42772065771` SUCCESS |
| 1.3 | Implement identity provider integration and secure session lifecycle | Official Supabase SSR integration for Next.js 16; request-scoped server client; HttpOnly/SameSite cookie handling; Proxy refresh; sign-in/sign-out server actions; server-side protected workspace boundary; invalid, expired, revoked and tampered-session tests. See [PHASE_1_TASK_1_3_AUTH_IMPLEMENTATION.md](PHASE_1_TASK_1_3_AUTH_IMPLEMENTATION.md). | 🟡 IN PROGRESS — owner has confirmed production sign-in, dashboard refresh persistence, sign-out, direct `/dashboard` redirect after logout and no Supabase Auth cookies remaining after logout. Current branch CI run `42834010390` passed all three jobs: formatting, lint, strict TypeScript, 18 foundation tests, 16 web tests, migration guard, architecture integrity, Next.js production build, content policy and secret scan. `/dashboard` remains request-dynamic. The live provider refresh/revocation test is implemented but skipped because its four dedicated test secrets are not configured. The Supabase security advisor still reports leaked-password protection disabled; this Pro+ control is unavailable on the current Free plan. No upgrade or residual-risk exception is assumed; production onboarding and confidential legal data remain gated. Task 1.4 remains locked. |
| 1.4 | Implement user profile and principal model | User profile schema and server-side identity mapping; immutable provider subject mapping; safe profile update rules; migrations and tests. | 🔒 LOCKED |
| 1.5 | Implement organisations, workspaces and tenant ownership | Tenant/workspace schema, ownership rules, lifecycle and isolation invariants; migrations and server-side domain/application contracts. | 🔒 LOCKED |
| 1.6 | Implement membership and invitation lifecycle | Membership states, invitation creation/acceptance/revocation/expiry, identity binding, replay protection and audit events. | 🔒 LOCKED |
| 1.7 | Implement roles, permissions and server-side authorisation | Explicit permission catalogue, role bindings, policy evaluation and route/use-case guards; deny-by-default and privilege-escalation tests. | 🔒 LOCKED |
| 1.8 | Implement PostgreSQL RLS and storage access policies | Tenant/workspace-scoped RLS policies, secure helper functions, private storage policies and tests executed as realistic non-owner principals. | 🔒 LOCKED |
| 1.9 | Implement security audit logging | Append-only/tamper-evident event contract and persistence; actor/action/target/outcome/correlation metadata; redaction and access controls. | 🔒 LOCKED |
| 1.10 | Implement subscription identity and entitlement boundary | Link billing customer/subscription identities to organisation/workspace without allowing billing state to grant data access; entitlements remain separate from authorisation. | 🔒 LOCKED |
| 1.11 | Execute tenant-isolation and security verification suite | Negative tests across two or more tenants and roles; read/write/delete/storage/API/background-job paths; session, invitation, privilege and audit tests; document threat-model residuals. | 🔒 LOCKED |
| 1.12 | Phase 1 acceptance and closeout | All 1.1–1.11 green, migration replay and CI pass, security review and acceptance report, dedicated closeout commit with successful CI. Only then unlock Phase 2. | 🔒 LOCKED |

## Owner/environment gates

- The repository is currently public although the original plan specifies private. This remains an owner-level risk; do not place confidential deployment configuration or data in Git.
- Dedicated Njumeni Supabase project `${id}` is provisioned in `eu-north-1`. Task 1.2 records project/database readiness. Auth service-specific health and security configuration must be checked during Task 1.3 before enabling authentication.
- Region/data residency and classification approval remain unresolved. Do not select a region based on another product's configuration.
- No real legal documents or customer matters may be used for tests; use synthetic fixtures.
- Supabase Auth is the planned identity provider from the original architecture. Any change requires a documented ADR and owner decision.
- RLS policies must be tested against the actual database semantics; static SQL inspection alone is not acceptance.

## Phase-wide completion rule

A task is GREEN only when its implementation or decision artifact is complete, reviewed, tested, documented, committed and the relevant CI checks pass. A scaffold, placeholder, unverified migration or mocked access-control test is not completion. A live-environment dependency may be marked BLOCKED with exact evidence and a safe next action; it must not be called complete.

Phase 1 does not authorise confidential production use until all phase acceptance criteria and required production controls are verified.
