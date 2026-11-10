# Phase 0 — Repository and infrastructure audit

Audit date: 2026-11-10  
Repository: `ICOFCUCAM/njumeni`  
Audited branch: `claude/wonderful-franklin-lt09d7`  
Audited head at time of inspection: `ad8e87f748321958c8716be989af8794f1798999`

## Executive finding

The repository is currently a documentation, research and repository-guardrail foundation. It is **not yet an implemented legal application**. No production-ready legal application runtime, identity system, tenant model, database schema, migration set, API, document service, AI orchestration or end-to-end workflow was found in the audited tree.

The master implementation plan is now recorded in `docs/MASTER_IMPLEMENTATION_PLAN.md`. Phase 0 remains IN PROGRESS; downstream phases must not start until Phase 0 acceptance criteria are met.

## Repository inventory

The audited tracked tree contains:

| Path | Finding | Treatment |
|---|---|---|
| `.github/workflows/repository-security.yml` | Repository-content policy and Gitleaks workflow | Preserve; expand later as Phase 0 CI design is completed |
| `.gitignore` | Secret and runtime/customer-data exclusions | Preserve and review as new runtime paths are designed |
| `README.md` | Updated to identify Njumeni legal platform and binding plan | Preserve |
| `SECURITY.md` | Application-data security and source-control policy | Preserve |
| `THIRD_PARTY_NOTICES.md` | Third-party notices | Preserve and update after every approved reuse |
| `docs/ARCHITECTURE.md` | Legacy CMP site architecture/design document | Archived and removed after exact blob verification; see [CMP archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive) |
| `docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md` | Proposed legal platform architecture and source assessments | Preserve; proposal is not implementation |
| `docs/MASTER_IMPLEMENTATION_PLAN.md` | Twenty workstreams and Phases 0–13 execution register | New binding execution control |
| `docs/PRODUCT_BOUNDARIES.md` | Confirmed project and data boundaries | Preserve |
| `scripts/bootstrap-legal-sources.sh` | Bootstrap script for upstream research sources | Preserve; inspect exact pins/licences before running |
| `scripts/security/check-repository-content.sh` | Tracked runtime/customer-data path guard | Preserve; test in CI |
| `site/` | Legacy CMP static website files | Archived and removed after exact blob verification; see [CMP archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive) |
| `third-party/legal-open-source/README.md` | Upstream legal-project source register | Preserve as research register, not imported product code |

The original CMP site consisted of `site/index.html`, `site/css/main.css`, `site/css/tokens.css` and `site/js/main.js`, alongside the CMP-specific README and `docs/ARCHITECTURE.md` from source commit `0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f`. On 2026-11-10, all six original files were transferred to `ICOFCUCAM/njumeni-cmp-archive`. Each archived Git blob SHA was compared with the original source blob SHA and all six matched exactly. The archive tree was inspected; it contains the six preserved files and an archive manifest. Only after that verification were the CMP-only `docs/ARCHITECTURE.md` and five `site/` files removed from Njumeni. The current Njumeni README remains the legal-platform README.

## Product and repository boundary decisions

1. `ICOFCUCAM/njumeni` remains the Njumeni legal-platform application repository.
2. `ICOFCUCAM/marketing-website` is the independent public marketing website repository and has been deployed separately.
3. CMP is unrelated software and must be preserved in a separate archive repository.
4. The legal application is intended to securely store and manage confidential documents, case files and evidence in protected runtime storage.
5. Customer documents, production records, secrets and live evidence must not be committed to Git.
6. Upstream projects are research references or candidate isolated adapters; no wholesale application import is authorised by the current architecture proposal.

## GitHub repository controls observed

- Repository visibility: public.
- Default branch: `claude/wonderful-franklin-lt09d7`.
- Branch protection observed on the audited branch: disabled.
- A GitHub Actions workflow exists and runs on pushes and pull requests.
- The workflow currently runs a tracked-content path check and Gitleaks. It does not yet run formatting, lint, type-check, unit/integration/e2e tests, dependency review, build checks or migration validation.
- The latest repository-security workflow run triggered by the README/master-plan update was still `in_progress` at the time of the audit. Do not mark it as passed until GitHub reports a completed successful conclusion.

## Missing implementation foundation

No tracked files were found for:
- application package/workspace manifests or lockfiles;
- frontend application shell or authenticated routes;
- backend/API service;
- database schema or migration files;
- identity/authentication or organisation/tenant policies;
- object storage integration or document upload pipeline;
- background job queue/worker;
- AI provider adapters or prompt registry;
- legal-source ingestion/synchronisation runtime;
- automated unit, integration or end-to-end test suites;
- local/staging/production environment templates or deployment manifests;
- operational runbooks, backup/restore procedures or observability configuration.

This is an inventory finding, not a recommendation to select a new stack immediately. The Phase 0 product and architecture decisions must first record the intended stack and service boundaries based on the original master outline and verified infrastructure.

## Phase 0 checklist disposition

| Item | Status | Evidence / next action |
|---|---|---|
| 0.1 Master scope and 20-workstream register | PARTIAL | Execution plan committed. The original 20-point headings and canonical A–M names have since been restored in the Master Implementation Plan; detailed contracts and phase mapping remain in task 0.7. |
| 0.2 Full repository/branch/tree audit | COMPLETE | Current tree, branch head, workflow, existing files and repository metadata inspected. Re-audit before destructive changes. |
| 0.3 Preserve existing components | COMPLETE | CMP source preserved in `ICOFCUCAM/njumeni-cmp-archive`; six of six original Git blob SHAs match. CMP-only source files removed from Njumeni only after verification. No legal app runtime was found to preserve. |
| 0.4 Repository boundaries | PARTIAL | Legal app and marketing-site separation confirmed. CMP archive still outstanding. |
| 0.5 Product specification | NOT STARTED | Define users, launch use cases, jurisdictions, requirements, non-goals and release scope. |
| 0.6 Modular-monolith and eight-layer architecture | PARTIAL | Proposed domain/topology document exists. Formal architecture decision, layer contracts and dependency rules still required. |
| 0.7 Original A–M module map | IN PROGRESS | Canonical A–M names restored in the Master Implementation Plan; map each module to layers, ownership, dependencies, APIs/events, permissions, tests and phase delivery. |
| 0.8 Engineering standards | NOT STARTED | Decide and document after stack and repo strategy are confirmed. |
| 0.9 Local/test/staging/production environments | NOT STARTED | No application runtime or environment specification found. |
| 0.10 CI pipeline | PARTIAL | Security workflow exists; full quality/build/test/migration pipeline remains to be implemented. |
| 0.11 Database migration discipline | NOT STARTED | No Njumeni migrations or database project found in this tree. Design policy before schema implementation. |
| 0.12 Application shell | NOT STARTED | No legal application UI or shell found. |
| 0.13 Infrastructure/provider audit | PARTIAL | Repository and GitHub controls audited. Hosting, DB, storage, queue, domains and secret ownership still need a verified inventory. |
| 0.14 Phase-by-phase backlog | COMPLETE | Master plan includes phases, dependencies, definition of done and ledger. Refine each item into implementation tasks after original outline reconciliation. |
| 0.15 Repository hygiene checks | PARTIAL | Ignore rules and CI checks exist; CI run and tracked-content script execution must be verified. |
| 0.16 Phase 0 acceptance review | NOT READY | Multiple required items are incomplete or blocked. |

## Risks and controls

- **Public source visibility:** the repository is public. Do not add secrets, customer data, proprietary third-party code or sensitive operational configuration. The owner should make a deliberate visibility decision before proprietary implementation begins.
- **Unprotected branch:** branch protection was observed as disabled. Define required checks and branch rules as part of Phase 0 release discipline.
- **Legacy CMP co-location:** CMP files remain in the repository. Archive and verify before removal; do not intermingle future application source with the CMP site.
- **Architecture drift:** the 20-workstream register is an operational mapping from the recovered outline summary. Exact original headings and the A–M module map must be restored from the original outline rather than guessed.
- **False completion:** architecture documents and repository guardrails do not constitute a working application.

## Immediate next execution items

1. CMP archival is complete and verified; preserve the separate archive as the canonical legacy source.
2. Complete the product specification and first-release scope.
3. Record the modular-monolith architecture decision and eight-layer contracts.
4. Map all A–M modules to the architecture, dependencies, contracts and delivery phases.
5. Complete the hosting/database/storage/queue/domain/provider inventory.
6. Define engineering standards, environments, complete CI and migration discipline.
7. Specify the minimal legal application shell only after the preceding architecture and repository gates are accepted.
