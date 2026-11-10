# Njumeni product direction and boundaries

## Decision

The existing `ICOFCUCAM/njumeni` repository is the canonical repository for the Njumeni legal AI platform. Do not create a separate `njumeni-legal` repository.

The original CMP marketing-site work must be preserved. It is legacy product work and must be archived within this repository before the legal application occupies the primary application structure. Do not delete the original source, design tokens, scripts or architecture documentation.

## Product A — Njumeni Legal AI (primary product)

Njumeni is being developed as a legal technology application focused on legal research and document intelligence.

The application will own its:
- frontend and application API;
- authentication, organisations, memberships and tenant boundaries;
- database schema and migrations;
- private document storage and processing workers;
- AI orchestration, retrieval and citation verification;
- jurisdiction-specific legal knowledge and source adapters;
- audit events, retention and security controls;
- environment variables, secrets, deployment and release process.

The initial architecture reference is [LEGAL_AI_PLATFORM_ARCHITECTURE.md](LEGAL_AI_PLATFORM_ARCHITECTURE.md). It is a proposal, not evidence that a working legal application has already been implemented.

## Product B — Legacy CMP work (preserved archive)

The original Njumeni CMP skeleton was a consent-management marketing website, not a legal AI application. Preserve it as historical work under a clearly labelled archive, retaining:
- original homepage HTML;
- CSS and design tokens;
- JavaScript interactions;
- original CMP architecture document;
- original README context and commit history.

When relocating these files, use a history-preserving Git move where possible. Do not overwrite or discard the original source. Record the original commit SHA in the archive documentation.

The CMP archive is not part of the legal application's runtime, build, routing or deployment.

## Upstream legal projects

The five reviewed projects remain external upstream sources:

1. OpenContracts — MIT
2. CaseCite — Apache-2.0
3. Lawgent — no clear licence identified in the initial review; do not copy code without permission or a confirmed licence.
4. Lovspor — AGPL-3.0 engine; review the corpus/data licence separately.
5. Mike — AGPL-3.0

Do not copy all five projects wholesale into Njumeni. Evaluate specific components, exact upstream commits, dependency licences, data rights and compatibility with the intended commercial distribution model before integration. Preserve attribution and upstream history where code is lawfully adopted.

## Implementation sequence

1. Keep the original CMP source recoverable and preserve its history.
2. Establish a clearly separated legacy CMP archive within this repository.
3. Build the Njumeni legal application as the primary product, with its own runtime and application structure.
4. Establish authentication, tenant isolation, auditability and secure document storage before enabling sensitive workflows.
5. Inspect and pin the five upstream projects to reviewed commits.
6. Implement the first vertical slice: secure document upload, extraction, source-grounded search and verifiable citations.
7. Add jurisdiction-specific legal sources and advanced workflows only after security and quality checks.

## Repository discipline

- One repository: `ICOFCUCAM/njumeni`.
- Primary application: Njumeni Legal AI.
- Preserved archive: legacy CMP website and documentation.
- No separate `njumeni-legal` repository.
- Never remove the original CMP work as part of the transition.
