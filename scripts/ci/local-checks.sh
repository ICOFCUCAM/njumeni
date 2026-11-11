#!/usr/bin/env bash
# Local substitute for CI while automatic CI is paused (owner decision, 2026-11-11).
# Runs every check that does not need Docker. Database (pgTAP) tests need a local
# Supabase stack: `supabase start && supabase db reset && supabase test db`.
set -euo pipefail
cd "$(dirname "$0")/../.."

step() { printf '\n== %s\n' "$1"; }

step "Repository content policy"
bash scripts/security/check-repository-content.sh

step "Foundation integrity"
node scripts/ci/verify-foundation.mjs

step "Migration guard"
node scripts/ci/check-migrations.mjs

step "Root documentation and policy tests"
node --test tests/*.test.mjs

if [ -d apps/web/node_modules ]; then
  step "Web type check"
  (cd apps/web && npm run --silent typecheck)
  step "Web and legal-knowledge tests"
  (cd apps/web && npm test)
else
  printf '\nSkipping web checks: run "cd apps/web && npm ci" first.\n'
fi

printf '\nAll local checks passed. Database tests not run (need a local Supabase stack).\n'
