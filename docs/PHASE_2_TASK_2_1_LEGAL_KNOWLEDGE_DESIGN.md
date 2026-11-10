# Phase 2.1 — Legal knowledge data model and source governance

## Decisions

- Legal knowledge is a bounded context owned by the Legal knowledge and jurisdiction domain.
- Jurisdictions, source catalogue, authority identities, immutable authority versions, passages, relationships and ingestion runs are private schema records.
- Stable authority identity is independent of each source-text version.
- Effective dates describe legal applicability; publication and retrieval timestamps describe source lifecycle. They are not interchangeable. A valid-until date is treated as the exclusive end of an applicability interval.
- Every fetched source and normalised text version carries a SHA-256 digest. Passages retain a parent version plus page, section and offset anchors.
- Authority versions, passages and asserted legal-authority relationships are append-only at database level. Corrections are represented by a new version or relationship record, not an overwrite.
- The latest ingested version is determined by the highest version_number for an authority. No mutable current-version flag is stored on an immutable version row.
- Full-text search uses PostgreSQL simple configuration as a language-neutral baseline. Language-specific dictionaries and query routing are a later retrieval task.
- pgvector is enabled with a 1536-dimension nullable embedding field. This is a storage contract, not a model/provider decision. Embeddings remain null until a model profile is explicitly selected and recorded.
- Source ingestion is disabled by default and requires rights approval, active source status, explicit enablement, a recorded licence identifier and attribution text.
- No direct Data API grants are made to public, anon or authenticated; the initial ingestion role is service_role.

## Initial jurisdiction catalogue

Norway, EU, UK, US, international law and Cameroon are seeded as priorities. Norway is marked pilot, not fully supported. All other entries remain planned. A jurisdiction's status is a product coverage assertion and must be backed by source, date, language and quality evidence before promotion.

## Initial source discovery catalogue

The registry contains discovery entries for Lovdata, EUR-Lex, legislation.gov.uk, Congress.gov, the UN Treaty Collection and Cameroon official legal publications. Each entry is explicitly review_required, planned and ingestion_enabled=false. The Cameroon entry intentionally has no guessed base URI; source discovery is outstanding.

## Rights and licensing gate

Before activating any source adapter, record:
- authoritative publisher/issuing body and canonical source URL;
- terms, licence identifier and version;
- permitted access method and rate limits;
- rights to retrieve, store, normalise, index, quote, display and redistribute;
- attribution requirements;
- jurisdiction and document-class coverage;
- update cadence and correction process;
- retention and takedown obligations.

No content is ingested merely because it is publicly reachable.

## Version and provenance rules

- Authority identity uses (source_id, external_id) as its stable source key.
- Each authority has sequential positive version_number values.
- valid_from / valid_until describe the legal effective period, not the crawler's observation window.
- published_at and retrieved_at preserve publication and retrieval provenance.
- source_content_hash identifies the fetched source representation; normalised_content_hash identifies the canonicalised text.
- A passage is always bound to one immutable authority version and stores page, section and text offsets where available.
- A corrected source is appended as a new authority version. Existing version rows are not overwritten.
- Relationships such as amendment, repeal, implementation, interpretation and overruling are separately stored with provenance.

## Retrieval substrate

Passages store a generated PostgreSQL full-text vector and an optional pgvector embedding. The baseline full-text configuration is simple, avoiding an incorrect assumption that all legal material is English or Norwegian. A later task will define language-aware tokenisation, ranking, hybrid retrieval, index strategy and the selected embedding model profile.

## Security and deployment

RLS is enabled on all legal-knowledge tables. Direct privileges are revoked from public, anon and authenticated. The initial service-role grants are confined to the legal-knowledge tables. No user-facing query RPC is exposed by this migration. Hosted Supabase remains unchanged until separately authorised.


## Application contracts added in the Phase 2 implementation batch

- Source adapter manifest validation checks stable source/adapter keys, adapter version, HTTPS base URI and an explicit hostname allow-list.
- Authority normalisation preserves both the fetched source hash and the canonical normalised-text hash.
- Passage generation is deterministic, bounded, overlap-aware and retains offsets into the normalised text.
- Ingestion batch planning is rights-gated, de-duplicates and sorts external IDs, and derives stable batch and per-authority idempotency keys.
- Ingestion state transitions are explicit; terminal runs cannot be reopened. Retryable failures use bounded exponential backoff.
- Relationship validation rejects self-links, malformed authority IDs, invalid effective dates and unsafe provenance URLs; inverse relationship types are explicit where applicable.
- Jurisdiction coverage is assessed against current, active, rights-approved sources for each declared authority class and language. Known gaps are returned for disclosure. “Supported” means the declared scope is evidenced and current, not that the jurisdiction is exhaustive or complete.


## Retrieval and answer-evidence contracts

The retrieval module defines bounded query plans scoped to jurisdiction, explicit as-of date, language, authority class and retrieval mode. It filters authority versions by their effective period, excludes repealed/expired/overruled status by default, and supports lexical, semantic and deterministic hybrid ranking. Hybrid scores use a documented 45/55 lexical/semantic weighting; score thresholds and weights require evaluation against jurisdiction-specific legal research sets before production use.

Ranked passages preserve stable authority/version identifiers, citation, source URI, source-content hash, section and page anchors. An answer-grounding assessment rejects unsupported passage identifiers and refuses to mark an answer grounded when no retrieved passage is cited, coverage is incomplete or source rights are not approved.

The database migration now includes a partial HNSW cosine index for passages with embeddings. Embedding generation remains disabled until a versioned model profile is selected and approved.
