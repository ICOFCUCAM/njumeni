# Njumeni infrastructure and hosting audit

- **Status:** Phase 0 task 0.13 — completed as a read-only inventory and gap assessment
- **Audit date:** 10 November 2026
- **Repository:** `ICOFCUCAM/njumeni`
- **Branch inspected:** `claude/wonderful-franklin-lt09d7`
- **Scope:** GitHub repository and CI, Vercel deployment context, Supabase project inventory, web runtime, domains, configuration, secrets boundaries, data services, queues, AI providers and operational infrastructure
- **Method:** Read-only inspection. No project, deployment, domain, database, secret, bucket, queue or provider configuration was created, changed or deleted.

## 1. Executive finding

**Njumeni has a working web application foundation shell, but it is not yet deployed as a Njumeni application and has no Njumeni production data infrastructure.**

The connected Vercel account has a separate `njumeni-marketing-website` project linked to `ICOFCUCAM/marketing-website`, not to this repository. **No Njumeni application project/deployment is linked.** The connected Supabase project inventory contains no project identifiable as Njumeni. The repository has no Supabase configuration, migrations, API/worker/scheduler services, object-storage configuration, Redis/queue configuration, infrastructure-as-code, custom domain or production provider credentials.

The current web health endpoint explicitly reports `authenticationConnected: false` and `databaseConnected: false`. This is consistent with the verified repository state: the web shell is a route/layout foundation, not an operational legal platform.

## 2. Verified infrastructure inventory

| Area | Verified current state | Assessment |
|---|---|---|
| GitHub repository | `ICOFCUCAM/njumeni` exists and is reported **PUBLIC**. Its default branch is `claude/wonderful-franklin-lt09d7`. | **Owner decision required:** the original source specifies a private repository. Public visibility exposes source code and architecture for copying. No visibility change was made. |
| Repository source | Original 20-section plan, product/architecture docs, web shell and CI are present. No customer legal files or live matter records were found in the tracked tree. | Keep confidential records, production exports and provider credentials out of Git. |
| CI/security | Formatting, lint, type-check, tests, migration guard, architecture integrity, repository content policy, Gitleaks and the web production build are active. Final combined run `42744161490` passed. | Foundation CI is operational; production deployment is not. |
| Vercel account context | The connected Vercel team reports the Hobby plan. No linked project is connected to `ICOFCUCAM/njumeni`. | No Njumeni application deployment target is configured. |
| Vercel marketing project | `njumeni-marketing-website` is linked to `ICOFCUCAM/marketing-website`, branch `main`, not this application repository. Its latest deployment reports `READY` with target `production`; the project metadata reports `live: false`. | Separate marketing property; do not treat it as the Njumeni application deployment. |
| Marketing project domain/security | The domain inventory lists `njumeni-marketing-website.vercel.app` as verified. No custom domain is configured. SSO protection is enabled for deployments except custom domains; no custom domain is present. | This is not a production Njumeni application domain. |
| Supabase | The connected Supabase organisation/project inventory contains no project identifiable as Njumeni. No Njumeni project ID, region, database URL or hosted Auth project was verified. | No Njumeni hosted database/Auth service is provisioned in the connected account. No other product's database was inspected or modified. |
| Supabase repository config | No `supabase/config.toml`, `supabase/migrations/` or Njumeni Supabase Edge Function directory exists in the repository tree. | No Njumeni Supabase deployment or migration history can be claimed. |
| Database | No Njumeni database connection is configured. The health route reports database disconnected. | Not provisioned. |
| Authentication/tenancy | The sign-in page is an explicit placeholder. The health route reports authentication disconnected. | Not provisioned; Phase 1 remains responsible for identity, tenancy, server-side guards and RLS. |
| Object storage | No provider, bucket, endpoint, access policy or storage adapter is configured. `.env.example` contains placeholder variable names only. | Not provisioned. Confidential legal documents must not be uploaded to the current shell. |
| Redis/queues | No Redis provider, queue configuration, BullMQ worker or queue service exists in the repository. | Not provisioned. |
| API/worker/scheduler | No `apps/api`, `apps/worker` or `apps/scheduler` package exists. | Not provisioned. The modular-monolith decision remains; future worker/scheduler processes are deployment roles, not a microservice mandate. |
| AI providers | `AI_PROVIDER_DEFAULT=mock` in the placeholder environment template. Provider key names are present as empty placeholders; no live provider connection was verified. | Mock mode only. No legal content should be sent to external AI providers until provider, purpose, data class, region, retention and contract are approved. |
| Domains/DNS/WAF | No Njumeni application domain, DNS record, Cloudflare configuration or WAF policy was verified. | Not provisioned. |
| Secrets | `.env.example` contains placeholders. `.gitignore` excludes real `.env` files and key/certificate files. Gitleaks passed in the recorded CI run. | No secret values were read or copied into this audit. Repository/repository-environment secret metadata was not accessible through the connected GitHub read action, so this audit does not claim that no GitHub secrets exist. |
| Branch protection | The repository's default branch is known; branch protection/ruleset settings were not exposed by the connected GitHub read action. | **Unverified**, not assumed absent or present. |
| Monitoring/telemetry | No Sentry, OpenTelemetry collector, production log service, metrics or alerting configuration was found. | Not provisioned. |
| Backups/DR | No Njumeni database or object store exists to back up; no provider backup policy, restore exercise, RPO or RTO was verified. | Not provisioned. |
| Region/data residency | No Njumeni database, object-storage or worker region has been selected or verified. | Open owner decision; do not inherit a region chosen for another product. |
| Containers/IaC | No Dockerfile, Compose file, Terraform state/configuration or infrastructure directory exists in the repository tree. | No reproducible containerised full-stack environment or IaC deployment is present. |

## 3. Runtime and configuration facts

The current web package pins:

- Node.js: `>=22.13.0 <23`
- Next.js: `16.4.5`
- React / React DOM: `19.3.1`
- Tailwind CSS: `4.3.5`
- TypeScript: `5.9.3`

The committed npm lockfile supports reproducible installation for the web package. The package provides `dev`, `build`, `start` and `typecheck` scripts.

The placeholder environment template declares names for public Supabase client configuration, server-only Supabase/database credentials, Redis, object storage and OpenAI/Anthropic provider keys. Values are examples/placeholders only. The template sets the AI provider default to `mock`; it is not evidence that any of those services are provisioned.

The web health endpoint returns service/mode metadata and explicitly reports both authentication and database as disconnected. The sign-in route explicitly states that no sign-in is being simulated.

## 4. Security and ownership risks

### P0 — repository visibility conflicts with original plan

GitHub currently reports this repository as public, while the original Njumeni source calls for a private application repository. Public visibility does not itself expose customer records or secrets found in the current tree, but it does expose proprietary implementation, product architecture and future development history.

**Recommendation:** change the repository to private before confidential implementation details, deployment configuration or partner-specific material are added. This is an owner-level visibility change and was not performed automatically because it can affect collaborators, external access and integrations.

### P0 — no production trust boundary exists yet

There is no Njumeni authentication, tenant resolution, RLS, private object storage, audit service, provider-egress control or production database. The preview must not accept customer legal documents or real matters.

### P1 — default branch and protection policy

The default branch is a Claude working branch. A stable protected release branch, required status checks, review policy and deployment promotion policy should be established before production deployment. Current branch protection was not verifiable through the connected read action.

### P1 — no production hosting or data residency decision

No Njumeni Vercel app, Supabase project, custom domain, object store, queue, worker host, monitoring service or backup service is provisioned. Hosting region and data residency must be selected for Njumeni itself, not inferred from another product.

### P1 — provider egress and legal confidentiality

The mock AI default is appropriate for the current shell. Real AI providers must remain disabled until legal-data classification, purpose limitation, contractual processing, region, retention/training terms and human-review controls are approved.

## 5. Recommended provisioning sequence — proposals, not existing infrastructure

1. Resolve GitHub repository visibility and default-branch protection.
2. Select Njumeni hosting and deployment ownership; create a dedicated Vercel project only if Vercel is approved for the application.
3. Select and create a dedicated Supabase project, region and Auth/database configuration for Njumeni; never reuse another product's project.
4. Establish private object storage, encryption/key management, retention and legal-hold controls.
5. Provision Redis/queue and the separately deployed worker/scheduler runtime when their numbered phases require them.
6. Configure the Njumeni domain, DNS, TLS, WAF and access policies.
7. Establish managed secrets, audit/telemetry, budget controls and provider-egress restrictions.
8. Define encrypted backups, restore tests, RPO/RTO, incident response and production access.
9. Promote only reviewed commits through CI and isolated staging into production.

No provider, project, domain, region, bucket or secret value is selected by this audit.

## 6. Explicit limitations of this audit

- GitHub branch protection, rulesets and Actions secret/variable metadata were not available through the connected GitHub read action. No claim is made about their existence or values.
- DNS/Cloudflare configuration and any Hetzner host were not inspected; no Njumeni domain or server reference was present in the repository or connected Vercel context.
- Vercel project details were inspected only for the separate marketing project. No environment-variable values were requested or read.
- Supabase project inventory was checked for Njumeni identity only. No other product's tables, records, secrets or data were queried.
- No live customer data, legal records, provider credentials or production secrets were accessed.

## 7. Task 0.13 acceptance

- [x] GitHub repository visibility/default branch and CI footprint recorded.
- [x] Vercel linked-project context, matching marketing project, deployment state and domain inventory recorded.
- [x] Supabase project inventory checked for a dedicated Njumeni project.
- [x] Database, Auth, RLS, storage, queue, worker, scheduler and AI-provider state recorded as present, absent or unverified.
- [x] Environment template, ignore policy and secret-scanning evidence reviewed without exposing secret values.
- [x] Domain, region, monitoring, backup, disaster-recovery and IaC gaps recorded.
- [x] Owner decisions and recommended provisioning sequence separated from verified facts.
- [x] No external resources or production data changed.

**Conclusion:** task 0.13 is complete as an infrastructure audit. Infrastructure provisioning and owner decisions remain future work; this completion must not be interpreted as a deployed or production-ready Njumeni platform.


## 8. Phase 1 provisioning update — 10 November 2026

The Phase 0 audit above remains a historical read-only inventory. The following dedicated Njumeni environment was provisioned afterward to resolve the Phase 1 Task 1.2 blocker.

| Area | Updated verified state | Boundary / remaining work |
|---|---|---|
| Dedicated Supabase project | `Njumeni`, ref `vvjpsejeeffykaozfbik`, organization `ICOFCUCAM's Org`, region `eu-north-1` (Stockholm), project status `ACTIVE_HEALTHY`. | Dedicated Njumeni project only; no other product project reused. |
| Project cost | Project-specific quote at creation: USD $0/month, monthly recurrence, approved by owner. Organization plan at verification: Free. | Quote is time-specific and does not mean unlimited usage, paid add-ons or production capacity. Recheck before any plan/compute changes. |
| PostgreSQL | PostgreSQL 17.11 (`17.11.0.018`); read-only SQL connectivity succeeded. | No Njumeni application tables or migrations yet. |
| Auth | Built-in `auth` schema and user/session tables present; user table empty; modern publishable key available. | Auth Management API service health/configuration endpoints were not exposed by the connected toolset. Do not claim sign-in is configured or tested. |
| Storage | Built-in `storage` schema present; bucket inventory empty. | No private Njumeni bucket or object policies created. |
| Extensions | `pgcrypto` installed; `vector` available but not installed. | Extension installation deferred to a reviewed migration. |
| Advisors | Security, performance and health advisors returned no findings at this empty baseline. | Re-run after each schema/security change; empty-baseline results are not an application security audit. |
| Application integration | Supabase project URL and publishable-key availability verified. | No application credentials written to Git, no app runtime integration and no confidential content enabled. |

The repository remains public, contrary to the original plan's private-repository requirement. This risk remains owner-controlled and unresolved; no visibility setting was changed. The current web shell remains disconnected from Supabase until the numbered identity integration task is implemented and tested.

See [Phase 1 environment readiness](PHASE_1_ENVIRONMENT_READINESS.md) for the task-level evidence and limitations.
