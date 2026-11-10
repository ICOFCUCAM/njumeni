# Phase 2.5 — Ingestion execution boundary

## Execution contract

The ingestion executor is dependency-injected. It accepts a source adapter, a rights snapshot and a persistence implementation; it does not embed a database client, provider credential, scheduler or HTTP endpoint. This keeps the source adapter and persistence boundary independently testable.

Execution validates the adapter manifest and source rights before discovery. It validates bounded concurrency, checks cursor progress, plans a deterministic de-duplicated batch, creates a run record, then fetches records through a bounded worker pool. Rights evidence is reloaded from the trusted source registry before each record fetch, so a pause, restriction or revocation can stop a running batch before the next upstream record is requested. Source URLs must match the adapter's HTTPS hostname allow-list. The fetched external identifier must match the requested stable identifier. Retrieval timestamps and normalised content are validated before persistence.

The persistence adapter is responsible for transactionally enforcing uniqueness/idempotency, appending immutable versions, persisting passage records and atomically updating the run result/cursor. The executor reports created, unchanged and skipped counts plus classified failures. Partial batches are never silently reported as complete.

## Deliberate non-goals

- No live source adapter is activated by this module.
- No queue, cron schedule, worker process, network client or secret is configured.
- No production Supabase writes are made.
- No source is ingested without approved licence and attribution evidence.

## Remaining worker tasks

Implement a trusted server-side persistence adapter using service-role credentials in the worker environment only, database-level idempotency and transactions, durable checkpoints, lease/heartbeat handling, retry scheduling and dead-letter operations. Add integration tests against local Supabase before enabling any source.
