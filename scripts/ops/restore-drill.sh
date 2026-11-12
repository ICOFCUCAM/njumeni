#!/usr/bin/env bash
# Backup and restoration drill (Phase 13). Dumps the database, restores it into a scratch database
# in the same cluster, and proves the restore is complete and intact:
#   - the same migrations are recorded,
#   - the same tables, columns and functions exist (catalogue fingerprints),
#   - row counts of the legal record tables match,
#   - the hash-chained security audit and every evidence custody chain still verify.
# Usage: scripts/ops/restore-drill.sh [db-container]   (default: supabase_db_njumeni)
# For the hosted project, restore a backup into a separate project and run the same
# FINGERPRINT_SQL against both with psql.
set -euo pipefail

CONTAINER="${1:-supabase_db_njumeni}"
SCRATCH="njumeni_restore_drill"
psql_in() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -t -A -d "$1"; }

FINGERPRINT_SQL=$(cat <<'SQL'
select 'migrations=' || (select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations);
select 'tables=' || md5(string_agg(format('%s.%s.%s:%s', table_schema, table_name, column_name, data_type), ',' order by table_schema, table_name, column_name))
  from information_schema.columns where table_schema in ('public', 'private');
select 'functions=' || md5(string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc), ',' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private');
select 'rows=' || (select string_agg(format('%s:%s', t, n), ',' order by t) from (
  select 'security_audit_events' t, count(*) n from private.security_audit_events union all
  select 'evidence_custody_events', count(*) from private.evidence_custody_events union all
  select 'evidence_items', count(*) from private.evidence_items union all
  select 'research_runs', count(*) from private.research_runs union all
  select 'research_claims', count(*) from private.research_claims union all
  select 'matters', count(*) from private.matters union all
  select 'legal_documents', count(*) from private.legal_documents union all
  select 'document_versions', count(*) from private.document_versions union all
  select 'invoices', count(*) from private.invoices union all
  select 'organizations', count(*) from public.organizations) c);
select 'audit_chain_valid=' || (public.verify_security_audit_chain() ->> 'valid');
select 'custody_links_broken=' || count(*) from (
  select e.*, lag(e.record_hash) over w as expected_previous, row_number() over w as expected_sequence
  from private.evidence_custody_events e window w as (partition by e.evidence_item_id order by e.item_sequence)) x
  where x.item_sequence <> x.expected_sequence or x.previous_hash is distinct from x.expected_previous
    or x.record_hash <> private.evidence_custody_digest(x.evidence_item_id, x.item_sequence, x.event_type,
      x.actor_principal_id, x.actor_kind, x.occurred_at, x.details, x.previous_hash);
SQL
)

echo "== Dumping the source database"
docker exec "$CONTAINER" pg_dump -U postgres -d postgres -Fc -f /tmp/njumeni-drill.dump
echo "   dump size: $(docker exec "$CONTAINER" stat -c %s /tmp/njumeni-drill.dump) bytes"

echo "== Restoring into ${SCRATCH}"
docker exec "$CONTAINER" psql -U postgres -q -c "drop database if exists ${SCRATCH}" -c "create database ${SCRATCH}"
# Supabase-managed cluster objects (roles, event triggers) already exist in the cluster; those
# notices are expected. The drill then verifies the restored legal records themselves.
docker exec "$CONTAINER" sh -c "pg_restore -U postgres -d ${SCRATCH} --no-owner /tmp/njumeni-drill.dump > /tmp/njumeni-drill-restore.log 2>&1" || true
echo "   restore notices: $(docker exec "$CONTAINER" sh -c 'grep -c "error:" /tmp/njumeni-drill-restore.log || true')"

echo "== Comparing"
SOURCE=$(echo "$FINGERPRINT_SQL" | psql_in postgres)
RESTORED=$(echo "$FINGERPRINT_SQL" | psql_in "$SCRATCH")
echo "$SOURCE" | sed 's/^/   source   /' | cut -c1-150
echo "$RESTORED" | sed 's/^/   restored /' | cut -c1-150

docker exec "$CONTAINER" psql -U postgres -q -c "drop database if exists ${SCRATCH}"
docker exec "$CONTAINER" rm -f /tmp/njumeni-drill.dump /tmp/njumeni-drill-restore.log

if [ "$SOURCE" != "$RESTORED" ]; then
  echo "RESTORE DRILL FAILED: the restored database differs from the source." >&2
  exit 1
fi
if ! echo "$RESTORED" | grep -q 'audit_chain_valid=true' || ! echo "$RESTORED" | grep -q 'custody_links_broken=0'; then
  echo "RESTORE DRILL FAILED: an audit or custody chain does not verify after restore." >&2
  exit 1
fi
echo "Restore drill passed: migrations, catalogue, record counts, audit chain and every custody chain identical and valid."
