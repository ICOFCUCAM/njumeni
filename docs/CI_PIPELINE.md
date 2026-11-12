# Njumeni CI pipeline

- **Workflow:** .github/workflows/repository-security.yml
- **Status:** Phase 0 task 0.10 initial CI baseline
- **Runtime:** GitHub Actions, Ubuntu runner, Node.js 22
- **Pipeline name:** Njumeni CI and security (quality, repository content policy and secret scanning are consolidated in one proven workflow)

## 1. Checks currently executed

| Gate | Implementation | Current scope |
|---|---|---|
| Formatting | Prettier 3.5.3 | CI configuration, foundation scripts, TypeScript probe and tests |
| Lint | ESLint 10.0.0 | CI JavaScript modules, lint configuration and foundation tests |
| Type-check | TypeScript 5.8.3 at root; TypeScript 5.9.3 in the web package | Strict foundation compiler probe plus apps/web TypeScript check |
| Tests | Node.js built-in test runner | Foundation, migration, original-source preservation, infrastructure-audit and app-shell contract tests for environment safety, phase locks, source SHA-256, all twenty original sections, eight original layers, five named upstream repositories, hosting/provider gap assertions, A–M registry, route boundaries, dependency lock consistency and migration immutability |
| Migration guard | scripts/ci/check-migrations.mjs | Validates CLI-shaped timestamp filenames, uniqueness, non-empty SQL, and rejects edits/deletions of existing migrations; reports a zero-migration baseline until schema work begins |
| Foundation build | scripts/ci/verify-foundation.mjs | Required architecture, phase, environment and migration-policy documents; canonical layers/modules and safe environment template |
| Application build | npm ci, npm run typecheck and next build in apps/web | Active for the Next.js shell; future module code remains gated by its delivery phase |
| Repository content policy | scripts/security/check-repository-content.sh | Blocks tracked runtime/customer-data paths |
| Secret scanning | Gitleaks GitHub Action | Scans Git history for accidentally committed secrets |

## 2. Workflow triggers and permissions

- Runs on pull requests and pushes to branches.
- Uses read-only repository contents permission.
- Cancels superseded runs for the same branch/ref.
- Does not deploy or access production data.
- Uses no production credentials.

## 3. Current successful baseline

The initial pipeline was exercised against the integration branch. The first runs exposed inaccurate foundation assertions and formatting issues; these were corrected against the actual phase register, traceability document and canonical Prettier output. The final successful run is the migration-enabled run recorded above.

The final migration-enabled baseline passed in GitHub Actions run 42741685025 on commit 3516acfc23e9f68db8b93fa6f0ca9f0100144acc. It confirms:
- Prettier formatting check passed;
- ESLint passed;
- strict TypeScript baseline passed;
- all eight tests passed (five foundation tests and three migration-guard tests);
- migration naming/order/immutability check passed against the zero-migration baseline;
- foundation architecture integrity check passed;
- repository content policy passed;
- Gitleaks secret scan passed.

## 4. Explicit limits

This is a foundation plus application-shell CI pipeline, not yet a complete product CI pipeline:
- The Next.js web shell exists, but no application API/worker/scheduler or authenticated data services exist yet.
- The TypeScript check validates the strict root baseline and the web package source.
- ESLint currently covers CI JavaScript modules and test files; dedicated Next.js/TypeScript application lint rules remain to be added.
- Foundation and app-shell tests protect architecture/route contracts; they are not legal-intelligence product evaluations.
- Database, RLS, migration replay against a live Njumeni database, browser E2E and legal-source evaluations remain gated by their numbered phases.
- Integration, database, RLS, migration, browser, legal-evaluation and performance tests are added as their corresponding code and environments become available.

Do not describe skipped or not-yet-applicable application checks as passed. The CI report and Phase Register must preserve this distinction.

## 5. Required extensions

When the application workspace is introduced:
1. Add workspace package scripts and a committed lockfile.
2. Expand Prettier/ESLint/TypeScript checks to all app and package source.
3. Run unit, integration and API tests for all changed packages.
4. Run the real Next.js production build.
5. Add database migration replay and schema drift checks after task 0.11.
6. Add RLS, tenant-isolation, storage and permission tests with Phase 1.
7. Add legal source, citation, currency, retrieval and reasoning evaluations in the relevant product phases.
8. Protect release environments and add staging/production deployment gates only after task 0.13 verifies the hosting setup.


## 6. Migration safety gate

The CI workflow now checks migration files on every push and pull request. It uses full Git history so the migration guard can compare the change with the push/PR base. Existing migration files are immutable; only new CLI-generated migration files may be added. The check does not connect to a hosted database, run DDL or deploy migrations.

No Njumeni migration SQL exists yet. The current CI result is a zero-migration baseline, not proof of a local or hosted database replay. See [Database Migration Policy](DATABASE_MIGRATION_POLICY.md).

## Addendum — CI paused (owner decision, 11 November 2026)

To avoid spending GitHub Actions resources for now, automatic CI is paused.

| Workflow | Trigger now |
|---|---|
| `repository-security.yml` (quality, tests, build, migration guard, Gitleaks) | Manual only (`workflow_dispatch`) |
| `supabase-local.yml` (migration replay, lint, pgTAP) | Manual only |
| `supabase-dependency-lock.yml` (lockfile regeneration, auto-commit) | Manual only |
| **`secret-scan.yml`** (repository content policy and Gitleaks) | **Every push and pull request**, because a committed secret on a public repository is exposed immediately |

**Working rule while paused:**
1. Run `scripts/ci/local-checks.sh` before each commit. It runs the content policy, foundation integrity, migration guard, root tests, web type check and web/legal-knowledge tests.
2. Run database tests on a local Supabase stack (`supabase start && supabase db reset && supabase test db`), or dispatch `supabase-local.yml` manually.
3. Before any phase closeout, run every workflow manually from the **Actions** tab. All must pass.

**To re-enable:** restore the previous `on:` blocks from Git history, or add `push`/`pull_request` triggers back to each workflow.

## Addendum — CI re-enabled (owner decision, 11 November 2026, later the same day)

Because the repository is public, GitHub Actions minutes are free, so automatic CI is **re-enabled**. This supersedes the "CI paused" addendum above.

| Workflow | Trigger |
|---|---|
| `repository-security.yml` (quality, tests, build, migration guard, content policy, Gitleaks) | Every push and pull request; manual |
| `supabase-local.yml` (migration replay, lint, pgTAP, type-drift check) | Pushes and pull requests touching `supabase/**`, `scripts/db/**` or the generated database types; manual |
| `supabase-dependency-lock.yml` | **Manual only.** It commits regenerated lockfiles by itself, which would conflict with the one-commit-per-phase cadence |

The stand-alone `secret-scan.yml` was removed: Gitleaks and the content policy already run on every push inside `repository-security.yml`. `scripts/ci/local-checks.sh` remains the recommended pre-commit check.

## Addendum — Release gates (Phase 6, 12 November 2026)

The `quality` job in `repository-security.yml` now runs `node scripts/ci/check-release-gates.mjs` after the migration guard. It fails the build when:
- any of the 12 release gates of master plan §18.3 loses the test or workflow step that evidences it (`quality/release-gates.json`);
- an evaluation threshold of §18.2 is lowered or removed compared with the base commit, without a recalibration entry (`quality/evaluation-thresholds.json`);
- a gate enforced in code is weaker than the thresholds file.

`scripts/ci/local-checks.sh` runs the same check.

## Addendum — Hosted database deployment (Phase 13, 12 November 2026)

`.github/workflows/deploy-hosted-database.yml` deploys the cumulative migration set to the hosted Supabase project (U-27):
- It runs **only manually**, with `confirm = DEPLOY`, in the protected `production` environment.
- It does a dry run first, then `supabase db push`.
- It then verifies the hosted schema with `scripts/ops/verify-hosted-schema.sql` and fails unless the hosted migration list equals the repository's and every security invariant holds.

It requires the repository secret `SUPABASE_DB_URL`. See the [operations runbook](operations/RUNBOOK.md).
