# Njumeni CI pipeline

- **Workflow:** .github/workflows/ci.yml
- **Status:** Phase 0 task 0.10 initial CI baseline
- **Runtime:** GitHub Actions, Ubuntu runner, Node.js 22
- **Security companion:** .github/workflows/repository-security.yml

## 1. Checks currently executed

| Gate | Implementation | Current scope |
|---|---|---|
| Formatting | Prettier 3.5.3 | CI configuration, foundation scripts, TypeScript probe and tests |
| Lint | ESLint 10.0.0 | CI JavaScript modules, lint configuration and foundation tests |
| Type-check | TypeScript 5.8.3, strict compiler options | Foundation TypeScript compiler probe; application packages are not present yet |
| Tests | Node.js built-in test runner | Foundation and migration tests for configuration, environment safety, phase locks, A–M names/layers, migration naming, timestamp uniqueness and immutability |
| Migration guard | scripts/ci/check-migrations.mjs | Validates CLI-shaped timestamp filenames, uniqueness, non-empty SQL, and rejects edits/deletions of existing migrations; reports a zero-migration baseline until schema work begins |
| Foundation build | scripts/ci/verify-foundation.mjs | Required architecture, phase, environment and migration-policy documents; canonical layers/modules and safe environment template |
| Application build | Conditional apps/web package build | Explicitly deferred until task 0.12 creates the application shell; the workflow emits a notice rather than pretending an application build ran |
| Repository content policy | scripts/security/check-repository-content.sh | Blocks tracked runtime/customer-data paths |
| Secret scanning | Gitleaks GitHub Action | Scans Git history for accidentally committed secrets |

## 2. Workflow triggers and permissions

- Runs on pull requests and pushes to branches.
- Uses read-only repository contents permission.
- Cancels superseded runs for the same branch/ref.
- Does not deploy or access production data.
- Uses no production credentials.

## 3. Current successful baseline

The initial pipeline was exercised against the integration branch. The first run exposed two inaccurate foundation assertions; those assertions were corrected against the actual phase register and traceability document. The successful run for commit db70491c7013f93b28979ea3d9f21a9b97c7488a is GitHub Actions run 42740638198.

The successful baseline run confirms:
- formatting check passed;
- ESLint passed;
- strict TypeScript baseline passed;
- all five foundation tests passed;
- foundation architecture integrity check passed;
- repository content policy passed;
- Gitleaks secret scan passed.

## 4. Explicit limits

This is a real foundation CI pipeline, not yet a full application CI pipeline:
- There is no application package.json, web application, API, worker or scheduler in the repository yet.
- The TypeScript check currently validates the strict compiler baseline, not application source.
- Lint currently covers the CI JavaScript modules, not future TypeScript application packages.
- Foundation tests protect repository/architecture invariants; they are not legal-intelligence product tests.
- The application build gate activates when task 0.12 creates apps/web and defines its build script.
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
