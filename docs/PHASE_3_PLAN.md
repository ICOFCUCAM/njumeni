# Phase 3 — Evidence intelligence

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending the items in §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §7 (evidence architecture), Module C, upgrades U-11 and U-12 |
| Strategic weight | **Second strategic priority:** evidence intelligence (master plan §22) |
| Execution mode | Owner-directed continuous autonomous mode (11 November 2026): one commit and push per completed phase |
| Architecture | [EVIDENCE_ARCHITECTURE.md](EVIDENCE_ARCHITECTURE.md) · [DOMAIN_MODEL.md](DOMAIN_MODEL.md) |

## 1. Objective

Turn uploaded documents into structured, provenance-preserving evidence that is safe to handle and traceable from end to end:
- originals preserved and fingerprinted;
- scanned before anyone can read them;
- text extracted with page and offset anchors;
- dates, amounts and references detected;
- a chronology built;
- evidence linked to factual propositions;
- contradictions surfaced;
- every action recorded in a tamper-evident chain of custody.

## 2. Dependencies and parallel-phase note

Phase 3 depends on the Phase 1 storage and RLS boundary. Phase 1 is implemented and verified locally, but not formally closed: its manual CI run is outstanding. Under the owner's continuous autonomous mode, Phase 3 was built in parallel. **Phase 3 cannot formally close before Phase 1 does.** No customer data is permitted (Stage 0), and nothing is deployed to the hosted database (U-27).

## 3. Task register

| No. | Task | Deliverable | Status |
|---|---|---|---|
| 3.1 | Evidence domain schema | `private.evidence_items`, `evidence_files` (versions), extractions, passages, entities, events, propositions, links, redactions, custody. All private, reachable only through permission-checked RPCs | ✅ Implemented and verified |
| 3.2 | Upload and object storage | Upload through the private workspace bucket under its existing path policies. Registration checks that the object exists inside the item's organisation/workspace path. SHA-256 recorded at intake | ✅ |
| 3.3 | Content addressing (U-11) | Each file is identified by its SHA-256; one hash per item version. The worker re-hashes the stored bytes, and a "clean" verdict on mismatched bytes is converted to `rejected` in the database | ✅ |
| 3.4 | Intake scanning | Quarantine until scanned. A structural scanner checks byte-level type against the declared MIME type and rejects executables, macro-enabled OOXML and PDFs with JavaScript, launch actions or embedded files; it recognises the EICAR signature. A pluggable `ExternalMalwareScanner` interface is provided. **Only the trusted worker can record a verdict** | ✅ Structural; ⏳ full anti-malware engine (Stage 1) |
| 3.5 | Text extraction | PDF (`pdfjs-dist`), DOCX and XLSX (`fflate` with bounded decompression), email (MIME multipart, quoted-printable, base64, charset), plain text and CSV (UTF-8, falling back to Windows-1252) | ✅ |
| 3.6 | OCR | Images and text-less PDFs are recorded as `unsupported / OCR_NOT_CONFIGURED`, never guessed | ⏳ Blocked: needs an OCR engine and language data (network) |
| 3.7 | Passages and provenance | Paragraph passages of at most 2,000 characters with exact offsets into the full text, page numbers and content hashes | ✅ |
| 3.8 | Entity extraction | Rule-based: dates (Norwegian, English, French, numeric; day and month precision), amounts (NOK/kr/EUR/USD/GBP/XAF), emails, URLs, phone numbers, case references, organisations (AS/ASA/Ltd/Inc/GmbH…) | ✅ Rule-based; AI extraction of persons and implicit events in Phase 5 |
| 3.9 | Evidence classification | Type, sensitivity (standard / confidential / special category) and legal privilege set at intake | ✅ Manual; AI-assisted classification in Phase 5 |
| 3.10 | Chronology | One event per dated sentence, anchored to its passage; workspace chronology view; manual events supported | ✅ |
| 3.11 | Evidence relationships and contradictions | Factual propositions; evidence `supports / contradicts / qualifies` links (same workspace only); contradiction report | ✅ |
| 3.12 | Chain of custody (U-11) | A per-item, hash-chained, append-only custody log: created, registered, scanned, extracted, accessed, linked, redacted, legal hold, deletion. Verification RPC; tampering detected | ✅ |
| 3.13 | Legal hold, redaction, deletion | Legal hold blocks deletion (and the attempt is audited as `denied`). Redactions mask text on read and withhold entities inside redacted ranges. Soft deletion with a recorded reason | ✅; ⏳ physical object purge job (Phase 13 operations) |
| 3.14 | Tamper-evident audit (U-12) and correlation | `security_audit_events` hash-chained under an advisory lock, with a verification RPC. The app sends `x-correlation-id` on every request and the audit records it | ✅ (closes Phase 1 deferrals D-AUD-2 and D-AUD-4) |
| 3.15 | User interface | `/evidence`: workspace selector, upload with classification, item list with scan status, chronology, contradictions. `/evidence/[id]`: redacted passages, entities, custody log and verification, legal hold | ✅ |
| 3.16 | Worker | `npm run worker:evidence` (service role): scan, then extract, then record, until the queue is drained | ✅ |
| 3.17 | Verification and closeout | See §4 and §5 | 🟡 Local verification complete; formal closeout pending |

## 4. Verification evidence (local, 11 November 2026)

| Check | Result |
|---|---|
| Clean replay of 28 migrations | ✅ |
| pgTAP, 14 files | ✅ **372/372**, including `evidence_intelligence` 34/34 |
| `db lint` | ✅ No errors |
| Generated types | ✅ In sync with the schema |
| App tests | ✅ **202/202**, including `evidence-intelligence` 15/15 |
| Type check, production build (`/evidence`, `/evidence/[itemId]`) | ✅ |
| CI Prettier file set, migration guard (28 migrations), root tests 19/19 | ✅ |
| **End-to-end on the local stack** | ✅ See below |

The end-to-end run used a real signed-in synthetic user, real storage access rules, the real worker and real reads:
- **Quarantine:** reading before the scan → `EVIDENCE_NOT_AVAILABLE`.
- **Worker:** 3 files processed. One clean DOCX was extracted. The EICAR file was marked **infected**, and a text file declared as PDF was **rejected**.
- **Extracted content:** passages, 2 dates, organisation `Nordic Transport AS` and reference `SAK-2024/118`, giving a two-event chronology (12 and 14 March 2024).
- **Integrity:** the custody chain is valid (5 events), and the security audit chain is valid (11 records).
- **Isolation:** a second user gets `EVIDENCE_NOT_AUTHORISED` on read, and an empty storage listing.

Database tests also prove:
- outsiders can't list, read or plant evidence;
- users can't record their own scan verdict;
- mismatched bytes are rejected;
- extractions can't be replaced;
- redaction masks text and withholds entities;
- legal hold blocks deletion;
- **a silently altered custody record or audit record is detected.**

## 5. Closeout conditions outstanding

| # | Condition | Owner / dependency |
|---|---|---|
| 1 | Phase 1 formally closed (manual CI run) | Owner: GitHub Actions |
| 2 | Manual run of the CI workflows on the Phase 3 commit | Owner: GitHub Actions |
| 3 | OCR engine and language data (images, scanned PDFs) | A network-enabled environment (`njumeni`); Stage 0 has no OCR |
| 4 | Full anti-malware engine behind `ExternalMalwareScanner` (for example ClamAV) | Stage 1, before any real user file |
| 5 | Physical purge of deleted objects (after the retention period, honouring legal hold) | Phase 13 operations runbook |
| 6 | Failed sign-in audit events (D-AUD-1) | Needs a trusted server path; Phase 10 platform administration |

## 6. Decisions made in this phase

- **Evidence lives in the `private` schema behind RPCs** (like legal knowledge), rather than in public tables with RLS. This gives a single enforcement point per operation and makes custody recording unavoidable.
- **Scan and extraction results are worker-only.** The web app never holds the service-role key. A user who calls the API directly can't mark a file clean or inject extracted text.
- **Rule-based extraction now; AI in Phase 5.** Deterministic, testable and zero-cost. Every extracted item records which extractor produced it.
- **Unknown and unauthorised evidence are indistinguishable** (`EVIDENCE_NOT_AUTHORISED`), so item IDs can't be probed.
