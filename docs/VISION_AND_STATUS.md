# Njumeni — Vision and Current Status

**Snapshot date:** 2026-11-11  
**Repository head reviewed:** `2b60d5f` (branches `claude/nice-darwin-hu9xau` and `claude/wonderful-franklin-lt09d7` point to the same commit)  
**Method:** full read of the vision documents (`ORIGINAL_MASTER_PLAN_SOURCE.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `PRODUCT_SPECIFICATION.md`, `PHASE_REGISTER.md`) plus audits of the code, migrations, tests, CI workflows and infrastructure docs. Local checks were run; findings were compared with the latest CI runs.

This is a point-in-time summary. The [Live Phase Register](PHASE_REGISTER.md) remains the operational source of truth; where this snapshot shows that the register is out of date, it says so explicitly.

> **Update, 2026-11-11.** After this snapshot, the owner adopted the [Njumeni Master Plan v2.0](NJUMENI_MASTER_PLAN.md) as the governing plan. The owner also decided:
> - to **build in public at zero cost** ([ADR-0003](architecture/ADR-0003-build-in-public-and-staged-infrastructure.md)), which resolves the "repository is PUBLIC" risk below;
> - to **keep all migrations in the repository and apply them to hosted Supabase only when all phases are complete**.
>
> The phase register has been rewritten to match.

---

## 1. The vision

### What Njumeni is
**Njumeni — Global Legal Intelligence.** *"Research. Evidence. Reasoning. Confidence."*  
A full international legal-technology company and platform. It is not a chatbot, a document generator or a search box connected to an LLM.

**Founding principle:** AI assists with legal research, analysis, evidence and reasoning. It does not pretend to be a lawyer, exercise legal authority or replace qualified human judgement.

### Who it serves: four workspaces on one engine
| Workspace | Users |
|---|---|
| Personal (Module H) | Individuals and self-represented people |
| Professional (Module I) | Lawyers, advisers, paralegals |
| Enterprise / Law firm (Module J) | Firms, in-house legal and compliance teams |
| Institutional (Module K) | Public bodies and institutional legal departments |

All four sit on a **shared legal intelligence engine** (research, evidence, knowledge, reasoning, verification, drafting) and **platform services** (API, database, AI orchestration, storage, security, audit). Tenants are strictly isolated.

### Eight architectural layers
Experience → API → Workflow orchestration → Evidence → Legal knowledge → Reasoning → Verification → Infrastructure.

### Thirteen product modules (A–M)
A Legal Intelligence · B Legal Research Engine · C Evidence Intelligence · D Case Management · E Document Intelligence · F Argument and Reasoning Engine · G Jurisdiction and Legal Systems · H Personal Assistant · I Professional Workspace · J Enterprise/Law Firm · K Institutional · L Compliance and Risk · M Knowledge Management.

### Core differentiators (the proprietary core)
1. **Versioned legal-authority graph.** Every source carries its jurisdiction, dates, version history and status, and relationships such as amends, repeals and overrules. Law is applied *as it stood at the relevant time*.
2. **Evidence-to-law engine.** Evidence → factual proposition → legal issue → authority → reasoned assessment, with provenance and chain of custody.
3. **Structured argument graph.** Issues, rules, facts, claims and counterarguments are stored as explicit data, not free text.
4. **Verification.** Citation, quotation, source and currency checks, with human review gates. Every answer separates verified authority, interpretation, assumptions, inferences, open questions and conflicting authority.
5. **Provider-independent AI orchestration.** An agent registry with about 19 agents, model governance and a legal RAG stack: PostgreSQL, pgvector, full-text search, hybrid retrieval and reranking.

### Strategic priority order
1. Legal knowledge and authority infrastructure
2. Evidence intelligence
3. Legal reasoning and verification

### Jurisdiction priority
Norway → EU → UK → US → International law → Cameroon → other African jurisdictions → global. No jurisdiction may be advertised as supported until its coverage is tested.

### Target stack
Next.js, React, TypeScript, Tailwind · Node/TypeScript backend as a modular monolith · Supabase (Postgres, Auth, RLS, pgvector) · Redis/BullMQ · S3-compatible storage · Vercel, Cloudflare, Sentry · **private** GitHub monorepo.

### First release (from the product specification)
A secure, responsive web workspace with one verifiable **research + document** vertical slice:
- Auth, tenancy and roles
- Matters
- Confidential document and evidence storage
- A source registry
- Jurisdiction- and date-aware research
- Grounded AI with citation and quote verification
- Human review
- Audit and operational controls

### Commercial hypothesis (not yet approved)
| Plan | Monthly price |
|---|---|
| Free | $0 |
| Personal | $19 |
| Personal Plus | $39 |
| Professional | $79 |
| Professional Plus | $149 |
| Law Firm | $299+ |
| Enterprise / Institutional | Custom or contract |

### Roadmap: 14 phases (0–13)
0 Foundation · 1 Identity, tenancy, security · 2 Legal knowledge · 3 Evidence · 4 Document intelligence · 5 Research · 6 AI reasoning · 7 Verification · 8 Documents/drafting · 9 Personal and case workspace · 10 Professional/institutional · 11 Commercial · 12 Global expansion · 13 Hardening and launch.

*(The live register orders phases 3–8 slightly differently from the original §16 roadmap; the register's order governs.)*

---

## 2. Where we are

### One-line summary
**Phase 0 is closed. Phase 1 has its code written, but its database tests fail in CI and it is not accepted. Phase 2 is a well-built governance and plumbing layer with no legal content, no source adapters, no embeddings and no UI. Phases 3–13 have not started. Nothing is deployed, and no real legal data may be used.**

### Phase overview
| Phase | Register says | Actual state |
|---|---|---|
| 0 Foundation | 🟢 CLOSED | Confirmed. Docs, ADRs, CI, and an A–M app shell with placeholder module pages. |
| 1 Identity, tenancy, security | 🟡 OPEN | Code complete for 1.3–1.10. **pgTAP fails in CI** (RBAC and audit test files). Live Auth checks have not been run. |
| 2 Legal knowledge | 🟡 PARALLEL | About 2,000 lines of TypeScript and 11 migrations. Empty corpus. **CI is red** (migration-policy guard and pgTAP). |
| 3–13 | 🔒 LOCKED | Not started. |

### What actually works today
- The Next.js 16 app shell, with sign-in, sign-out and session refresh through Supabase SSR. The workspace routes are guarded.
- Profile settings; organisation and workspace management; invitations (single-use, hashed tokens); role management UI.
- 23 Supabase migrations that **replay cleanly** on a local stack. They cover:
  - profiles, organisations, workspaces, memberships and invitations
  - RBAC
  - private storage policies
  - an append-only audit log
  - subscriptions and entitlements
  - the legal source/authority registry
  - a durable ingestion queue
  - lexical and semantic retrieval RPCs
  - coverage governance
- Local checks run during this review:

  | Check | Result |
  |---|---|
  | `apps/web` typecheck | ✅ |
  | `test:auth` (includes the Phase 2 tests) | ✅ 161/161 |
  | `test:legal-knowledge` | ✅ 114/114 |
  | root `node --test tests/*.mjs` | ✅ 19/19 |

  These are unit or contract tests with mocked clients.

### What is not built or connected
- **No legal content.** The worker's adapter list is empty and frozen (`worker-adapters.ts`), and nothing fetches law for any jurisdiction. The seeds are 6 jurisdictions (Norway is `pilot`; the rest are `planned`) and 6 catalogue sources (Lovdata, EUR-Lex, legislation.gov.uk, Congress.gov, UN Treaty Collection, Cameroon). All are under rights review, with ingestion disabled.
- **No AI.** There is no model provider, no embedding model and no embedding generation. `AI_PROVIDER_DEFAULT=mock`.
- **The legal knowledge module is not reachable from the app.** It has no routes, UI or generated types.
- **The storage helper is unused.** `lib/workspace-storage.ts` is imported nowhere, so there is no upload path. The audit and billing RPCs are not called from the app.
- **No hosting or deployment of the app.** There is also no object storage, Redis, worker host, monitoring, backups or domains.
- **The hosted Supabase project is empty.** `Njumeni` (`vvjpsejeeffykaozfbik`, eu-north-1, Free plan) exists, but **no migrations have been applied to it**, by design until the owner authorises it.

### CI is red: what is failing and why
1. **Migration-policy guard.** Commit `2b60d5f` edited `20261110290000_legal_source_coverage_review.sql` without adding it to `scripts/ci/migration-predeployment-corrections.json`, so the guard reports "Existing migration is immutable".
2. **`role_permission.test.sql` (Phase 1.7).** Test 10 creates a workspace as a member before that member receives `org_admin`; tests 11 and 37 fail as a result. Line ~497 reads `private.role_audit_events` while still in the `authenticated` role, and the permission error aborts the file. These look like test-fixture bugs, not policy bugs.
3. **`security_audit.test.sql` (Phase 1.9).** The fixture inserts two rows into `audit_test_ids`, so a scalar subquery returns more than one row and none of the 12 tests run.
4. **`legal_knowledge_foundation.test.sql` (Phase 2).**
   - Line 66 still has the `$`-delimiter corruption (`)$,`) that the recent "repair migration" commits fixed in the migrations. It is a syntax error.
   - Test 22 expects `USER-DEFINED` where Postgres reports `tsvector`.
   - Test 39 checks an old 7-argument signature of `legal_ingestion_append_authority`; only the 9-argument version exists.
5. **Gap:** `test:legal-knowledge` is not run by any CI workflow.

### Smaller defects found
- The worker entrypoint imports `server-only`, which is not in `apps/web/package.json`, so the worker fails to start with `ERR_MODULE_NOT_FOUND`.
- `api/health` still hard-codes `authenticationConnected: false, databaseConnected: false`.
- `database.types.ts` is out of date: no audit, billing or legal types.
- `npm audit` reports one high-severity advisory in `apps/web`.
- Lexical search uses the `'simple'` text-search config, which is not language-aware.

### Documentation that is out of date
- `README.md` says auth, tenancy and database/RLS are "not connected yet". They are implemented, though not deployed.
- `PHASE_REGISTER.md`:
  - Task 2.5 says the queue and persistence are "pending", and task 2.7 says "NOT STARTED". Both are implemented.
  - §3 says "Phases 2–13 remain locked" while the same document shows Phase 2 in progress.
  - Tasks 1.7–1.11 say "verification deferred", but the verification has run in CI and fails.
- `PHASE_1_ACCEPTANCE_REPORT.md` says the combined verification has not been run.
- `PHASE_2_PLAN.md` describes the work as uncommitted.
- These docs predate the 23 migrations and the Supabase project:
  - `INFRASTRUCTURE_AUDIT.md` §2
  - `ENVIRONMENT_STRATEGY.md` §1
  - `DATABASE_MIGRATION_POLICY.md` §1
  - `CI_PIPELINE.md`
  - `CONTRIBUTING.md` §3

  `tests/infrastructure-audit.test.mjs` requires some of the stale wording to stay.
- `CMP_ARCHIVE_MANIFEST.md` is still marked "awaiting creation", although the archive is done.
- `ADR-0002` is still "Proposed"; `PHASE_1_ENVIRONMENT_READINESS.md` ends with "IN PROGRESS".

### Owner decisions and risks
| Priority | Item |
|---|---|
| ~~P0~~ Resolved | The repository is public. **Resolved 2026-11-11 by owner decision to build in public (ADR-0003).** |
| **P0** | No production trust boundary exists. No confidential legal data may be used until Phase 1 is accepted. |
| P1 | The default branch is a Claude working branch, and branch protection is off or unverified. |
| P1 | CI actions use version tags instead of pinned SHAs; installs use `--no-audit`; two workflows auto-commit to the branch. |
| P1 | Leaked-password protection requires a paid Supabase plan; the project is on Free. |
| P1 | Upstream reference repositories: Lawgent has no licence; Lovspor and Mike are AGPL. None are cloned or used yet. |
| Open | First jurisdiction and launch order, pricing, SLOs, pilot cohort, languages, data residency beyond the database, AI provider, embedding model, hosting for the app and workers. |

---

## 3. Recommended next steps (in order)

1. **Get CI green.**
   - Fix the RBAC and audit pgTAP fixtures.
   - Fix line 66 and tests 22 and 39 of the legal-knowledge pgTAP file.
   - Add the hash-pinned correction entry for `20261110290000`.
   - Add `test:legal-knowledge` to CI.
   - Add the `server-only` dependency.
2. **Close Phase 1.**
   - Run the live Auth lifecycle test with a dedicated test identity.
   - Decide on leaked-password protection: upgrade the plan or formally accept the risk.
   - Regenerate the database types.
   - Write the acceptance report with run IDs, then make the closeout commit.
3. **Owner items.** *Repository visibility is resolved (build in public).* Confirm data residency and classification, the licence posture (D-1), and the domain/trademark knock-out search (D-2).
4. **Update the stale docs.** Correct the register, README, health endpoint and infrastructure/CI docs to match reality.
5. **Make Phase 2 real.**
   - Complete the rights review for one pilot source (Lovdata / Norway).
   - Build the first adapter.
   - Choose an embedding model and implement embedding generation.
   - Make retrieval language-aware and create an evaluation set.
   - Then run the 2.8 closeout.
6. Only then unlock **Phase 3 (Evidence)**, the second strategic pillar.
