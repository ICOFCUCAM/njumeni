# NJUMENI — MASTER IMPLEMENTATION CONTROL PLAN

Status: authoritative execution register  
Product: Njumeni — Global Legal Intelligence  
Repository: `ICOFCUCAM/njumeni`  
Execution rule: all work proceeds in the numbered order below and through Phases 0–13. A request to "go next" means execute the next incomplete checklist item in this plan. It never means invent a parallel roadmap, skip a dependency, or merely produce another proposal.

## 1. Project control and preservation rule

Njumeni is one independent legal platform. Its application must be designed to securely ingest, store, organise, process, retrieve and govern confidential legal documents, case files and evidence. Live customer data belongs in Njumeni's protected runtime data layer, not in Git history.

Do not combine Njumeni source code, build pipelines, deployment configuration or product data with the unrelated CMP project or any other product. The public marketing website lives in `ICOFCUCAM/marketing-website`. The legacy CMP work has been preserved in the separate verified archive [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive); the CMP-only files were removed from this repository only after all six original Git blob IDs matched. The existing legal-source research projects remain upstream references/adapters and are not to be copied wholesale into Njumeni.

This document governs implementation. Supporting architecture documents explain design; they do not count as implementation.

## 2. Original master outline — 20 numbered sections

These are the original twenty agreed sections, restored from the earlier project outline. Preserve these names and their sequence. Do not replace them with a newly invented workstream list.

1. **Brand/corporate identity** — Njumeni's brand, institutional positioning, naming, visual identity and corporate presentation.
2. **Product architecture** — product definition, system boundaries, product structure and overall architecture.
3. **Complete product modules** — the complete A–M module portfolio and the responsibility of each module.
4. **Complete AI architecture** — AI capabilities, agent architecture, model/provider strategy, orchestration, tools, evaluation and controls.
5. **Technical architecture/stack** — application architecture, technology choices, service boundaries, contracts and engineering patterns.
6. **Legal knowledge infrastructure** — jurisdictions, legislation, case law, regulations, official sources, source versions and update pipelines.
7. **Security/privacy/governance** — identity, tenant isolation, access control, confidentiality, audit, retention, data governance and classification requirements.
8. **Open-source research/software reuse** — upstream research, technical evaluation, licence assessment and controlled component reuse.
9. **API/integration framework** — internal/external APIs, legal-source adapters, provider integrations and interoperability.
10. **Infrastructure/hosting/deployment** — environments, hosting, database, storage, queues, domains, CI/CD, secrets and operations.
11. **User journeys/operational workflows** — user journeys, professional workflows, approvals, collaboration and end-to-end task flows.
12. **Administration/platform operations** — platform administration, organisation controls, support, monitoring and operational management.
13. **Commercial architecture/monetisation** — plans, packaging, entitlements, usage, billing, pricing and commercial model.
14. **Testing/evaluation/QA** — automated tests, legal answer evaluation, security testing, quality gates and regression controls.
15. **Repository/development structure** — repository boundaries, code organisation, standards, branching, migrations and developer experience.
16. **Complete implementation roadmap** — dependency-aware phases, numbered tasks, milestones and release sequencing.
17. **Definition of completion** — acceptance criteria, quality requirements and evidence required before marking work complete.
18. **Initial strategic priorities** — first-release scope, priority capabilities and sequencing rationale.
19. **Permanent architectural decisions** — decisions that must remain stable unless formally reviewed and changed.
20. **Immediate execution/foundation** — the initial audit, environment, engineering foundation and first executable tasks.

### Original complete product modules A–M

These module names are canonical. Keep their names and identity intact in architecture, code, navigation, documentation and implementation mapping. A module may be delivered across several phases, but must not be silently merged into another module or renamed.

| ID | Canonical module | Responsibility |
|---|---|---|
| A | **Njumeni Legal Intelligence** | The central legal intelligence platform and unified experience |
| B | **Legal Research Engine** | Legal research, source discovery, retrieval and research workflows |
| C | **Evidence Intelligence Engine** | Evidence ingestion, analysis, provenance, organisation and evidential relationships |
| D | **Legal Case Management** | Matters, cases, clients, teams, timelines, tasks and case workflows |
| E | **Legal Document Intelligence** | Secure legal document handling, OCR, extraction, understanding and versioning |
| F | **Legal Argument and Reasoning Engine** | Issues, rules, facts, arguments, counterarguments, inference and reasoning structures |
| G | **Jurisdiction and Legal Systems Engine** | Jurisdiction selection, legal systems, applicable law and jurisdiction-specific rules |
| H | **Personal Legal Assistant** | Individual legal assistance and personal legal workflows |
| I | **Professional Legal Workspace** | Tools and workspace for individual legal professionals |
| J | **Enterprise and Law Firm Workspace** | Firm, enterprise, team and multi-user legal operations |
| K | **Institutional Workspace** | Institutional and public-sector legal operations and governance |
| L | **Legal Compliance and Risk Intelligence** | Compliance, obligations, risk identification and monitoring |
| M | **Legal Knowledge Management** | Knowledge libraries, institutional knowledge, precedents and managed legal knowledge |

The detailed module contracts must specify each module's purpose, users, capabilities, inputs, outputs, data ownership, APIs/events, permissions, dependencies, AI responsibilities, security controls, tests and acceptance criteria.

## 3. Mandatory execution phases

Phases must be completed in order. A phase is not complete because folders or documents exist. Completion requires working implementation, automated tests, security checks, documentation and demonstrated end-to-end behaviour appropriate to that phase.

### Phase 0 — Foundation and repository/infrastructure audit

- [x] 0.1 Restore and freeze the original twenty numbered outline sections and canonical A–M modules. Evidence: [Master outline and modules](MASTER_IMPLEMENTATION_PLAN.md#2-original-master-outline--20-numbered-sections); commit `0c2b9d5`.
- [x] 0.2 Audit the complete current repository tree, branch, commits, existing source, scripts, workflows and third-party material. Evidence: [Phase 0 audit](PHASE_0_AUDIT.md).
- [x] 0.3 Identify and preserve useful existing Njumeni/JurisAI components; inventory before changing or replacing anything. CMP archive verified against all six original Git blob IDs before CMP-only files were removed; see [Phase 0 audit](PHASE_0_AUDIT.md).
- [x] 0.4 Resolve repository boundaries: Njumeni application, independent marketing website, separate CMP archive and isolated upstream research sources. Canonical map and separation rules are in [Product Boundaries](PRODUCT_BOUNDARIES.md).
- [x] 0.5 Produce a product specification: users, priority use cases, first release, jurisdictions, requirements and non-goals. See [Njumeni Product Specification](PRODUCT_SPECIFICATION.md); unresolved strategic choices are recorded as explicit release gates.
- [ ] 0.6 Confirm modular-monolith architecture and document bounded contexts, dependency rules and eight platform layers.
- [ ] 0.7 Recover and record the original A–M module map; map every module to workstreams, layers, dependencies and phase.
- [ ] 0.8 Establish coding standards, naming, formatting, linting, type-checking, error handling, logging and review conventions.
- [ ] 0.9 Establish environment strategy: local development, test/CI, staging and production; document required services and configuration.
- [ ] 0.10 Establish CI checks for formatting, lint, type checks, tests, security scanning, secret detection and repository content policy. Security/content-policy workflow exists and passed; quality/build/test checks remain outstanding.
- [ ] 0.11 Establish database migration discipline: ordered immutable migrations, local reset/replay, hosted-history reconciliation, drift detection, backup and rollback/forward-fix policy.
- [ ] 0.12 Define application shell and navigation architecture without prematurely building unfinished feature modules.
- [ ] 0.13 Audit hosting, domains, deployment targets, secrets, storage, queues, database and external providers; record verified facts versus unknowns. GitHub/repository audit recorded; runtime infrastructure inventory remains outstanding.
- [x] 0.14 Create the phase-by-phase implementation backlog with dependencies, acceptance criteria and evidence of completion. See this plan and [Phase 0 audit](PHASE_0_AUDIT.md).
- [ ] 0.15 Run repository hygiene checks and document unresolved risks. GitHub Actions repository-security workflow passed on 2026-11-10; broader hygiene review remains outstanding.
- [ ] 0.16 Phase 0 acceptance review: no unresolved product/repository boundary ambiguity, no destructive changes to unreviewed components, reproducible development setup, CI and migration policy defined, architecture mapped to all twenty workstreams and A–M modules.

**Live status is maintained in the [Phase Register](PHASE_REGISTER.md). Phase 0 status: IN PROGRESS.** The repository audit, verified CMP archive, canonical repository boundaries and product specification are recorded. The original twenty-point headings and canonical A–M module names are preserved. Detailed module contracts and architecture mapping, architecture decisions, engineering standards, environments, complete CI, migration discipline, infrastructure inventory and application shell remain outstanding. See [Phase 0 audit](PHASE_0_AUDIT.md) and [Product Specification](PRODUCT_SPECIFICATION.md). The separate marketing website is in its own repository; that does not complete the Njumeni application foundation.

### Phase 1 — Identity, tenancy and security foundation
Organisations, users, memberships, invitations, roles/permissions, MFA/session controls, tenant/matter policies, audit primitives and adversarial isolation tests.

### Phase 2 — Legal knowledge foundation
Jurisdiction registry, source registry, source adapters, versioned legal texts, effective dates, update/synchronisation pipeline, provenance and coverage reporting.

### Phase 3 — Evidence and document foundation
Secure upload, file validation, malware scanning, immutable originals, version records, metadata, access control, page rendering, retention and audit.

### Phase 4 — Document intelligence
OCR, layout-aware extraction, page/span anchors, chunking, embeddings, indexing, processing queues, retries and human correction.

### Phase 5 — Legal research
Jurisdiction-aware search, hybrid retrieval, ranking, research sessions, evidence selection, source-grounded answers and claim-level citations.

### Phase 6 — AI reasoning and argument graph
Provider-independent orchestration, structured legal reasoning, issues/rules/facts/evidence relationships, argument and counterargument graphs, uncertainty and explanation.

### Phase 7 — Verification and quality control
Citation existence, quotation matching, claim-evidence coverage, source/version validity, contradiction detection, evaluation datasets, regression tests and safe failure.

### Phase 8 — Documents, contracts and drafting
Document comparison, clause extraction, review playbooks, issue detection, suggested edits, drafting and approval workflows with version history.

### Phase 9 — Personal and case workspace
Matter workspace, research history, evidence bundles, notes, tasks, collaboration, permissions, activity timeline and export.

### Phase 10 — Professional and institutional edition
Advanced role models, organisation administration, templates, reporting, policy controls, integrations, support operations and institutional deployment requirements.

### Phase 11 — Commercial platform
Plans, entitlements, billing, usage metering, subscriptions, onboarding, customer administration, support and commercial analytics.

### Phase 12 — Global and multi-jurisdiction expansion
Jurisdiction packs, local source adapters, language/localisation, legal-source licensing, regional hosting and country-specific compliance.

### Phase 13 — Production hardening and launch
Threat modelling, penetration testing, performance/load testing, backup restore drills, disaster recovery, monitoring/alerting, incident response, release approvals, operational runbooks and controlled launch.

## 4. Definition of done for every feature

A feature is not marked complete until all relevant items are satisfied:

- [ ] Database schema and forward migration are implemented and replayable.
- [ ] API/service contract and validation are implemented.
- [ ] UI or operator interface is implemented where required.
- [ ] Authentication, organisation and matter permissions are enforced server-side and at the database boundary.
- [ ] Tenant-isolation and negative-authorisation tests pass.
- [ ] Input validation, error handling, idempotency and retry behaviour are addressed.
- [ ] Audit events and observability are implemented.
- [ ] Unit, integration and end-to-end tests pass.
- [ ] Documentation and operational instructions are updated.
- [ ] Deployment and rollback/forward-fix procedure is verified.
- [ ] The user-visible workflow has been exercised end to end.

## 5. Execution ledger

| Phase | Status | Evidence / blocking items |
|---|---|---|
| 0 — Foundation and audit | IN PROGRESS | Repository audit, verified CMP archive, product boundaries and product specification recorded; architecture, module contracts, engineering and infrastructure foundation still outstanding |
| 1 — Identity and tenancy | NOT STARTED | Depends on Phase 0 acceptance |
| 2 — Legal knowledge | NOT STARTED | Depends on Phase 0 and source governance |
| 3 — Evidence/documents | NOT STARTED | Depends on tenant security model |
| 4 — Document intelligence | NOT STARTED | Depends on evidence/document foundation |
| 5 — Legal research | NOT STARTED | Depends on knowledge and document indexing |
| 6 — AI reasoning | NOT STARTED | Depends on retrieval and provenance |
| 7 — Verification | NOT STARTED | Depends on evidence and reasoning outputs |
| 8 — Contracts/drafting | NOT STARTED | Depends on documents, research and verification |
| 9 — Case workspace | NOT STARTED | Depends on identity, matters and core workflows |
| 10 — Professional/institutional | NOT STARTED | Depends on stable core product |
| 11 — Commercial | NOT STARTED | Depends on product entitlements and usage model |
| 12 — Global expansion | NOT STARTED | Depends on jurisdiction/source governance |
| 13 — Production launch | NOT STARTED | Depends on all required release gates |

## 6. Phase-lock and commit-gated execution rules

The live task-by-task status, green indicators, commit evidence and phase locks are maintained in [PHASE_REGISTER.md](PHASE_REGISTER.md). The register is authoritative for current execution state. The rules below govern it.

1. **Only one phase is open at a time.** The active phase is the only phase in which work may be executed. All later phases remain LOCKED.
2. **Open the phase register first.** Before coding, identify the active phase, its final numbered task, task dependencies, acceptance tests and current Git branch/head.
3. **Execute in strict task order.** Work on the first incomplete task in the active phase. Do not jump to a later task merely because it is easier or more interesting. If blocked, resolve the blocker within the same phase.
4. **Green means verified and committed.** A task turns green only after its implementation/deliverable is complete, relevant tests and checks pass, documentation is updated, and its changes are committed to Git. For a documentation-only task, review and validation appropriate to the document are required before its commit.
5. **No speculative green.** A proposal, scaffold, placeholder, empty folder, generated plan, partial code or unverified claim is not complete. Use BLOCKED, IN PROGRESS or NOT STARTED until acceptance evidence exists.
6. **Record commit evidence.** Every green task must have a commit SHA and a concise test/acceptance record in the phase register. If a task spans multiple commits, record all relevant SHAs.
7. **Complete the final numbered task.** Do not close a phase while any numbered task, test, review, security check, documentation item or acceptance criterion remains incomplete.
8. **Run phase-wide acceptance.** After the final task, run the complete phase test suite, relevant security checks, migration checks, build checks and end-to-end acceptance tests. Record the actual results.
9. **Create a phase completion commit.** After all phase tasks and phase-wide checks pass, create a dedicated phase-closeout commit containing the completed register, acceptance report and any final integration changes.
10. **Unlock the next phase only after closeout.** The phase is marked COMPLETE/GREEN only when the phase-closeout commit exists and is verified. Only then may the next phase become OPEN.
11. **A failed check revokes green.** If later changes break a completed task or phase acceptance, mark the affected task/phase REGRESSION and resolve it before proceeding.
12. **Every "go next" follows the register.** Resume the first incomplete task in the one open phase. Never start the next phase until the active phase has been fully completed and its closeout commit verified.
13. **Preserve the original outline.** The twenty original sections and canonical A–M module names above are binding. Any proposed change requires a documented decision; never silently replace or omit them.

## 6. Change-control rules

1. Never skip a phase or implement a downstream feature before its dependencies are accepted.
2. Never mark a document, directory, scaffold or proposal as a completed feature.
3. Before each task, inspect the current repository and existing implementation; do not assume prior state.
4. Update this execution ledger after each verified milestone.
5. Every "go next" resumes the first incomplete item in the active phase, not the next idea.
6. If an item is blocked, state the blocker and work on the next prerequisite within the same phase.
7. Do not delete or overwrite existing components without inventory, evidence of preservation and an explicit migration plan.
8. Do not mix CMP or other unrelated product code into Njumeni.
9. Never put live customer documents, evidence, secrets or production records in Git.
10. Do not claim classified-data readiness without the relevant hosting and service-provider authorisations.
