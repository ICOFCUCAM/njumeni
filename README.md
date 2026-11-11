# Njumeni — Global Legal Intelligence

**Research. Evidence. Reasoning. Confidence.**

Njumeni is an international legal technology platform under active construction. It is designed to be a complete legal intelligence ecosystem, not an AI chatbot or document generator:
- jurisdiction-aware legal research over versioned law
- provenance-preserving evidence intelligence
- structured legal reasoning
- citation verification
- secure matter workspaces for individuals, professionals, firms and institutions

> **Founding principle:** AI assists with legal research, analysis, evidence and reasoning. It does not pretend to be a lawyer, independently exercise legal authority or replace qualified human judgement.

## Built in public

This repository is **public by decision** ([ADR-0003](docs/architecture/ADR-0003-build-in-public-and-staged-infrastructure.md)): open code, closed data.

- Source code, schema, security policies, tests and plans are visible.
- Customer data, documents, evidence, secrets and production configuration are **never** committed.
- **Visibility is not a licence.** Unless and until a licence is published, all rights are reserved.
- External contributions are not accepted until a licence and contributor terms are chosen.

## Where the project stands

| Phase | Name | State |
|---|---|---|
| 0 | Architecture and project foundation | 🟢 Closed |
| 1 | Identity, tenancy and security | 🟡 Open: implemented; database verification being fixed |
| 2 | Legal knowledge infrastructure | 🟡 In progress: framework built; first source, embeddings and evaluation next |
| 3 | Evidence intelligence | 🔵 Implemented and verified locally: upload, quarantine and scan, extraction, chronology, contradictions, hash-chained custody and audit |
| 4–13 | Research → reasoning → verification → documents → workspaces → enterprise → commercial → global → launch | 🔒 Not started |

**What exists:**
- A Next.js 16 application with Supabase authentication, organisations, workspaces, invitations and role management.
- 23 database migrations: identity, RBAC, RLS, private storage policies, audit, entitlements, and the legal-knowledge registry, ingestion queue and retrieval. They replay cleanly on a local stack.
- About 180 automated application tests, plus pgTAP database tests.

**What does not exist yet:**
- Legal content and source adapters.
- AI models and embeddings.
- Evidence upload, matters and research answers.
- Any deployment.

The hosted database is intentionally empty. **All migrations stay in this repository and are applied to the hosted project only when every phase is complete** (Phase 13).

The live status, with evidence and blockers, is in the **[Phase Register](docs/PHASE_REGISTER.md)**.

## Key documents

| Document | Purpose |
|---|---|
| [Master Plan v2.0](docs/NJUMENI_MASTER_PLAN.md) | **Governing plan:** the complete product, architecture, security, AI, legal knowledge, commercial and roadmap specification, with all upgrades (U-01–U-27) |
| [Phase Register](docs/PHASE_REGISTER.md) | Live task and phase status, CI blockers, owner decisions |
| [Original master source](docs/ORIGINAL_MASTER_PLAN_SOURCE.md) | The immutable original 20-section plan (checksum-enforced) |
| [Product Specification](docs/PRODUCT_SPECIFICATION.md) | Users, journeys, first-release scope, acceptance criteria |
| [Phase 1 plan](docs/PHASE_1_PLAN.md) · [Phase 2 plan](docs/PHASE_2_PLAN.md) | Active phase plans |
| [ADR-0001](docs/architecture/ADR-0001-modular-monolith-and-bounded-contexts.md) · [ADR-0002](docs/architecture/ADR-0002-identity-tenancy-security.md) · [ADR-0003](docs/architecture/ADR-0003-build-in-public-and-staged-infrastructure.md) | Architecture decisions |
| [Module Layer Map](docs/architecture/MODULE_LAYER_MAP.md) · [Capability Traceability](docs/architecture/MODULE_REQUIREMENTS_TRACEABILITY.md) | Modules A–M mapped to the eight layers |
| [Engineering Standards](docs/ENGINEERING_STANDARDS.md) · [Contributing](CONTRIBUTING.md) | How work is done |
| [Database Migration Policy](docs/DATABASE_MIGRATION_POLICY.md) · [CI Pipeline](docs/CI_PIPELINE.md) · [Environment Strategy](docs/ENVIRONMENT_STRATEGY.md) | Engineering controls |
| [Security Policy](SECURITY.md) · [Third-Party Notices](THIRD_PARTY_NOTICES.md) | Security and licensing |

## Architecture at a glance

- **Four workspaces on one engine:** Personal, Professional, Enterprise and Institutional, all on a shared legal intelligence engine (research, evidence, knowledge, reasoning, verification, drafting).
- **Eight layers:** Experience · API · Workflow orchestration · Evidence · Legal knowledge · Reasoning · Verification · Infrastructure.
- **Thirteen modules (A–M):** Legal Intelligence, Research Engine, Evidence Intelligence, Case Management, Document Intelligence, Argument and Reasoning, Jurisdictions, Personal Assistant, Professional, Enterprise, Institutional, Compliance, and Knowledge Management.
- **Stack:**
  - Next.js, React, TypeScript, Tailwind
  - a Node/TypeScript modular monolith
  - Supabase: PostgreSQL, Auth, RLS, pgvector and Storage
  - a Postgres-backed job queue
  - provider-independent AI
- **Priority jurisdictions:** Norway → EU → UK → US → international law → Cameroon.

## Local development

Requirements: Node 22 (`>=22.13 <23`), npm 10, and the Supabase CLI with Docker for the local database.

Install dependencies:

```bash
cd apps/web && npm ci
```

Start the web app:

```bash
cd apps/web && npm run dev
```

Run the type check:

```bash
cd apps/web && npm run typecheck
```

Run the application tests:

```bash
cd apps/web && npm run test:auth
```

Run the root documentation and policy tests:

```bash
node --test tests/*.mjs
```

Replay all migrations locally:

```bash
supabase start && supabase db reset
```

Run the database tests:

```bash
supabase test db
```

Copy `.env.example` for local configuration. It contains placeholders only, and the AI provider defaults to `mock`. Use synthetic data only.

## Upstream research

Five open-source legal projects are tracked as architectural references: OpenContracts, CaseCite, Lawgent, Lovspor and Mike. See [the source register](third-party/legal-open-source/README.md). Nothing is vendored. Public availability is not a licence; review exact versions and licences before any reuse.

## Related repositories

- **Marketing website:** [ICOFCUCAM/marketing-website](https://github.com/ICOFCUCAM/marketing-website). Separate and decoupled; it contains no application data.
- **Legacy CMP archive:** [ICOFCUCAM/njumeni-cmp-archive](https://github.com/ICOFCUCAM/njumeni-cmp-archive).
