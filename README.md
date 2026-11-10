# Njumeni — Global Legal Intelligence

Njumeni is an independent legal technology platform under active architecture and implementation. Its intended capabilities include jurisdiction-aware legal research, secure document and evidence management, document intelligence, contract workflows, legal reasoning and institutional governance.

**Implementation status:** the repository contains the complete original twenty-section product plan, architecture and security controls, a tested Next.js web foundation shell and route entry points for all thirteen A–M modules. Authentication, tenancy, database/RLS, private storage, AI providers, API/worker services and operational legal workflows are not connected yet.

## Canonical repositories and product boundaries

- **Njumeni application:** this repository, `ICOFCUCAM/njumeni`.
- **Public marketing website:** [ICOFCUCAM/marketing-website](https://github.com/ICOFCUCAM/marketing-website). It is an independent public-facing repository and contains no legal application data or authenticated matter workflows. Its separate implementation and deployment lifecycle must remain decoupled from the legal application.
- **Legacy CMP archive:** [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive). The six original CMP files were transferred and verified against their source Git blob IDs before the CMP-only files were removed from this repository.
- **Upstream legal projects:** remain independent research sources or candidates for isolated adapters. Do not vendor entire projects or import code without technical, security and licence approval.

Njumeni is intended to securely handle confidential legal documents, case files and evidence through protected application storage. Live customer data must never be committed to Git or stored in build artefacts, issue trackers or CI logs. Officially classified material requires hosting and service providers authorised for the applicable classification.

## Binding implementation plan and live phase register

The [Master Implementation Plan](docs/MASTER_IMPLEMENTATION_PLAN.md) preserves the original twenty numbered sections and canonical A–M modules, and defines Phases 0–13. The [Live Phase Register](docs/PHASE_REGISTER.md) is the operational source of truth for the active phase, numbered tasks, green completion indicators, commit SHAs and phase locks. The [Phase 0 Audit](docs/PHASE_0_AUDIT.md) records repository findings, and the [Product Specification](docs/PRODUCT_SPECIFICATION.md) defines target users, priority journeys, initial jurisdiction priorities, first-release scope, requirements and non-goals.

**Execution rule:** only one phase is open at a time. Every "go next" resumes the first incomplete task in that phase. A task turns green only after its acceptance checks pass and its commit is verified. The entire phase—including the final numbered task, phase-wide checks, acceptance report and dedicated closeout commit—must be complete before the next phase is unlocked. A proposal, folder, scaffold or unverified code does not count as completion.

## Architecture and security

- [Engineering Standards](docs/ENGINEERING_STANDARDS.md) — coding, naming, formatting, validation, errors, logging, security and review conventions.
- [Contributing Guide](CONTRIBUTING.md) — task discipline, change requirements and pull-request review.
- [ADR-0001 — Modular monolith and bounded contexts](docs/architecture/ADR-0001-modular-monolith-and-bounded-contexts.md) — approved architecture decision, canonical eight layers, dependency rules and security boundaries.
- [A–M Module Layer Map](docs/architecture/MODULE_LAYER_MAP.md) — module ownership, layer assignment, contracts, dependencies, permissions and phase delivery.
- [A–M Capability Traceability](docs/architecture/MODULE_REQUIREMENTS_TRACEABILITY.md) — original module capabilities mapped to their implementation layers.
- [Legal AI Platform Architecture](docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md) — bounded domains, topology, retrieval, evidence provenance, source assessments and licensing.
- [Product Boundaries](docs/PRODUCT_BOUNDARIES.md) — canonical product and repository separation.
- [Security Policy](SECURITY.md) — application-data protection and source-control hygiene.
- [Third-Party Notices](THIRD_PARTY_NOTICES.md) — legal-source project notices and licensing notes.

## Current engineering controls

The repository includes a GitHub Actions [CI pipeline](docs/CI_PIPELINE.md) for formatting, lint, strict TypeScript baseline, foundation tests, architecture integrity, repository content policy and Gitleaks secret scanning. The application build and application-level test gates activate as the app shell and workspace are introduced; database/RLS/legal-intelligence tests are added in their dependent phases. These controls do not yet constitute a production application pipeline.

## Local development

- [Environment Strategy](docs/ENVIRONMENT_STRATEGY.md) — separation of local, test/CI, staging and production, service topology, secret boundaries and deployment promotion.
- [Database Migration Policy](docs/DATABASE_MIGRATION_POLICY.md) — immutable migrations, local replay, hosted history reconciliation, drift, backup and forward-fix controls.
- [CI Pipeline](docs/CI_PIPELINE.md) — formatting, lint, type, tests, security, repository policy and migration checks.
- [Infrastructure Audit](docs/INFRASTRUCTURE_AUDIT.md) — verified hosting, database, domain, storage, queue and provider state.
- [Application Shell](docs/APP_SHELL.md) — route boundaries, A–M module entry points and current preview limitations.
- [.env.example](.env.example) — placeholder-only configuration template; it contains no real credentials.

The full application development setup is not yet established. Follow the Master Implementation Plan's Phase 0 checklist before treating this repository as a runnable legal application. Do not infer a stack or start services that have not been verified and recorded in the architecture decision.

## Legal-technology research sources

Selected upstream projects are tracked as engineering research. See [the source register](third-party/legal-open-source/README.md). Run `bash scripts/bootstrap-legal-sources.sh` only when the local environment is ready and the pinned source/licence review is understood.

Public availability is not a licence. Re-check exact upstream commits, dependencies, bundled templates, datasets, model licences and API terms before any reuse.
