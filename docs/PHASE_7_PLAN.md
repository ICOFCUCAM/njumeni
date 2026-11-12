# Phase 7 — Document intelligence

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): Module E (legal document intelligence), journey §15.5 (AI document production), §8.5 (final document approval gate), §18.3 RG-08 |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phase 4 (verified research), Phase 5 (agents, argument graph), Phase 6 (review controls), Phase 3 (evidence) |

## 1. Objective

Journey §15.5, end to end:

> Document request → template selection → case and research context → draft generation → section-level analysis → authority validation → evidence validation → quality review → human approval → DOCX / PDF export

Throughout, each final document keeps its link to the sources behind its material statements.

## 2. Design

| Element | Implementation |
|---|---|
| Templates | `private.document_templates`, seeded with six: legal memorandum, research memorandum, legal letter, statement of facts, complaint, appeal. Each has sections with required flags and drafting guidance. Templates are versioned, and each document records the template version it used |
| Documents | `private.legal_documents`, scoped to a workspace and optionally linked to a research run and an argument issue. Status is `draft` → `in_review` → `approved`. Identity, scope and template are immutable, and documents are never deleted |
| Versions | `private.document_versions` (append-only). Each save is a new numbered version, stored in template order with the template's titles, and carries its SHA-256 content hash, its origin (person or agent, with the drafting execution) and a change note. **Optimistic concurrency:** a save must name the version it edits, so a stale editor gets `DOCUMENT_VERSION_CONFLICT` and nothing is overwritten |
| Citations | `private.document_citations` (append-only, per version), numbered markers `[n]` in the text. **Verified by the database on every save:** authority passages must exist and their source must be approved, active and display-permitted. Quotations must match the passage after whitespace normalisation, and the source must permit quoting. Evidence must belong to the same workspace. The citation text is written by the database, never by the client |
| Section analysis | `modules/documents/analysis.ts` checks each section for: missing required sections; placeholders left in; markers without a source; attached sources never referred to; legal assertions ("must", "shall", "skal", "plikter", §…) with no citation; ambiguous wording ("as soon as possible", "reasonable", "and/or", open-ended lists, approximations); mixed date formats. Submission is disabled while errors remain |
| Drafting agent | `modules/documents/drafting.ts`. The `drafting` agent runs through `runAgent` (authorised, isolated, recorded) and fills the template from the linked research (verified claims with exact quotations), reviewed argument nodes (accepted facts, arguments, counterarguments) and limitations. Anything it cannot ground becomes a visible `[To be completed: …]` placeholder, which blocks submission until a lawyer resolves it. `validateDraft` rejects citations outside the run's verified passages, altered quotations and sections outside the template. The database accepts an agent version only with a successful `drafting` execution |
| Comparison | `modules/documents/compare.ts`: section-level changes (unchanged, added, removed, modified) with a word-level diff that merges change runs; sources added and removed. Page: `/documents/[id]/compare?from=&to=` |
| Approval workflow | `document_submit` and `document_withdraw` need `draft.update`; `document_decide` needs `draft.approve` to approve or `draft.review` to request changes (with a note). **Four-eyes in teams:** neither the author nor the submitter of a version may approve it; personal organisations record self-review. Approval requires every required section to be filled. Editing an approved document creates a new draft version; the approved version number is kept. Every step is audited |
| Export | `GET /api/v1/documents/{id}/export?format=docx|pdf&version=n` (OpenAPI documented and contract-tested). The DOCX is OOXML built with `fflate`, byte-identical for identical content. The PDF is A4 Helvetica with WinAnsi encoding (Norwegian and French letters, §), paginated, with a footer on every page. Both carry the version, the content-hash prefix, a numbered **Sources** list (citation, version in force, quotation, official link) and a **DRAFT — not approved** marking unless the version is the approved one. Each export is recorded with its SHA-256 and whether it was final (`document_exports`, audit `document.exported`) |
| Interface | `/documents` (create from a template, linked to research and an argument; list). `/documents/[id]`: editor per section with guidance; attach verified sources from the linked research; remove sources; the document check; the drafting agent; submit, withdraw, approve or request changes; version history with comparison links and decisions; export links. `/documents/[id]/compare` |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 7.1 | Templates with required sections and guidance | ✅ |
| 7.2 | Versioned documents (append-only, hashed, optimistic concurrency) | ✅ |
| 7.3 | Citation insertion verified by the database (authority and evidence) | ✅ |
| 7.4 | Section-level analysis | ✅ |
| 7.5 | Drafting agent with grounding validation and placeholders | ✅ |
| 7.6 | Version comparison | ✅ |
| 7.7 | Approval workflow with four-eyes, required sections and audit | ✅ |
| 7.8 | DOCX and PDF export with draft marking, sources and recorded hashes | ✅ |
| 7.9 | Document editor interface | ✅ |
| 7.10 | Rich-text editing, tracked changes inside the editor, and user-defined templates | ⏸ Phase 9 (professional templates) |
| 7.11 | Model-backed drafting | ⏸ Owner decision D-5 (the adapter slots into `draftDocument`) |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **505/505** in 18 files (`document_intelligence` 42/42) |
| Application tests | **234/234** (`document-intelligence` 8; API contract extended to the export route) |
| Root tests and release gates | 24/24; 12 gates evidenced (RG-02, RG-04 and RG-08 now include document tests) |
| Type check, Prettier (CI set), content policy, migration guard, `next build` | ✅ |
| End-to-end on the local stack (synthetic) | ✅ See below |

pgTAP covers:
- templates; creation with every section;
- a stale editor is refused; foreign sections are rejected;
- citations: a fabricated passage, an unapproved source, a misquotation, quoting a display-only source and foreign-tenant evidence are all rejected;
- citation text comes from the database; earlier versions stay readable;
- only a drafting execution can author an agent version;
- no edits under review; approval blocked by empty required sections; requesting changes needs a reason; personal self-approval is recorded;
- exports are final only for the approved version; editing after approval creates a new draft;
- append-only versions; retained documents;
- a team editor cannot approve; a manager who did not write the version can; four-eyes blocks self-approval;
- outsider denial.

The end-to-end run as a real signed-in user:
1. Research, then an argument proposal; a person accepted its nodes.
2. A legal memorandum was linked to both, and **the drafting agent** wrote version 2: law quoted with `[1] SYN-AML-5-2`; facts from the reviewed graph; placeholders for the short answer and conclusion, which the check flagged as errors.
3. The lawyer completed them as version 3, citing the source. A stale save was refused.
4. Version 3 was submitted and approved.
5. Over HTTP on the built app:
   - unauthenticated export → **401**; bad format → **400**;
   - the PDF of v3 is final (`X-Document-Final: true`, SHA-256 header) and `pdftotext` reads it with æøå and §;
   - the DOCX of v2 is marked DRAFT and opens with `python-docx` (styles intact);
   - the editor and comparison pages render (200).
6. Exports were recorded as `3|pdf|final` and `2|docx|not final`. The audit has created, saved ×2, submitted, approved and exported ×2, and the hash chain is valid.

pdftotext found one defect during this run: the page content streams were passed through the text encoder, which turned their line breaks into `?`. It was fixed, and a unit test now asserts ASCII content streams with real line breaks.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | CI green on the Phase 7 commit | Automatic on push |
| 2 | Phases 3–6 closed | Their own closeout items |
| 3 | Draft-completeness evaluation (§18.2, 100% of required sections) on real templates and content | Task 2.8; Phase 9 templates |

## 6. Decisions

- **The database verifies citations in documents too.** The rules that protect research answers apply to everything a document cites, at every save.
- **Placeholders, not guesses.** The drafting agent never fills a section it cannot ground. It leaves a marked gap, which the document check turns into a blocking error.
- **Approval is per version.** Approving version n says nothing about version n+1. Exports state which version they are and whether it is the approved one.
- **No new dependencies.** DOCX uses `fflate` (already used for evidence extraction); the PDF writer is small and self-contained, using standard fonts. Rich formatting can come later without changing the version model.
