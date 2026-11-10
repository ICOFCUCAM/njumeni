# Njumeni Phase 2 — Legal knowledge infrastructure

**Status:** IN PROGRESS — parallel development authorised by the product owner on 10 November 2026.  
**Phase 1:** remains OPEN; Phase 2 work does not imply Phase 1 acceptance.  
**Repository:** ICOFCUCAM/njumeni  
**Execution branch:** claude/wonderful-franklin-lt09d7

## Objective

Establish a governed, version-aware legal knowledge substrate that later evidence, research, reasoning and verification capabilities can safely consume. Legal authorities are not generic uploaded documents: their identity, issuing body, jurisdiction, source rights, effective period, historical text and provenance must remain explicit.

## Phase 2 task plan

| Task | Deliverable | Acceptance condition |
|---|---|---|
| 2.1 | Jurisdiction and legal-source registry | Jurisdictions, legal systems, source ownership, source types, coverage and explicit source-rights/ingestion gates are modelled and seeded. RLS and direct-grant restrictions are verified. |
| 2.2 | Legal authority identity and version model | Stable authority identity is separate from immutable source versions; effective dates, publication/retrieval times, status, hashes and supersession relationships are represented. |
| 2.3 | Normalisation and provenance contract | Source adapters produce canonical metadata, stable external IDs, source and normalised hashes, allow-listed source URIs, retrieval timestamp, normalisation profile and attribution/rights evidence. |
| 2.4 | Full-text and vector retrieval substrate | Language-aware indexing strategy, generated full-text vectors, passage anchors, pgvector model-profile contract and retrieval indexes are implemented. |
| 2.5 | Source ingestion lifecycle | Idempotent adapter runs, deterministic batches, checkpoints, retries, error classification, update detection and operational audit are implemented. |
| 2.6 | Legal authority relationship graph | Amendment, repeal, implementation, interpretation, application, citation and overruling links are represented with provenance. |
| 2.7 | Jurisdiction/source coverage governance | Coverage status, supported document classes, date ranges, language, update cadence and known omissions are explicit; unsupported jurisdictions are never represented as complete. |
| 2.8 | Phase 2 verification and closeout | Clean migration replay, pgTAP, schema/type generation, application checks, source-rights review, provenance and retrieval contract tests, documentation and one verified phase commit. |

## Initial implementation batch

Task 2.1 and foundational data contracts for Tasks 2.2–2.6 are introduced in the first additive migration:

- jurisdiction registry seeded for Norway, EU, UK, US, international law and Cameroon;
- official-source discovery catalogue seeded without claiming that all sources or rights are approved;
- stable authority identity and separate historical versions;
- source and normalised-content SHA-256 fields;
- effective-period and current-version constraints;
- version-bound passage records with stable page/section/offset anchors;
- PostgreSQL full-text search and pgvector embedding field, with a partial HNSW cosine index for populated embeddings;
- private server-only lexical and semantic retrieval RPCs, constrained by jurisdiction, language, legal status, effective date and approved/enabled source rights;
- TypeScript source-manifest and rights validation, canonical metadata normalisation, source/normalised hashes and deterministic passage chunking;
- deterministic ingestion batch planning, idempotency keys, retry classification and run-state transitions;
- source-provenanced authority relationship validation and scoped jurisdiction-coverage assessment;
- source-provenanced legal-authority relationships;
- ingestion-run records with explicit status and checkpoints;
- RLS enabled and direct anon/authenticated table privileges revoked;
- trusted service-role access only for the initial ingestion substrate.

## Important implementation boundaries

1. A jurisdiction marked planned or pilot is not advertised as fully supported.
2. No legal-source ingestion is enabled until the source's licence, terms, attribution, access method and permitted storage/redistribution rights have been reviewed and approved.
3. Seeded source records are discovery references, not confirmation that an API is available or that bulk ingestion is legally permitted.
4. The 1536-dimensional vector column is an initial storage contract only. The embedding model/profile must be selected and versioned before embeddings are generated. No provider is selected by this schema.
5. Legal authority versions are append-only by application contract. A correction creates a new version; historical text is not overwritten.
6. Legal-source content is distinct from customer evidence and matter documents. Phase 2 does not accept confidential customer documents.
7. This migration is local/repository work only. Hosted Supabase remains unchanged pending separate owner authorisation.
8. Service-role credentials must never be exposed to the browser. Ingestion adapters must run in a trusted server/worker boundary and re-check source rights and operational policy.

## Dependencies and parallel-phase policy

Phase 2 may proceed against planned Phase 1 contracts while Phase 1 combined verification and live Auth release checks remain outstanding. All customer-facing reads and writes must continue to fail closed until the Phase 1 access boundary is accepted. The Phase 2 schema is private and not directly exposed to PostgREST users.

## Current status

- Task 2.1: implementation written; combined database verification pending.
- Task 2.2: stable identity, version history and append-only database guards written; verification pending.
- Task 2.3: TypeScript adapter, rights, URL, metadata and text-normalisation contracts written; unit tests authored, not run.
- Task 2.4: PostgreSQL full-text and pgvector substrate written, including GIN/HNSW indexes, private server-only lexical/semantic retrieval RPCs, executable retrieval-provider contract and reproducible citation bundles with rights-aware display/quotation checks and a composed legal-knowledge search service; language-aware ranking, calibrated thresholds, query evaluation and model-profile selection remain pending.
- Task 2.5: deterministic ingestion planning, idempotency, state machine, bounded batch executor, source-rights rechecks, service-role Supabase persistence RPCs, append-only authority version/passages transaction, durable leased queue, checkpoint/retry/dead-letter RPCs, a separate worker runtime with lease renewal, lease-bound writes and restart recovery, exact-version adapter registry, trusted service-role worker bootstrap, source-rights evidence table and worker-only source-config RPC are written; a Supabase retrieval provider now calls service-role-only PostgREST wrappers for lexical and explicitly configured 1536-dimensional semantic retrieval; a server-only jurisdiction coverage snapshot service exposes conservative coverage assessments; a separate rights-review workflow records append-only human review evidence without activating sources; an idempotent enqueue RPC requires an approved, active, ingestion-enabled source and an exact adapter key/version. Adapter/runtime/database/bootstrap/retrieval/coverage/review/enqueue/citation-permission tests are authored but not run; a trusted search orchestrator now joins retrieval with citation metadata and suppresses source text when quotation is not permitted; adapters can declare typed authority relationships that are persisted idempotently under the same live worker lease and checked against source provenance hosts. Combined migration replay and runtime verification remain pending.
- Task 2.6: authority relationship schema, validation contract, bounded breadth-first graph traversal, typed adapter relationship references and lease-bound, idempotent, provenance-host-checked relationship persistence are written; relationship source adapters and graph-query UI remain pending.
- Task 2.7: scoped coverage assessment, server-only snapshot service, source-level coverage review RPC, jurisdiction-level authority-scope review RPC and append-only audit records are written; no jurisdiction is marked supported by declaration alone.
- Task 2.8: not started; verification remains intentionally deferred until the planned implementation batch is complete.
- No source adapter is registered; no hosted migration deployed; no legal-source ingestion enabled; no embeddings generated. All implementation and verification work remains on a prepared, uncommitted Git tree.


## Worker bootstrap addition (10 November 2026)

The worker deployment boundary now includes:

- an immutable adapter-registry snapshot keyed by exact adapter key and version;
- duplicate registration rejection and no latest-version fallback;
- adapter factory manifest checks against the registered source identity;
- a server-only bootstrap that creates a Supabase service-role client only inside the worker process;
- required environment validation and a stable worker ID;
- a worker-only source configuration RPC that joins source activation state with explicit licence-review evidence;
- fail-closed source-key, source-ID, expiry and permission validation before ingestion;
- deployment guidance covering secrets, process lifecycle, structured logs and activation gates.

The new rights-evidence table does not approve any source. Existing source catalogue entries remain unapproved, planned and ingestion-disabled. The new migration is not deployed to hosted Supabase.


## Retrieval and coverage administration addition (10 November 2026)

- Added a Supabase-backed lexical retrieval provider that maps stable passage/version/source provenance into the retrieval contract.
- Added an optional semantic embedding adapter. Semantic retrieval refuses to run unless an embedder returns a non-empty model key and exactly 1536 finite dimensions. No embedding vendor or model is selected.
- Added service-role-only public RPC wrappers so the trusted server process can invoke the private retrieval functions through Supabase PostgREST without exposing private tables or retrieval functions to browser roles.
- Added a server-only jurisdiction coverage snapshot service. The SQL snapshot distinguishes source freshness from licence-review timestamps and never treats a licence review as proof that the source itself was recently verified.
- Added coverage and retrieval provider tests; they are authored but not run.


## Source review and enqueue controls (10 November 2026)

- Added a rights-review evidence audit table with append-only protection.
- Added a trusted rights-review RPC. It records licence, terms, attribution, reviewer, review interval, permission matrix and restrictions. It can mark rights as approved or restricted, but deliberately does not change source status or enable ingestion.
- Added exact adapter-version pinning to the source registry.
- Added an idempotent enqueue RPC that rejects sources unless rights are approved, source status is active, ingestion is explicitly enabled, rights evidence is current, required permissions are present, and the queued adapter key/version exactly match the registry.
- Added PgTAP assertions for the new rights-review and enqueue contracts. Tests remain unexecuted.
- Corrected a malformed lexical-retrieval jurisdiction validation expression found during static source review. The correction is in the additive migration source; no database has been migrated.


## Trusted rights-aware retrieval orchestration (10 November 2026)

- Added a server-only search orchestrator that executes the retrieval provider, loads source attribution and permission metadata, assembles reproducible citation bundles, and returns only passages whose source permits display.
- When display is permitted but quotation is not, the orchestrator suppresses the retrieved source text while retaining citation metadata and a warning.
- Added a service-role-only citation metadata RPC. It keeps source licence/attribution data and separate display/quotation permissions behind the trusted server boundary.
- Added focused tests for metadata loading and error sanitisation. Tests remain unexecuted.


## Source-provenanced relationship ingestion (10 November 2026)

- Authority adapters may now return typed relationship references by stable external authority ID.
- Normalisation validates relationship type, target ID, effective date, source note and HTTPS provenance against the adapter's host allow-list.
- Supabase persistence writes relationship edges after the authority upsert and before the worker checkpoint. If relationship persistence fails, the authority ID is not checkpointed and the retry can safely repeat the idempotent authority/edge writes.
- The relationship RPC checks the live job lease, source rights and activation state, same-source authority identity, and provenance host against the registered source base URI.
- Added tests for relationship normalisation and same-lease persistence. Tests remain unexecuted.


## Explicit source activation governance (10 November 2026)

- Added a separate trusted activation RPC and append-only operator audit.
- A rights review can approve legal permissions, but only a separate operator activation action can change a source from planned to active or enable ingestion.
- Enabling ingestion requires active status, approved rights, non-expired review evidence, all required ingestion permissions, and an exact adapter key/version.
- Every activation change records operator, reason, prior state and resulting state. No activation RPC has been invoked; all seeded sources remain inactive and ingestion-disabled.


## Worker hardening follow-up (10 November 2026)

- The trusted worker now reloads source-rights evidence from the database for every upstream authority fetch rather than retaining a per-job snapshot.
- Adapter factories must return a manifest identical to the registered manifest, including the complete allowed-host set, jurisdiction, base URI, source type and access method. Exact key/version matching alone is insufficient.
- The source activation RPC validates nullable arguments explicitly and rejects malformed adapter pins before recording an activation change.


## Executable worker process entrypoint (10 November 2026)

- Added `npm run worker:legal-knowledge`, a Node 22 TypeScript-strip entrypoint using the React server condition to honour the `server-only` package boundary.
- Added a deliberately empty adapter registration catalogue. The process refuses to start until at least one source-specific, rights-reviewed, exact-version adapter is intentionally registered. This avoids a misleading idle deployment and prevents discovery-catalogue entries from becoming live ingestion sources by accident.


## Coverage and lease correctness refinements (10 November 2026)

- Jurisdiction coverage now requires an explicitly ingestion-enabled source before it can count as currently usable for retrieval. Approved-but-disabled sources are reported separately and cannot inflate coverage claims.
- Coverage snapshots expose the source ingestion-enabled flag. Source licence-review timestamps are not treated as source freshness timestamps.
- Worker heartbeat renewal now begins immediately after a job claim, including during exact-version adapter resolution and trusted rights-evidence loading. This prevents slow startup lookups from consuming the entire lease before processing begins.


## Coverage review administration (10 November 2026)

- Added an auditable source coverage review RPC and append-only review history.
- Reviewers can declare covered authority classes, languages, effective date intervals, source verification timestamp and known gaps.
- The review updates only the source's coverage declaration. It does not approve legal-source rights, activate the source or enable ingestion.
- The coverage administration service validates review input and returns the resulting declared coverage. Tests and PgTAP assertions are authored but not run.


## Rights-permission separation refinement (10 November 2026)

- Display permission and quotation permission are now evaluated independently in the source-governance contract. A source may permit display of a citation or metadata while prohibiting verbatim quotation.
- Rights-review changes that would restrict a currently ingestion-enabled source require the source to be deactivated first. This avoids a rights update silently violating the source registry's activation invariant.
- Coverage-review RPCs reject null or malformed authority-class, language and known-gap entries rather than silently accepting incomplete declarations.


## Typed source-governance administration service (10 November 2026)

- Added server-only exports for the trusted rights-review, source-activation and idempotent-ingestion-enqueue RPCs.
- The typed administration layer validates source UUIDs, licence evidence, permission matrices, review timestamps, adapter pins, operator reasons, retry limits and returned job identifiers before exposing results to server actions.
- Rights approval, activation and job enqueue remain three distinct operations. The service does not invoke any of them automatically.
- Focused administration tests are authored but not run.


## Jurisdiction coverage scope administration (10 November 2026)

- Added a separate jurisdiction-level coverage scope review. Reviewers can declare the authority classes that a jurisdiction is expected to cover and the source verification interval.
- The RPC records an append-only audit and updates only coverage metadata. It does not upgrade jurisdiction status or represent it as supported.
- The coverage snapshot now has an explicit administration path for both jurisdiction expectations and source-level coverage declarations.
