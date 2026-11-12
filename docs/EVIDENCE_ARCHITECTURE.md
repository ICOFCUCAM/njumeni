# Njumeni — Evidence Architecture

| Field | Value |
|---|---|
| Status | Describes the **implemented** Phase 3 evidence engine (verified locally, 11 November 2026) |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §7 and Module C |
| Schema | `supabase/migrations/20261111200000_evidence_intelligence_foundation.sql` |
| Code | `apps/web/src/modules/evidence/` (scanner, extractors, analysis, pipeline, worker); `apps/web/src/app/(workspace)/evidence/` |

## 1. Lifecycle

```
Upload ──► register (SHA-256, path check) ──► QUARANTINED
                                                   │  trusted worker
                                                   ▼
                       download ─► re-hash ─► scan ─► verdict ─┬─► infected / rejected (closed)
                                                               └─► clean ─► ACTIVE
                                                                     │
                                         extract text ─► passages ─► entities ─► chronology
                                                                     │
                     read (redacted) · link to propositions · redact · legal hold · delete
            every step ─► hash-chained custody event  +  hash-chained security audit event
```

| Stage | Control |
|---|---|
| Upload | Allowed types: PDF, DOCX, XLSX, TXT, CSV, EML, PNG, JPEG, TIFF; at most 100 MB. Stored under `organisation/workspace/uuid/filename` in the private bucket; storage policies require `document.upload` |
| Register | `evidence_register_file` checks `document.upload` and that the object exists in the item's own tenant path. Records SHA-256, size, MIME type and version number |
| Quarantine | Nothing is readable until a clean scan |
| Scan (worker) | Re-hash; structural scan; optional external engine. A clean verdict on mismatched bytes becomes `rejected` |
| Extract (worker) | Per-format extractor, then passages, entities and events, recorded atomically, once per file |
| Read | `document.read`; redactions applied; an `accessed` custody event is written |

## 2. Data model

| Table | Purpose | Mutability |
|---|---|---|
| `evidence_items` | Title, type, sensitivity, privilege, legal hold, status | Guarded: identity and ownership immutable; never hard-deleted |
| `evidence_files` | Versions: object key, SHA-256, size, MIME type, scan result | Immutable except resolving a pending scan |
| `evidence_extractions` | Extractor, version, status, text hash, page count | Append-only; one per file |
| `evidence_passages` | Text with page, offsets and hash | Append-only |
| `evidence_entities` | Typed values with raw and normalised forms and offsets | Append-only |
| `evidence_events` | Chronology (extracted or manual) with date precision | Append-only |
| `factual_propositions` | Statements of fact (alleged, established, disputed, withdrawn) | Status changes only |
| `evidence_proposition_links` | supports / contradicts / qualifies | Append-only |
| `evidence_redactions` | Masked ranges with a reason | Append-only |
| `evidence_custody_events` | Hash-chained custody per item | Append-only |

## 3. Integrity

**Custody chain.** Each event's `record_hash` is SHA-256 over: the previous hash, item, sequence, type, actor, actor kind, timestamp and details. Appends lock the item row, so the sequence is strictly ordered. `evidence_verify_custody` recomputes the whole chain and reports the first broken sequence.

**Audit chain (U-12).** `security_audit_events` gains `chain_position`, `previous_hash` and `record_hash`. An advisory lock serialises chain extension across writers. `verify_security_audit_chain` (service role) recomputes it. A row altered with triggers disabled, which only a database superuser can do, is detected.

**Correlation.** The web server client sends `x-correlation-id` on every request, and audit records copy it.

## 4. Scanning

| Rule | Verdict |
|---|---|
| Empty, or over 100 MB | rejected |
| EICAR test signature | infected |
| Windows or ELF executable | rejected |
| Byte content does not match the declared type | rejected |
| OOXML containing `vbaProject.bin` or embedded executables | rejected |
| PDF containing `/JavaScript`, `/Launch` or `/EmbeddedFile` | rejected |
| External engine reports infection | infected |

Archive entries are listed **without decompression**, and extraction caps the total uncompressed size at 200 MB, giving zip-bomb resistance. A full engine must be configured before Stage 1 (ADR-0003).

## 5. Extraction and analysis

| Format | Method | Pages |
|---|---|---|
| PDF | `pdfjs-dist` text layer (no font loading) | Per page; no text layer means OCR is required |
| DOCX | `word/document.xml`: paragraphs, tabs, breaks, XML entities | 1 |
| XLSX | Shared strings, inline strings, values; tab-separated rows | Per sheet |
| Email | Headers (From, To, Cc, Date, Subject) plus a plain or HTML body; multipart, base64, quoted-printable, charset | 1 |
| Text, CSV | UTF-8 (BOM stripped), falling back to Windows-1252 | 1 |
| Images | — | `OCR_NOT_CONFIGURED` |

**Entities** (rule-based) cover dates, amounts, emails, URLs, phone numbers, case references and organisations. Offsets index the passage exactly. **Chronology** creates one event per dated sentence; sentence splitting keeps Norwegian ordinal dates ("14. mars 2024") whole.

## 6. Access rules

| Operation | Permission |
|---|---|
| Create item, add event, propositions and links, redact | `evidence.manage` |
| Register a file | `document.upload` |
| List, read, chronology, entities, contradictions, custody | `document.read` |
| Legal hold, deletion | `document.delete` |
| Scan verdicts, extraction, pending queue | **service role only** (worker) |

Unknown and unauthorised items return the same `EVIDENCE_NOT_AUTHORISED` error.

## 7. Planned extensions

| Extension | Phase |
|---|---|
| OCR (images, scanned PDFs) | When a network-enabled environment is available |
| Full anti-malware engine | Stage 1 |
| AI-assisted extraction (persons, implicit events), classification, contradiction suggestions (Evidence, Chronology and Contradiction agents) | 5 |
| Matter linkage (`matter_id`) | 8 |
| Physical object purge after retention | 13 |
