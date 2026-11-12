# Task 2.8b — Lovdata licence policy, ingestion completion and the legal reranker

| Field | Value |
|---|---|
| Status | 🔵 IMPLEMENTED — verified locally and on hosted (§6) |
| Date | 2026-11-12 |
| Builds on | [Task 2.8 Lovdata pilot](PHASE_2_TASK_2_8_LOVDATA_PILOT.md) |
| Migration | `20261113000000_source_licence_policy_and_sync` (new); `20261112900000_legal_pilot_ingestion_support` (Task 2.8, reviewed here) |
| Adapter | `lovdata-public-data@1.1.0` |
| Engine | research engine `extractive-1.1.0`, reranker `legal-rerank-1.0.0` |

## 1. Licence position (owner decision, 2026-11-12)

The owner settled the open question in Task 2.8 §2. The sources are:
- the [user terms](https://lovdata.no/info/brukeravtale);
- the Lovdata [API announcement](https://lovdata.no/artikkel/lovdata_tilrettelegger_for_bruk_tilpasset_var_ki-hverdag_gjor_api_av_oppdatert_regelverk_gratis_tilgjengelig_for_alle/5277);
- [api.lovdata.no](https://api.lovdata.no/);
- [NLOD 2.0](https://data.norge.no/nlod/en/2.0).

| Question | Position |
|---|---|
| Lovdata public API datasets (current formal laws, central regulations) | Released under **NLOD 2.0** |
| Larger downloads | Lovdata directs them to the API |
| Ordinary website scraping | **Prohibited** (user terms) |
| Commercial use and RAG on the licensed API datasets | **May proceed** |
| AI training on ordinary website content | **Not permitted** |
| Fine-tuning on any Lovdata material | **Not without separate legal confirmation** |

This cloud session's network does not reach `lovdata.no`, `api.lovdata.no` or `data.norge.no`. The quotations in Task 2.8 §2 were read by the Lovdata session on 2026-11-12. A fresh read of the four pages was requested from that session.

## 2. Source-specific licence policy

`private.legal_source_licence_policies` holds an **append-only, versioned** policy per source. The latest version applies to that source only.

**Version 1 (Lovdata only):**

| Field | Value |
|---|---|
| Licence | `NLOD-2.0`, `https://data.norge.no/nlod/en/2.0` |
| Attribution | "Inneholder data under Norsk lisens for offentlige data (NLOD) 2.0 tilgjengeliggjort av Lovdata. Contains data under the Norwegian Licence for Open Government Data (NLOD) 2.0 made available by Lovdata." |
| Acquisition hosts | `api.lovdata.no` |
| Licensed datasets | `gjeldende-lover.tar.bz2`, `gjeldende-sentrale-forskrifter.tar.bz2` |
| Permitted | RAG, commercial use, display, quotation, redistribution |
| Not permitted | model training, model fine-tuning, website scraping |

**Rules for every other source:**
- No other source inherits this policy. pgTAP proves it.
- A source with no policy keeps the general rights-evidence rules.
- Training, fine-tuning and scraping are never permitted without an explicit policy (`private.legal_source_permits_use`, `assertTrainingExportPermitted`).

**Enforcement.** The database enforces the policy whatever the worker does:

| Point | Rule |
|---|---|
| New authority version (trigger) | Its `source_uri` must be on an acquisition host, and its `dataset` a licensed dataset. Otherwise `LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED` / `…_DATASET_NOT_PERMITTED` |
| Enabling ingestion (trigger) | Licence identifier and attribution must equal the policy (`LEGAL_SOURCE_LICENCE_POLICY_MISMATCH`). `web` access is refused when scraping is not permitted (`LEGAL_SOURCE_SCRAPING_NOT_PERMITTED`) |
| Adapter | Only licensed dataset filenames (`LOVDATA_DATASET`, default current laws). Every request goes to `https://api.lovdata.no/v1/publicData/`, never the website |
| Seeded source | `lovdata-official` changed from `web` to `bulk_download`. It is still `planned` / `review_required` / not enabled: the migration approves nothing |

## 3. Ingestion completion (adapter 1.1.0)

| Requirement | Where |
|---|---|
| Licence enforcement, NLOD attribution | §2; `source_metadata.licence`, `licenceUri`, `licencePolicyVersion` on every authority |
| Original identifiers | `externalId` = Lovdata DokumentID (`NL/lov/…`), `refid`, ELI, legacy ID in metadata |
| Source URLs | `source_uri` = API archive URL + `#entry`; `canonical_uri` = lovdata.no reference link (a citation link, not a fetch) |
| Retrieval timestamps | `retrieved_at` per version; dataset `retrieved_at` per sync |
| Versioning | A new `legal_authority_versions` row only when the content hash changes (`unchanged` otherwise) |
| Effective dates | `valid_from` = latest amendment in force, else date in force |
| Amendment relationships | `amends` edges from Lovdata "Endrer" key information; `cites` from references |
| Integrity checks | Archive size against the listing, SHA-256 of archive and every entry, tar checksums, path confinement, UTF-8 validation |
| Incremental sync | `legal_source_dataset_syncs`: an archive identical to the last complete sync is not processed again |
| Absence detection | A complete listing flags authorities it no longer contains (`legal_status = 'unknown'`, `absentFromDatasetSince`). Nothing is deleted |
| Failed-ingestion retries | Job level: durable queue backoff (unchanged). Item level: `legal_ingestion_item_failures`. Retryable failures back off exponentially from 1 min to 24 h and are abandoned after 8 attempts; terminal ones after 3. Due items join the next job |
| Provenance | Dataset name, last-modified, size and SHA-256; entry path and SHA-256; normalisation profile; licence policy version |

## 4. Legal reranker (`legal-rerank-1.0.0`)

The reranker is a second stage. The existing pipeline is kept:
- `createRetrievalPlan`;
- lexical, semantic and hybrid search;
- the effective-date, status, language and jurisdiction filters in `rankLegalPassages`.

With a reranker, `executeLegalRetrieval` searches a wider pool (3 × limit, 30 to 50) and re-scores it. Without one, the behaviour is unchanged.

| Signal | Weight | Meaning |
|---|---|---|
| retrieval | 0.42 | First-stage score fused with reciprocal ranks of the lexical and semantic lists (hybrid). Tied scores share a rank |
| provision | 0.18 | Exact provision match: "§ 15-3", "article 5", "kapittel 4" against the section path. Neutral when the question names none |
| citation | 0.14 | The question names the authority: citation, short title, title words; compound words handled |
| authority | 0.10 | Hierarchy: constitution > treaty/act > EU regulation > directive > regulation > judgment > decision > guidance |
| currency | 0.08 | In force 1, amended 0.8, unknown 0.55 (for example absent from the latest dataset); lower without a start date |
| jurisdiction | 0.05 | Home 1. Related jurisdictions (opt-in, for example OHADA for CM, EU via EEA for NO) by weight |
| language | 0.03 | The preferred language (the language of the request) |

After scoring:
1. Several passages of one authority add up to +0.06.
2. Passages under 60% of the best score are cut.
3. At most 3 passages are kept per authority.
4. The reranker abstains when the best score is under 0.2.

Every passage carries a trace: version, first-stage rank and score, every signal, and the reasons. The research engine stores it with each finding:
- `private.research_findings.ranking_trace`, sanitised and limited to 4 KB;
- returned by `research_get_run` as `rankingTrace`.

The evaluation runner measures the full pipeline by default (`NJUMENI_EVAL_FIRST_STAGE_ONLY=1` for the first stage alone). The Precision@5 gate stays at 0.6.

## 5. Migration history reconciliation

The repository files were compared with hosted `supabase_migrations.schema_migrations`, comparing the MD5 of each file with the stored statement.

| Item | Finding |
|---|---|
| 38 hosted versions, `20261110141433` → `20261112800000` | Identical to the repository files, byte for byte (MD5 equal for every version) |
| `20261112700000_global_expansion` (hosted) | Same version, name and MD5 (`af2936f33395e32bc0294c92cbb5c85b`) as `supabase/migrations/20261112700000_global_expansion.sql` |
| `20261127000000_global_expansion.sql` | **Does not exist.** It is in no file, commit or branch, and in no hosted record. No discrepancy: a misreading of `20261112700000` |
| `20261112900000_legal_pilot_ingestion_support` | Genuinely pending: in the repository, not yet on hosted. Reviewed: additive, same signatures and grants, every gate re-checked, approves nothing |

Nothing was renamed, deleted, re-applied or edited. Applied migrations are immutable (`check-migrations.mjs` in CI).

## 6. Tests and verification

| Suite | Result |
|---|---|
| pgTAP (`supabase test db`) | 26 files, **748** assertions, PASS. New: `source_licence_policy.test.sql` (37) |
| Web unit tests (`npm test`) | **294** pass. New: `legal-knowledge-licence-sync` (9), `legal-knowledge-reranker` (12) |
| Root tests, migration policy, release gates, foundation, Prettier CI set, `supabase db lint`, typecheck, build | Pass |
| Browser journeys (`npm run test:e2e`) | 3/3. The research journey recorded a finding with its reranking trace (`extractive-1.1.0`) |
| Hosted deployment | Both pending migrations applied in one transaction from commit `68dbe53`, each MD5-checked. History is 40/40, equal to the repository. Schema fingerprints (columns, functions, policies, triggers, indexes, constraints, grants) are identical to the tested local database. Security invariants hold; health reports schema `20261113000000`. A rolled-back probe confirmed enforcement. Details: [Phase register](PHASE_REGISTER.md) |

## 7. Owner steps that remain

1. Record the rights review with the **policy attribution** (the trigger refuses any other wording), then activate with adapter `1.1.0`. Commands: [Task 2.8 §6](PHASE_2_TASK_2_8_LOVDATA_PILOT.md).
2. Run the worker from a host whose egress Lovdata accepts, then the embedding backfill.
3. Run `npm run eval:retrieval -- ../../legal-data/evaluation-datasets/lovdata-no-v1.json`. It now measures the reranked pipeline. `partial` coverage stays refused until every gate passes.
