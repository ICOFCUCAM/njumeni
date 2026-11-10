# Njumeni — Global Legal Intelligence

Njumeni is an independent legal technology platform under active architecture and implementation. Its intended capabilities include jurisdiction-aware legal research, secure document and evidence management, document intelligence, contract workflows, legal reasoning and institutional governance.

**Implementation status:** the repository currently contains architecture, product-boundary and security documentation, repository controls and legal-technology source assessments. These documents are not evidence that the legal application features are already implemented.

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

- [Legal AI Platform Architecture](docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md) — bounded domains, topology, retrieval, evidence provenance, source assessments and licensing.
- [Product Boundaries](docs/PRODUCT_BOUNDARIES.md) — canonical product and repository separation.
- [Security Policy](SECURITY.md) — application-data protection and source-control hygiene.
- [Third-Party Notices](THIRD_PARTY_NOTICES.md) — legal-source project notices and licensing notes.

## Current engineering controls

The repository includes a GitHub Actions repository-security workflow and a tracked-content policy check. These are initial guardrails, not a substitute for the full Phase 0 CI, environment, migration, application-shell and operational foundation.

## Local development

The full application development setup is not yet established. Follow the Master Implementation Plan's Phase 0 checklist before treating this repository as a runnable legal application. Do not infer a stack or start services that have not been verified and recorded in the architecture decision.

## Legal-technology research sources

Selected upstream projects are tracked as engineering research. See [the source register](third-party/legal-open-source/README.md). Run `bash scripts/bootstrap-legal-sources.sh` only when the local environment is ready and the pinned source/licence review is understood.

Public availability is not a licence. Re-check exact upstream commits, dependencies, bundled templates, datasets, model licences and API terms before any reuse.
