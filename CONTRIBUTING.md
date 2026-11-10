# Contributing to Njumeni

This repository contains the Njumeni Global Legal Intelligence application and its engineering documentation. Read the [Master Implementation Plan](docs/MASTER_IMPLEMENTATION_PLAN.md), [Live Phase Register](docs/PHASE_REGISTER.md), [Engineering Standards](docs/ENGINEERING_STANDARDS.md), [ADR-0001](docs/architecture/ADR-0001-modular-monolith-and-bounded-contexts.md) and [Security Policy](SECURITY.md) before making changes.

## 1. Before starting

1. Confirm the active numbered task in the Phase Register. Do not begin work in a locked phase.
2. Read the relevant A–M module, platform-layer and bounded-context contracts.
3. Inspect existing files, tests, migrations and workflows before editing.
4. Identify affected data owners, permission boundaries, provenance requirements and external dependencies.
5. Do not start implementation that depends on unresolved environment, migration or security decisions.

## 2. Change requirements

Every change must identify:
- phase/task number;
- canonical A–M module(s);
- platform layer(s) and bounded context(s);
- data ownership and tenant/workspace/matter scope;
- API/event or migration impact;
- security, privacy, legal-provenance and provider-egress implications;
- tests and documentation changed.

Use explicit contracts between bounded contexts. Never write directly to another context's owned tables. Do not add live customer data, real credentials, private legal documents or production records.

## 3. Local quality checks

The root formatter settings are in .editorconfig and .prettierrc.json. The repository does not yet have an application package manifest or a complete lint/type/test toolchain. Do not invent local scripts or claim checks passed when those tools are not installed. Task 0.10 establishes the automated CI toolchain and task 0.9 establishes reproducible environments.

When the toolchain is available, run the exact repository scripts for formatting, lint, type-check, unit/integration tests, build and security checks. Record the results in the pull request.

## 4. Pull request review

A pull request must:
- be focused and use a Conventional Commit-style title;
- link the task and describe the change;
- include tests and evidence of successful checks;
- explain data/API/event/migration compatibility;
- include negative authorisation tests for security-sensitive paths;
- update architecture, operational or legal-governance documents when required;
- identify new dependencies and include licence/security review;
- contain no generated build output, customer data or secrets.

At least one independent review is required before merging. Security-sensitive, tenant-isolation, migration, legal verification and provider-egress changes require a reviewer with the relevant expertise. Do not self-approve high-risk changes.

## 5. Completion and phase discipline

A task is GREEN only after its deliverables are reviewed, applicable checks pass, documentation and the Phase Register are updated, and the commit SHA is verified. The active phase must pass its full acceptance review and receive a dedicated closeout commit before the next phase is unlocked.

A proposal, placeholder, empty folder, simulated result or unverified workflow is not completion.
