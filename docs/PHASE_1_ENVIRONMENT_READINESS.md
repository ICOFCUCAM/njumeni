# Phase 1 task 1.2 — Dedicated Njumeni environment readiness assessment

- **Review date:** 10 November 2026
- **Task:** Verify dedicated Njumeni identity/database environment readiness
- **Result:** **ENVIRONMENT VERIFIED — dedicated Njumeni Supabase project provisioned**
- **Project:** `Njumeni`
- **Project reference:** `vvjpsejeeffykaozfbik`
- **Region:** `eu-north-1` (Stockholm, Sweden)
- **Organization:** `ICOFCUCAM's Org` (`dqldzokgvcgbkzkxbrdr`)
- **Project status at verification:** `ACTIVE_HEALTHY`
- **Database engine:** PostgreSQL 17.11 (`17.11.0.018`)
- **API URL:** `https://vvjpsejeeffykaozfbik.supabase.co`
- **Quoted project cost at creation:** USD $0/month, monthly recurrence, for the selected organization at the time of provisioning
- **Provisioned:** 10 November 2026
- **Scope:** project identity, hosted Postgres/Auth/Storage schema readiness, migration baseline, API key availability and Supabase advisors. No application schema, user account, storage bucket, secret configuration or customer record was created.

## 1. Provisioning evidence

The dedicated project was created through the authenticated Supabase integration after:
1. confirming the organization `ICOFCUCAM's Org`;
2. retrieving the project-specific cost quote of USD $0/month;
3. receiving the owner's explicit approval of that quote;
4. obtaining the required cost-confirmation ID; and
5. creating the project in the owner-selected `eu-north-1` region.

The project details endpoint returned:
- name: `Njumeni`;
- project reference: `vvjpsejeeffykaozfbik`;
- organization ID: `dqldzokgvcgbkzkxbrdr`;
- region: `eu-north-1`;
- status: `ACTIVE_HEALTHY`;
- database host: `db.vvjpsejeeffykaozfbik.supabase.co`;
- PostgreSQL version: `17.11.0.018`.

The project URL endpoint returned `https://vvjpsejeeffykaozfbik.supabase.co`. A modern Supabase publishable key is available for future client configuration. Key material is intentionally not copied into this document or committed to Git. No secret/service-role key was requested or exposed in the repository.

The $0/month amount is the project-specific quotation returned at creation time, not a promise of unlimited usage or a guarantee that future usage, add-ons, plan changes or overages will remain free.

## 2. Database and built-in service inspection

Read-only inspection of the dedicated database confirmed:

| Check | Observed result |
|---|---|
| Database connection | Successful SQL execution |
| PostgreSQL | 17.11 |
| Core Supabase schemas | `auth`, `storage`, `public`, `extensions`, `vault` present |
| Auth user records | 0 |
| Auth schema | Built-in Auth tables, including users and sessions, present |
| Storage schema | Built-in Storage tables present |
| Storage buckets | 0 |
| Application tables in `public` | 0 |
| Njumeni migration history | 0 migrations |
| `pgcrypto` | Installed |
| `vector` | Available, not yet installed |
| Supabase security advisor | No findings returned |
| Supabase performance advisor | No findings returned |
| Supabase health advisor | No findings returned |

The `auth.users` and `storage.buckets` tables are provider-managed infrastructure tables, not Njumeni application tables. No application schema or policy has been created. The vector extension is deliberately not installed during this environment-verification task; its installation and use belong to a reviewed, version-controlled migration when the database foundation task requires it.

## 3. Verification limits and remaining configuration

The project-level status is `ACTIVE_HEALTHY`, SQL connectivity is confirmed, built-in Auth and Storage schemas are present, a publishable key is available, and the security/performance/health advisors returned no findings.

The connected Supabase toolset does not expose the Management API's per-service health endpoint or the complete Auth configuration read endpoint. Therefore this assessment does **not** claim independent service-by-service Auth API health verification, nor does it claim that sign-up policy, redirect allow-lists, SMTP, MFA enforcement, password policy or production Auth settings have been configured. Those settings must be deliberately reviewed as part of Task 1.3 before enabling user authentication.

No test user was created and no sign-in was simulated. No storage bucket or access policy was created. No application migration was applied. No other product's Supabase project was queried or changed.

## 4. Security and environment boundaries

- This project is dedicated to Njumeni; SocialOS, OpsCommand, FlyttGo and all other product databases remain separate.
- No customer legal documents, case files, evidence or confidential records may be uploaded at this stage.
- No Supabase secret/service-role key may be exposed to browser code, Git, CI output or untrusted workers.
- Only the publishable key may eventually be used in browser-side configuration; all privileged keys remain server-side and are not committed.
- The GitHub repository remains public at the time of this assessment, despite the original plan's private-repository requirement. This is a separate owner-level source-code exposure risk; do not commit real deployment credentials or confidential configuration. The visibility change has not been made automatically.
- The Free organization plan and $0/month project quote do not provide production-grade backup, availability or unlimited capacity guarantees. Production use requires a separate capacity, backup, recovery, data-processing and hosting-approval decision.

## 5. Acceptance evidence

- [x] Connected organization verified.
- [x] Project-specific cost quoted and explicitly approved by the owner.
- [x] Dedicated Njumeni project created in the owner-selected `eu-north-1` region.
- [x] Project identity and project-level `ACTIVE_HEALTHY` status verified.
- [x] PostgreSQL connection and server version verified with read-only SQL.
- [x] Built-in Auth and Storage schemas verified.
- [x] Empty Auth user table, Storage bucket inventory and public application schema verified.
- [x] Hosted Njumeni migration history verified empty.
- [x] Publishable key availability verified without copying key material into Git.
- [x] Security, performance and health advisors returned no findings.
- [x] No other product project or customer data was modified or inspected.
- [ ] Task documentation commit and repository CI verification completed.

**Environment result:** provisioned and verified for Phase 1 Task 1.2.  
**Task status:** IN PROGRESS pending the documentation commit and successful repository CI verification.  
**Next task after acceptance:** Task 1.3 — implement identity provider integration and secure session lifecycle.
