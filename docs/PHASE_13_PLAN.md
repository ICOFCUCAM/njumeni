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

### 3.1 First hosted deployment (U-27), 2026-11-12, at the owner's request

| Item | Result |
|---|---|
| Source | Commit `da164c72e2f5df8e2d3548ec03289fcbcf1e23a5`. The hosted database fetched each migration file from that immutable commit and **checked its MD5 against the repository's** before executing it |
| Method | One transaction for all 38 migrations (all or nothing). Each was recorded in `supabase_migrations.schema_migrations` under its repository version, so later `supabase db push` runs and the deployment workflow continue from it. The temporary `http` extension used for fetching was dropped afterwards |
| Migrations | **38/38**, `20261110141433` → `20261112800000`; `platform_health()` reports schema `20261112800000` |
| Security invariants (hosted) | 0 tables without RLS · 0 private grants · 0 unpinned definers · anonymous functions exactly the intended six · 0 anonymous private functions · 0 unindexed foreign keys · audit chain valid |
| **Schema equality** | Fingerprints identical to the local database: tables `0e59a41e56f519d1971530e47504c67a`, functions `53d643a977497295c4ea1a279c58e8c6`, policies `e68a9302aae0c1722cf3f2a25e93df1c`; 13 jurisdictions and 14 sources seeded on both |
| Existing data | The one existing sign-in account was backfilled into a principal with its personal organisation |
| Supabase security advisor | Only by-design notices: private tables have RLS with no policies (reachable only through checked functions); the six intended anonymous functions; signed-in users call security-definer RPCs (the architecture); `regconfig` column (language search). **Action for the owner:** enable *leaked password protection* (Authentication → Policies) |

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
| 1 | ~~CI green on the Phase 13 commit~~ ✅ Database verification `43139417538` on `ae46590` passed. CI and security failed on `ae46590` (Prettier formatting of `tests/foundation.test.mjs`) and passed on the fix `f6633b6` (`43139433213`) | Done |
| 2 | ~~Deploy the database~~ ✅ Done 2026-11-12 (§3.1); hosted schema equals the repository. Future migrations: set `SUPABASE_DB_URL` and use the workflow | [Runbook §1](operations/RUNBOOK.md) |
| 3 | Deploy the web app (Stage 2 hosting) with the hosted URL and publishable key | No service-role key in the web app |
| 4 | Independent penetration test | Before commercial launch |
| 5 | Decisions D-5 (AI provider and budget) and the payment provider | Capabilities stay off until then |
| 6 | Real legal content (Task 2.8, then per jurisdiction) | Needed for coverage, evaluation calibration and pilot customers |
| 7 | Pilot customers, then commercial launch | After steps 2–6 |

## 5a. Browser journey suite (2026-11-12)

`apps/web/e2e/journeys.e2e.mjs` (`npm run test:e2e`) drives headless Chromium through the real interface: sign-in, forms, server actions, redirects and downloads.

| Journey | Steps exercised in the browser | Result |
|---|---|---|
| 15.1 Individual | Sign in → employment intake → numbered matter with intake summary and verify-deadline task → pre-filled research → verified answer → re-verify → approve the review gate → create a document from the research → drafting agent → submit → approve → PDF download (final, no DRAFT) → link research and document to the matter → case bundle download (ZIP) | ✅ |
| 15.2 Firm | Law firm without a check → "No usable check" → register client → run a conflict check for the right workspace → clear → open the matter with the check and client → "Conflict check: clear" → assign the responsible lawyer → the used check cannot open a second matter | ✅ |
| Localisation and accessibility | Norwegian navigation from the profile locale; one main heading per page; every form field labelled (6 pages) | ✅ |

Passed twice in a row. Running the suite found and fixed **two real defects** that API-level tests could not see:
1. **Stale research page after "Re-verify"**: the action redirected to the same page without refreshing it, so the new verification status appeared only after a manual reload. Fixed with `revalidatePath` in both research verification actions.
2. **Overlapping controls in list rows**: inline forms (review decisions, deadlines, tasks, conflict decisions) were squeezed into the row's single flex line, and the Approve button overlapped the note field. Fixed with global CSS: inline forms take their own full-width line, and action rows wrap with consistent controls.

## 6. Decisions

- **The hosted deployment is a button the owner presses, and it proves itself.** No migration reaches the hosted project from a developer's machine, and the run fails unless the hosted schema equals the repository.
- **Invariants over checklists.** Security rules are tests that every future migration must pass, not a one-time review.
- **Launch claims stay honest.** The platform is technically ready, but it is not launched: real content, an independent test and the owner's commercial decisions come first.
