# Phase 12 — Global expansion

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** The master-plan gate (every jurisdiction at least `partial`) is **not met** and cannot be until real content is ingested; see §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §6 (jurisdiction profiles, initial framework), §6.7 and U-21 (coverage levels), U-22 (search languages), P8 (honest coverage) |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Acceptance (master plan) | Each jurisdiction reaches at least `partial` (§6.7) |

## 1. Objective and honest scope

Make Njumeni structurally ready for every priority jurisdiction and language, without claiming coverage it does not have.

The master plan's gate needs **live, rights-approved legal content** with coverage reviews and passing evaluation sets. That is Task 2.8 (Lovdata first), and it needs a network-enabled environment and source-by-source rights review, neither of which this session has. Phase 12 therefore delivers:
- the jurisdiction model;
- the official source registry, held for rights review;
- cross-language research;
- citation conventions;
- interface localisation;
- a readiness report that keeps every jurisdiction at its true level. The database already refuses any promotion the evidence does not support.

## 2. Design

| Element | Implementation |
|---|---|
| Jurisdiction model | Migration `20261112700000` catalogues the **EEA**, **OHADA**, **Nigeria**, **Kenya**, **South Africa**, **Ghana** and **Senegal** (status `catalogued`, never marketed). **Cameroon now sits under OHADA**, whose Uniform Acts apply directly, so OHADA law passes the jurisdiction-fit check for Cameroonian research. Norway is deliberately *not* placed under the EU: `jurisdiction_relationships` records that it is an EEA member and **incorporates EU law by treaty**. Each jurisdiction records its citation convention and a territorial note (e.g. the UK's three legal systems, Cameroon's bijural system) |
| Official sources | EEA-Lex, GovInfo, the OHADA portal, NigeriaLII, Kenya Law, SAFLII, GhaLII and the Senegalese official journal are registered as `review_required`, not ingestion-enabled and `planned`. They become usable only after the Phase 2 rights review and activation workflow |
| Legal glossary (U-22) | `private.legal_glossary`: **50 legal concepts** aligned across Norwegian (Bokmål), English and French, with preferred terms and synonyms. Signed-in users read it through `legal_glossary_terms` |
| Cross-language research | `modules/global/language.ts` detects the question's language (nb, nn, en, fr). When it differs from the sources' language, `modules/global/glossary.ts` rewrites the question as the **recognised legal concepts** in the source language (longest terms first, simple inflections). A rewrite needs at least two concepts and **never invents words**. The research service searches with the rewrite and records it as the first **limitation**, so the user sees exactly what was searched. Quotations stay in the source language |
| Citation conventions | `modules/global/citation-style.ts`: Norway (`… (LOV-…) § 15-7`), EU (`Regulation (EU) 2016/679, Art. 6`), UK (`…, s. 98`; neutral citations for judgments), US (`42 U.S.C. § 2000e-2`), OHADA, civil-law Africa and Cameroon (`…, art. 414`; English variant `Article`), Commonwealth Africa (`…, section 45`), international (`…, art. …`) |
| Interface localisation | `modules/global/i18n.ts`: English, Norwegian Bokmål and French for navigation and the core legal disclaimer. Locale resolution: the **profile locale** (an explicit choice; new profiles default to English), then the browser's `Accept-Language`, then English; Nynorsk falls back to Bokmål. A test asserts that every string exists in every locale |
| Readiness and P8 | `jurisdiction_readiness()` reports, per jurisdiction: legal system, parent and treaty relationships; coverage level; **what it may be marketed as** (only what the level allows); sources (total, approved, live); authorities; the latest evaluation result; glossary support for its languages; citation style; and whether it meets `partial` |
| Interface | `/jurisdictions` (the coverage table: "N of M jurisdictions are at partial coverage or better", plus how cross-language questions work); the research form offers Portuguese and Swahili sources |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 12.1 | Jurisdiction model: EEA, OHADA, more African jurisdictions; relationships; citation conventions | ✅ |
| 12.2 | Official sources registered for rights review | ✅ |
| 12.3 | Multilingual legal glossary (nb, en, fr; 50 concepts) | ✅ |
| 12.4 | Cross-language research with a disclosed rewrite | ✅ |
| 12.5 | Jurisdiction-specific citation formatting | ✅ |
| 12.6 | Interface localisation (en, nb, fr) | ✅ |
| 12.7 | Readiness report and `/jurisdictions` | ✅ |
| 12.8 | **Real content per jurisdiction to `partial`** (rights review, adapters, coverage review, evaluation set per jurisdiction) | ⛔ Blocked: network access and per-source rights review (Task 2.8 first) |
| 12.9 | Full interface translation, plus Portuguese and Swahili glossaries | ⏸ Incremental; the framework and tests are in place |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **679/679** in 23 files (`global_expansion` 18/18; the Phase 2 seed assertion now names the initial six sources instead of counting all sources) |
| Application tests | **250/250** (`global-expansion` 4) |
| Type check, Prettier (CI set), content policy, migration guard, release gates, `next build` | ✅ |
| End to end over HTTP (synthetic) | ✅ See below |

pgTAP covers:
- the catalogued jurisdictions, all catalogued;
- Cameroon under OHADA; Norway not under the EU but incorporating EU law by treaty; citation conventions;
- new sources held inactive pending rights review; **promotion to pilot without a live, approved source is refused**;
- the glossary is not public; Norwegian and French are aligned by concept; at least 50 concepts;
- no jurisdiction reported at `partial`; Norway is only "Coming", catalogued jurisdictions are "Not marketed"; glossary support is reported;
- an OHADA Uniform Act passes re-verification for Cameroonian research without a jurisdiction mismatch;
- the research profile lists the new jurisdictions.

End to end on the built app:
1. An **English** question was researched against **Norwegian** sources over the API. The run was `answered`, with the verified Norwegian quotation from SYN-AML-5-2. Its first limitation states: *"The question was asked in en and searched in nb as the legal concepts 'arbeidstilsynet ulykke arbeidsgiver alvorlig varsle' (legal glossary). Check that these match your question."*
2. `/jurisdictions` renders the honest table ("Coming", "Not marketed", OHADA).
3. A user whose profile locale is `fr-CM` sees French navigation ("Recherche juridique", "Affaires et dossiers", "Juridictions").

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | ~~CI green on the Phase 12 commit~~ ✅ `c866ebd`: runs `43138014579` (CI and security) and `43138014534` (database verification), both successful | Done |
| 2 | **Each jurisdiction at `partial` or better** (master-plan gate) | Per jurisdiction: rights review → adapter → ingestion → coverage review → evaluation set passing. Starts with Norway (Task 2.8) in a network-enabled environment |
| 3 | Glossary reviewed by qualified lawyers per language | Legal review |
| 4 | Phases 3–11 closed | Their own closeout items |

## 6. Decisions

- **Coverage is earned, not configured.** Nothing in Phase 12 raises a coverage level. The database trigger from Task 2.7 refuses it, and the readiness report shows why.
- **Concepts, not machine translation.** Cross-language search uses reviewed legal terminology and shows its rewrite. A model-based translation agent can add to it once a provider is chosen (D-5), but answers keep quoting sources in their own language.
- **Model the law as it actually applies.** OHADA's direct effect and Norway's EEA incorporation are represented explicitly, so jurisdiction-fit checks give legally meaningful results.
