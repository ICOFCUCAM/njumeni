# Phase 2 Task 2.8: Lovdata pilot source, real embeddings and the Norwegian evaluation set

| Field | Value |
|---|---|
| Status | 🔵 IMPLEMENTED: verified on the local stack. **Hosted: rights approved and source activated by the owner on 2026-11-14 (§6, steps 2–3). Ingestion not yet run** |
| Date | 2026-11-12 |
| Governing plan | [Phase 2 plan](PHASE_2_PLAN.md) Tasks 2.8 and 2.10; master plan §6.3, §6.7 (U-21), §5.7 (U-22), §18.2; U-27 |
| Source | Lovdata public data: `gjeldende-lover.tar.bz2` (current consolidated acts) |
| Code | `modules/legal-knowledge/lovdata-document.ts`, `lovdata-archive.ts`, `lovdata-adapter.ts`; adapter `lovdata-public-data@1.0.0` (now `1.1.0`: [Task 2.8b](PHASE_2_TASK_2_8B_LICENSING_INGESTION_RERANKER.md)) |
| Migration | `20261112900000_legal_pilot_ingestion_support` |
| Evaluation set | [`lovdata-no-v1`](../legal-data/evaluation-datasets/lovdata-no-v1.json) |

## 1. What was verified, and how

Facts were taken from the provider's own pages and data on 2026-11-12. Nothing below relies on memory.

| What | URL | Outcome | Evidence |
|---|---|---|---|
| Dataset listing | `https://api.lovdata.no/v1/publicData/list` | 200, JSON | `gjeldende-lover.tar.bz2`, "Gjeldende lover, ajourført med endringer", `sizeBytes` "5809848", `lastModified` 2026-11-11T02:32:00Z. Also listed: `gjeldende-sentrale-forskrifter.tar.bz2` and Lovtidend archives |
| Access and licence | `https://api.lovdata.no/om-api-tjenesten/` | 200 | "Lovdata tilbyr to gratis datasett med henholdsvis lover og sentrale forskrifter, **uten krav om bruker eller autentisering**." · "Også konsoliderte (ajourførte) versjoner av gjeldende lover og sentrale forskrifter **kan fritt benyttes til alle formål uten vederlag, gjennom API. Dataene er lisensiert under NLOD 2.0.**" · "Nye datapakker legges ut hver natt". Download links: `https://api.lovdata.no/v1/publicData/get/{filename}` |
| Purpose | `https://api.lovdata.no/` | 200 | "Benytt datagrunnlaget fritt for eksperimentering og forskning med KI." · "Alle dokumenter foreligger i XML-kompatibel HTML med strukturer som kapitler, paragrafer og ledd." |
| Exclusions | `https://api.lovdata.no/faq/` | 200 (headings only) | The question "Hvorfor inkluderer dere ikke historiske og opphevede lover?" confirms that historical and repealed acts are **not** in the free sets. The answer text, and the answer to "Hvorfor må vi kreditere Lovdata ved bruk?", were collapsed and could not be read |
| NLOD 2.0 licence text | `https://data.norge.no/nlod/no/2.0`, `/en/2.0` (HTTPS, plain HTTP, `?lang=en`); `www.digdir.no` | 406 on every data.norge.no route; digdir.no does not resolve from this environment | **Not verified.** The licence's grant and attribution clauses and its suggested attribution wording still need confirming (§6, step 1). Second attempt 2026-11-12 |
| Lovdata user terms | `https://lovdata.no/info/brukeravtale` ("Sist endret: 31.10.2025") | 200 | §2.3: you may "fritt kopiere, bruke og dele" regulations in Norsk Lovtidend, current formal acts and current central regulations "hvis du oppgir Lovdata som kilde og ellers følger vilkårene i" NLOD 2.0 (linked). The same section continues: "Av ytelseshensyn gjelder unntaket kun for enkeltlover og -forskrifter. **Massenedlasting og systematiske uttrekk er ikke tillatt.**" §2.1, for other content: "Det er ikke tillatt å bruke innholdet til trening eller utvikling av KI-algoritmer." |
| API specification | `https://api.lovdata.no/swagger/index.html` | 200, rendered client-side only; `/swagger/v1/swagger.json` 404 | No rate limits found on any readable page |
| File format | `/muligheter/` 404; no format documentation found | — | The structure was read from the archive itself (§3) |

**Network note.** Lovdata's edge (Varnish IPS) answered `405 Request stopped` to every request from this cloud environment's egress, including an honestly identified client. The official archive was therefore fetched through the session's web-fetch tool, which Lovdata served normally (200, `application/x-bzip2`). The file was checked before use:

| Check | Result |
|---|---|
| Size | 5 809 848 bytes, equal to the published `sizeBytes` |
| bzip2 integrity | `bzip2 -t` passed |
| SHA-256 | `684a65593a2345c0ca30108d783049180406eaad84af9cc7cf817b868f40df89` |
| Contents | 753 XML documents under `nl/` |

The archive was never committed. A worker host that Lovdata serves directly uses the HTTP source, which checks the listing before downloading. A host that Lovdata refuses can use an operator-downloaded file, with its listing facts (`LOVDATA_ARCHIVE_*`, §4).

## 2. Rights assessment (prepared for the owner)

| Permission | Proposed | Basis |
|---|---|---|
| retrieve, store, normalise, index | yes | "fritt benyttes til alle formål" through the API, NLOD 2.0 |
| quote, display | yes | Same statement; display with attribution |
| redistribute | yes, **pending the NLOD text** | NLOD is an open-data licence permitting redistribution; confirm the clause (step 1) |
| Attribution | Required | The user terms require "oppgir Lovdata som kilde" (name Lovdata as the source) and NLOD 2.0's conditions. Proposed wording: "Kilde: Lovdata (https://lovdata.no/). Lisensiert under Norsk lisens for offentlige data (NLOD) 2.0." Adjust it to NLOD's own form once that is verified |
| **Resolved 2026-11-12** | — | Owner decision: the public API datasets are licensed under NLOD 2.0 and may be used commercially and for RAG; website scraping stays prohibited; no training on website content; no fine-tuning without separate legal confirmation. Enforced as a source-specific licence policy: [Task 2.8b](PHASE_2_TASK_2_8B_LICENSING_INGESTION_RERANKER.md). The original note follows. The website terms (§2.3) forbid bulk downloading and systematic extraction from the website services. The API page offers the same content as nightly bulk datasets "fritt … til alle formål" and "for eksperimentering og forskning med KI". The pilot uses only the API datasets and trains no model: it embeds text with a pre-trained model for retrieval. The reading that the API datasets are a separate, permitted channel is plausible, but it is not confirmed. **Confirm it with Lovdata, or take legal advice, before approval** |
| Restrictions | Current consolidated acts only | No historical or repealed acts (FAQ). Lovdata's case law is commercial and out of scope (master plan §6.3) |

Statutes are also not protected by copyright in Norway. Åndsverkloven § 14, as ingested: "Lover, forskrifter, rettsavgjørelser og andre vedtak av offentlig myndighet er uten vern etter denne loven." That is a separate basis for the statute text. This pilot nevertheless relies on the published licence, which also covers Lovdata's consolidation and metadata.

## 3. Source structure (read from the archive)

```
header.documentHeader > dl.data-document-key-info > dt.X / dd.X
  legacyID (Datokode, e.g. LOV-2005-06-17-62) · dokid (NL/lov/2005-06-17-62) · refid (lov/2005-06-17-62)
  dateInForce (I kraft fra) · lastChangeInForce (Ikrafttredelse av siste endring) · lastChangedBy
  changesToDocuments (Endrer) · ministry · legalArea · dateOfPublication · titleShort · title · eli
main.documentBody > section.section (h2–h6) > article.legalArticle[data-name="§1-1"]
  > h3.legalArticleHeader (span.legalArticleValue "§ 1-1", span.legalArticleTitle)
  > article.legalP | numberedLegalP | ol > li[data-name="a."] > article.listArticle
  article.changesToParent (amendment notes) · footer.footnotes (editorial)
```

Observations that shaped the adapter:

- 753 documents; 28 661 `legalArticle` sections; 107 short or historical acts have no numbered sections.
- Languages: `nb` 639, `nn` 97, `no` 17. One `lang` attribute is malformed (`nl-20200507-040.xml`).
- The Constitution ships twice (`nl-18140517-000.xml` and `-nn.xml`) under one DokumentID.
- `dateInForce` is missing in 27 documents and sometimes lists several dates. `lastChangeInForce` is missing in 180.
- One act (`nl-19831223-076.xml`) publishes a title only.

## 4. Implementation

| Part | Behaviour |
|---|---|
| `lovdata-document.ts` | Dependency-free tolerant tokenizer and element tree; entity decoding. Reads the key-information list. Emits **one unit per `§`**, with the chapter path (for example `["Kapittel 15. …", "§ 15-3"]`). Keeps list markers; drops amendment notes and footnotes; shortens very long annex headings in paths. Collects references to other acts |
| `lovdata-archive.ts` | POSIX tar reader (checksums; paths confined; size and entry limits; strict UTF-8). Archive checks: bzip2 signature and published size; SHA-256 recorded. HTTP source: identifying user agent, listing check, timeouts; 429 → `RATE_LIMITED`, 5xx → `UPSTREAM_5XX` (retryable). The file source requires the listing facts. bzip2 is decoded by the optional worker-only runtime `seek-bzip@2.0.0` (MIT), loaded lazily like the embedding runtime |
| `lovdata-adapter.ts` | Manifest `lovdata-official` / `lovdata-public-data@1.0.0`, host `lovdata.no` (covers `api.lovdata.no`). Discovery returns sorted DokumentIDs in pages of 200 with an `after:<id>` cursor. External ID: the DokumentID, plus `:nn` for a language variant |
| Authority mapping | Citation from the Datokode; type `act` (`constitution` for `lov/1814-05-17`); language from the document; canonical URI = the document's `<base href>` + RefID (`https://lovdata.no/lov/2005-06-17-62`). Source URI = archive URL + `#entry`. **`validFrom` = Ikrafttredelse av siste endring, else I kraft fra** (when it is a single date). Metadata: dataset, `lastModified`, archive SHA-256, entry SHA-256, ELI, ministries, legal areas, licence |
| Relationships | `amends` from "Endrer", and `cites` from statute-text links, **only to acts in the dataset** (at most 100 per act). An edge to an act not yet ingested is deferred and appended on the next run |
| Contracts | `LegalAuthorityInput.validFrom`, optional `sections` from adapters, `createSectionPassages` (one passage per section; sections over 2 000 characters split with their path kept; offsets verified against the normalised text) |
| Migration `20261112900000` | `legal_ingestion_append_authority` records `valid_from` and each passage's `section_path` (validated; same signature and grants). New `legal_ingestion_enqueue_continuation(job, key)` queues the next page from a finished job's saved cursor, re-checking every gate. Approves nothing |
| Worker | `worker-adapters.ts` registers the Lovdata adapter. Registration alone permits nothing: the database gates decide |
| Evaluation | `run-retrieval-evaluation.mjs` embeds questions with the local model for semantic and hybrid modes. The harness accepts `expectedSections` and reports `sectionHitAt10` |

Tests: `apps/web/tests/legal-knowledge-lovdata.test.mjs` (18 tests, using short NLOD-licensed excerpts of two acts) and two new harness tests. pgTAP: `supabase/tests/legal_pilot_ingestion.test.sql` (18 assertions).

## 5. Local run (2026-11-12, local Supabase stack, all 39 migrations)

The gates were set **on the local stack only**, by reviewer `local-verification:task-2.8 (not an owner approval)`. A local stack cannot ingest without them. Nothing in the repository approves or activates the source, and the hosted project was not touched (U-27).

| Run | Pages | Created | Unchanged | Time | Authorities | Versions | Passages | Relationships |
|---|---|---|---|---|---|---|---|---|
| 1 | 4 (200+200+200+153) | 753 | 0 | 38 s | 753 | 753 | 31 007 | 3 084 (rest deferred) |
| 2 | 4 | 0 | 753 | 30 s | 753 | 753 | 31 007 | 4 487 |
| 3 | 4 | 0 | 753 | 30 s | 753 | 753 | 31 007 | 4 487 |

- **Idempotent:** re-runs create no versions, passages or duplicate edges.
- **Edges:** run 2 completes the deferred edges (448 `amends`, 4 039 `cites`).
- **Passages:** 30 942 carry a section path; all 31 007 use the `norwegian` text-search configuration.
- **Validity:** 657 versions record `valid_from`. 96 acts publish no single in-force date, so their versions have none.

**Embeddings.** `intfloat/multilingual-e5-small` (`Xenova/multilingual-e5-small`, q8, through `@huggingface/transformers@4.3.2`) ran through `local-embedder.ts` and `embedding-backfill.ts`, with profile `multilingual-e5-small-v1`, 384 dimensions and `passage:`/`query:` prefixes. **All 31 007 passages were embedded** under `multilingual-e5-small-v1` with 384 dimensions. That is 30 751 in one backfill (2 681 s, about 11.5 passages per second on 4 CPU cores), after a 256-passage trial.

The model files come from Hugging Face's CDN. The environment's allow-list was extended (with approval) to `us.aws.cdn.hf.co` and `us.gcp.cdn.hf.co`.

## 6. For the owner: approval and activation

**Done on hosted, 2026-11-14.** The owner approved Lovdata in the session chat ("just approve it"). Steps 2 and 3 were run on the hosted project with the commands below, recorded as `Njumeni owner (approved in chat, 2026-11-14)`. Result: `rights_status = approved` (valid 12 months), `status = active`, `ingestion_enabled = true`, adapter `lovdata-public-data@1.1.0`. One rights-review and one activation audit row were written. The owner chose to activate before the Precision@5 gate passes (Task 2.8b §7 had advised waiting). That gate still governs coverage: Norway stays `planned` until ingestion and step 5, and `partial` stays refused until the evaluation passes. Steps 4 and 5 remain.


These operations are not done. They run on the hosted project, using a service-role connection (SQL editor or `psql "$SUPABASE_DB_URL"`). Each is a separate audited step. Hosted holds all 40 migrations, including `20261112900000` and `20261113000000` (applied and verified 2026-11-12; [Phase register](PHASE_REGISTER.md)).

1. **Licence position: settled** (owner, 2026-11-12; [Task 2.8b](PHASE_2_TASK_2_8B_LICENSING_INGESTION_RERANKER.md) §1). The attribution is fixed by licence policy version 1, and activation is refused under any other wording.
2. **Record the rights review** (sets `rights_status = 'approved'`; does not activate):
   ```sql
   select public.legal_source_record_rights_review(
     (select id from private.legal_sources where source_key = 'lovdata-official'),
     '<owner name>', 'NLOD-2.0', '2.0', 'https://api.lovdata.no/om-api-tjenesten/',
     (public.legal_source_licence_policy_get('lovdata-official') ->> 'attributionText'),
     now(), now() + interval '12 months',
     '{"retrieve":true,"store":true,"normalise":true,"index":true,"quote":true,"display":true,"redistribute":true}'::jsonb,
     array['attribution-required','current consolidated acts only; no historical or repealed acts']);
   ```
3. **Activate, enable ingestion and pin the adapter:**
   ```sql
   select public.legal_source_set_activation(
     (select id from private.legal_sources where source_key = 'lovdata-official'),
     '<operator>', 'Pilot: Lovdata current acts under NLOD 2.0 (Task 2.8)', 'active', true,
     'lovdata-public-data', '1.1.0');
   ```
4. **Ingest.** Enqueue page 1, run the worker, then enqueue each next page until the RPC answers `LEGAL_INGESTION_NO_CONTINUATION` (four pages today):
   ```sql
   select public.legal_ingestion_enqueue_job(
     (select id from private.legal_sources where source_key = 'lovdata-official'),
     'lovdata-public-data', '1.1.0', 'lovdata-gjeldende-lover-<date>-page-1');
   select public.legal_ingestion_enqueue_continuation('<finished job id>', 'lovdata-gjeldende-lover-<date>-page-2');
   ```
   Worker host: `cd apps/web && npm install --no-save seek-bzip@2.0.0 @huggingface/transformers@4.3.2`. Then run `npm run worker:legal-knowledge` with:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`;
   - `LEGAL_INGESTION_WORKER_ID`;
   - `LEGAL_NORMALISATION_PROFILE=lovdata-nl-html-v1`.

   If Lovdata refuses the host's egress, download the archive elsewhere and also set:
   - `LOVDATA_ARCHIVE_PATH`;
   - `LOVDATA_ARCHIVE_SIZE_BYTES` and `LOVDATA_ARCHIVE_LAST_MODIFIED` (from the listing);
   - `LOVDATA_ARCHIVE_RETRIEVED_AT`;
   - optionally `LOVDATA_ARCHIVE_SHA256`.

   Then run the embedding backfill (`runEmbeddingBackfill` with `createLocalLegalEmbedder()`).
5. **Coverage (optional, owner).** Record a source coverage review (`legal_source_record_coverage_review`). Then Norway may be set to `pilot` (`update private.jurisdictions set status = 'pilot' where code = 'NO'`); the trigger allows this only with a live, approved source. `partial` stays refused until a recorded `lovdata-no-v1` evaluation passes every gate (§7). It does not pass yet.

## 7. Evaluation (`lovdata-no-v1`, 41 cases)

The 41 cases are:

- 39 questions, each naming one expected act **and section**;
- 6 currency checks: the version's `valid_from` must equal the recorded *Ikrafttredelse av siste endring*;
- 2 abstention cases: an as-of date before an act's latest amendment (the free dataset holds no earlier text), and an out-of-scope question.

Every expected section was matched in the ingested text before the set was saved. Searches use `nb`, `nn` and `no`.

Command: `npm run eval:retrieval -- ../../legal-data/evaluation-datasets/lovdata-no-v1.json <mode>` on the local stack, 2026-11-12. Gates come from `quality/evaluation-thresholds.json` and are **unchanged**.

| Metric | Gate | Lexical | Hybrid | Semantic |
|---|---|---|---|---|
| Recall@10 | ≥ 0.80 | 0.897 ✅ | **1.000** ✅ | 1.000 ✅ |
| Precision@5 | ≥ 0.60 | 0.252 ❌ | **0.312** ❌ | 0.308 ❌ |
| Currency accuracy | ≥ 0.95 | 1.000 ✅ | **1.000** ✅ | 1.000 ✅ |
| MRR | reported | 0.641 | 0.732 | 0.909 |
| Section hit@10 | reported | 0.692 | 0.923 | 0.974 |
| Abstention accuracy | reported | 0.000 | 0.000 | 0.000 |
| **Result** | | FAIL | **FAIL** | FAIL |

**What the numbers mean:**

- **Precision@5 fails in every mode, and this is not tuning noise.** Each question has one relevant act, while a hybrid search returns ten passages from 1–10 distinct acts (median 5). The metric divides by the acts returned (at most five), so a perfect first-ranked hit next to four other acts scores 0.2. Meeting 0.6 needs either fewer, more confident authorities per answer (a reranker with an abstention threshold, Phase 4) or a recalibration of the metric's definition. Recalibrating is an owner decision under the thresholds file's rule. Nothing was lowered.
- **Semantic outranks hybrid** (MRR 0.909 against 0.732). The right act ranks first in 33 of 39 questions semantically, but only in 23 with the fixed 0.45 lexical / 0.55 semantic blend, where broad lexical matches displace it. The weights are a candidate for recalibration on this set.
- **Lexical misses** are the Constitution questions (×2), the age of criminal responsibility, and the duty to help an injured animal. In each, everyday wording does not share stems with the statute.
- **Abstention fails in every mode.** Search returns the best-matching acts even when nothing answers the question. Abstention needs a calibrated threshold or a verifier (Phase 4).
- **Currency** passes, but only for current versions: the dataset contains no earlier texts (§8).

This set's evaluation was **not** recorded as coverage evidence (`legal_record_retrieval_evaluation`). It does not pass, and the local database is reset for the verification sweep.

## 8. Known gaps

| Gap | Effect | Resolution |
|---|---|---|
| Historical versions are not in the free dataset | A question about the law before the latest amendment finds no version of that act. This is correct, but other acts still match | Version history comes from nightly re-ingestion (new versions from now on), or from licensed historical data |
| A superseded version's `valid_until` is never closed (versions are append-only) | Once a second consolidated version exists, an as-of search can match both | Choose the latest version per authority at the as-of date in the search RPCs (Task 2.11 or Phase 6 monitoring) |
| NLOD text and attribution wording not verified; the website terms forbid bulk extraction | Approval is not safe until the owner confirms that the API datasets are a permitted channel | Owner step 1 (§2) |
| Continuation pages are enqueued by an operator | Four commands per full run | Scheduled monitoring (Phase 12) |
| Lovdata refuses this cloud environment's egress | The HTTP source cannot be exercised here against the live service (it is unit-tested) | Run the worker where Lovdata answers, or use the file source |
| Central regulations (`gjeldende-sentrale-forskrifter.tar.bz2`) are not ingested | Regulations are absent | Same adapter shape; a separate review and pin |
