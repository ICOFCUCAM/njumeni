# Phase 2.4 — Legal retrieval and citation contract

## Retrieval requirements

Every retrieval request is scoped to one jurisdiction, an explicit as-of date and one or more languages. Authority classes may further constrain the search. The query mode is lexical, semantic or hybrid; the requested result count and minimum score are bounded.

The retrieval plan requires legal-effectivity filtering. An authority version is eligible only where valid_from is null or no later than the as-of date, and valid_until is null or strictly later than the as-of date. Repealed, expired and overruled authorities are excluded by default. Historical-law research can later add an explicit mode that intentionally includes superseded versions.

## Ranking

The contract supports lexical and semantic score inputs. Hybrid ranking uses a deterministic weighted score (45% lexical, 55% semantic); when only one score exists, that score is used. Ties are stable by authority and passage identifier. Scores are clamped to [0,1], and low-scoring candidates are filtered by the configured threshold.

The current implementation defines ranking semantics only. Database query execution, language-specific tokenisation, vector model selection, calibrated score thresholds and query evaluation datasets remain implementation tasks.

## Citation and answer grounding

Each ranked passage carries its authority identity, authority version, source URI, source-content hash, jurisdiction, language, effective period, section/page anchors and citation label.

An answer can be marked grounded only if it is non-empty, cites at least one passage returned by the retrieval step, contains no unsupported passage identifiers, has approved source rights and has complete declared coverage. Otherwise the assessment returns explicit warnings. This is a contract for downstream answer orchestration, not a claim that a generated legal conclusion is legally correct.

## Safety

The retrieval contract does not replace professional legal review, and a high retrieval score is not a legal authority ranking. Jurisdiction and as-of date must be visible in downstream UI. Incomplete coverage and source-rights restrictions must not be hidden. The system must never invent citations or cite material not present in the retrieval result.


## Database query implementation

The migration now defines private lexical and semantic retrieval RPCs. Both are SECURITY DEFINER with an empty search path and execution granted only to service_role; anon, authenticated and public cannot execute them. Both functions constrain jurisdiction, language, optional authority class, legal effective period and non-superseded legal status. They also require the source record to be rights-approved, active and explicitly ingestion-enabled. Semantic retrieval additionally requires a caller-supplied 1536-dimensional vector and an exact embedding model key, preventing accidental cross-model vector comparisons.

The server-only application provider must invoke these RPCs from a trusted worker or server boundary and must never expose the service-role credential or embedding vector-generation credentials to the browser. The seeded source catalogue remains disabled, so these functions return no seeded source content until a separate rights approval and ingestion process has been completed.


Each retrieval row also carries the registered source key, allowing the citation-bundle builder to resolve the exact source licence and attribution record. The SQL RPC return contract includes this source key; application citations must not infer source identity from a URL or title.
