# NJUMENI — LIVE PHASE EXECUTION REGISTER

**This is the operational register.** The [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md) defines the scope and architecture; this register controls the actual work and phase locks.

- Repository: `ICOFCUCAM/njumeni`
- Active phase: **Phase 0 — Foundation and repository/infrastructure audit**
- Phase state: **🟡 OPEN — IN PROGRESS**
- Next task: **0.10 — Implement complete CI checks for formatting, lint, type, tests, build, security, secrets and repository policy**
- Phase completion commit: **NOT CREATED**
- Rule: no Phase 1 work may begin until Phase 0 is fully green and its phase-closeout commit is verified.

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
| 0.1 | Restore and freeze the original 20 numbered outline sections and canonical A–M modules | 🟢 GREEN | Restored in [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md); commit `0c2b9d5` |
| 0.2 | Audit complete repository tree, branch, commits, scripts, workflows and upstream material | 🟢 GREEN | [Phase 0 audit](PHASE_0_AUDIT.md); audit commit `a3b5d32`; repository security workflow passed |
| 0.3 | Inventory and preserve existing Njumeni/JurisAI components; archive legacy CMP separately and verify preservation before removal | 🟢 GREEN | Six original files archived in [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive); all six archive blob SHAs match source commit `0d9c90f`. Recursive archive tree verified. Archive verification commit `a2820521ce3459af3feb6c8a28d83aa28c2291f6`. CMP-only files removed from Njumeni in commits `4643a0e`, `06fda6a`, `6f6e804`, `158a09d`, `f5d842b`. |
| 0.4 | Finalise repository boundaries: Njumeni app, marketing website, CMP archive and isolated upstream research | 🟢 GREEN | Canonical repository map and project-separation rules in `docs/PRODUCT_BOUNDARIES.md`; README and Phase 0 audit aligned. Commits `42177a8`, `5988fb2`, `cbdb919`; repository-security workflow passed on task commit `c54a2b2` (run `42737825274`). |
| 0.5 | Produce complete product specification: users, priority journeys, launch scope, jurisdiction, requirements and non-goals | 🟢 GREEN | [Product Specification](PRODUCT_SPECIFICATION.md) committed at `67f3a9a`. Defines four target segments, seven priority journeys, Norway/EU/UK/US/international law/Cameroon priority coverage, P0/P1 first-release scope, functional and trust requirements, A–M positioning, non-goals, acceptance criteria and explicit open decision gates. Reviewed against the master plan and architecture proposal; 15-section structural/content validation passed. Supporting updates: master plan `f6f14ca`, audit `83af95c`, README `195f898`. |
| 0.6 | Approve modular-monolith architecture, bounded contexts, eight platform layers and dependency rules | 🟢 GREEN | [ADR-0001](architecture/ADR-0001-modular-monolith-and-bounded-contexts.md) records all eight original layers verbatim, with purpose, exclusions, interfaces, dependencies, security responsibilities, acyclic interaction model and high-level mapping to all twenty original sections. The canonical list is restored in [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md). Original source supplied 2026-11-10. Verified commits: ADR `850f9570abe915d461c13f28e04d169826410065`, final ADR acceptance/mapping `f7a5befaf9c4b281821ecd2fad4d1cc344fb9b65`; master plan `bd02fd727ed8b35f2be873192bc823fb67114b68`. Repository-security workflows passed for the ADR, master-plan and register commits (runs `42739489916`, `42739509636`, `42739524009`) and final ADR acceptance/mapping commit `f7a5bef` (run `42739570155`). Detailed A–M mapping remains task 0.7. |
| 0.7 | Map A–M modules to layers, workstreams, ownership, dependencies, APIs/events, permissions and phase delivery | 🟢 GREEN | [A–M Module Layer Map](architecture/MODULE_LAYER_MAP.md) and [A–M Capability Traceability](architecture/MODULE_REQUIREMENTS_TRACEABILITY.md) preserve all thirteen canonical module names and original module capabilities, and map each to layers, bounded-context ownership, inputs/outputs, contracts/events, permission boundaries, cross-module dependencies and Phase 0–13 delivery. Commits: map `dd9711df15a76e9c3d7ad29aaf8139b3d002b083`; traceability `9c1fb2c272970f4a14c371865c60d38c58ca048e`; cross-link `fb3b468be5a5dcb14d3b26af578ff2d0a6c5b433`; README `47872f85e4fde51cf5a3d4a48c5e57b235940c79`. Manual structural review confirmed all A–M names and traceability sections; repository-security workflows passed (runs `42739682487`, `42739776901`, `42739793181`, `42739838357`). |
| 0.8 | Establish coding, naming, formatting, lint, type, error, logging and review standards | 🟢 GREEN | [Engineering Standards](ENGINEERING_STANDARDS.md) `83db8b6e6d6700e4b3e53672ebd20496eab43b80`; [Contributing Guide](../CONTRIBUTING.md) `031e6c83ff26addb92dfecb7ed146dcc18646318`; `.editorconfig` `e3cdffceb1fcb44853826754d5178bba8dc67dd9`; `.prettierrc.json` `9d8c55108304cf120d3fed573b51185faf615a19`; `.prettierignore` `bea7cf9160b2555e2e703351a94575731b8e5093`; README link `078c024d58dc0cbdcef6902c399281681117b84a`. Standards define TypeScript strictness, naming, formatting, validation, error handling, logging/audit, privacy, tests, reviews, commits and future enforcement. Formatter JSON was parsed and settings reviewed; no package manifest exists yet, so executable ESLint/type-check/test scripts are intentionally assigned to task 0.10 after environment/toolchain setup. Repository-security workflows passed for all deliverable commits, including final register commit run `42740075241`. |
| 0.9 | Establish reproducible local, test/CI, staging and production environment strategy | 🟢 GREEN | [Environment Strategy](ENVIRONMENT_STRATEGY.md) `c7ac3b4f76a78decd6aaa9336cb184be9f7921d3`; placeholder-only `.env.example` `7a06c68db0b5e07674488fc4564f53f3cf3bf217`; README link `c906c249bd4d9c3484f6f7d6b5f5d8710b365afa`. Defines local/test/staging/production separation, service topology, secrets, data controls, build/release promotion, backup/restore and unresolved provider decisions. Placeholder config was reviewed and .gitignore explicitly permits only `.env.example`; no real secrets were added. Repository-security workflows passed for all task commits, including register run `42740233124`. Verified risk retained: GitHub metadata reports the application repository is PUBLIC, conflicting with the original plan's private-repository requirement; resolution is tracked for Phase 0 security/hosting review. Provider IDs/regions/domains and actual runtime provisioning are deliberately not claimed. |
| 0.10 | Complete CI for format, lint, type-check, tests, build, security, secrets and repository policy | ⚪ NOT STARTED | Existing security workflow is a baseline; expand it when this numbered task becomes active |
| 0.11 | Define migration discipline: immutable ordered migrations, local replay/reset, hosted history reconciliation, drift, backup and forward-fix | ⚪ NOT STARTED | Migration policy and verified database inventory required |
| 0.12 | Define legal application shell, navigation, route boundaries and module entry points | ⚪ NOT STARTED | Architecture specification and acceptance review required |
| 0.13 | Audit hosting, domains, deployment, secrets, DB, storage, queues and external providers | ⚪ NOT STARTED | Repository facts are recorded; complete the runtime infrastructure inventory when this numbered task becomes active |
| 0.14 | Create dependency-aware Phase 0–13 backlog and acceptance criteria | 🟢 GREEN | [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md); initial commit `b057558`, updated register commit `0c2b9d5` |
| 0.15 | Run full repository hygiene checks and document unresolved risks | ⚪ NOT STARTED | Existing security check is a baseline; complete the full hygiene review when this numbered task becomes active |
| 0.16 | Conduct Phase 0 acceptance review and prepare closeout commit | 🔒 LOCKED | Opens only after 0.1–0.15 are all green |


**Task 0.6 closeout note (2026-11-10):** The original Njumeni master architecture was supplied and the eight canonical platform layers were recovered without renaming: Experience; API; Workflow orchestration; Evidence; Legal knowledge; Reasoning; Verification; Infrastructure. Their original responsibilities are preserved in the [Master Implementation Plan](MASTER_IMPLEMENTATION_PLAN.md) and expanded into layer contracts, exclusions, interfaces, dependency rules, security responsibilities, an acyclic interaction model and a high-level mapping to all twenty original sections in [ADR-0001](architecture/ADR-0001-modular-monolith-and-bounded-contexts.md). Task 0.6 is GREEN. Detailed A–M mapping is task 0.7.

### Phase 0 verified commits

| Deliverable | Commit |
|---|---|
| Phase 0 repository audit | `a3b5d32c602f96baf9ac3daaf51f49633e9e2e3e` |
| Original 20-point outline and A–M register restored; phase-lock rules added | `0c2b9d5c970a8de8670cc5823374dd246aa7483b` |
| Master phase backlog initial commit | `b05755824b97f7f937cb4679f73cdadf4e45e471` |

The security workflow passed for commits `a3b5d32`, `0c2b9d5`, `9427e26` and `c046790`. Workflow runs for the latest audit/README/master-plan corrections are still running or queued and must be checked before their commits are treated as CI-verified.

## 3. Phase lock register

Only Phase 0 is open. All future phases remain locked until the active phase has a complete set of green tasks, successful phase-wide checks, an acceptance report and a verified closeout commit.

| Phase | Name | Register state | Unlock condition |
|---|---|---|---|
| 0 | Foundation and repository/infrastructure audit | 🟡 OPEN | All 0.1–0.16 green + Phase 0 closeout commit |
| 1 | Identity, tenancy and security foundation | 🔒 LOCKED | Phase 0 closeout verified |
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

## 5. "Go next" instruction

When the user says **"go next"**, continue the first incomplete task in the one active phase shown above. Do not ask the user to select a task already determined by this register. Do not start work in a locked phase. If blocked, explain the blocker and resolve the next prerequisite within the same phase.
