# Phase 2 — Legal knowledge infrastructure

| Field | Value |
|---|---|
| Phase state | 🟡 **IN PROGRESS: parallel with Phase 1** (owner authorisation, 2026-11-10) |
| Governing plan | [Njumeni Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §6 (legal knowledge), §5.5 (RAG), §5.7 (embedding profile), §18.2 (evaluation) |
| Strategic weight | **First strategic priority:** legal knowledge and authority infrastructure (master plan §22) |
| Plan revision | 2026-11-11: rewritten for v2.0. Adds Tasks 2.8–2.10 (pilot source, embeddings, evaluation); closeout renumbered 2.11 |

## 1. Objective

Establish a governed, jurisdiction-aware, **bitemporal** legal-authority registry and retrieval substrate. Prove it **end-to-end with one rights-approved pilot source** (Norwegian legislation) and a measured retrieval evaluation.

Legal authorities are not generic uploaded documents. Their identity, issuing body, jurisdiction, source rights, effective period, historical text and provenance remain explicit.

**▲ v2.0 change of ambition.** The previous plan could close with an empty corpus. v2.0 requires real, evaluated content from one source, because an infrastructure that has never ingested law has not demonstrated the first strategic priority.

## 2. Scope

| In scope | Out of scope (later phase) |
|---|---|
| Jurisdiction and source registry, rights governance | Research UI and Module A answers (Phase 4) |
| Authority identities, append-only versions, passages | Grounded generation and LLM reasoning (Phases 4–5) |
| Normalisation, hashing, provenance, adapters | Citation verification of answers (Phase 4, U-10) |
| Durable ingestion queue, worker, checkpoints | Scheduled monitoring at scale (Phase 12) |
| Full-text and vector indexes; hybrid retrieval | Reranking (Phase 4) |
| Authority relationship graph | Treatment analysis such as overruling detection (Phase 6) |
| Coverage governance | Jurisdictions beyond the pilot (Phase 12) |
| **One pilot source; embedding profile; evaluation set** | Customer documents (never in this phase) |

## 3. Non-negotiable boundaries

1. A jurisdiction marked `planned` or `pilot` is never advertised as supported (coverage levels: master plan §6.7).
2. No ingestion until the source's licence, terms, attribution, access method and storage/redistribution rights are reviewed and approved. Approval, activation and ingestion enablement are **three separate audited operations**.
3. Seeded catalogue entries are discovery references, not confirmation that an API exists or that bulk ingestion is permitted.
4. No embeddings until the embedding profile (model, dimension, languages, licence) is selected and versioned. Embeddings from different profiles are never mixed.
5. Authority versions are append-only. A correction creates a new version; historical text is never overwritten.
6. Legal-source content is separate from customer evidence. Phase 2 accepts no confidential documents.
7. Service-role credentials exist only inside the trusted server or worker. Adapters re-check rights before every fetch.
8. **▲ U-27:** all Phase 2 migrations are verified on local and CI stacks only. Nothing is applied to hosted Supabase until Phase 13. Pilot ingestion runs against the **local** stack.
9. **▲ Build in public:** public legal content MAY appear in fixtures where its licence permits. Worker logs from public CI MUST NOT contain secrets.

## 4. Task register

| No. | Task | Deliverable | Acceptance criteria | Status |
|---|---|---|---|---|
| 2.1 | Jurisdiction and legal-source registry | Jurisdictions, sources, rights evidence, activation/coverage audits, RLS, revoked grants, seeds | pgTAP green; direct grants denied to browser roles | 🔵 IMPLEMENTED: 69/69 locally |
| 2.2 | Authority identity and version model | Stable identities, append-only versions, effective periods, hashes; ▲ as-of query over valid time and system time (U-07) | Immutability and as-of pgTAP tests pass | 🔵 IMPLEMENTED: as-of query verified locally |
| 2.3 | Normalisation and provenance contract | Adapter manifest, rights matrix (ingest, display, quote, redistribute), HTTPS allow-list, Unicode normalisation, source and normalised SHA-256, passage anchors | Unit tests pass | 🔵 IMPLEMENTED |
| 2.4 | Full-text and vector retrieval substrate | GIN and HNSW indexes, lexical/semantic RPCs, hybrid ranking, citation bundles, rights-aware trusted search | Unit tests pass; RPCs covered by pgTAP | 🔵 IMPLEMENTED |
| 2.5 | Source ingestion lifecycle | Deterministic batches, idempotency, durable leased queue, checkpoints, retries, dead letters, worker runtime, exact-version adapter registry | Worker starts; queue pgTAP passes; runtime tests pass | 🔵 IMPLEMENTED (B-5 fixed: the worker starts and refuses to run with no approved adapters, as designed) |
| 2.6 | Authority relationship graph | Typed directional edges with provenance; bounded traversal; lease-bound relationship ingestion; ▲ database graph query RPC | Graph RPC tested with cycles and as-of filters | 🔵 IMPLEMENTED: database graph query verified locally (parity with TypeScript proven) |
| 2.7 | Coverage governance | Source and jurisdiction coverage reviews, snapshots, audits; ▲ aligned to the coverage levels in master plan §6.7 | Coverage never exceeds evidence; pgTAP passes | 🔵 IMPLEMENTED: five levels enforced in the database; verified locally |
| 2.8 | **Pilot source and first adapter** | Rights review of Norwegian legislation (candidate: Lovdata public data, master plan §6.3); adapter with an exact version pin; audited activation; bounded ingestion into the local stack | Rights evidence recorded; an authority with versions, passages and relationships ingested idempotently; re-run produces no duplicates | 🔵 IMPLEMENTED: verified locally ([record](PHASE_2_TASK_2_8_LOVDATA_PILOT.md)). Licence verified on api.lovdata.no (NLOD 2.0). Adapter `lovdata-public-data@1.0.0`. **753 acts, 753 versions, 31 007 section passages, 4 487 relationships** on the local stack. Re-runs: 0 created, 753 unchanged, no duplicates. **Owner:** approve rights and activate (record §6); NLOD text still to confirm |
| 2.9 | **Embedding profile and multilingual retrieval** | Profile record; forward migration of the vector dimension; embedding generation in the worker; language-specific FTS | Semantic and lexical retrieval over pilot passages; the profile is recorded on every embedding | 🔵 IMPLEMENTED: verified locally with a stand-in model (D-3 decided: `multilingual-e5-small-v1`) |
| 2.10 | **Retrieval evaluation set (Norway)** | Golden questions with expected authorities and as-of dates; evaluation harness | Recall@10 and Precision@5 reported; harness runnable in CI | 🟡 IN PROGRESS: **`lovdata-no-v1` (41 cases) built and run** with real `multilingual-e5-small` embeddings (31 007 passages). Hybrid: Recall@10 1.000 ✅, currency 1.000 ✅, **Precision@5 0.312 ❌** (gate 0.6), MRR 0.732. Lexical: 0.897 / 0.252 / 1.000. Thresholds unchanged; precision needs reranking and abstention (Phase 4) or an owner recalibration ([record](PHASE_2_TASK_2_8_LOVDATA_PILOT.md) §7) |
| 2.11 | Verification and closeout | Clean replay, all pgTAP, regenerated types, consolidated `LEGAL_KNOWLEDGE_ARCHITECTURE.md` and `DATABASE_ARCHITECTURE.md`, acceptance report | All 2.1–2.10 green; closeout commit; green CI; tag `phase-2-closed` | 🔒 LOCKED |

## 5. Implementation inventory

### 5.1 Database (migrations `20261110200000` → `20261110300000`)

| Migration | Content |
|---|---|
| `…200000_legal_knowledge_foundation` | Jurisdictions, sources, authorities, versions, passages, relationships, ingestion runs; FTS and pgvector; lexical/semantic RPCs; seeds |
| `…210000_legal_ingestion_durable_queue` | Leased jobs, heartbeats, checkpoints, retries, dead letters |
| `…220000_legal_ingestion_persistence` | Lease-bound append-authority/version/passage transaction |
| `…230000_legal_worker_trusted_source_config` | Rights evidence; worker-only source configuration RPC |
| `…240000_legal_retrieval_and_coverage_rpc` | Service-role PostgREST wrappers; coverage snapshot |
| `…250000_legal_source_review_and_enqueue` | Rights review audit; idempotent enqueue; adapter pins |
| `…260000_legal_citation_source_metadata` | Citation metadata RPC with separate display and quote permissions |
| `…270000_legal_relationship_ingestion` | Typed relationship persistence under the live lease |
| `…280000_legal_source_activation_audit` | Separate audited operator activation |
| `…290000_legal_source_coverage_review` | Source coverage review and audit |
| `…300000_legal_jurisdiction_coverage_scope` | Jurisdiction coverage scope review and audit |
| `20261112900000_legal_pilot_ingestion_support` | ▲ Task 2.8: append records `valid_from` and passage `section_path`; `legal_ingestion_enqueue_continuation` for page-by-page sources |

Several of these files were corrected before deployment, to repair `$`-delimiter corruption (`00b7eb8`, `e2d52b4`, `01d459f`, `2b60d5f`). All 23 repository migrations replay cleanly (CI run `42900717384`). The correction to `…290000` still needs its hash-pinned entry (B-1).

### 5.2 Application module (`apps/web/src/modules/legal-knowledge/`)

| Area | Files |
|---|---|
| Contracts and normalisation | `contracts.ts`, `ingestion.ts`, `relationships.ts`, `source-governance.ts` |
| Queue and worker | `durable-queue.ts`, `worker.ts`, `worker-runtime.ts`, `worker-process.ts`, `worker-bootstrap.ts`, `worker-main.ts`, `worker-adapters.ts` (Lovdata registered; the database gates decide), `adapter-registry.ts`, `worker-source-config.ts` |
| ▲ Lovdata source (Task 2.8) | `lovdata-document.ts` (parser), `lovdata-archive.ts` (tar.bz2, provenance checks), `lovdata-adapter.ts` (`lovdata-public-data@1.0.0`) |
| Persistence | `supabase-persistence.ts` |
| Retrieval | `retrieval.ts`, `supabase-retrieval-provider.ts`, `citation-bundle.ts`, `citation-metadata.ts`, `trusted-search.ts`, `service.ts` |
| Graph | `authority-graph.ts` |
| Governance and coverage | `coverage.ts`, `coverage-admin.ts`, `coverage-admin-core.ts`, `source-admin.ts`, `source-admin-core.ts` |

Tests: 21 files, 114 tests passing locally (`npm run test:legal-knowledge`). They are not yet run in CI (B-6). `worker-bootstrap.ts` and `trusted-search.ts` lack direct tests.

### 5.3 Seed state

| Jurisdiction | Status | Catalogue source | Rights | Ingestion |
|---|---|---|---|---|
| Norway | `planned` | Lovdata (official) | review required: evidence prepared, **owner approval pending** ([Task 2.8](PHASE_2_TASK_2_8_LOVDATA_PILOT.md) §6) | disabled (ingested on the local stack only) |
| European Union | `planned` | EUR-Lex | review required | disabled |
| United Kingdom | `planned` | legislation.gov.uk | review required | disabled |
| United States | `planned` | Congress.gov | review required | disabled |
| International | `planned` | UN Treaty Collection | review required | disabled |
| Cameroon | `planned` | Official sources (URI unknown) | review required | disabled |

## 6. Known gaps

| Gap | Resolution |
|---|---|
| ~~No adapters; nothing ingests law~~ | Resolved locally: the Lovdata adapter ingested 753 acts (Task 2.8). Hosted ingestion waits for owner approval and the U-27 deployment |
| Superseded versions keep an open `valid_until` (append-only) | Matters once a second consolidated version exists; select the latest version per authority at the as-of date (Task 2.11) |
| ~~No embedding model; the `vector(1536)` dimension is a placeholder~~ | Resolved: `multilingual-e5-small-v1`, `vector(384)` (Task 2.9) |
| ~~FTS uses the `simple` configuration (not language-aware)~~ | Resolved: per-language stemming (Task 2.9) |
| ~~No database-backed graph query~~ | Resolved: `legal_authority_graph` (Task 2.6) |
| ~~No as-of query function~~ | Resolved: `legal_authority_version_as_of` (Task 2.2) |
| Not reachable from the app (no routes, UI or types) | Types at 2.11; UI in Phase 4 |
| ~~`server-only` missing; tests not in CI; stale types~~ | Resolved 2026-11-11 (B-5, B-6, B-7) |

## 7. Changes from the previous plan

| Previous | v2.0 | Why |
|---|---|---|
| Phase closes on infrastructure alone | Requires a pilot source, an embedding profile and an evaluation (Tasks 2.8–2.10) | The first strategic priority must be demonstrated, not only scaffolded |
| Status said "uncommitted"; "tests authored, not run" | Committed; tests run (114/114 unit; pgTAP partly failing) | Register accuracy |
| Task 2.5 "persistence/queue pending"; Task 2.7 "not started" | Both implemented | Register accuracy |
| Effective dates only | Bitemporal model with an as-of query (U-07) | Reproducible past answers |
| Single 1536-dimension vector contract | Versioned embedding profile; dimension set by forward migration (U-22) | Multilingual Norwegian, English and French needs |
| Hosted deployment "pending owner authorisation" | **Deferred until all phases are complete** (U-27) | Owner decision |
| Batch-uncommitted cadence | Small commits, CI green (U-18) | Prevents a repeat of the delimiter corruption |

## 8. Task records

- [Task 2.1: Legal knowledge design](PHASE_2_TASK_2_1_LEGAL_KNOWLEDGE_DESIGN.md)
- [Task 2.3: Source rights governance](PHASE_2_TASK_2_3_SOURCE_RIGHTS_GOVERNANCE.md)
- [Task 2.4: Retrieval contract](PHASE_2_TASK_2_4_RETRIEVAL_CONTRACT.md) · [Citation bundle](PHASE_2_TASK_2_4_CITATION_BUNDLE.md)
- [Task 2.5: Ingestion contract](PHASE_2_TASK_2_5_INGESTION_CONTRACT.md) · [Persistence](PHASE_2_TASK_2_5_PERSISTENCE.md) · [Durable queue](PHASE_2_TASK_2_5_DURABLE_QUEUE.md) · [Worker deployment](PHASE_2_TASK_2_5_WORKER_DEPLOYMENT.md)
- [Task 2.6: Authority graph](PHASE_2_TASK_2_6_AUTHORITY_GRAPH.md)
- [Task 2.8: Lovdata pilot, real embeddings, Norwegian evaluation](PHASE_2_TASK_2_8_LOVDATA_PILOT.md)
- [Legal AI platform architecture](LEGAL_AI_PLATFORM_ARCHITECTURE.md)

Where a task record conflicts with this plan or the register on status, the register governs.
