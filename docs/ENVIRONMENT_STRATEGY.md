# Njumeni environment strategy

- **Status:** Phase 0 task 0.9 strategy deliverable
- **Scope:** local development, automated test/CI, staging and production
- **Repository:** ICOFCUCAM/njumeni
- **Architecture:** private modular monolith; see ADR-0001
- **Important:** this document distinguishes confirmed repository facts from recommended environment design. It does not claim that cloud projects, domains, services, regions, credentials or deployments already exist.

## 1. Verified current state

| Item | Verified status |
|---|---|
| GitHub repository | ICOFCUCAM/njumeni exists; active branch is claude/wonderful-franklin-lt09d7 |
| Repository visibility | GitHub metadata currently reports PUBLIC. This conflicts with the original plan's requirement that the application repository be private and must be resolved in the Phase 0 security/hosting review before sensitive source or deployment configuration is added. |
| Application package manifest | No root package.json is currently present |
| Application runtime | No runnable Njumeni web/API/worker application has been verified in this repository |
| Local environment | No reproducible local application setup has been verified |
| CI | Repository-security workflow exists and runs content-policy and Gitleaks checks; full build/test/type/lint CI is not yet implemented |
| Supabase project | No Njumeni-specific project ID, URL, region or hosted database was verified in this task |
| Vercel project | No Njumeni-specific project/deployment was verified in this task |
| Redis, object storage, worker hosting, domains and AI provider credentials | Not verified as provisioned for Njumeni |
| Environment secrets | No real secrets are recorded in this document or repository |

Earlier architecture discussions proposed Vercel for the web application, Supabase for PostgreSQL/Auth/RLS/pgvector, Redis/BullMQ, S3-compatible object storage, Cloudflare for DNS/WAF, a dedicated worker host and GitHub Actions/Vercel CI/CD. These remain **proposals**, not verified Njumeni infrastructure.

## 2. Environment separation

Njumeni must maintain four distinct environments. Production data, credentials and provider accounts must never be reused in local, CI or staging.

| Environment | Purpose | Data | Services and controls | Deployment / promotion |
|---|---|---|---|---|
| Local development | Individual developer implementation and debugging | Synthetic fixtures only; no copied production matters or confidential documents | Local Node.js toolchain; local database/auth/storage/queue substitutes or isolated local services; safe mock AI adapters; .env.local ignored by Git | Developer-controlled; changes flow through reviewed commits |
| Test / CI | Deterministic automated quality, integration, security and migration tests | Synthetic, generated or properly anonymised fixtures only | Ephemeral database and storage; isolated queue; mocked external providers by default; secret scanning; no production credentials | GitHub Actions on pull requests and protected-branch pushes |
| Staging | Production-like end-to-end acceptance, integration and release rehearsal | Synthetic or explicitly approved anonymised test data only; never production matter data by default | Separate cloud project/account, database, storage bucket, queue, AI credentials, auth settings and domains; production-like policies | Deploy only from reviewed commits after CI passes; explicit release approval |
| Production | Live customer legal work | Customer data under approved contracts, classification and retention controls | Isolated production project/account, private storage, managed secrets, encryption, least privilege, audit, backups, monitoring, incident response and approved providers | Protected release promotion; reviewed migration; controlled rollout and rollback/forward-fix |

No environment may share writable databases, storage buckets, encryption keys, auth secrets or service-role credentials with another environment.

## 3. Logical service topology

The following is the recommended logical topology, not a statement that these services are already provisioned.

| Capability | Local | Test / CI | Staging | Production |
|---|---|---|---|---|
| Web experience | Local Next.js dev server | Build and browser tests | Isolated staging web deployment | Production web deployment |
| API/application | Local app process | Unit/API/integration tests | Staging application runtime | Production application runtime |
| Database | Local PostgreSQL-compatible environment | Disposable PostgreSQL database | Separate managed PostgreSQL project | Separate managed PostgreSQL project |
| Authentication | Local auth emulator/service | Test identity fixtures | Staging auth tenant/project | Production auth tenant/project |
| Vector retrieval | pgvector extension where supported | pgvector integration tests | Separate staging database/index | Production database/index with backups |
| Object storage | Local S3-compatible emulator or isolated local storage | Ephemeral test bucket | Separate staging bucket | Private production bucket with lifecycle/retention policy |
| Queue/cache | Local Redis-compatible service | Ephemeral isolated Redis | Separate staging Redis | Production Redis with access controls and monitoring |
| Background work | Local worker process | Worker integration tests | Staging worker runtime | Independently scalable production worker runtime |
| Scheduler | Local/manual test trigger | Deterministic scheduled-job tests | Staging scheduler | Production scheduler with idempotency and alerting |
| AI/model providers | Mock by default; explicit developer opt-in | Mock by default; controlled evaluation endpoint only | Separate staging credentials and data-egress policy | Approved provider accounts, contractual controls, budget limits and egress policy |
| Observability | Local structured logs | CI logs without sensitive payloads | Staging telemetry | Production monitoring, alerting, audit and incident response |

The modular monolith remains the product architecture. Separate worker/scheduler processes are deployment roles, not separate domain ownership or approval for a microservice fleet.

## 4. Configuration and secret boundaries

- Commit only a placeholder .env.example file.
- Real environment files, local overrides and credential files must remain ignored by Git.
- CI secrets belong in GitHub Actions environment/repository secrets with the narrowest possible scope.
- Staging and production credentials must be stored in their respective hosting secret managers; never copy production secrets into GitHub Actions or local machines.
- Browser-exposed variables must be explicitly classified as public. A public key is not an authorisation mechanism.
- Service-role, database-owner, object-storage, Redis, encryption and AI-provider credentials are server-only.
- Never print environment values, full provider responses or secret-bearing configuration in CI logs.
- Rotate credentials after suspected exposure; deleting a secret in a later commit does not remove it from Git history.

### Configuration categories

| Category | Example variable names | Exposure |
|---|---|---|
| Environment identity | APP_ENV, APP_BASE_URL, LOG_LEVEL | Public only where non-sensitive |
| Public auth/client config | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | Browser-visible; must still rely on server/RLS authorisation |
| Server auth/database | SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL | Server-only |
| Queue | REDIS_URL | Server-only |
| Object storage | OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, OBJECT_STORAGE_SECRET_ACCESS_KEY | Server-only |
| AI providers | OPENAI_API_KEY, ANTHROPIC_API_KEY, AI_PROVIDER_DEFAULT | Server-only; provider egress policy applies |
| Security/crypto | APP_ENCRYPTION_KEY or managed-key reference | Server-only; prefer managed KMS/key service over static application secrets |
| Telemetry | OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS | Endpoint may be public; headers are secret |

Variable names are illustrative configuration contracts, not confirmation that these providers or values have been selected. Exact required variables must be finalised alongside the implementation and deployment adapters.

## 5. Data and security invariants across environments

1. Local and CI fixtures must be synthetic or properly anonymised and must not contain live legal records.
2. Staging must not be populated by copying production documents, database snapshots or object-storage buckets.
3. Production object storage is private by default; all reads and downloads are mediated by server-side authorisation.
4. Tenant and matter isolation must be enforced by application services and database/storage policies.
5. Provider egress is disabled by default until the user-authorised purpose, data classification, contract, region, retention and training-use terms are approved.
6. No officially classified information is accepted until the environment and all relevant providers are authorised for the applicable classification.
7. Audit records, logs, caches, search indexes, embeddings, exports and backups are treated as potentially sensitive copies.
8. Retention, legal hold, deletion, backup and restore requirements apply to all copies, not only primary database rows.
9. Staging and CI must use separate signing/encryption keys and separate auth/identity tenants.
10. Production access is least-privilege, time-bounded where possible, attributable and audited.

## 6. Build, test and promotion flow

1. Developer creates a focused change against the active Phase Register task.
2. Local formatting, lint, type and relevant tests run using pinned tool versions once established.
3. Pull request runs content-policy, secret, formatting, lint, type, unit, integration, build and security checks as those controls are added in task 0.10.
4. Review confirms architecture boundaries, data permissions, migration safety, provider egress, licence and legal provenance impacts.
5. Merge produces an immutable commit artifact.
6. Staging deploys that exact commit; migrations and end-to-end workflows are tested against isolated staging services.
7. Release approval promotes the same reviewed artifact to production; rebuilds from a different source state are not silently substituted.
8. Database changes use the migration discipline in task 0.11; destructive production migrations require a verified backup and explicit release approval.
9. Rollback/forward-fix, monitoring and incident response are documented and rehearsed before launch.

## 7. Backup, restore and disaster recovery

- Define database, object-storage, queue and encryption-key backup responsibilities before production.
- Database backups alone are insufficient: document originals, versions, extracted artefacts and metadata relationships must be recoverable.
- Backups must be encrypted, access-controlled, retained according to policy and tested through restoration.
- Restore tests must verify referential integrity, object checksums, evidence provenance, tenant boundaries and audit continuity.
- Staging restore exercises use synthetic data.
- Recovery time and recovery point objectives remain open decisions until service criticality, provider capability and commercial requirements are assessed.
- Queue messages must be replay-safe; workers must be idempotent and must re-authorise at execution time.

## 8. Provider and deployment decisions still open

These are explicit gates for task 0.13 and must not be filled with assumptions:

- Exact GitHub repository visibility and branch protection policy.
- Exact Vercel project/team, domains, regions and deployment settings, if Vercel is selected.
- Exact Supabase project IDs, regions, database settings, Auth configuration, RLS and pgvector extension status, if Supabase is selected.
- Redis provider/region, persistence and availability configuration.
- Object-storage provider, region, encryption, lifecycle and retention.
- Worker/scheduler hosting provider and network access.
- DNS/WAF/CDN ownership and production domain records.
- AI provider contracts, data processing terms, regions, retention/training settings and approved model list.
- Monitoring, alerting, secrets management and key-management services.
- Backup retention, RPO/RTO, incident response and disaster recovery.

## 9. Acceptance criteria for task 0.9

- [x] Local, test/CI, staging and production responsibilities are defined.
- [x] Data and credential separation rules are defined.
- [x] Logical web/API/worker/scheduler/database/storage/queue/AI topology is documented.
- [x] Build, test, staging and production promotion flow is documented.
- [x] Backup/restore and classified-data exclusions are recorded.
- [x] Verified current facts are distinguished from proposals and unknowns.
- [ ] Exact provider-specific project IDs, regions, domains and deployment settings are verified in task 0.13; this is not a prerequisite to approve the environment strategy.
- [ ] Reproducible local scripts/containers and CI environment are implemented in the later numbered setup tasks; this document defines the strategy, not an already running environment.
