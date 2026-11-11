# Phase 4 — Legal research engine (with the verification core)

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): Module B, §4 Module A answer contract, §8.2 claim ledger (U-09), §8.3 verification checks pulled forward (U-10), §13 API |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phase 2 (legal knowledge: retrieval, as-of, graph, coverage) and Phase 1 (closed) |

## 1. Objective

Answer legal questions only from verifiable law. Each answer:
- uses the law as it stood on the question's date;
- uses only rights-approved sources;
- is decomposed into a claim ledger;
- has every claim about law verified **by the database**.

When nothing verifiable is found, the engine abstains.

## 2. Design

| Element | Implementation |
|---|---|
| Workspace-scoped retrieval | `research_search_lexical` / `research_search_semantic` re-check `research.create` for the caller and wrap the Phase 2 retrieval. **The web app never holds the service-role key** |
| Authority context | `research_authority_context` returns amendments, repeals and replacements (flagged when after the research date), plus overrulings, conflicts, interpretations and applications |
| Source permissions | `research_source_permissions`: display and quote permission and attribution, so a display-only source is cited but never quoted |
| Answer composition | `modules/research/composer.ts` (extractive). One claim per authority (maximum five): the best-matching sentence as a verbatim quote with citation, in-force date and section. Overrulings and conflicts become **conflicting authority**; interpretations and applications become **interpretation**; later amendments become limitations. Legal abbreviations (jf., nr., art., e.g.…) are kept inside sentences |
| Claim ledger (U-09) | `private.research_claims`, using the six Module A categories |
| Database verification (U-10) | `research_record_run` checks every law-bearing claim: **existence** (passage exists), **resolution** (the stated citation matches the passage's authority), **currency** (version in force on the date, same jurisdiction, not repealed or overruled), **source rights** (approved, active, enabled, display permitted), **quotation** (verbatim after whitespace normalisation, and quoting permitted). Results go to `citation_checks`; failures to `failure_codes` |
| Verified-or-abstain | A run is `answered` only if at least one law claim verified; otherwise `abstained`. Runs, claims and checks are append-only. The single status transition is allowed only inside the recording function |
| Findings | Each finding's authority and version are **derived from the passage**, never taken from input |
| API | `POST/GET /api/v1/research/runs`, `GET /api/v1/research/runs/{id}`, `GET /api/v1/openapi.json` (OpenAPI 3.1). Consistent error schema with request IDs; unknown and unauthorised runs both return 404 |
| UI | `/research` (question, jurisdiction with coverage level, as-of date, language, history) and `/research/[id]` (claims grouped by category with ✓, withheld claims with reasons, limitations) |

## 3. Task register

| No. | Task | Status |
|---|---|---|
| 4.1 | Jurisdiction-aware retrieval (workspace-scoped) | ✅ |
| 4.2 | Legal RAG pipeline: retrieval → context → composition → verification | ✅ Extractive; AI reasoning in Phase 5 |
| 4.3 | Authority discovery and relationship context | ✅ |
| 4.4 | Legislation and case-law search (authority types; judgments ranked with legislation) | ✅ |
| 4.5 | Source comparison (several authorities per answer; conflict and interpretation claims) | ✅ |
| 4.6 | Citation retrieval and resolution | ✅ |
| 4.7 | Historical version selection (as-of) | ✅ |
| 4.8 | **Verification core** (existence, resolution, currency, source rights, quotation) | ✅ |
| 4.9 | Claim ledger and verified-or-abstain | ✅ |
| 4.10 | Research API and OpenAPI | ✅ Hand-maintained document with a contract test (U-26 Zod generation deferred; see §6) |
| 4.11 | Research UI | ✅ |
| 4.12 | Evaluation gates (U-15) | ✅ Harness from Phase 2 applies; ⏳ real Norway set needs Task 2.8 |
| 4.13 | Verification and closeout | 🟡 See §4 and §5 |

## 4. Verification evidence (local, 11 November 2026)

| Check | Result |
|---|---|
| Clean replay of 29 migrations | ✅ |
| pgTAP, 15 files | ✅ **399/399**, including `legal_research_engine` 27/27 |
| `db lint`, type sync, migration guard, CI Prettier set, content policy | ✅ |
| App tests | ✅ **214/214**, including `research-engine` 9/9 and `api-contract` 3/3 |
| Production build (`/research`, `/research/[runId]`, `/api/v1/research/runs`, `/api/v1/research/runs/[runId]`, `/api/v1/openapi.json`) | ✅ |
| **Service end-to-end** (signed-in synthetic user, real database) | ✅ See below |
| **API end-to-end** (built app, real session cookie) | ✅ See below |

The service end-to-end run:
- **2024 question:** answered from the 2020 version, with a verbatim quotation and a cited judgment. A limitation records that the law is amended from 2027, after the date.
- **Same question as of 2015:** answered from the **2006** version ("innen tre dager"), so law is applied as it stood.
- **Out-of-scope question:** abstained.

The API end-to-end run:

| Request | Result |
|---|---|
| `POST` | 201, answered; claims verified |
| `GET` run, `GET` history | 200 |
| Result page | Renders the verified claims and limitations |
| Another organisation's scope | 403 |
| Signed out | 401 JSON |

The database tests prove that each of the following is **caught and withheld**:
- a forged quotation;
- an unapproved source;
- an out-of-date version;
- a mismatched citation;
- an invented passage;
- quoting a display-only source.

They also prove:
- whitespace differences in a genuine quotation still verify;
- citation without quotation from a display-only source verifies;
- a run whose only law claim is invented abstains;
- a run cannot later be upgraded to answered, and claims cannot be re-marked verified;
- outsiders can't search, read or record research.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | CI green on the Phase 4 commit | Automatic on push |
| 2 | Real legal content and the Norway evaluation set (`lovdata-no-v1`) passing the §18.2 gates | Task 2.8 (network-enabled environment) |
| 3 | Semantic and hybrid research with the real e5 model (lexical works today) | A model download host (network) |
| 4 | API keys for non-browser clients | Phase 10 |

## 6. Decisions

- **The database verifies, not the client.** Recording a run is the verification step, so a direct API caller can't claim a citation is verified.
- **Extractive answers until Phase 5.** The engine quotes law and never paraphrases it. Interpretation, inference and factual-assumption claims arrive with the reasoning agents. Their categories already exist in the ledger and API.
- **OpenAPI is hand-maintained for three operations**, rather than adding a schema library now. A contract test fails if handlers and the document diverge, or if claim categories differ from the database. Zod-generated contracts (U-26) are adopted when the API surface grows (Phase 5 or later).
- **Interpretation is not conflict.** A judgment interpreting a provision is labelled `interpretation`. Only overrulings and recorded conflicts are `conflicting_authority`.
