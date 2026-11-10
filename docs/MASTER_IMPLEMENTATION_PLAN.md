# NJUMENI — MASTER IMPLEMENTATION CONTROL PLAN

Status: authoritative execution register  
Product: Njumeni — Global Legal Intelligence  
Repository: `ICOFCUCAM/njumeni`  
Execution rule: all work proceeds in the numbered order below and through Phases 0–13. A request to "go next" means execute the next incomplete checklist item in this plan. It never means invent a parallel roadmap, skip a dependency, or merely produce another proposal.

## 1. Project control and preservation rule

Njumeni is one independent legal platform. Its application must be designed to securely ingest, store, organise, process, retrieve and govern confidential legal documents, case files and evidence. Live customer data belongs in Njumeni's protected runtime data layer, not in Git history.

Do not combine Njumeni source code, build pipelines, deployment configuration or product data with the unrelated CMP project or any other product. The public marketing website lives in `ICOFCUCAM/marketing-website`. The legacy CMP work must be preserved separately and verified in its own archive before removal from this repository. The existing legal-source research projects remain upstream references/adapters and are not to be copied wholesale into Njumeni.

This document governs implementation. Supporting architecture documents explain design; they do not count as implementation.

## 2. Master 20-workstream register

These twenty workstreams are the controlled scope register. They are not twenty parallel projects: their dependencies are resolved in the phase sequence below. Each item must eventually have implemented code/configuration, tests, documentation and an acceptance record where applicable.

1. **Product definition and scope** — product promise, boundaries, target users, use cases, product requirements and non-goals.
2. **System architecture** — modular monolith first, bounded domains, deployment topology, service boundaries and evolution criteria.
3. **Eight-layer platform architecture** — presentation, application/API, identity/access, domain services, AI orchestration, knowledge/retrieval, data/storage, and infrastructure/observability layers; maintain explicit contracts between them.
4. **Domain modules A–M** — define each module's responsibility, inputs/outputs, ownership, dependencies, permissions and events before implementation. Preserve the original A–M module map as the detailed module register; do not silently rename or collapse modules.
5. **Identity and organisations** — authentication, organisations, memberships, invitations, roles, MFA, session management and tenant isolation.
6. **Matters and workspaces** — client/matter context, teams, matter membership, status, permissions and activity.
7. **Document and evidence lifecycle** — secure intake, validation, malware inspection, immutable originals, versioning, metadata, derivatives, retention, legal hold, export and deletion.
8. **Document intelligence** — OCR, layout-aware parsing, page/span anchors, extraction, chunking, embeddings and indexing.
9. **Legal knowledge system** — jurisdiction-aware legislation, case law, regulations, official guidance and approved commentary; version history, effective dates, source lineage and coverage limitations.
10. **Research and retrieval** — hybrid lexical/semantic retrieval, filters, jurisdiction resolution, ranking, reranking and research history.
11. **Evidence provenance** — exact source/version/page/span/coordinates, evidence records and reproducible links from every material assertion to its source.
12. **Legal reasoning and argument graph** — represent issues, rules, elements, facts, evidence, inferences, counterarguments, uncertainty and conclusions as explicit relationships; never present unsupported inference as fact.
13. **AI orchestration** — provider/model abstraction, model routing, BYOK where appropriate, prompt and tool versioning, policy controls, budgets, structured outputs and evaluation; avoid provider lock-in.
14. **Verification and citation integrity** — verify source existence, exact quotations, claim-to-evidence mapping, jurisdiction, temporal validity, conflicts and unsupported claims; fail visibly when verification fails.
15. **Contract review and drafting** — clause extraction, playbooks, comparison, issue detection, suggested amendments, document generation and human approval.
16. **Workflow automation** — versioned workflows, background jobs, retries, resumability, approvals, notifications and traceable state transitions.
17. **Security, privacy and governance** — tenant/matter enforcement, least privilege, encryption, secrets, audit, retention, data residency, AI data controls, backups, recovery and incident response; classification-specific hosting approval.
18. **Interfaces and integrations** — accessible web application, API contracts, search/document experiences, controlled external adapters, import/export and professional integrations.
19. **Engineering quality and operations** — repository controls, migrations, CI/CD, environments, testing, observability, performance, disaster recovery and release discipline.
20. **Commercialisation and global expansion** — packaging, pricing, customer segments, onboarding, support, jurisdiction expansion, local legal-source adapters and sustainable operating model.

## 3. Mandatory execution phases

Phases must be completed in order. A phase is not complete because folders or documents exist. Completion requires working implementation, automated tests, security checks, documentation and demonstrated end-to-end behaviour appropriate to that phase.

### Phase 0 — Foundation and repository/infrastructure audit

- [ ] 0.1 Freeze and record the master product scope and the twenty-workstream register.
- [x] 0.2 Audit the complete current repository tree, branch, commits, existing source, scripts, workflows and third-party material. Evidence: [Phase 0 audit](PHASE_0_AUDIT.md).
- [ ] 0.3 Identify and preserve useful existing Njumeni/JurisAI components; inventory before changing or replacing anything. Inventory completed; CMP archival and verification remain outstanding.
- [ ] 0.4 Resolve repository boundaries: Njumeni application, independent marketing website, separate CMP archive and isolated upstream research sources. Application/marketing separation confirmed; CMP archive remains outstanding.
- [ ] 0.5 Produce a product specification: users, priority use cases, first release, jurisdictions, requirements and non-goals.
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

**Phase 0 status: IN PROGRESS.** The repository audit and phase backlog are recorded. Existing security/content-policy CI passed on 2026-11-10. The original twenty-point headings and exact A–M module map still require reconciliation; CMP archival, product specification, architecture decisions/contracts, engineering standards, environments, complete CI, migration discipline, infrastructure inventory and application shell remain outstanding. See [Phase 0 audit](PHASE_0_AUDIT.md). The separate marketing website is already in its own repository and deployed; that does not complete the Njumeni application foundation.

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
| 0 — Foundation and audit | IN PROGRESS | Existing docs and repository security workflow; full audit and decisions still outstanding |
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
