# ADR-0003 — Build in public and staged zero-cost infrastructure

| Field | Value |
|---|---|
| Status | **Accepted** |
| Date | 2026-11-11 |
| Decision owner | Njumeni product owner |
| Supersedes | Original master plan §15 ("the repository should be private from the beginning"), §10.1 "Source control: Private GitHub repository" and §19 "Development: Private GitHub monorepo". Also changes how §10.1 background jobs and object storage are delivered at Stage 0 |
| Related | [NJUMENI_MASTER_PLAN.md](../NJUMENI_MASTER_PLAN.md) §11.7, §12.2, §14.1, §19; ADR-0001; ADR-0002; [SECURITY.md](../../SECURITY.md) |

## 1. Context

1. The original plan requires a private repository and a production-grade stack:
   - Vercel, Supabase, Redis/BullMQ, S3-compatible storage, Cloudflare, Sentry and dedicated workers.
2. The repository `ICOFCUCAM/njumeni` is public, and every Phase 0 and Phase 1 audit flagged this as a P0 risk.
3. The owner has decided **not to spend money for now** and **to build in public**.
4. The current implementation already uses the following, so Redis, BullMQ and a separate object store are not needed today:
   - a Postgres-backed durable queue (leases, retries, dead letters, checkpoints)
   - Supabase Storage policies
   - a single Supabase Free project (`Njumeni`, `eu-north-1`)

## 2. Decision

### 2.1 Build in public: open code, closed data

1. The repository stays **public**. Source code, migrations, RLS policies, tests, CI configuration and plans may be public.
2. The following MUST NEVER be committed, logged in CI or written into issues or pull requests:
   - customer data, documents, evidence and matter metadata
   - secrets
   - production configuration and backups
3. Security MUST NOT rely on secrecy of the code. Isolation is enforced by authentication, RLS, server-side authorisation and secret management.
4. CI logs on a public repository are public. Workflows MUST NOT print secrets, tokens or non-public data, and secret-bearing steps MUST mask their outputs.
5. Synthetic fixtures only. Legal-source content that is public law MAY appear in tests where its licence permits.

### 2.2 Licence posture

1. Public visibility is **not** an open-source licence. Until the owner chooses a licence, the code is **all rights reserved**.
2. Before accepting any external contribution, the owner MUST either:
   - choose a licence (proprietary source-available, open-core or open source), **and**
   - adopt a contributor agreement;

   or decline external contributions.

### 2.3 Staged infrastructure

| Stage | Trigger to enter | Character |
|---|---|---|
| **Stage 0 (now)** | — | Zero cost: Supabase Free, GitHub Actions on a public repository, local development, Postgres queue, Supabase Storage, mock AI, synthetic data only |
| **Stage 1 (pilot)** | First real (non-synthetic) user data, **or** any commercial use, **or** a backup/PITR requirement, **or** free-tier limits or pausing becoming disruptive | Paid database plan with backups, commercial-grade web hosting, DPAs with every subprocessor |
| **Stage 2 (production)** | Release R1 / commercial launch | Full topology from master plan §14.2 |

### 2.4 Component decisions at Stage 0

| Component | Decision | Graduation trigger |
|---|---|---|
| Job queue | Postgres durable queue (existing) | Throughput or latency SLOs the Postgres queue cannot meet → Redis/BullMQ behind the same interface |
| Object storage | Supabase Storage (S3-compatible API) | Volume, cost or residency needs → an external S3-compatible store |
| Web hosting | Local; Vercel Hobby only for **non-commercial** previews | Any commercial use → a paid plan (Hobby terms forbid commercial use) |
| Workers | Local, or scheduled GitHub Actions for **public legal sources only** | Confidential workloads → a private container host |
| Monitoring | Sentry free developer tier, structured logs | Stage 1 |
| Embeddings | Open multilingual model run locally or in the worker | Evaluation shows the need for a hosted model |
| LLM | Mock by default; pay-as-you-go only with hard caps | M1 demo or the Stage 1 pilot |

### 2.5 Migration deployment deferral (owner decision, 2026-11-11)

1. **All migrations are kept in the repository** under `supabase/migrations/` as the single cumulative schema history. None is deleted or squashed.
2. **No migration is applied to the hosted Supabase project until all phases are complete.** The cumulative set is deployed once, as part of Phase 13 (production hardening and launch), after a final clean replay, pgTAP run and owner sign-off.
3. Until then, migrations are run **only** on ephemeral local and CI stacks (`supabase db reset`) to test them. This is verification, not deployment.
4. Because no shared environment has received any migration, corrections to existing migration files remain permitted. Each correction MUST be hash-pinned in `scripts/ci/migration-predeployment-corrections.json`. Additive forward migrations are still preferred for substantive changes.
5. Any hosted deployment before Phase 13 requires a separate, explicit owner exception recorded in the phase register. Examples: the Milestone M1 public demo, or a Stage 1 pilot.

### 2.6 Accepted Stage 0 risks

| Risk | Mitigation | Re-evaluate at |
|---|---|---|
| Leaked-password protection unavailable on Supabase Free | Minimum password strength, MFA rollout (passkeys/TOTP), no customer data at Stage 0 | Stage 1 (enable) |
| No automated backups or PITR on the free tier | Synthetic data only; migrations replayable from Git | Stage 1 |
| Free project pauses after inactivity | Acceptable for development; not used for demos with SLAs | Stage 1 |
| Architecture and policies are publicly readable | Defence in depth; pgTAP negative tests; no reliance on obscurity | Continuous |
| The name is exposed before trademark clearance | Early knock-out search and primary domain acquisition (master plan U-24) | Before M1 |

## 3. Consequences

**Positive**
- Zero spend.
- Free CI minutes for public repositories.
- Transparency, and a way to build an audience.
- An existing implementation that already fits.

**Negative**
- Published history cannot be withdrawn.
- Competitors can read the design.
- Some security controls are deferred to Stage 1.
- The licence decision must not be forgotten.

**Required follow-ups**
- Update `SECURITY.md` with the build-in-public rules and a vulnerability disclosure route.
- Keep Gitleaks and the repository content policy blocking on every push.
- Review the workflows that auto-commit to the branch, so that they never commit generated secrets or data.
- Record D-1 (licence) and D-2 (domain/trademark) in the master plan's open decisions.

## 4. Reversal

The repository can be made private at any time without changing the architecture. Making it private does **not** remove history that has already been published or cloned. Treat anything already committed as public permanently.
