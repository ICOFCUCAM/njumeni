# Njumeni Phase 1 — Acceptance and closeout report

| Field | Value |
|---|---|
| Phase | 1: Identity, tenancy and security foundation |
| Repository | `ICOFCUCAM/njumeni` (public; ADR-0003) |
| Branch | `claude/nice-darwin-hu9xau` |
| Verification base | `929f61b` plus the closeout documentation commit |
| Verification environment | Ephemeral **local** Supabase stack (CLI 3.1.0, Docker) in the development container. **The hosted project `Njumeni` was not used and has no migrations applied** (deployment deferred until all phases are complete; ADR-0003 §2.5) |
| Prepared | 11 November 2026 |
| Decision | **READY FOR CLOSEOUT: one manual CI run outstanding** (§6) |

## 1. Executive summary

Every Phase 1 task is implemented. The full verification has been run locally and passes:
- 23 migrations replay from empty;
- 272/272 pgTAP assertions pass;
- schema lint is clean;
- the live Auth lifecycle passes;
- 161 application tests pass;
- the type check and production build pass.

The three test files that failed in CI on `2b60d5f` had **fixture defects, not policy defects**, and are fixed. The only remaining closeout condition is the owner-agreed manual run of the CI workflows, which are paused (§6). After that run, Phase 1 is closed and tagged `phase-1-closed`.

No customer data, confidential legal material or hosted deployment is authorised by this acceptance. Those remain gated by Stage 1 and by Phase 13.

## 2. Task acceptance

| Task | Scope | Result | Evidence |
|---|---|---|---|
| 1.1 | Security contracts | ✅ Accepted | ADR-0002 now **Accepted**, with §12 decisions resolved or deferred to named phases |
| 1.2 | Environment readiness | ✅ Accepted | Project `vvjpsejeeffykaozfbik` (`eu-north-1`); commit `4fdc1e8`; CI `42772065771` |
| 1.3 | Auth and session lifecycle | ✅ Accepted | Mocked suite; owner manual check; **live lifecycle test passed** (§3.4) |
| 1.4 | Principal and profile | ✅ Accepted | `profile_security` pgTAP passes; earlier CI `42846043378` |
| 1.5 | Organisations and workspaces | ✅ Accepted | `organisation_workspace` pgTAP passes; earlier CI `42848567330` |
| 1.6 | Memberships and invitations | ✅ Accepted | `membership_invitation` pgTAP passes; earlier CI `42855740121` |
| 1.7 | RBAC and server authorisation | ✅ Accepted | `role_permission` pgTAP **60/60** (fixture corrected; new negative test added) |
| 1.8 | RLS and storage policies | ✅ Accepted (database policy level) | `storage_isolation` pgTAP passes; the upload UI is Phase 3 |
| 1.9 | Security audit logging | ✅ Accepted with deferrals | `security_audit` pgTAP **12/12**; provider auth events in `auth.audit_log_entries`; deferrals in §5 |
| 1.10 | Subscription identity and entitlements | ✅ Accepted with a finding | `subscription_entitlements` pgTAP passes; finding F-1 in §5 |
| 1.11 | Isolation and security verification | ✅ Accepted | All nine pgTAP files pass in one run (§3.2) |

## 3. Verification evidence (local, 11 November 2026)

### 3.1 Migration replay and lint

| Check | Command | Result |
|---|---|---|
| Clean replay | `supabase db reset` | ✅ 23 migrations applied from empty |
| Schema lint | `supabase db lint --level error` | ✅ `results: []` for `public` and `private` |
| Migration guard | `MIGRATION_BASE_SHA=b7123a0 GITHUB_SHA=HEAD node scripts/ci/check-migrations.mjs` | ✅ Pass. It fails without the new hash-pinned correction, which confirms the guard is effective |

### 3.2 Database tests (`supabase test db`)

| File | Result |
|---|---|
| `legal_knowledge_foundation` (Phase 2) | ✅ 69/69 |
| `membership_invitation` | ✅ |
| `organisation_workspace` | ✅ |
| `phase1_security_contract` | ✅ |
| `profile_security` | ✅ |
| `role_permission` | ✅ 60/60 |
| `security_audit` | ✅ 12/12 |
| `storage_isolation` | ✅ |
| `subscription_entitlements` | ✅ |
| **Total** | **✅ 272/272, 9 files, `Result: PASS`** |

### 3.3 Application checks

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ |
| `npm test` (auth, profile, tenancy, invitations, RBAC, storage, and legal knowledge) | ✅ 161/161 |
| `npm run build` (placeholder Supabase values) | ✅ |
| Root tests `node --test tests/*.test.mjs` | ✅ 19/19 |
| CI Prettier file set | ✅ |
| Foundation integrity, repository content policy | ✅ |
| Database type drift | ✅ Regenerated from the schema with CLI 3.1.0; CI now fails on drift |

### 3.4 Live Auth lifecycle

`npm run test:auth-integration` ran against the **local Supabase Auth service**, with a synthetic identity created through the admin API and deleted afterwards (HTTP 200). The test covered sign-in, server-verified user, session refresh, sign-out, and **rejection of the revoked refresh token**: ✅ 1/1.

The provider recorded `login`, `logout`, `token_refreshed`, `token_revoked`, `user_signedup` and `user_deleted` in `auth.audit_log_entries`.

### 3.5 Defects found and fixed during verification

| ID | Defect | Fix |
|---|---|---|
| B-1 | A correction to migration `…290000` was not hash-pinned | Added to `migration-predeployment-corrections.json` |
| B-2 | RBAC test ran an "administrator" step as a plain member; read a private table as `authenticated` | Fixture reordered; negative member test added; `reset role` before private inspection |
| B-3 | Audit fixture inserted two rows; scalar subqueries failed | Single fixture row |
| B-4 | Legal-knowledge test: corrupted `$$`, wrong `tsvector` check, superseded signature | Repaired; now asserts no unleased append RPC exists |
| B-5 | Worker missing `server-only` | Dependency pinned (`0.0.1`) |
| B-6 | (Withdrawn) legal-knowledge tests thought missing from CI | Already covered; explicit `npm test` added |
| B-7 | Stale generated types hid `null` misuse of optional RPC arguments | Types regenerated; three call sites fixed; drift check added |
| — | Health endpoint reported auth and database as disconnected | Now reports Auth integrated and a database-configured boolean, without exposing values |

## 4. Security residuals and accepted risks

| Item | Disposition |
|---|---|
| Public repository | **Accepted by decision** (ADR-0003: build in public; open code, closed data) |
| Leaked-password protection unavailable (Supabase Free) | **Accepted Stage 0 risk** (ADR-0003 §2.6, decision D-6); enable at Stage 1 |
| MFA not yet available | Required before R1 |
| Region and data residency | Database in `eu-north-1`; EU/EEA for all components recommended (D-8), before Stage 1 |
| Break-glass support access | No operator access to matters exists; defined in Phase 10, before any customer data |
| Hosted deployment | None until all phases are complete (ADR-0003 §2.5) |
| Background jobs | Only the legal-knowledge worker exists. It handles public legal sources under the service role and never tenant data. Tenant-scoped jobs (Phase 3+) must resolve tenant context from persisted job state and re-check permissions |

## 5. Findings and deferrals carried forward

| ID | Item | Target |
|---|---|---|
| F-1 | `record_usage_event` is callable by `org_admin` with any positive quantity. There is no current exposure (no consumers, positive-only), but metering must originate from trusted server code | Phase 11: make server-only |
| D-AUD-1 | Failed sign-in and denied-access audit events | Phase 3 |
| D-AUD-2 | Hash-chained tamper evidence for audit (U-12) | ✅ Done in Phase 3 (`verify_security_audit_chain`) |
| D-AUD-3 | Audit retention, legal hold, export | Phase 3 |
| D-AUD-4 | The app sets `x-correlation-id` | ✅ Done in Phase 3 (server client header) |
| D-STO-1 | Upload UI, malware scanning, content addressing | Phase 3 |

## 6. Closeout conditions

| # | Condition | Status |
|---|---|---|
| 1 | All tasks 1.1–1.11 meet acceptance | ✅ |
| 2 | Full verification passes | ✅ locally (§3) |
| 3 | **`repository-security.yml` and `supabase-local.yml` green on GitHub Actions** (automatic CI re-enabled 11 November 2026; the runs on the Phase 3 commit qualify) | ⏳ Outstanding |
| 4 | Residuals resolved or formally accepted | ✅ (§4) |
| 5 | Consolidated `SECURITY_ARCHITECTURE.md` and `MULTITENANCY.md` | ✅ |
| 6 | Closeout commit and tag `phase-1-closed`; register updated | ⏳ After condition 3 |

**Decision: Phase 1 is ACCEPTED, conditional on condition 3.** When both manual workflow runs pass, record their run IDs here, set Task 1.12 and the phase to 🟢 CLOSED in the register, and tag the commit.
