# Njumeni product boundaries

## Decision

Preserve the existing Njumeni consent-management platform (CMP) website and establish the legal AI platform as a separate application in a separate GitHub repository.

This decision is based on the repository's original purpose: the README describes a CMP marketing-site skeleton, and `docs/ARCHITECTURE.md` documents a CMP product website and consent-layer demonstration. There is no repository evidence that the CMP work was intended only as a temporary legal-product scaffold.

## Product A — Njumeni CMP

- Keep the existing root-level `site/` implementation intact.
- Preserve its original HTML, CSS, JavaScript, design tokens and CMP architecture documentation.
- Continue CMP product development independently.
- Do not introduce legal-AI application dependencies, database migrations, authentication flows or worker processes into this product.

## Product B — Njumeni Legal AI

Create a separate repository and independently deployable application for legal research and document intelligence.

The legal application should own its:
- frontend and application API;
- authentication, organisations, memberships and tenant boundaries;
- database schema and migrations;
- private document storage and processing workers;
- AI orchestration, retrieval and citation verification;
- audit events, retention and security controls;
- environment variables, secrets, deployment and release process.

The existing `docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md` is the initial architecture reference, not evidence that a working legal application has already been implemented.

## Upstream legal projects

The five reviewed projects remain external upstream sources:

1. OpenContracts — MIT
2. CaseCite — Apache-2.0
3. Lawgent — no clear licence identified in the initial review; do not copy code without permission or a confirmed licence.
4. Lovspor — AGPL-3.0 engine; review the corpus/data licence separately.
5. Mike — AGPL-3.0

Do not copy all five projects wholesale into either product. Evaluate specific components, exact upstream commits, dependency licences, data rights and compatibility with the intended commercial distribution model before integration. Preserve attribution and upstream history where code is lawfully adopted.

## Repository and deployment boundary

The legal application should be created as a separate GitHub repository under the same owner, with its own deployment project and secrets. The CMP repository must not become a monorepo for the legal platform.

The GitHub connection used for this work currently exposes repository read/write operations but does not expose repository creation. Therefore, creating the new repository is a prerequisite before its application code can be committed there. Once created, its URL can be used to continue implementation.

## Implementation sequence

1. Keep this CMP repository unchanged except for product-boundary and research documentation.
2. Create the separate legal application repository.
3. Establish the legal app foundation and security model before importing upstream code.
4. Inspect and pin the five upstream projects to reviewed commits.
5. Implement a first vertical slice: secure document upload, extraction, source-grounded search and verifiable citations.
6. Add jurisdiction-specific legal sources and advanced workflows only after the first slice passes security and quality checks.
