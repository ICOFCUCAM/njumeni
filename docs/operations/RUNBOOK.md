# Njumeni — Operations Runbook

| Field | Value |
|---|---|
| Status | In force from Phase 13 |
| Applies to | Stage 1–2 infrastructure ([ADR-0003](../architecture/ADR-0003-build-in-public-and-staged-infrastructure.md)): Next.js web application, hosted Supabase project **Njumeni** (`vvjpsejeeffykaozfbik`, eu-north-1) |
| Related | [Phase 13 plan](../PHASE_13_PLAN.md) · [Security audit report](../SECURITY_AUDIT_REPORT.md) · [CI pipeline](../CI_PIPELINE.md) |

## 1. First deployment of the database (U-27)

The hosted project is empty by design until the owner decides to deploy.

1. In GitHub, set the repository secret **`SUPABASE_DB_URL`**: the hosted project's session-pooler connection string, including the database password (Supabase dashboard → Connect).
2. Create the GitHub environment **`production`** with the owner as required reviewer.
3. Run **Actions → "Deploy database to hosted Supabase"** with `confirm = DEPLOY` and `dry_run = true`. Check the listed migrations: there should be 38, the first `20261110141433`, the last `20261112800000`.
4. Run it again with `dry_run = false`. The workflow applies every migration, then runs `scripts/ops/verify-hosted-schema.sql`. That script checks:
   - row level security is enabled everywhere;
   - no private grants exist;
   - search paths are pinned;
   - exactly six functions can be called anonymously;
   - the audit chain is valid;
   - the hosted migration list equals the repository's.

   It fails if anything differs.
5. Configure the web deployment with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` of the hosted project. **Never** give the web app the service-role key.
6. Smoke test:
   - `GET /api/health` returns `{"status":"ok","database":"ok","schemaVersion":"20261112800000"}`;
   - `BASE_URL=https://<app> node scripts/security/http-probe.mjs` passes.

Later migrations follow the same path: merge → CI green → run the workflow.

## 2. Configuration that stays off until decided

| Capability | How it is enabled | Decision |
|---|---|---|
| Commercial AI provider | `update private.ai_providers set status = 'enabled'`; each workspace opts in (`ai_update_workspace_settings`); the adapter uses the official SDK | Owner D-5 (provider, budget) |
| Payment provider | Insert `private.billing_provider_settings` (provider, webhook secret ≥ 32 characters, enabled); point the provider's webhook to `/api/billing/webhooks/<provider>` | Owner (provider and account) |
| Platform operators | Insert into `private.platform_operators` (principal, role); audited use | Owner |
| SSO | The customer configures it; an operator verifies the DNS TXT record (`platform_verify_sso_domain`); then Supabase Auth SAML on the hosted project | Per customer |
| Legal sources | Phase 2 rights review → activation → ingestion worker (`npm run worker:legal-knowledge`) | Per source (Task 2.8 first) |

## 3. Monitoring and alerts

| Signal | Source | Alert when |
|---|---|---|
| Liveness | `GET /api/health` (every minute) | Not 200, or `database` ≠ `ok`, for 3 consecutive checks |
| Schema drift | `schemaVersion` in `/api/health` | Differs from the latest repository migration after a deployment |
| Audit integrity | `platform_operations_status().auditChainValid` (operators) | `false`: **security incident**, see §5 |
| AI failures | `ai.failedLastHour`, `ai.safetyFlagsLastDay` | > 5 failures per hour; any spike in safety flags |
| Ingestion | `ingestion.failedJobs` (failed and dead-letter) | > 0 new since the last check |
| Billing | `billing.webhookFailures`, `openInvoices` | Any webhook failure; invoices open > 30 days |
| Quality | `quality.pendingReviews`, `oldestPendingReviewHours`, `blockedVerificationsLastDay` | Oldest review > 72 h |
| Access | `security.deniedEventsLastHour`, `activeSupportGrants` | A spike in denials (probing); any grant outside a ticket |
| Performance | Load-test baseline (§6) | p95 above twice the baseline |

## 4. Backups and restoration

- **Hosted:** Supabase daily backups (point-in-time recovery when the plan includes it). Keep them for at least 30 days.
- **Drill (quarterly and before every major release):** run `scripts/ops/restore-drill.sh` locally. For the hosted project, restore a backup into a scratch project and run the drill's fingerprint SQL against both. The restore must have identical migrations, catalogue fingerprints and record counts, a valid audit chain and **zero broken custody links**. Last local drill: 2026-11-12, passed (see the Phase 13 plan).

## 5. Incidents

| Severity | Examples | Response |
|---|---|---|
| SEV-1 | Cross-tenant data exposure, audit chain invalid, fabricated citation shown as verified | Disable public sign-in; preserve logs; notify the owner immediately; root cause before re-enabling; inform affected customers within 72 h (GDPR Art. 33 where personal data is involved) |
| SEV-2 | Database unreachable, ingestion corrupted, billing double-charges | Status notice; fix forward; post-incident review within 5 days |
| SEV-3 | Degraded performance, a single failing source | Ticket; fix in the next release |

**Support access** (ADR-0002 item 4): an operator requests it with a ticket reference (`support_access_request`); only the customer approves it; it is read-only, it expires automatically, and the customer can revoke it at once. Never ask a customer for their password.

## 6. Performance baseline (local, 2026-11-12, 20 concurrent clients)

| Endpoint | Throughput | p50 | p95 | p99 | Errors |
|---|---|---|---|---|---|
| `GET /api/health` | 216.6 req/s | 86 ms | 147 ms | 161 ms | 0 |
| `GET /api/v1/research/runs/{id}` | 175.8 req/s | 109 ms | 167 ms | 203 ms | 0 |
| `GET /dashboard` (server-rendered) | 70.9 req/s | 282 ms | 346 ms | 351 ms | 0 |
| `GET /matters` (server-rendered) | 69.5 req/s | 288 ms | 337 ms | 365 ms | 0 |

Re-run with `scripts/perf/load-test.mjs` against staging before launch and record the result here.

## 7. Key and secret rotation

| Secret | Where | Rotation |
|---|---|---|
| Database password | Supabase dashboard, GitHub secret `SUPABASE_DB_URL` | On staff change or suspicion |
| Publishable key | Web deployment environment | With Supabase key rotation |
| Billing webhook secret | `private.billing_provider_settings` and the provider dashboard | Yearly, or on suspicion; update both together |
| Customer API keys | Customers revoke and reissue (`/organisation`) | They expire after at most 365 days |
