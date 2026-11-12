# Phase 13 — Production hardening and launch

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally (hardening).** Launch steps that need the owner are listed in §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) Phase 13, §18.3 release gates, U-27 (first hosted deployment of the cumulative migration set), [ADR-0003](architecture/ADR-0003-build-in-public-and-staged-infrastructure.md) Stage 2 |
| Acceptance (master plan) | All release gates; Stage 2 infrastructure; hosted schema equals repository migrations |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |

## 1. Objective

Prove the system is ready for production, and make the first hosted deployment a single, verified, owner-controlled step. The work covers:
- security audit and penetration probes;
- performance;
- AI evaluation;
- backup and restoration;
- monitoring;
- operational documentation.

## 2. Delivered

| Area | Implementation | Result |
|---|---|---|
| Security audit | Catalogue audit of all 38 migrations ([report](SECURITY_AUDIT_REPORT.md)); remediation migration `20261112800000` (RLS on every table, an index on every foreign key, private functions closed to PUBLIC) | 5 findings fixed; none high or critical |
| Security invariants | `supabase/tests/security_hardening.test.sql` (14): RLS everywhere; no private grants; pinned and empty search paths; **exactly six anonymous functions**; no anonymous private functions; every foreign key indexed; no exposed base functions; audit log protected; health probe minimal; operator-only status and fingerprint | 14/14; runs in CI on every schema change |
| HTTP security | Security headers for every route (CSP with `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, referrer and permissions policies, HSTS in production) | Headless Chromium: 6 pages hydrate with **no CSP violations**; mobile layout intact |
| Penetration probes | `scripts/security/http-probe.mjs`: headers; anonymous access to every API (no leaks); page redirects; forged and malformed API keys; forged webhook; webhook path traversal; IDOR on runs, matters, documents and invoices; invalid input; back office hidden; oversized input | **37/37** against the production build |
| Performance | `scripts/perf/load-test.mjs` (budgets on p95 and errors) | 20 concurrent clients: API p95 147–167 ms, server-rendered pages p95 337–346 ms, **0 errors** ([baseline](operations/RUNBOOK.md#6-performance-baseline-local-2026-11-12-20-concurrent-clients)) |
| AI evaluation | `apps/web/tests/ai-evaluation.test.mjs`: 12 synthetic cases through the reasoning and drafting agents, measured against `quality/evaluation-thresholds.json` | Source grounding **1.0** (≥ 0.95), citation accuracy **1.0** (= 1.0), limitation disclosure **1.0** (= 1.0); **0 invented citations**; cases without law block submission |
| Backup and restoration | `scripts/ops/restore-drill.sh`: dump → restore into a scratch database → compare migrations, table and function fingerprints and record counts; verify the audit chain and recompute **every custody link** | Passed: identical, audit chain valid, 0 broken custody links |
| Monitoring | `public.platform_health()` (anonymous, minimal) behind `GET /api/health` (database status and schema version); `public.platform_operations_status()` (operators: audit chain, AI failures and safety flags, ingestion, billing, review backlog, denials, support grants) | Health returns `ok` with schema `20261112800000` |
| Schema equality (U-27) | `public.schema_fingerprint()`; `scripts/ops/verify-hosted-schema.sql`; workflow `.github/workflows/deploy-hosted-database.yml` (manual only, `confirm = DEPLOY`, dry run first, `production` environment, applies with `supabase db push`, then proves the hosted schema equals the repository) | Verified locally; hosted project inspected (§3) |
| Operational documentation | [Operations runbook](operations/RUNBOOK.md): deployment, capabilities that stay off until decided, monitoring and alerts, backups, incidents, support access, performance baseline, secret rotation | — |
| Release gates | RG-01, RG-02, RG-04, RG-09 and RG-12 gain Phase 13 evidence (invariants, AI evaluation, restore drill) | 12/12 evidenced |

## 3. Hosted project state (inspected read-only, 2026-11-12)

| Item | Value |
|---|---|
| Project | **Njumeni**, ref `vvjpsejeeffykaozfbik`, eu-north-1, Postgres 17, `ACTIVE_HEALTHY` |
| Migrations applied | **None** |
| Tables in `public`/`private` | **None** |

The project is in exactly the state U-27 prescribes: untouched until the owner deploys the complete, tested set.

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **693/693** in 24 files (`security_hardening` 14/14) |
| Application tests | **251/251** (including `ai-evaluation`) |
| Root tests, release gates, content policy, migration guard, Prettier (CI set), type check, `next build` | ✅ |
| Penetration probes / browser CSP check / load test / restore drill | 37/37 · no violations · 0 errors · passed |

## 5. Launch steps outstanding (owner)

| # | Step | Notes |
|---|---|---|
| 1 | CI green on the Phase 13 commit | Automatic on push |
| 2 | **Deploy the database:** set `SUPABASE_DB_URL`, create the `production` environment, run "Deploy database to hosted Supabase" (dry run, then deploy) | [Runbook §1](operations/RUNBOOK.md); the workflow proves equality with the repository |
| 3 | Deploy the web app (Stage 2 hosting) with the hosted URL and publishable key | No service-role key in the web app |
| 4 | Independent penetration test | Before commercial launch |
| 5 | Decisions D-5 (AI provider and budget) and the payment provider | Capabilities stay off until then |
| 6 | Real legal content (Task 2.8, then per jurisdiction) | Needed for coverage, evaluation calibration and pilot customers |
| 7 | Pilot customers, then commercial launch | After steps 2–6 |

## 6. Decisions

- **The hosted deployment is a button the owner presses, and it proves itself.** No migration reaches the hosted project from a developer's machine, and the run fails unless the hosted schema equals the repository.
- **Invariants over checklists.** Security rules are tests that every future migration must pass, not a one-time review.
- **Launch claims stay honest.** The platform is technically ready, but it is not launched: real content, an independent test and the owner's commercial decisions come first.
