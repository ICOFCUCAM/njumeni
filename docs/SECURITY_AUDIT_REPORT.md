# Njumeni — Pre-launch Security Audit (Phase 13)

| Field | Value |
|---|---|
| Date | 2026-11-12 |
| Scope | Database schema (38 migrations), web application and API, operational controls |
| Method | Automated catalogue audit, invariant tests (pgTAP), HTTP penetration probes against the production build, headless-browser check of the content security policy, load test, backup/restore drill |
| Independent penetration test | **Outstanding.** Required before commercial launch (Phase 13 closeout §5) |

## 1. Findings and remediation

| # | Finding | Severity | Remediation | Evidence |
|---|---|---|---|---|
| F-1 | Four internal tables (membership events, ingestion jobs, checkpoints, failures) had RLS disabled. They had no grants, so they were not exploitable | Low (defence in depth) | RLS enabled on every table (migration `20261112800000`) | `security_hardening`: "every table … has row level security" |
| F-2 | About 120 foreign-key columns had no index (slow joins and tenant scans; lock risk on restricted deletes) | Medium (availability) | An index for every single-column foreign key | "every foreign key is indexed" |
| F-3 | Two private trigger functions kept PostgreSQL's default PUBLIC execute right. Trigger functions cannot be called directly, so not exploitable | Low | Execute revoked from PUBLIC/anon on every private function | "no private function can be called without a session" |
| F-4 | No HTTP security headers (CSP, framing, sniffing, referrer, permissions) | Medium | Headers set for every route; HSTS in production | HTTP probe: 7/7 header checks; browser: all pages hydrate with no CSP violations |
| F-5 | The health endpoint did not check the database | Low (operability) | `/api/health` checks the database via `platform_health()` (no operational detail exposed) and reports the schema version | Probe and health check |

No high or critical findings.

## 2. Verified controls

| Control | Verification |
|---|---|
| Tenant isolation | Every module's pgTAP suite has outsider-denial tests; HTTP probes: foreign identifiers return 404 or 403 and are indistinguishable from missing ones |
| Anonymous surface | Exactly six functions callable without a session (SSO discovery, two API-key endpoints, the plan catalogue, the signed billing webhook, health), pinned by a test |
| Security-definer hygiene | Every definer function pins an empty `search_path`; no unchecked base function is exposed |
| Authentication on every API | Anonymous calls to all seven API operations → 401 with no internal detail; protected pages redirect to sign-in |
| Credentials | Forged and malformed API keys → 401; forged webhook signature → 401; API keys stored as SHA-256 only; no service-role key in the web app |
| Audit and custody integrity | Hash chains verified in tests, after the restore drill, and continuously by `platform_operations_status` |
| Privileged access | Operators have no default content access; support access is customer-approved, time-limited and read-only (tested) |
| AI governance | Database authorisation, egress, budget, plan credits and EU AI Act conformity gate; injection isolation; append-only execution log |
| Secrets in the repository | Gitleaks on every push (full history) |

## 3. Residual risks

| Risk | Treatment |
|---|---|
| `'unsafe-inline'` scripts in the CSP (required by the Next.js bootstrap) | Accepted for now. Move to nonce-based CSP with Next.js middleware before launch if feasible |
| No rate limiting at the application edge | Rely on the hosting platform's edge protection; add per-IP limits on authentication and API routes at deployment |
| Independent test not yet performed | Commission before commercial launch |
| Information barriers apply at matter level; linked artefacts in the same workspace remain visible to its members | Documented (Phase 9); firms use separate workspaces for walled-off material |
