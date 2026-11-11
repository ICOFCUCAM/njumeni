# NJUMENI — LIVE PHASE REGISTER

**This is the operational register.** The governing plan is the [Njumeni Master Plan v2.0](NJUMENI_MASTER_PLAN.md). The original source is preserved unchanged in [MASTER_IMPLEMENTATION_PLAN.md](MASTER_IMPLEMENTATION_PLAN.md) and [ORIGINAL_MASTER_PLAN_SOURCE.md](ORIGINAL_MASTER_PLAN_SOURCE.md). This register controls actual work, task status, evidence and phase locks.

| Field | Value |
|---|---|
| Repository | `ICOFCUCAM/njumeni`: **public, built in public** ([ADR-0003](architecture/ADR-0003-build-in-public-and-staged-infrastructure.md)) |
| Register revision | 2026-11-11: rewritten to align with Master Plan v2.0 and to correct status against the actual code and CI |
| Reviewed head | `2b60d5f` |
| Infrastructure stage | **Stage 0: zero cost, synthetic data only** |
| Hosted database | Supabase project `Njumeni` (`eu-north-1`). **No migrations applied. Deployment deferred until all phases are complete (Phase 13)** |
| Active phases | **Phase 2 (IN PROGRESS; 2.8 needs network)** · **Phase 3 (IMPLEMENTED; CI green)** · **Phase 4 (IMPLEMENTED; verified locally)** · Phase 5 next |
| Phase 0 closeout | `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1`; CI run `42768822407` SUCCESS |
| Next action | Confirm CI on the Phase 4 commit, then Phase 5 (AI reasoning and agent framework) |
| CI mode | ▶️ **Automatic CI re-enabled** (owner decision, 2026-11-11; free on the public repository). **Execution mode: continuous autonomous, one commit and push per completed phase** |

## 1. Status legend (Master Plan v2.0 §21.2)

| Indicator | Meaning |
|---|---|
| ⚪ NOT STARTED | No work begun |
| 🟡 IN PROGRESS / OPEN | Work under way; not yet complete |
| 🔵 IMPLEMENTED | Code and tests committed; verification not yet run or not yet passing everywhere |
| 🟠 VERIFICATION FAILING | Verification ran and failed; fixing it is the next action |
| 🟢 GREEN / CLOSED | Acceptance met, CI green, evidence (commit and run IDs) recorded |
| 🔴 BLOCKED | Named external dependency or owner decision required |
| 🔒 LOCKED | Future phase; no implementation may start |
| ⚠️ REGRESSION | Was green; a later change broke it |

A task does not turn green because code was written. It turns green only when its acceptance conditions are met and its commit is verified by CI.

## 2. Current position

### 2.1 Summary

| Area | State |
|---|---|
| Phase 0 | 🟢 Closed and verified |
| Phase 1 | Implementation complete; **all database tests pass locally** (2026-11-11). Remaining: live Auth check, closeout items |
| Phase 2 | Schema, ingestion framework, durable queue, worker, retrieval, citation bundles and rights/coverage governance implemented; pgTAP passing locally. **No legal content, no source adapters, no embeddings, no UI** |
| Phases 3–13 | 🔒 Locked |
| Local checks (2026-11-11) | pgTAP 272/272 ✅ · db lint ✅ · typecheck ✅ · web tests 161/161 ✅ (includes 114 legal-knowledge) · build ✅ · root tests 19/19 ✅ |
| CI | ▶️ Automatic on every push. Runs on the Phase 3 commit provide the CI evidence for the Phase 1 closeout |

### 2.2 Owner decisions in force

| Date | Decision | Record |
|---|---|---|
| 2026-11-10 | Phase 2 may proceed in parallel with Phase 1 verification; no customer data before Phase 1 acceptance | This register |
| 2026-11-10 | Five upstream reference projects (OpenContracts, CaseCite, Lawgent, Lovspor, Mike) form the initial assessment set; not exclusive | Master plan §12.1 |
| 2026-11-11 | **Build in public at zero cost** (Stage 0) | ADR-0003 |
| 2026-11-11 | **Keep all migrations in the repository; apply them to hosted Supabase only when all phases are complete** | ADR-0003 §2.5; master plan U-27 |
| 2026-11-11 | Master Plan v2.0 adopted as the governing plan; roadmap order of Phases 3–8 restored to the original | Master plan §20 |

### 2.3 Check failures (fix before any new feature work, U-18)

**Resolution, 2026-11-11.** All seven blockers are fixed. They were verified locally because automatic CI is paused:
- A local Supabase stack (CLI 3.1.0) replayed all 23 migrations from empty.
- **pgTAP: 272/272 passing across 9 files.**
- `db lint`: no errors.
- Migration guard (against base `b7123a0`): passes, and fails without the new entry.
- Web type check passes, web tests pass 161/161, production build succeeds.
- Root tests pass 19/19, and the Prettier check passes.

A manual run of the CI workflows is still required at phase closeout.


| # | Blocker | Location | Cause | Fix |
|---|---|---|---|---|
| B-1 ✅ | Migration-policy guard fails | `scripts/ci/check-migrations.mjs` | `20261110290000_legal_source_coverage_review.sql` was corrected in `2b60d5f` without a hash-pinned entry | Add the entry to `scripts/ci/migration-predeployment-corrections.json` |
| B-2 ✅ | RBAC pgTAP fails (tests 10, 11, 37; file aborts near line 497) | `supabase/tests/role_permission.test.sql` | Fixture creates a workspace as a member before `org_admin` is bound; reads `private.role_audit_events` while still `authenticated` | Reorder the fixture; `reset role` before the private read |
| B-3 ✅ | Audit pgTAP: 0 of 12 run | `supabase/tests/security_audit.test.sql` | Fixture inserts two rows into `audit_test_ids`, so a scalar subquery returns more than one row | Use a single keyed row, or keyed lookups |
| B-4 ✅ | Legal-knowledge pgTAP fails | `supabase/tests/legal_knowledge_foundation.test.sql` | Line 66 `$`-delimiter corruption; test 22 expects `USER-DEFINED` (Postgres reports `tsvector`); test 39 checks a superseded 7-argument signature | Repair the delimiter; update both assertions |
| B-5 ✅ | Worker cannot start | `apps/web/package.json` | `server-only` is imported but not a dependency | Add the pinned dependency and update the lockfile |
| B-6 ✅ | Legal-knowledge unit tests not in CI (*finding withdrawn: `test:auth` already ran every `tests/*.test.mjs`, including legal-knowledge; a clearer `npm test` script was added*) | `.github/workflows/repository-security.yml` | No job runs `test:legal-knowledge` | Add the step |
| B-7 ✅ | Generated DB types stale (*regenerated with CLI 3.1.0; three callers stopped passing `null` for optional `p_workspace_id`; CI now fails on type drift*) | `apps/web/src/lib/supabase/database.types.ts` | Not regenerated since the Phase 1 audit and billing work, and the Phase 2 work | Regenerate; add a drift check in CI |


## 3. Phase 0: Architecture and project foundation (🟢 CLOSED)

**Objective:** establish the verified product, repository, architecture, engineering and infrastructure foundation required to begin application implementation safely.

The Phase 0 record below is preserved as verified history. Two Phase 0 positions have since been changed by owner decision and recorded in v2.0, without reopening the phase:
- **Repository visibility.** The 0.9 and 0.15 risk "repository is PUBLIC" is resolved by ADR-0003 (build in public).
- **Monorepo.** The original "establish monorepo" is delivered incrementally (master plan §9.4, U-06).

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
| Master phase backlog, initial commit | `b05755824b97f7f937cb4679f73cdadf4e45e471` |
| Phase 0 closeout | `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1` (CI run `42768822407` SUCCESS) |

## 4. Phase 1: Identity, tenancy and security (🟢 CLOSED, 11 November 2026)

**Objective:** establish identity, tenant/workspace isolation, authorisation, audit and security foundations before Njumeni handles confidential legal matters or documents.
**Plan:** [PHASE_1_PLAN.md](PHASE_1_PLAN.md) (rewritten for v2.0).
**Implementation batch:** `b08605486b6782f5fda030aa4fe27a8b86c9989a`, plus a formatting follow-up `90d9a5f` and later corrections.

| No. | Task | Status | Evidence / remaining work |
|---|---|---|---|
| 1.1 | Identity, authentication, tenant and workspace security contracts | 🟢 GREEN | [ADR-0002](architecture/ADR-0002-identity-tenancy-security.md); ADR commit `f8a2ee06588cc985970ce8a0b8a6828d25afef96`; CI run `42769220793`. *Closeout action:* move the ADR from "Proposed" to "Accepted" and resolve or defer its §12 open decisions |
| 1.2 | Dedicated Njumeni identity/database environment readiness | 🟢 GREEN | Project `Njumeni` (`vvjpsejeeffykaozfbik`, `eu-north-1`, PostgreSQL 17.11); commit `4fdc1e8bb70d888d0869f75e76d0726d57901e6a`; CI run `42772065771`. The hosted schema stays empty until Phase 13 (U-27) |
| 1.3 | Identity provider integration and secure session lifecycle | 🟢 GREEN | Supabase SSR, Proxy refresh, server-side `getUser()` guard, sign-in/out; owner-confirmed manual checks; CI run `42839971018` (mocked lifecycle suite). **Remaining:** live provider test (`scripts/auth-provider.integration.test.mjs`, which needs test secrets); leaked-password protection is an accepted Stage 0 risk (ADR-0003) Verified on GitHub Actions: CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). |
| 1.4 | User profile and principal model | 🟢 GREEN | 16/16 pgTAP; local run `42845114187`; CI `42846043378`. [Acceptance](PHASE_1_TASK_1_4_ACCEPTANCE.md) |
| 1.5 | Organisations, workspaces and tenant ownership | 🟢 GREEN | 38/38 pgTAP; run `42846849437`; CI `42848567330`. [Acceptance](PHASE_1_TASK_1_5_ACCEPTANCE.md) |
| 1.6 | Membership and invitation lifecycle | 🟢 GREEN | 85/85 pgTAP; run `42855740183`; CI `42855740121`. [Acceptance](PHASE_1_TASK_1_6_ACCEPTANCE.md) |
| 1.7 | Roles, permissions and server-side authorisation | 🟢 GREEN | `role_permission.test.sql` **60/60** after the fixture fix (B-2). Admin creation now runs under the admin identity; a new negative test proves a plain member cannot create workspaces. Turns GREEN with the closeout CI run Verified on GitHub Actions: CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). |
| 1.8 | PostgreSQL RLS and storage access policies | 🟢 GREEN | Private workspace bucket and path-scoped policies; `storage_isolation.test.sql` passes in CI. The server storage helper is not yet called by any UI; the upload path is delivered in Phase 3. Acceptance for 1.8 is at database-policy level Verified on GitHub Actions: CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). |
| 1.9 | Security audit logging | 🟢 GREEN | Append-only stream, triggers, allow-listed metadata, read RPC. `security_audit.test.sql` **12/12** after the fixture fix (B-3). **v2.0 scope note:** sign-in/sign-out and denied-access events are added at Phase 1 closeout; hash-chaining (U-12) is delivered with evidence custody in Phase 3 Verified on GitHub Actions: CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). |
| 1.10 | Subscription identity and entitlement boundary | 🟢 GREEN | Billing identity, entitlements, usage ledger, provider-event idempotency; `subscription_entitlements.test.sql` passes. **Review at closeout:** whether `record_usage_event` should be server-only Verified on GitHub Actions: CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). |
| 1.11 | Tenant-isolation and security verification suite | 🟢 GREEN | All Phase 1 pgTAP files pass on a local stack (2026-11-11). Remaining: the manual CI run at closeout Verified on GitHub Actions: CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). |
| 1.12 | Phase 1 acceptance and closeout | 🟢 GREEN — CLOSED | [Acceptance report](PHASE_1_ACCEPTANCE_REPORT.md): every condition met. CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`). Closed 11 November 2026 |

### 4.1 Phase 1 closeout checklist

**Progress, 2026-11-11:** items 1 (locally), 2, 3, 4 (deferred to Phase 3 with rationale), 5, 6 and 7 are done. The remaining item is the manual CI run in item 1, followed by item 8. See the [acceptance report](PHASE_1_ACCEPTANCE_REPORT.md).


1. Fix blockers B-1 to B-7 and get one fully green CI run, including the local database job.
2. Run the live Auth lifecycle test with a dedicated synthetic identity, then delete the identity.
3. Record the D-6 leaked-password risk acceptance (ADR-0003 §2.6).
4. Add sign-in, sign-out and denied-access audit events, or record their deferral with an owner decision.
5. Move ADR-0002 to Accepted.
6. Refresh the stale documents:
   - `README.md`
   - `apps/web/src/app/api/health/route.ts` and `docs/APP_SHELL.md`
   - `INFRASTRUCTURE_AUDIT.md`, `ENVIRONMENT_STRATEGY.md`, `DATABASE_MIGRATION_POLICY.md`, `CI_PIPELINE.md` and `CONTRIBUTING.md`

   Update the tests that pin outdated wording.
7. Write `PHASE_1_ACCEPTANCE_REPORT.md` with run IDs.
8. Make the closeout commit, get a green CI run and tag it `phase-1-closed`.

No hosted migration is part of the Phase 1 closeout (U-27).

**Phase 1 safety gate:** no real customer legal documents or confidential matters may be accepted until identity, tenancy, RLS, private storage, audit and provider-egress controls are verified **and** the hosted deployment of Phase 13 has taken place.

## 5. Phase 2: Legal knowledge infrastructure (🟡 IN PROGRESS, parallel)

**Objective:** a governed, jurisdiction-aware, bitemporal legal-authority registry and retrieval substrate, proven end-to-end with one rights-approved pilot source.
**Plan:** [PHASE_2_PLAN.md](PHASE_2_PLAN.md) (rewritten for v2.0).
**Implementation:** `b7123a0` plus repair commits `00b7eb8`, `e2d52b4`, `01d459f` and `2b60d5f` (migration `$`-delimiter corruption repaired; clean replay of all 23 migrations confirmed in CI run `42900717384`).

> **Renumbering note (v2.0):** the former Task 2.8 "Phase 2 verification and closeout" is now **Task 2.11**. New Tasks 2.8–2.10 make Phase 2 deliver real, evaluated content rather than empty infrastructure.

| No. | Task | Status | Evidence / remaining work |
|---|---|---|---|
| 2.1 | Jurisdiction and legal-source registry | 🔵 IMPLEMENTED: verified locally | Schema, seeds (6 jurisdictions, 6 catalogue sources: all `review_required`, ingestion disabled), RLS and revokes. `legal_knowledge_foundation.test.sql` **69/69** after B-4. The test now asserts that *no unleased* append RPC exists |
| 2.2 | Authority identity and version model (bitemporal, U-07) | 🔵 IMPLEMENTED: verified locally | Stable identities, append-only versions, effective periods, SHA-256 hashes. **As-of query added** (migration `20261111130000`, `legal_authority_version_as_of`): valid time (`valid_from ≤ date < valid_until`) × system time (`created_at ≤ known_at`), so past answers can be reproduced exactly. pgTAP 6 assertions; typed client `getAuthorityVersionAsOf` |
| 2.3 | Normalisation and provenance contract | 🔵 IMPLEMENTED | Manifest/rights validation, Unicode normalisation, hashes, passage anchors; unit tests pass |
| 2.4 | Full-text and vector retrieval substrate | 🔵 IMPLEMENTED | GIN/HNSW indexes, lexical/semantic RPCs, hybrid ranking, citation bundles, trusted search. Language-aware FTS and the embedding profile are moved to Task 2.9 |
| 2.5 | Source ingestion lifecycle | 🔵 IMPLEMENTED | *(Register previously said "pending"; corrected.)* Durable leased queue, checkpoints, retries, dead letters, persistence RPCs, worker runtime, exact-version adapter registry. **Defect:** B-5 |
| 2.6 | Legal authority relationship graph | 🔵 IMPLEMENTED: verified locally | **Database graph query added** (`legal_authority_graph`): breadth-first, deterministic, cycle-safe, depth/node limits with a truncation flag, as-of and type filters. **Proven identical to the in-memory `traceAuthorityGraph` on 50 random cases (90 edges).** Vocabulary extended to the full §6.5 set (adds replaces, supplements, conflicts_with, plus inverses); a drift-guard test keeps TypeScript and SQL lists identical. pgTAP 14 assertions |
| 2.7 | Jurisdiction/source coverage governance | 🔵 IMPLEMENTED: verified locally | Coverage assessment, snapshot, source and jurisdiction reviews, append-only audits. **Aligned to master plan §6.7** (migration `20261111150000`): five levels (catalogued, planned, pilot, partial, supported). **The database refuses a published level that exceeds its evidence:** pilot needs a live rights-approved source; partial needs a recent passing recorded evaluation; supported is refused until citation verification exists (Phases 4/6). Append-only evaluation records (`legal_record_retrieval_evaluation`; a run can't be recorded as passed if any gate failed). **Norway corrected from `pilot` to `planned`** (no live source). Found and fixed: the shared append-only guard crashed with error 42703 on relationship rows instead of the intended 55000 (changes were still blocked, but with the wrong error); relationships now use a plain guard. App assessment uses the same ladder and explains each level. pgTAP `legal_coverage_levels` 16/16 (suite 338/338); 187 app tests; full chain verified through the API |
| 2.8 | Pilot source: rights review and first adapter (Norway legislation) | ⚪ NOT STARTED | Rights review of the candidate source (master plan §6.3); adapter with an exact version pin; activation through the audited RPCs; ingestion of a bounded corpus into the **local** stack |
| 2.9 | Embedding profile and multilingual retrieval (U-22) | 🔵 IMPLEMENTED: verified locally | **D-3 decided:** `multilingual-e5-small-v1` (MIT, 384 dimensions). Migration `20261111120000`: profile registry, `vector(384)`, per-language stemming (Norwegian, English, French, German, Swedish, Danish; `simple` fallback), embedding-only updates on otherwise immutable passages, worker-only backfill RPCs. App: `embedding-profile.ts`, `local-embedder.ts`, `embedding-backfill.ts`. pgTAP `legal_embedding_profile` 22/22 (suite 294/294); app tests 169/169; end-to-end backfill and search through the Supabase API passed with a stand-in model. **Remaining:** run the real model on a host that can download it (this environment blocks Hugging Face) |
| 2.10 | Retrieval evaluation set, Norway (U-15) | 🟡 IN PROGRESS: harness done; Norway set waits on 2.8 | **Harness implemented:** `retrieval-evaluation.ts` (Recall@10, Precision@5, MRR, currency accuracy, abstention accuracy; master plan §18.2 gates; gates with nothing to measure fail), dataset format in `legal-data/evaluation-datasets/`, synthetic set `synthetic-no-v1`, command `npm run eval:retrieval`. Through the real search pipeline on a local database, all gates pass on the synthetic set. **The harness found two defects, now fixed** (migration `20261111140000`): natural-language questions returned nothing because search required every term, and keyword scores (~0.03) always fell below the 0.12 relevance floor. Lexical search now matches any meaningful term and scores by coverage (0–1). pgTAP `legal_lexical_coverage` 8/8 (suite 322/322). **Remaining:** the real Norway set (`lovdata-no-v1`) after Task 2.8 |
| 2.11 | Phase 2 verification and closeout | 🔒 LOCKED | All of 2.1–2.10 green; clean replay; pgTAP; regenerated types; consolidated `LEGAL_KNOWLEDGE_ARCHITECTURE.md` and `DATABASE_ARCHITECTURE.md`; acceptance report; closeout commit and tag |

**Phase 2 safety gates:**
- No source ingestion until rights, terms and attribution are approved.
- No embeddings until the model profile is selected.
- No customer documents.
- No hosted migration deployment before Phase 13 (U-27).

## 5a. Phase 3: Evidence intelligence (🔵 IMPLEMENTED, verified locally)

**Plan and acceptance:** [PHASE_3_PLAN.md](PHASE_3_PLAN.md) · **Architecture:** [EVIDENCE_ARCHITECTURE.md](EVIDENCE_ARCHITECTURE.md) · **Domain model:** [DOMAIN_MODEL.md](DOMAIN_MODEL.md)

Built in parallel with Phase 1 closeout, under the owner's continuous autonomous mode (11 November 2026):
- **Evidence engine:** migration `20261111200000` adds items, file versions identified by SHA-256, quarantine until a worker-only scan, and extraction of PDF, DOCX, XLSX, email and text into anchored passages. It also detects dates, amounts, references and organisations, and builds the chronology.
- **Analysis and safeguards:** propositions with supports/contradicts/qualifies links and a contradiction report; redaction; legal hold; soft deletion.
- **Tamper evidence:** a hash-chained custody log per item, and a hash-chained security audit (U-12) with request correlation IDs. This closes Phase 1 deferrals D-AUD-2 and D-AUD-4.
- **Interface and worker:** pages at `/evidence` and `/evidence/[id]`; `npm run worker:evidence`.
- **Verification:** pgTAP 372/372 (`evidence_intelligence` 34/34); app tests 202/202; build passes; the end-to-end run on the local stack passed (quarantine, EICAR infected, disguised file rejected, extraction, chronology, custody and audit chains valid, outsider denied).
- **Outstanding for closeout:** Phase 1 closed; CI green on the phase commit; OCR (network); a full anti-malware engine (Stage 1); a physical purge job (Phase 13); failed sign-in audit (Phase 10).

## 5b. Phase 4: Legal research engine (🔵 IMPLEMENTED, verified locally)

**Plan and acceptance:** [PHASE_4_PLAN.md](PHASE_4_PLAN.md) · **Testing:** [TESTING_STRATEGY.md](TESTING_STRATEGY.md)

- **Workspace-scoped research.** Migration `20261111300000`: retrieval and authority context that never needs the service-role key in the web app.
- **Claim ledger and database verification (U-09, U-10).** Six-category claim ledger. `research_record_run` checks existence, resolution, currency, source rights and quotation, then answers or abstains.
- **Extractive composition** with verbatim quotes and citations. Later-amendment limitations. Conflict versus interpretation claims.
- **API and interface.** `/api/v1/research` with OpenAPI 3.1 and a contract test. Pages `/research` and `/research/[id]`.
- **Verification.** pgTAP 399/399 (research 27/27); app 214/214; build passes. Service and API end-to-end runs passed, including law applied as of 2015 versus 2024, abstention, 401/403 and forged claims withheld.
- **Outstanding.** CI on the phase commit; real content and the Norway evaluation set (Task 2.8); the semantic model (network); API keys (Phase 10).

**Phase 1 tag note:** the `phase-1-closed` tag (on `c51e53c`) could not be pushed from this environment; its Git proxy accepts branch pushes only. The closeout is recorded by commit SHA and CI run IDs. The owner can create the tag on GitHub (Releases).

## 6. Phase lock register

| Phase | Name | Register state | Unlock condition |
|---|---|---|---|
| 0 | Foundation and repository/infrastructure audit | 🟢 CLOSED | All 0.1–0.16 green; closeout `6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1`; CI run `42768822407` SUCCESS |
| 1 | Identity, tenancy and security foundation | 🟢 CLOSED | Unlocked after Phase 0 closeout verified. All 1.1–1.12 green; CI `43120316404` (CI and security, on `91a6544`) and `43120020368` (database verification, on `b11bf30`) |
| 2 | Legal knowledge foundation | 🟡 IN PROGRESS — PARALLEL | Owner authorised parallel implementation on 2026-11-10; Phase 1 acceptance remains a prerequisite for customer data |
| 3 | Evidence intelligence | 🔵 IMPLEMENTED — VERIFIED LOCALLY | Closeout needs Phase 1 closed, CI green on the Phase 3 commit, OCR and a full anti-malware engine ([Phase 3 plan](PHASE_3_PLAN.md) §5) |
| 4 | Legal research engine (with verification core) | 🔵 IMPLEMENTED — VERIFIED LOCALLY | Built in parallel (owner autonomous mode). Formal closeout needs Phase 2 content (Task 2.8) and CI on the phase commit ([Phase 4 plan](PHASE_4_PLAN.md) §5) |
| — | Milestone M1: grounded-research demo (local stack) | — | Phase 4 exit criteria met for Norway |
| 5 | AI reasoning and agent framework | 🔒 LOCKED | Phases 3 and 4 closed |
| 6 | Verification and legal quality | 🔒 LOCKED | Phase 5 closed |
| 7 | Document intelligence | 🔒 LOCKED | Phase 6 closed |
| 8 | Case management and personal workspace | 🔒 LOCKED | Phase 7 closed |
| — | Release R1: first release | — | Phase 8 closed, Stage 1 infrastructure, and an owner exception for hosted deployment **or** Phase 13 |
| 9 | Professional workspace | 🔒 LOCKED | Phase 8 closed |
| 10 | Enterprise and institutional systems | 🔒 LOCKED | Phase 9 closed |
| 11 | Commercial infrastructure | 🔒 LOCKED | Phase 10 closed |
| 12 | Global expansion | 🔒 LOCKED | Phase 11 closed |
| 13 | Production hardening and launch | 🔒 LOCKED | Phase 12 closed; includes the **first hosted deployment of the cumulative migration set** |

*The order of Phases 3–8 now follows the original source and v2.0 (U-25). The previous register had them as: Evidence and document foundation, Document intelligence, Legal research, AI reasoning, Verification, and Documents/contracts/drafting.*

## 7. Required workflow for every task (v2.0, U-18)

1. Read this register and the relevant master plan section before editing.
2. Confirm dependencies, acceptance criteria, branch and head.
3. Inspect existing implementation and tests before changing anything.
4. Make **small, coherent commits**, each with its tests and documentation. *(Replaces the former "no intermediate commits / single phase batch" rule, which produced corrupted migrations and long-red CI.)*
5. **Keep checks green.** In continuous autonomous mode (owner decision, 2026-11-11), each phase is committed and pushed once, after full local verification (`scripts/ci/local-checks.sh` plus the local Supabase pgTAP suite). Automatic CI then runs on the push, and a red run is fixed before the next phase proceeds.
6. Migrations:
   - Add new migrations with CLI-format timestamps.
   - Correct existing migrations only while undeployed, and hash-pin every correction.
   - **Never apply migrations to hosted Supabase before Phase 13** (U-27).
7. Regenerate database types after any schema change.
8. Use synthetic data only (Stage 0). Never commit secrets or non-public data. CI logs are public.
9. At phase closeout:
   - write the acceptance report
   - make the closeout commit
   - get a green CI run
   - tag `phase-N-closed`
   - update this register

## 8. Autonomous build instruction

Following the owner's instructions of 10 and 11 November 2026:
- Implementation continues autonomously without waiting for repeated "go next" messages.
- Phase 2 proceeds in parallel with Phase 1 verification.
- External verification, plan-dependent Auth controls and launch reviews are release gates. They do not halt functional development.
- None of this authorises production use, customer onboarding, confidential legal data, or hosted migration deployment before Phase 13.
- No task or phase is reported GREEN until its evidence requirements pass.

## 9. "Go next" instruction

When the user says **"go next"**:
1. Fix any open CI blocker (§2.3).
2. Otherwise, continue the first incomplete task in Phase 1.
3. Then continue the first incomplete task in Phase 2.

Do not start work in a locked phase. If blocked, explain the blocker and resolve the next prerequisite.
