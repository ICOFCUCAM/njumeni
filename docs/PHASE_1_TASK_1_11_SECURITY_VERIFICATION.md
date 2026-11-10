# Phase 1 Task 1.11 — Consolidated tenant-isolation and security verification

**Status:** verification suite authored; execution deliberately deferred to the Phase 1 batch closeout.

## Purpose

Provide one consolidated release gate for the identity, organisation/workspace, membership, RBAC, storage, audit and billing boundaries implemented in Tasks 1.3–1.10. The suite is additive: task-specific pgTAP tests remain the source of realistic two-principal lifecycle and negative-access fixtures.

## Test layers

| Layer | Evidence source | Required negative cases |
|---|---|---|
| Identity/session | Auth lifecycle integration tests and live Supabase Auth checks | Invalid, expired, revoked and tampered sessions; no protected route access after sign-out |
| Tenant and workspace | Organisation/workspace and membership pgTAP suites | Tenant B cannot read, create, update or delete Tenant A records; inactive membership is denied |
| RBAC | `role_permission.test.sql` and web boundary contracts | Viewer/editor/admin separation; no privilege escalation; workspace scope does not leak to sibling workspaces |
| Storage | `storage_isolation.test.sql` and server storage contract tests | Cross-tenant read/write/delete denied; malformed and mismatched object keys denied; signed URL requires current permission |
| Audit | `security_audit.test.sql` | No direct read/forgery; append-only; tenant-scoped reads; sensitive metadata excluded |
| Billing/usage | `subscription_entitlements.test.sql` | Tenant isolation; no client-forged subscriptions or entitlements; idempotent usage; billing cannot grant resource access |
| Background work | Worker boundary contract | Any future worker must resolve a job's tenant/workspace from a trusted persisted job record, re-check current authorisation at execution, and reject caller-supplied service-role scope. No production worker is currently part of Phase 1; this contract is a mandatory gate when the first worker is introduced. |

## Consolidated SQL suite

`supabase/tests/phase1_security_contract.test.sql` verifies the cross-cutting database invariants: RLS enabled on protected relations, no direct API grants on private security/billing tables, no anonymous execution of privileged RPCs, service-role-only subscription snapshot ingestion, deny-by-default permission evaluation, malformed storage path rejection, private bucket/RLS configuration, append-only audit/usage guards, and separation of billing entitlements from resource authorisation.

## Phase closeout execution

Do not run this suite in isolation after every implementation task. At Phase 1 closeout, run the complete local database replay and all pgTAP tests together, then application tests, type-check, lint, production build, migration checks and repository security workflow. Run the live Auth checks against the dedicated Njumeni project using synthetic accounts only. Record command output, CI run IDs, environment and any blocked external settings in the acceptance report.

Suggested local commands (execute together at closeout, not now):

```bash
supabase start
supabase db reset
supabase test db
npm --prefix apps/web ci
npm --prefix apps/web test
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Confirm actual package scripts before executing; do not assume a script exists merely because it appears in this illustrative sequence.

## Residual release gates

- Verify live Supabase Auth refresh/revocation behaviour and leaked-password protection configuration.
- Confirm public repository exposure is resolved or explicitly accepted; never commit secrets or legal content.
- Confirm region/data-residency and data-classification decisions.
- Review service-role use, background-job tenant propagation and provider egress when those integrations are introduced.
- Perform final cross-tenant RLS/storage/API negative tests against the local database replay.
- Keep hosted Supabase migrations unapplied until the owner separately authorises deployment.

## Acceptance rule

Task 1.11 is not GREEN merely because this suite exists. It becomes GREEN only after the complete batch is executed, failures are resolved, residuals are documented and evidence is attached to the Phase 1 acceptance report. No confidential legal data or customer onboarding is permitted before Phase 1 closeout.
