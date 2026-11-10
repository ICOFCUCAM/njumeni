# Phase 2.5 — Supabase persistence adapter

`createSupabaseLegalIngestionPersistence` implements the ingestion persistence contract with the private server-side Supabase client. It calls only service-role RPCs; no table write permissions are added to browser roles.

The worker now splits normalised source text into deterministic passages before persistence. The append RPC stores authority metadata, source-content hash, normalised-content hash, immutable version history and passage records in one transaction. An unchanged source hash does not create a duplicate version. Any invalid passage causes the transaction to roll back.

The source-rights gate is checked both by the worker immediately before every fetch and again by PostgreSQL when beginning a run and appending authority content. This closes the gap where rights could be revoked between worker-side checks and persistence.

The adapter and worker tests have been authored but not executed. The migration remains unapplied; no source has been activated.


## Worker lease enforcement and recovery

The worker runtime passes the claimed job ID and lease token into the authority append RPC. PostgreSQL validates that the job is still leased, the token matches, the lease has not expired, and the job belongs to the same source key. This check occurs in the same transaction as authority version and passage writes.

The queue checkpoint RPC mirrors completed external IDs and counters into the job's JSON checkpoint, because the claim RPC reads the job row. A retry therefore resumes from the same source cursor and excludes successfully persisted IDs. If an attempt has retryable failures, it retains the current source cursor; it advances to the next cursor only after the batch has no retryable failures. This prevents failed records from being skipped after a partial batch.

The runtime is deliberately not auto-started by Next.js. It must run as a separate Node worker with worker-only service-role credentials, a version-pinned adapter registry, source-rights resolver and controlled deployment lifecycle. The worker emits structured lifecycle events without source text or secrets.
