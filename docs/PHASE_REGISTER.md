# NJUMENI — LIVE PHASE EXECUTION REGISTER

**This is the operational register.** The [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md) defines the scope and architecture; this register controls the actual work and phase locks.

- Repository: `ICOFCUCAM/njumeni`
- Active phase: **Phase 1 — Identity, tenancy and security foundation**
- Phase state: **🟡 OPEN — IN PROGRESS**
- Next task: **1.5 — Implement organisations, workspaces and tenant ownership**
- Phase 0 closeout commit: `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1` — CI run `42768822407` completed SUCCESS.
- Rule: work may proceed only in the single active phase; later phases remain locked until their dedicated closeout commits and CI checks are verified.

## 1. Register legend

| Indicator | Meaning |
|---|---|
| 🟢 GREEN / COMPLETE | Deliverable implemented or completed, reviewed, checks passed, documentation updated and commit SHA recorded |
| 🟡 IN PROGRESS | Work has started; acceptance is not yet satisfied |
| 🔴 BLOCKED | Cannot proceed until a named dependency or decision is resolved |
| ⚪ NOT STARTED | Work has not begun |
| 🔒 LOCKED | Belongs to a future phase; no implementation may start |

A task does not turn green because code was written. It turns green only after its acceptance conditions are met and its commit is verified. If a later change breaks it, change its state to REGRESSION and resolve it.

## 2. Active phase — Phase 0

**Phase objective:** establish the complete, verified product, repository, architecture, engineering and infrastructure foundation required to begin application implementation safely.

**Phase-wide closeout requirements:**
- All numbered tasks 0.1–0.16 are green.
- Exact original 20-point outline and A–M module map are preserved and mapped.
- CMP material is safely archived and verified outside Njumeni before its removal from this repository.
- Product scope and first-release specification are approved and documented.
- Modular-monolith architecture, eight layers, bounded contexts and module contracts are recorded.
- Development standards and local/test/staging/production environment strategy are documented and reproducible.
- CI quality, build, test, security and repository-policy checks pass.
- Database migration and hosted-database reconciliation policy is defined and verified against the actual environment before schema work begins.
- Hosting, domains, database, storage, queue, provider, secrets and deployment facts are inventoried; unknowns are explicitly recorded.
- Application shell and navigation architecture are specified without prematurely implementing downstream features.
- Repository hygiene and all Phase 0 risks are reviewed.
- Phase-wide acceptance report is committed.
- Dedicated Phase 0 closeout commit exists and is verified.

### Phase 0 task register

| No. | Task / required outcome | Status | Acceptance evidence / commit |
|---|---|---|---|
| 0.1 | Restore and freeze the original 20 numbered outline sections and canonical A–M modules | 🟢 GREEN | Original source preserved as `docs/ORIGINAL_MASTER_PLAN_SOURCE.md`; canonical [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md) begins with the exact original text and appends a separate live overlay. Source SHA-256 `4dce95748a34c529caa74fce5f2dfd3486fc9d2fa5c88ac54cc3f14f71992fe0` (60,927 bytes; 60,008 characters; 3,437 lines). `tests/original-plan.test.mjs` enforces the checksum, all twenty headings, eight layers and five named upstream repositories. Preservation commit `0e0f263e6917bbde78bc633f8ea470adb8fdfe96`; test commit `d79c9d747040f9e53051e6c318cb6cb7066d0809`. |
| 0.2 | Audit complete repository tree, branch, commits, scripts, workflows and upstream material | 🟢 GREEN | [Phase 0 audit](PHASE_0_AUDIT.md); audit commit `a3b5d32`; repository security workflow passed |
| 0.3 | Inventory and preserve existing Njumeni/JurisAI components; archive legacy CMP separately and verify preservation before removal | 🟢 GREEN | Six original files archived in [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive); all six archive blob SHAs match source commit `0d9c90f`. Recursive archive tree verified. Archive verification commit `a2820521ce3459af3feb6c8a28d83aa28c2291f6`. CMP-only files removed from Njumeni in commits `4643a0e`, `06fda6a`, `6f6e804`, `158a09d`, `f5d842b`. |
| 0.4 | Finalise repository boundaries: Njumeni app, marketing website, CMP archive and isolated upstream research | 🟢 GREEN | Canonical repository map and project-separation rules in `docs/PRODUCT_BOUNDARIES.md`; README and Phase 0 audit aligned. Commits `42177a8`, `5988fb2`, `cbdb919`; repository-security workflow passed on task commit `c54a2b2` (run `42737825274`). |
| 0.5 | Produce complete product specification: users, priority journeys, launch scope, jurisdiction, requirements and non-goals | 🟢 GREEN | [Product Specification](PRODUCT_SPECIFICATION.md) committed at `67f3a9a`. Defines four target segments, seven priority journeys, Norway/EU/UK/US/international law/Cameroon priority coverage, P0/P1 first-release scope, functional and trust requirements, A–M positioning, non-goals, acceptance criteria and explicit open decision gates. Reviewed against the master plan and architecture proposal; 15-section structural/content validation passed. Supporting updates: master plan `f6f14ca`, audit `83af95c`, README `195f898`. |
| 0.6 | Approve modular-monolith architecture, bounded contexts, eight platform layers and dependency rules | 🟢 GREEN | [ADR-0001](architecture/ADR-0001-modular-monolith-and-bounded-contexts.md) records the modular-monolith decision, bounded contexts, dependency direction, ownership, tenant/matter isolation and the exact eight original layer names in their original order: Experience, API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification and Infrastructure. The source and exact layer naming are preserved in `docs/ORIGINAL_MASTER_PLAN_SOURCE.md`. ADR status and acceptance commit `4ecfafcb2ba342e2f71c614dd19e7af4308158dc`; exact label correction `78bca73e2f1c70827f6e18ede38017c3e641c6b4`; final clarification `6310a7aa01371f1636578cea4f5b51b34de809e8`. |
| 0.7 | Map A–M modules to layers, workstreams, ownership, dependencies, APIs/events, permissions and phase delivery | 🟢 GREEN | [A–M Module Layer Map](architecture/MODULE_LAYER_MAP.md) and [A–M Capability Traceability](architecture/MODULE_REQUIREMENTS_TRACEABILITY.md) preserve all thirteen canonical module names and original capabilities, and map each to the eight exact source layers, bounded-context ownership, inputs/outputs, contracts/events, permission boundaries, cross-module dependencies and Phase 0–13 delivery. Final status/acceptance recorded in commits `4ecfafcb2ba342e2f71c614dd19e7af4308158dc`, `78bca73e2f1c70827f6e18ede38017c3e641c6b4` and `6310a7aa01371f1636578cea4f5b51b34de809e8`. |
| 0.8 | Establish coding, naming, formatting, lint, type, error, logging and review standards | 🟢 GREEN | [Engineering Standards](ENGINEERING_STANDARDS.md) `83db8b6e6d6700e4b3e53672ebd20496eab43b80`; [Contributing Guide](../CONTRIBUTING.md) `031e6c83ff26addb92dfecb7ed146dcc18646318`; `.editorconfig` `e3cdffceb1fcb44853826754d5178bba8dc67dd9`; `.prettierrc.json` `9d8c55108304cf120d3fed573b51185faf615a19`; `.prettierignore` `bea7cf9160b2555e2e703351a94575731b8e5093`; README link `078c024d58dc0cbdcef6902c399281681117b84a`. Standards define TypeScript strictness, naming, formatting, validation, error handling, logging/audit, privacy, tests, reviews, commits and future enforcement. Formatter JSON was parsed and settings reviewed; no package manifest exists yet, so executable ESLint/type-check/test scripts are intentionally assigned to task 0.10 after environment/toolchain setup. Repository-security workflows passed for all deliverable commits, including final register commit run `42740075241`. |
| 0.9 | Establish reproducible local, test/CI, staging and production environment strategy | 🟢 GREEN | [Environment Strategy](ENVIRONMENT_STRATEGY.md) `c7ac3b4f76a78decd6aaa9336cb184be9f7921d3`; placeholder-only `.env.example` `7a06c68db0b5e07674488fc4564f53f3cf3bf217`; README link `c906c249bd4d9c3484f6f7d6b5f5d8710b365afa`. Defines local/test/staging/production separation, service topology, secrets, data controls, build/release promotion, backup/restore and unresolved provider decisions. Placeholder config was reviewed and .gitignore explicitly permits only `.env.example`; no real secrets were added. Repository-security workflows passed for all task commits, including register run `42740233124`. Verified risk retained: GitHub metadata reports the application repository is PUBLIC, conflicting with the original plan's private-repository requirement; resolution is tracked for Phase 0 security/hosting review. Provider IDs/regions/domains and actual runtime provisioning are deliberately not claimed. |
| 0.10 | Complete CI for format, lint, type-check, tests, build, security, secrets and repository policy | 🟢 GREEN | `.github/workflows/repository-security.yml` is the consolidated quality/security workflow. Formatting, ESLint, strict TypeScript baseline, foundation/migration tests, original-plan checksum and twenty-section tests, A–M app-shell contract tests, migration guard, architecture integrity, repository content policy, Gitleaks, web-package typecheck and Next.js production build all passed in final run `42744161490` on `89bbdd50aaf41e67694a08b693f023ad2307c34e`. |
| 0.11 | Define migration discipline: immutable ordered migrations, local replay/reset, hosted history reconciliation, drift, backup and forward-fix | 🟢 GREEN | [Database Migration Policy](DATABASE_MIGRATION_POLICY.md) defines immutable ordered migrations, local replay/reset, hosted-history reconciliation, drift, backup and forward-fix rules. `scripts/ci/check-migrations.mjs` enforces filename format, unique ascending timestamps and blocks edits/deletions/renames; three migration tests and the CI guard passed in run `42741685025`. Repository has no Njumeni Supabase config or migration SQL and no clearly identifiable Njumeni hosted project; no other product database was queried or modified, and hosted history is not claimed as reconciled. Local replay remains documented for the future provisioned Njumeni environment. |
| 0.12 | Build the legal application shell, navigation, route boundaries and module entry points | 🟢 GREEN | `apps/web` implements the Next.js App Router shell, responsive navigation, dashboard, all A–M module route entries, sign-in boundary placeholder, health endpoint, error and not-found boundaries. Package manifest and committed npm lockfile are pinned; [Application Shell](APP_SHELL.md) documents route ownership and non-operational boundaries. App TypeScript check and production build passed in final CI run `42744161490` on commit `89bbdd50aaf41e67694a08b693f023ad2307c34e`; route contract and source-integrity tests also passed. |
| 0.13 | Audit hosting, domains, deployment, secrets, DB, storage, queues and external providers | 🟢 GREEN | [Infrastructure Audit](INFRASTRUCTURE_AUDIT.md) records the read-only GitHub, Vercel, Supabase, web runtime, domain, storage, queue, worker, AI-provider, monitoring, backup and data-residency inventory; distinguishes verified facts, gaps and owner decisions; no external resources or production data changed. Acceptance checklist complete. Audit file blob `4791f4498e323790f056469dd73d1fd90f8627fb`. |
| 0.14 | Create dependency-aware Phase 0–13 backlog and acceptance criteria | 🟢 GREEN | [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md); initial commit `b057558`, updated register commit `0c2b9d5` |
| 0.15 | Run full repository hygiene checks and document unresolved risks | 🟢 GREEN | [Repository Hygiene Review](REPOSITORY_HYGIENE_REVIEW.md) records the tracked-tree review, ignore/data/secret controls, CI evidence, third-party notices, supply-chain gaps and owner/security risks. Review commit `54088c64f5f3c7068d2c46907331591e9ceb46ab`; CI run `42768502487` completed SUCCESS. |
| 0.16 | Conduct Phase 0 acceptance review and prepare closeout commit | 🟢 GREEN | [Phase 0 Acceptance Report](PHASE_0_ACCEPTANCE_REPORT.md) and [Phase 0 Closeout](PHASE_0_CLOSEOUT.md). Dedicated closeout commit `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1`; CI run `42768822407` completed SUCCESS. All Phase 0 tasks 0.1–0.16 are GREEN. |


**Task 0.6 closeout note (2026-11-10):** The original Njumeni master architecture was supplied and the eight canonical platform layers were recovered without renaming: Experience; API; Workflow orchestration; Evidence; Legal knowledge; Reasoning; Verification; Infrastructure. Their original responsibilities are preserved in the [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md) and expanded into layer contracts, exclusions, interfaces, dependency rules, security responsibilities, an acyclic interaction model and a high-level mapping to all twenty original sections in [ADR-0001](architecture/ADR-0001-modular-monolith-and-bounded-contexts.md). Task 0.6 is GREEN. Detailed A–M mapping is task 0.7.

### Phase 0 verified commits

| Deliverable | Commit |
|---|---|
| Phase 0 repository audit | `a3b5d32c602f96baf9ac3daaf51f49633e9e2e3e` |
| Original 20-point outline and A–M register restored; phase-lock rules added | `0c2b9d5c970a8de8670cc5823374dd246aa7483b` |
| Master phase backlog initial commit | `b05755824b97f7f937cb4679f73cdadf4e45e471` |

The security workflow passed for commits `a3b5d32`, `0c2b9d5`, `9427e26` and `c046790`. Workflow runs for the latest audit/README/master-plan corrections are still running or queued and must be checked before their commits are treated as CI-verified.

## Active phase — Phase 1

**Phase objective:** establish identity, tenant/workspace isolation, authorisation, audit and security foundations before Njumeni handles confidential legal matters or documents.

**Phase plan:** [Phase 1 — Identity, tenancy and security foundation](PHASE_1_PLAN.md).

| No. | Task / required outcome | Status | Acceptance evidence |
|---|---|---|---|
| 1.1 | Define identity, authentication, tenant and workspace security contracts | 🟢 GREEN | [ADR-0002 — Identity, Tenancy and Security Architecture](architecture/ADR-0002-identity-tenancy-security.md) defines principal/session/tenant/workspace/membership/permission concepts, trust boundaries, deny-by-default rules, RLS, audit, threat model and open decisions. ADR commit `f8a2ee06588cc985970ce8a0b8a6828d25afef96`; verified by CI run `42769220793` on follow-up integrity commit `2f22fddc14881c18a96a0cd6bcee12ad709943f8`. |
| 1.2 | Verify dedicated Njumeni identity/database environment readiness | 🟢 GREEN | Dedicated project `Njumeni` (`vvjpsejeeffykaozfbik`) created in `eu-north-1`; project status `ACTIVE_HEALTHY`; PostgreSQL 17.11 and built-in Auth/Storage schemas verified; empty app schema/migration baseline confirmed; publishable key availability verified; security/performance/health advisors clear. Documentation commit `4fdc1e8bb70d888d0869f75e76d0726d57901e6a`; CI run `42772065771` SUCCESS (all 3 jobs passed). See [Environment Readiness Assessment](PHASE_1_ENVIRONMENT_READINESS.md). |
| 1.3 | Implement identity provider integration and secure session lifecycle | 🟡 DEVELOPMENT IMPLEMENTATION COMPLETE — RELEASE CHECKS DEFERRED | Official Supabase SSR/Auth integration, request-scoped client, Next.js 16 Proxy refresh, server-side `getUser()` guard, sign-in/sign-out and cookie handling are implemented. Owner confirmed sign-in, refresh persistence, logout, protected-route denial and cookie removal. CI run `42839971018` passed all three jobs and the mocked Auth lifecycle suite. Live provider refresh/revocation verification and leaked-password protection remain release checks assigned to Task 1.11/Phase 1.12. Development proceeds to Task 1.4 under the owner’s autonomous-build instruction; no confidential data or customer onboarding is permitted before Phase 1 closeout. See [Task 1.3 implementation contract](PHASE_1_TASK_1_3_AUTH_IMPLEMENTATION.md). |
| 1.4 | Implement user profile and principal model | 🔒 LOCKED | Task 1.3 must close first. Preliminary profile UI/action and two SQL migration drafts are not approved or applied. Pre-review identified required corrections for principal suspension/deactivation enforcement, consistent HTTPS avatar validation, IANA time-zone validation, SECURITY DEFINER/trigger review, clean local replay and database RLS integration tests. See [Task 1.4 draft review](PHASE_1_TASK_1_4_PROFILE_DRAFT_REVIEW.md). |
| 1.5 | Implement organisations, workspaces and tenant ownership | 🔒 LOCKED | Tenant/workspace schema, ownership rules and isolation tests. |
| 1.6 | Implement membership and invitation lifecycle | 🔒 LOCKED | Active/pending/revoked membership; expiring single-use identity-bound invitations and audit. |
| 1.7 | Implement roles, permissions and server-side authorisation | 🔒 LOCKED | Explicit permission catalogue, scoped roles, deny-by-default policy and escalation tests. |
| 1.8 | Implement PostgreSQL RLS and storage access policies | 🔒 LOCKED | Tenant-scoped RLS and private storage policies tested under realistic non-owner principals. |
| 1.9 | Implement security audit logging | 🔒 LOCKED | Structured append-only security events, redaction, retention and access controls. |
| 1.10 | Implement subscription identity and entitlement boundary | 🔒 LOCKED | Billing identity linkage separated from resource authorisation. |
| 1.11 | Execute tenant-isolation and security verification suite | 🔒 LOCKED | Negative cross-tenant tests across API, DB, storage and jobs; threat-model residuals documented. |
| 1.12 | Phase 1 acceptance and closeout | 🔒 LOCKED | All 1.1–1.11 green, phase-wide security/CI acceptance and verified closeout commit. |

**Phase 1 safety gate:** no real customer legal documents or confidential matters may be accepted until identity, tenancy, RLS, private storage, audit and provider-egress controls have been implemented and verified.

## 3. Phase lock register

Phase 0 is CLOSED. Phase 1 is now OPEN after successful verification of the dedicated Phase 0 closeout commit and its CI run. Phases 2–13 remain locked until their respective phase acceptance and closeout conditions pass.

| Phase | Name | Register state | Unlock condition |
|---|---|---|---|
| 0 | Foundation and repository/infrastructure audit | 🟢 CLOSED | All 0.1–0.16 green; closeout `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1`; CI run `42768822407` SUCCESS |
| 1 | Identity, tenancy and security foundation | 🟡 OPEN | Active; Phase 0 closeout verified |
| 2 | Legal knowledge foundation | 🔒 LOCKED | Phase 1 closeout verified |
| 3 | Evidence and document foundation | 🔒 LOCKED | Phase 2 closeout verified |
| 4 | Document intelligence | 🔒 LOCKED | Phase 3 closeout verified |
| 5 | Legal research | 🔒 LOCKED | Phase 4 closeout verified |
| 6 | AI reasoning and argument graph | 🔒 LOCKED | Phase 5 closeout verified |
| 7 | Verification and quality control | 🔒 LOCKED | Phase 6 closeout verified |
| 8 | Documents, contracts and drafting | 🔒 LOCKED | Phase 7 closeout verified |
| 9 | Personal and case workspace | 🔒 LOCKED | Phase 8 closeout verified |
| 10 | Professional and institutional edition | 🔒 LOCKED | Phase 9 closeout verified |
| 11 | Commercial platform | 🔒 LOCKED | Phase 10 closeout verified |
| 12 | Global and multi-jurisdiction expansion | 🔒 LOCKED | Phase 11 closeout verified |
| 13 | Production hardening and launch | 🔒 LOCKED | Phase 12 closeout verified |

## 4. Required workflow for every task

1. Read this register and the relevant master-plan section before editing code.
2. Confirm the active task number, dependencies, acceptance criteria and current branch/head.
3. Inspect existing implementation and tests before making changes.
4. Implement only the active task and its necessary prerequisites.
5. Run the task's tests, security checks and relevant integration checks.
6. Update documentation and this register with the result.
7. Commit the task. Record the full commit SHA.
8. Mark it 🟢 GREEN only after verification and commit.
9. Move to the next numbered task in the same phase.
10. When the last task is complete, run the entire phase acceptance suite, create the phase acceptance report and a dedicated phase-closeout commit.
11. Verify the closeout commit and then unlock the next phase.

## 5. Autonomous build instruction

On the owner’s instruction dated 10 November 2026, continue implementation sequentially across the remaining numbered tasks and phases without waiting for repeated “go next” messages. External security verification, plan-dependent Auth controls and final launch reviews must remain recorded as release gates and be revisited at the designated security/phase acceptance tasks; they must not repeatedly interrupt functional product development. This does not authorise production use, customer onboarding or confidential legal data before the relevant phase safety gates pass. Do not report a task or phase GREEN until its own implementation, tests, review, CI and evidence requirements pass.

## 6. "Go next" instruction

When the user says **"go next"**, continue the first incomplete task in the one active phase shown above. Do not ask the user to select a task already determined by this register. Do not start work in a locked phase. If blocked, explain the blocker and resolve the next prerequisite within the same phase.


## Owner decision — upstream reference set (10 November 2026)

The product owner has confirmed that the five repositories named in the original master source—OpenContracts, CaseCite, Lawgent, Lovspor and Mike—are the selected upstream reference projects for the initial architecture assessment. They are architectural inputs, not the exclusive set of technologies, components or sources Njumeni may use. Njumeni's wider architecture may incorporate other suitable open-source and commercial technologies, independently developed components and further capabilities as requirements demand. Each of the five named projects requires an individual capability inventory, exact-version licence review, security assessment, architecture/compatibility decision, implementation mapping and tests. For each capability, the outcome may be adopt, adapt, reimplement in Njumeni-owned code, isolate behind an adapter, replace or discard. Product requirements and Njumeni's approved architecture govern selection; wholesale copying and licence circumvention are not authorised. The earlier uncertainty is closed only as to whether a sixth project is needed to complete this initial five-project assessment set. Future technologies and projects may still be evaluated when justified, without changing this decision.
