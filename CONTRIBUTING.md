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

The root formatter settings are in .editorconfig and .prettierrc.json. CI is documented in [CI Pipeline](docs/CI_PIPELINE.md).

Automatic CI runs on every push. Before every commit, run the same checks locally:

```bash
scripts/ci/local-checks.sh
```

It runs the content policy, foundation integrity, migration guard, root tests, the web type check and the web and legal-knowledge tests. Database (pgTAP) tests need a local Supabase stack:

```bash
supabase start && supabase db reset && supabase test db
```

Never apply migrations to the hosted project: deployment is deferred until all phases are complete. Record the checks you ran in the commit message or pull request.

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
