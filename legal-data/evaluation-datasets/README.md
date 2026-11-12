# Legal retrieval evaluation datasets

Permanent evaluation sets for Njumeni's legal search (Master Plan v2.0 §18.2, upgrade U-15; Phase 2 Task 2.10). The harness is `apps/web/src/modules/legal-knowledge/retrieval-evaluation.ts`.

## Rules

- **Content must be synthetic or properly licensed.** Record the licence in `contentLicence`.
- **Never include customer data.** This repository is public (ADR-0003).
- **Name expected authorities by `sourceKey` and official `citation`** (for example `LOV-2005-06-17-62`), never by database IDs. That way a dataset runs against any environment.
- **Give every case an `asOfDate`.** The law is applied as it stood on that date.
- **Changing a published dataset bumps its `version`.** Reports cite the dataset key and version.

## Format

| Field | Meaning |
|---|---|
| `datasetKey`, `version` | Stable identity of the dataset |
| `jurisdictionCode` | For example `NO` |
| `contentLicence` | `synthetic` or the licence of the source material |
| `cases[].question` | The user's question, in the source language |
| `cases[].asOfDate` | The date whose law applies |
| `cases[].languageCodes` | Search languages, for example `["nb"]` |
| `cases[].mode` | `lexical`, `semantic` or `hybrid` (default `hybrid`) |
| `cases[].relevant` | Authorities a correct answer must retrieve. **An empty list means the system must abstain** (return nothing) |
| `cases[].expectedValidFrom` | Optional currency check: the top relevant result must be the version in force from this date |
| `cases[].expectedSections` | Optional section labels that answer the question (the last section-path element, for example `§ 15-3`). Reported as `sectionHitAt10`, not gated |

## Metrics and gates

| Metric | Definition | Gate |
|---|---|---|
| Recall@10 | Share of relevant authorities among the top 10 unique authorities | ≥ 0.80 |
| Precision@5 | Share of the returned top-5 unique authorities that are relevant | ≥ 0.60 |
| MRR | 1 / rank of the first relevant authority | Reported |
| Currency accuracy | Top relevant hit is the version in force on `asOfDate` | ≥ 0.95 |
| Abstention accuracy | Out-of-scope questions return no results | Reported |
| Section hit@10 | A top-10 passage of a relevant authority comes from an expected section | Reported |

The gates are initial targets, to be recalibrated with the first real data. A gate with no measurable cases counts as **failed**, never as passed.

## Datasets

| Key | Status |
|---|---|
| `synthetic-no-v1` | Harness and pipeline verification with fictitious authorities (local databases only) |
| `lovdata-no-v1` | 41 cases over Lovdata's current acts (NLOD 2.0); questions written for Njumeni, expected acts and sections checked against the ingested text. Results: [Task 2.8 record](../../docs/PHASE_2_TASK_2_8_LOVDATA_PILOT.md) §7 |
