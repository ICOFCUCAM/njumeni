# Phase 2.5 — Durable ingestion execution

The ingestion queue is database-backed and uses short-lived leases rather than process memory.

- A worker claims one due job with `FOR UPDATE SKIP LOCKED`.
- A lease token is required for heartbeat, checkpoint writes and completion.
- Expired leases are returned to the queue while attempts remain; exhausted jobs move to dead letter.
- Checkpoints preserve the source cursor, completed external IDs and aggregate counts.
- Retry delay is supplied by the worker's classified backoff policy.
- All RPCs are service-role only; browser roles cannot claim or mutate jobs.
- This migration does not seed jobs, approve source rights, enable ingestion, or activate a connector.

The server process must create its Supabase client from worker-only environment variables. Never expose the service-role key to a browser, route response, log or client bundle. Before each upstream fetch, the worker must reload the current source-rights record and stop if permission is paused, revoked or expired.

The prior foundation migration's partial unique index referenced `is_current_source_version` before defining it. This additive migration supplies the missing boolean before recreating the index. The full migration chain still requires combined validation before any hosted deployment.
