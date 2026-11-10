# Njumeni — Global Legal Intelligence

Njumeni is an independent legal technology platform under active architecture and implementation. Its intended capabilities include jurisdiction-aware legal research, secure document and evidence management, document intelligence, contract workflows, legal reasoning and institutional governance.

**Implementation status:** the repository currently contains architecture, product-boundary and security documentation, repository controls and legal-technology source assessments. These documents are not evidence that the legal application features are already implemented.

## Canonical repositories and product boundaries

- **Njumeni application:** this repository, `ICOFCUCAM/njumeni`.
- **Public marketing website:** `ICOFCUCAM/marketing-website`. It is independently hosted and contains no legal application data or authenticated matter workflows.
- **Legacy CMP:** unrelated software. It must be preserved in a separate archive repository and must not be merged into Njumeni. Existing CMP files in this repository are a Phase 0 cleanup item and must not be removed before verified archival.
- **Upstream legal projects:** reviewed as references or possible isolated adapters. They are not copied wholesale into Njumeni.

Njumeni is intended to securely handle confidential legal documents, case files and evidence through protected application storage. Live customer data must never be committed to Git or stored in build artefacts, issue trackers or CI logs. Officially classified material requires hosting and service providers authorised for the applicable classification.

## Binding implementation plan

The execution sequence is controlled by [the Master Implementation Plan](docs/MASTER_IMPLEMENTATION_PLAN.md). It contains the twenty-workstream register, Phases 0–13, Phase 0 execution checklist, definition of done and execution ledger.

**Execution rule:** every "go next" resumes the first incomplete item in the active phase. No phase may be skipped. A proposal, folder, scaffold or documentation file alone does not count as a completed feature.

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
