# Njumeni Phase 1 — Acceptance and closeout report

<badge>Draft — not accepted</badge>

**Phase:** 1 — Identity, tenancy and security foundation  
**Repository:** `ICOFCUCAM/njumeni`  
**Environment:** Dedicated Njumeni Supabase project `vvjpsejeeffykaozfbik`, Stockholm (`eu-north-1`)  
**Prepared:** 10 November 2026  
**Closeout status:** OPEN — combined verification has not been run

## 1. Executive status

Phase 1 implementation is being assembled as one coherent batch. Tasks 1.7–1.10 have implementation artifacts prepared. Task 1.11's consolidated verification suite and acceptance matrix are authored but deliberately unexecuted under the owner's instruction to defer checks until phase closeout. This document is a closeout template, not evidence of acceptance.

No confidential legal documents, real customer matters or production onboarding are permitted before Phase 1 is accepted. Hosted Supabase migrations have not been deployed.

## 2. Task status at preparation time

| Task | Scope | Current state | Evidence / remaining work |
|---|---|---|---|
| 1.1 | Identity, tenancy and security contracts | GREEN (historical) | ADR-0002 and recorded CI evidence |
| 1.2 | Dedicated identity/database readiness | GREEN (historical) | Environment readiness assessment and recorded CI evidence |
| 1.3 | Authentication and session lifecycle | Implementation complete; release checks pending | Owner-confirmed sign-in, refresh persistence, logout and cookie removal; live refresh/revocation and leaked-password protection remain to verify |
| 1.4 | Principal and profile | GREEN (historical) | Acceptance record and recorded local/CI evidence |
| 1.5 | Organisations and workspaces | GREEN (historical) | Acceptance record and recorded local/CI evidence |
| 1.6 | Membership and invitations | GREEN (historical) | Acceptance record and recorded local/CI evidence |
| 1.7 | RBAC and authorisation | IMPLEMENTATION WRITTEN | Combined database and application verification pending |
| 1.8 | Tenant RLS and storage | IMPLEMENTATION WRITTEN | Combined database, storage and application verification pending |
| 1.9 | Security audit logging | IMPLEMENTATION WRITTEN | Combined audit isolation and immutability verification pending |
| 1.10 | Subscription identity and entitlements | IMPLEMENTATION WRITTEN | Combined billing isolation, provider privilege and usage verification pending |
| 1.11 | Tenant-isolation/security verification | SUITE AUTHORED; NOT RUN | Execute all database and application suites together; complete live Auth and residual-risk review |

## 3. Required combined verification evidence

Complete this section only after the phase-wide run. Do not infer success from a workflow being queued or from tests merely existing.

| Verification | Required evidence | Result |
|---|---|---|
| Clean database replay | Full migration replay from empty local database; exact command and output | PENDING |
| Database lint/advisors | Relevant local checks and any warnings disposition | PENDING |
| pgTAP | All Phase 1 SQL suites, including RBAC, storage, audit, billing and consolidated security contract | PENDING |
| Web contract/integration tests | Auth, profile, organisation/workspace, invitation, RBAC and storage tests | PENDING |
| Type-check and lint | Actual package scripts and successful output | PENDING |
| Production build | Successful production build | PENDING |
| Migration integrity | Ordered/immutable migration guard | PENDING |
| Repository security | Secret scanning, content policy and workflow evidence | PENDING |
| Live Auth | Refresh, revocation, invalid/tampered session and leaked-password protection configuration | PENDING |
| Tenant isolation | Separate synthetic principals across read/write/update/delete, API, storage and workspace scopes | PENDING |
| Background-job boundary | Confirm no untrusted service-role scope; document worker tenant-context contract and re-check when worker implementation is introduced | PENDING / FUTURE WORK |
| Residual-risk review | Public repository exposure, region/data residency, service-role boundaries, provider egress and external configuration | PENDING |

## 4. Known residual decisions and restrictions

- Repository visibility is currently recorded as public although the original plan requires private. Resolve or record an explicit owner risk acceptance before confidential source material or secrets are introduced.
- Region and data-residency classification require an explicit owner decision.
- Supabase Auth leaked-password protection and live provider refresh/revocation behaviour require live verification.
- Payment provider is intentionally undecided. No provider webhook or checkout adapter is claimed as implemented.
- Background job execution is not yet part of the Phase 1 application. The first worker must resolve tenant/workspace from trusted persisted job state and re-check current permission at execution.
- Provider egress, external legal-source access and AI processing require their own data classification and jurisdiction controls before confidential data is sent.
- Hosted migrations remain unapplied until separately authorised by the owner.

## 5. Phase acceptance decision

**Decision: NOT ACCEPTED — awaiting combined verification.**

Phase 1 may be accepted only when:
1. All tasks 1.1–1.11 meet their acceptance criteria.
2. The full combined verification run passes, or every remaining blocker is explicitly documented and accepted under the project's release governance.
3. All migration and CI evidence is recorded with commit SHA and workflow run IDs.
4. The security residuals and data-residency decisions are resolved or formally accepted.
5. The dedicated Phase 1 closeout commit is created and its CI is verified.

## 6. Owner-directed commit and verification cadence

The owner has directed that there be **one commit at the end of Phase 1**, not separate commits after each task. Keep the Phase 1 implementation and test artifacts in the prepared tree. Do not poll CI or run intermediate checks after individual changes. At closeout, present the complete phase batch, obtain approval for the closeout commit, create that commit, and run the combined verification once. If verification fails, fix the batch and repeat the consolidated run; do not mark the phase GREEN prematurely.

This cadence changes when work is committed and verified. It does not waive security requirements, authorise production use, or permit confidential legal data before acceptance.
