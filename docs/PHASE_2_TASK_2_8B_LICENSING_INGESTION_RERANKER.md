# Task 2.8b — Lovdata licence policy, ingestion completion and the legal reranker

| Field | Value |
|---|---|
| Status | 🔵 IMPLEMENTED — verified locally and on hosted (§6) |
| Date | 2026-11-12 |
| Builds on | [Task 2.8 Lovdata pilot](PHASE_2_TASK_2_8_LOVDATA_PILOT.md) |
| Migration | `20261113000000_source_licence_policy_and_sync`, `20261113100000_lovdata_licence_policy_v2` (new); `20261112900000_legal_pilot_ingestion_support` (Task 2.8, reviewed here) |
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

**Verified 2026-11-12.** The Lovdata session read the pages; this session's network does not reach those hosts. Quotes are verbatim:

| Page | Finding |
|---|---|
| User terms ("Sist endret: 31.10.2025") §2.3 "Unntak" | "Gjeldende formelle lover" and "Gjeldende sentrale forskrifter" may be copied, used and shared "hvis du oppgir Lovdata som kilde og ellers følger vilkårene i" NLOD 2.0. Then: "Massenedlasting og systematiske uttrekk er ikke tillatt. For større nedlastinger, bruk våre åpne API-er." (Bulk download and systematic extraction are not allowed; for larger downloads, use the open APIs.) |
| User terms §2.1 (open website services) | "Massenedlasting av innholdet er ikke tillatt." "Det er ikke tillatt å bruke innholdet til trening eller utvikling av KI-algoritmer." (No bulk download; no training or development of AI algorithms on website content.) |
| Article 5277 (3 Nov 2025) | "Lovdata deler to datasett via API til henholdsvis lover og sentrale forskrifter, under en NLOD 2.0-lisens", free of charge; use in "KI-løsninger, chatboter, automatisert juridisk veiledning og analyseverktøy" is foreseen. It says nothing explicit on training |
| `api.lovdata.no/v1/publicData/list` | The two NLOD datasets are `gjeldende-lover.tar.bz2` and `gjeldende-sentrale-forskrifter.tar.bz2`, exactly the policy's datasets. The four Norsk Lovtidend archives (`lovtidend-*`) are deliberately outside the policy |
| NLOD 2.0 (`data.norge.no/nlod/en/2.0`) | Verified by the owner, 2026-11-12. §2 permits copying, modification, combination and redistribution for any purpose, subject to the licence conditions. §5 requires attribution to the licensor and a reference to the licence; links to the licence and the original source where practicable; and identification of modifications. This environment still receives HTTP 406 from that host |

## 2. Source-specific licence policy

`private.legal_source_licence_policies` holds an **append-only, versioned** policy per source. The latest version applies to that source only.

**Current policy (Lovdata only):**

| Field | Value |
|---|---|
| Licence | `NLOD-2.0`, `https://data.norge.no/nlod/en/2.0` |
| Attribution (current, version 2) | "Contains data made available by Lovdata under the Norwegian Licence for Open Government Data (NLOD) 2.0. Source: Lovdata. Njumeni has processed and indexed the material for legal research. The authoritative legal text remains attributable to its original source." It names the licensor, references the licence and gives the modification notice (NLOD §5). Also link to the licence and to the Lovdata source |
| Version history | v1 (`20261113000000`): bilingual NLOD notice. v2 (`20261113100000`): the owner's attribution after verifying NLOD §2 and §5. Hosts, datasets and uses are unchanged. Both versions stay on record |
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

## 4a. Evaluation on the real corpus (lovdata-no-v1, 41 cases, 2026-11-12)

Run by the Lovdata session on a fresh stack: 753 acts and 31 007 passages ingested with adapter 1.1.0 and embedded with multilingual-e5-small-v1. Hybrid mode. Thresholds unchanged.

| Metric | Gate | First stage only | With `legal-rerank-1.0.0` (defaults) |
|---|---|---|---|
| Recall@10 | ≥ 0.80 | 1.000 ✅ | 1.000 ✅ |
| Precision@5 | ≥ 0.60 | 0.316 ❌ | 0.210 ❌ |
| MRR | — | 0.718 | **0.903** |
| Currency accuracy | ≥ 0.95 | 1.000 ✅ | 1.000 ✅ |
| Section hit@10 | — | 0.923 | 0.846 |
| Abstention | — | 0/2 | 0/2 |

**Reading.**
- The reranker ranks the correct act first in 33 of 39 answerable cases.
- Its defaults still return 4–5 distinct acts, so Precision@5 (relevant distinct authorities among those returned) stays near 1/5.
- Abstention fails in both cases. The out-of-scope question returns 4 acts.

**Response.**
- Authority-level confidence options were added: `authorityMargin` and `maxAuthorities`. Their defaults leave behaviour unchanged.
- The runner accepts `NJUMENI_EVAL_RERANK_OPTIONS` for calibration sweeps.
- Settings are adopted only if every gate passes. The gate is not lowered.
- Because the settings are calibrated on this set, a held-out set is required before `partial` coverage is claimed.

**Calibration sweep (2026-11-12, 36 runs, real corpus).** Grid:
- `authorityMargin` 0.7, 0.8, 0.85 or 0.9;
- `maxAuthorities` 1, 2 or 3;
- `abstainBelow` 0.2, 0.35 or 0.5;
- `maxPassagesPerAuthority` 10.

`abstainBelow` made no difference.

| Margin | Max authorities | P@5 | R@10 | MRR | Currency | Section hit | All gates |
|---|---|---|---|---|---|---|---|
| any | 1 | 0.846 | 0.846 | 0.846 | 0.667 | 0.846 | ❌ currency |
| 0.9 | 2 | 0.782 | 0.897 | 0.872 | 0.833 | 0.897 | ❌ currency |
| 0.8 | 3 | 0.598 | 0.974 | 0.897 | 1.000 | 0.923 | ❌ P@5 |
| 0.85 | 3 | 0.667 | 0.974 | 0.897 | 1.000 | 0.923 | ✅ |
| **0.9** | **3** | **0.774** | **0.974** | **0.897** | **1.000** | **0.923** | **✅ adopted** |

**Adopted.** `CALIBRATED_RERANK_OPTIONS` (margin 0.9, 3 authorities, 10 passages per authority) as `legal-rerank-1.1.0`, in the research engine and as the evaluation runner's default. The gates were not changed.

**Open.**
- Abstention is still 0/2. Its base scores exceed 0.5, so it needs a different signal, for example lexical evidence or out-of-scope detection.
- A held-out Norwegian set must confirm the calibration before `partial` coverage is recorded.

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

1. The authorised rights reviewer records the rights review with the **current policy attribution** (version 2; the trigger refuses any other wording). Activate adapter `1.1.0` only when the Precision@5 gate also passes. Commands: [Task 2.8 §6](PHASE_2_TASK_2_8_LOVDATA_PILOT.md).
2. Run the worker from a host whose egress Lovdata accepts, then the embedding backfill.
3. Run `npm run eval:retrieval -- ../../legal-data/evaluation-datasets/lovdata-no-v1.json`. It now measures the reranked pipeline. `partial` coverage stays refused until every gate passes.
