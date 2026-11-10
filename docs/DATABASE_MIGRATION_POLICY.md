# Njumeni database migration and schema-change policy

- **Status:** Phase 0 task 0.11 policy
- **Database direction:** PostgreSQL; Supabase CLI is the proposed migration workflow, pending final provider/project verification in task 0.13
- **Migration source of truth:** ordered, reviewed SQL migration files committed to this repository
- **Production rule:** forward-only schema evolution; no unreviewed direct remote DDL

## 1. Verified database/migration state as of 2026-11-10

| Item | Verified finding |
|---|---|
| Repository migration directory | No supabase/ or supabase/migrations/ directory existed at the start of task 0.11 |
| Supabase project reference in repository | No Njumeni-specific project ref/configuration is recorded |
| Supabase CLI config | No supabase/config.toml is present |
| Migration files | No Njumeni SQL migration files are present |
| Njumeni hosted project | The connected Supabase project listing contains no project explicitly named Njumeni; no project can be safely identified as the Njumeni database from the available evidence |
| Hosted migration history | Not inspected because no Njumeni-specific project ID has been identified. Other projects were not queried or modified. |
| Hosted schema drift | Not assessable until the Njumeni database project is identified |
| Production backup state | No Njumeni-specific database/backup configuration was verified |

This is an explicit zero-baseline, not permission to reuse another product's database. No SocialOS, FlyttGo, CMP, CivicOS or other project database may be linked to Njumeni merely because it is available in the same Supabase organisation.

## 2. Migration file creation and naming

- Use the Supabase CLI to create each migration with: supabase migration new descriptive_change_name.
- Do not manually invent timestamp filenames. The CLI generates the migration timestamp and filename.
- Keep the generated timestamp prefix and use a descriptive lowercase snake_case suffix.
- A migration file must be non-empty, reviewed SQL and committed in the same change as its schema-dependent code.
- Migration order is the CLI-generated timestamp order. Timestamps must be unique and strictly sortable.
- Every migration is append-only after it has been merged or applied to any shared environment.
- Never edit, rename, reorder or delete a committed/applied migration. Correct mistakes with a new forward migration.
- A migration that has been shared with another developer or applied to any shared database is immutable, even if it has not reached production.
- Keep data backfills separate from structural DDL when operational risk, runtime or rollback strategy differs.
- Keep synthetic development seed data separate from schema migrations. Never seed real customers, legal matters, evidence or confidential documents.

## 3. Local development and replay

After the Supabase CLI and Docker/local runtime are installed and pinned in the environment setup:
1. Start the local stack using the CLI command documented for the pinned CLI version.
2. Apply all migrations to the local database from a clean state.
3. Run the complete migration sequence and seed only synthetic fixtures.
4. Run the application, integration and RLS tests against the local database.
5. Reset the local database and replay all migrations from zero before merging any migration change.
6. Test upgrades from the previous released schema where data-preserving changes are involved.
7. Verify indexes, constraints, triggers, functions, grants, RLS policies, views and extensions after replay.

The exact CLI version and command flags must be pinned and verified when the local environment is provisioned. Do not use guessed flags. Run supabase --help, supabase db --help and the relevant command help against the installed version before use.

## 4. Review and immutable migration controls

Every migration pull request must include:
- the purpose and owning bounded context;
- affected tables, columns, functions, views, triggers, indexes, extensions and policies;
- tenant/workspace/matter security impact;
- forward compatibility and application deployment ordering;
- lock duration, table rewrite and availability risks;
- data migration/backfill volume and idempotency;
- backup/restore and forward-fix plan;
- tests for clean replay and upgrade from the previous schema.

The CI migration guard checks:
- generated timestamp filename shape;
- unique and ordered timestamps;
- non-empty SQL migration files;
- no modification or deletion of an existing migration relative to the PR/push base;
- new migrations only are accepted as additions.

A new migration is not automatically safe because it has a valid filename. SQL review, RLS/security review and replay tests remain mandatory.

## 5. Remote history reconciliation and deployment

Before any remote schema deployment:
1. Identify the exact project ref and environment. Confirm it from the approved environment inventory, not from a remembered or similarly named project.
2. Authenticate using a scoped, short-lived deployment credential stored in the appropriate secret manager.
3. Compare local migration files to the remote migration history using supabase migration list.
4. Inspect the remote schema and migration history read-only before taking action.
5. Resolve all differences and establish a backup/restore point before deployment.
6. Preview pending changes using the supported dry-run capability of the pinned CLI.
7. Review the SQL, security implications, RLS policies and lock/availability risk.
8. Apply only to staging first; verify application compatibility and data integrity.
9. Production deployment requires a separate release approval, backup confirmation and maintenance/rollback plan.
10. Record the exact commit, migration identifiers, target project, actor, execution time, result and verification evidence.

**Never perform schema DDL directly in a hosted SQL editor or dashboard once migration management is active.** All schema changes must be represented in reviewed migration files.

### Migration history repair

supabase migration repair changes migration tracking metadata; it does not apply or revert SQL. It may be used only after:
- the actual remote schema has been inspected;
- the intended migration SQL has been proven to be already reflected in the schema (or not applied);
- a backup exists;
- the discrepancy and evidence are reviewed and recorded;
- the repair is approved for that specific environment.

Never use migration repair merely to silence a db push error.

## 6. Drift detection and remediation

- CI validates local migration file order and immutability.
- Staging compares repository migration files with remote history before release.
- Production migration history and schema state are inventoried on a scheduled basis and before each release.
- Unexpected remote schema changes trigger a deployment freeze for the affected database.
- Compare the remote schema against the expected schema using the supported CLI diff/pull tooling.
- Do not overwrite the remote state or blindly mark migrations applied.
- If an authorised emergency change was made remotely, capture it as a reviewed forward migration after inspecting the real schema and testing a clean replay.
- Record the root cause, actor, affected environment, schema diff, repair/forward migration and post-repair verification.

## 7. Production-safe schema evolution

Use expand/contract for changes that must coexist with deployed application versions:
1. Expand: add nullable columns, compatible tables/indexes or new structures.
2. Deploy application code that can read/write both old and new representations.
3. Backfill in bounded, restartable, observable batches.
4. Verify data completeness and application behaviour.
5. Switch reads/writes to the new representation.
6. Remove old structures only in a later approved migration after all old application versions are retired.

Additional rules:
- Avoid long blocking locks; set and review lock/statement timeouts where appropriate.
- Build large indexes using an online/concurrent strategy supported by the database and migration runner.
- Make backfills idempotent and resumable.
- Do not combine a large data rewrite with unrelated DDL.
- Do not drop or irreversibly transform customer/legal data in a routine migration.
- Destructive changes require explicit owner/release approval and a verified recovery path.

## 8. Backup, restore and forward-fix policy

Before production schema changes:
- verify a recent successful database backup and its retention;
- confirm object-storage backups cover documents, evidence, extracted artefacts and version metadata;
- ensure backups are encrypted and access-controlled;
- verify encryption/key recovery procedures;
- record the restoration point and responsible operator;
- ensure the migration has a forward-fix plan.

Backups must be restoration-tested. A backup is not considered valid merely because a provider dashboard reports that one exists. Restore tests must verify schema, row relationships, storage object integrity, evidence provenance, tenant boundaries and audit continuity.

**Production rollback default is a forward fix, not a destructive down migration.** A down migration may be used only where it is explicitly safe, data-preserving, tested and approved. If a migration partially applies or causes failure, stop further deploys, preserve evidence, assess the exact state and create a reviewed recovery/forward migration.

RPO, RTO, backup frequency and retention remain deployment decisions for task 0.13.

## 9. RLS, permissions and privileged SQL

- Enable RLS on every table in exposed schemas before granting application roles access.
- RLS policies must enforce actual tenant/workspace/matter membership, not merely the authenticated role.
- Never use user-editable metadata as an authorisation source.
- UPDATE policies require both USING and WITH CHECK; test both row selection and reassignment attempts.
- Views must not accidentally bypass RLS; use security-invoker semantics where supported or keep/restrict views in non-exposed schemas.
- Prefer SECURITY INVOKER. SECURITY DEFINER requires a documented exception, restricted schema/function grants, explicit identity checks and specialist review.
- Revoke unnecessary default grants and verify function execution privileges.
- Run Supabase security/performance advisors after schema changes when a Supabase project is selected.
- Generated database types must be refreshed from the verified schema and committed with the corresponding schema change where used.

## 10. CI and operational enforcement

The CI pipeline runs scripts/ci/check-migrations.mjs:
- no migration directory: reports a clean zero-migration baseline;
- migration directory exists: validates timestamp names, ordering, uniqueness and non-empty SQL;
- when a valid base SHA is available: rejects modification/deletion of existing migration files.

The pipeline does not connect to a hosted database or deploy migrations. Hosted reconciliation and release execution require the verified project ID, protected credentials and environment-specific approval.

## 11. Official workflow references

- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Local Development — Database Migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Supabase Migration Repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)
- [Supabase Database Push](https://supabase.com/docs/reference/cli/supabase-db-push)

## 12. Acceptance checklist for task 0.11

- [x] Immutable, ordered migration policy defined.
- [x] Local clean replay/reset and synthetic seed policy defined.
- [x] Hosted history reconciliation and migration repair controls defined.
- [x] Schema drift detection and remediation defined.
- [x] Backup/restore and forward-fix policy defined.
- [x] Current repository and connected Supabase project inventory checked; no Njumeni-specific project/config/migrations identified, and no other project was modified.
- [x] CI migration filename/order/immutability guard implemented and passed in workflow run 42741685025.
- [x] Local replay/reset procedure documented; actual execution is deferred until the CLI/runtime and Njumeni-specific database configuration are provisioned. No placeholder migration SQL was invented.
