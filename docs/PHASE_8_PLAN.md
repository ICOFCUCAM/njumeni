# Phase 8 — Case management and personal workspace

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): Module D (legal case management), Module H (personal legal assistant), journey §15.1 (individual legal assistance), milestone R1 |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phases 3–7 (evidence, research, reasoning, verification, documents) |

## 1. Objective

One workspace per legal matter, and a personal workspace that shows what is due. Journey §15.1, end to end:

> Registration → personal workspace → legal issue and jurisdiction → guided intake → documents and evidence → chronology → research → analysis → citation verification → draft → human review → export and case archive

## 2. Design

| Element | Implementation |
|---|---|
| Matters | `private.matters` (migration `20261112300000`). Each matter has: a per-workspace, per-year number (`M-2026-0001`, allocated under an advisory lock so concurrent creation never collides); a title; a legal category (10); a jurisdiction (must exist); a description; the stored intake; a status (`open`, `on_hold`, `closed`, `archived`). Matters are never deleted, their identity and number are immutable, archived matters are read-only, and only closed matters can be archived (`matter.archive`) |
| Parties | Client, opposing party, representative (linked to the party they represent, in the same matter), opposing representative, witness, court, authority, other |
| Links | Evidence items, research runs, argument issues and documents, **only from the same workspace**. Links are idempotent and append-only |
| Tasks | Priority, due date and status (`open` → `in_progress` → `done`/`cancelled`). An assignee must be a workspace member or the organisation owner |
| Deadlines and hearings | Limitation, filing, response, appeal, hearing, other. Each has a due time, location, the basis it was taken from, and a status (`pending`, `met`, `missed`, `waived`; `held` for hearings only) |
| Procedural history | `private.matter_events` (append-only). Every change is logged automatically. Users can add research notes, communications and procedural steps, but cannot write system events by hand or date entries in the future |
| Chronology | `matter_get` merges dated events from linked evidence (Phase 3 extraction), deadlines and hearings, and recorded communications and procedural steps |
| Personal agenda | `matter_my_agenda(days)`: pending deadlines (overdue and upcoming) and open tasks assigned to me or to nobody, across every matter I can read. The **dashboard** is now this live personal workspace (it was a preview notice) |
| Guided intake | `modules/cases/intake.ts`: questionnaires per legal category (counterparty, event and date, goal, documents, any deadline received), with validation |
| Intake agent | Runs through `runAgent` (agent `intake`; authorised, isolated, recorded). It produces a research question, the facts stated, missing information, suggested parties and tasks. **It never states a deadline as fact:** it adds a high-priority task to verify limitation, complaint and appeal deadlines, and to record any deadline the person was given. The matter page links its research question straight into `/research` (pre-filled) |
| Case bundle | `GET /api/v1/matters/{id}/export` (OpenAPI and contract test) returns a ZIP containing: a case report PDF (matter, parties with whom they represent, chronology, deadlines and hearings, tasks, links, procedural history); a chronology CSV (every cell quoted, formula injection neutralised); each **approved** document at its approved version (PDF and DOCX); an evidence manifest; and `manifest.json` with every file's SHA-256. The archive hash is returned in `X-Content-SHA256` and the export is logged in the matter history and the audit log |
| Interface | `/matters` (choose a legal area; list with open tasks and the next deadline). `/matters/new?category=` (guided intake). `/matters/[id]`: intake summary; deadlines and hearings; tasks; parties; links; chronology; history and communications; status; export. `/dashboard`: the agenda |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 8.1 | Matters with numbering, category, jurisdiction and lifecycle | ✅ |
| 8.2 | Parties and representatives | ✅ |
| 8.3 | Links to evidence, research, arguments and documents (same workspace) | ✅ |
| 8.4 | Tasks with assignees and priorities | ✅ |
| 8.5 | Deadlines and hearings | ✅ |
| 8.6 | Procedural history, communications and research notes | ✅ |
| 8.7 | Matter chronology | ✅ |
| 8.8 | Guided intake and the intake agent | ✅ |
| 8.9 | Personal agenda and dashboard | ✅ |
| 8.10 | Case bundle export with a SHA-256 manifest | ✅ |
| 8.11 | Deadline reminders by e-mail or push | ⏸ Needs an outbound mail provider (Stage 1, ADR-0003); the agenda covers it in the app |
| 8.12 | Evidence originals inside the bundle | ⏸ Listed by identifier in the manifest. Including originals needs signed storage reads at export time (Phase 13 hardening) |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **539/539** in 19 files (`case_management` 34/34) |
| Application tests | **239/239** (`case-management` 5; API contract extended to the bundle route) |
| Root tests and release gates | 24/24; 12 gates evidenced (RG-01 and RG-04 now include matter tests) |
| Type check, Prettier (CI set), content policy, migration guard, `next build` | ✅ |
| Journey 15.1 end to end (synthetic) | ✅ See below |

pgTAP covers:
- creation and sequential numbering;
- unknown jurisdictions and categories are rejected;
- parties and representatives;
- idempotent links; another tenant's evidence is refused;
- assignees must be members; only hearings can be marked held; tasks complete;
- communications are recorded; system history cannot be forged;
- reads (parties, links, chronology with evidence and hearings, history, next deadline, agenda windows);
- lifecycle: archive only after close; a closed matter is read-only but exportable;
- retention and append-only history;
- a viewer cannot create; an outsider is denied.

Journey 15.1 run as a newly registered user:
1. Personal workspace; employment intake (Norway). The intake agent produced the research question, the counterparty (Acme AS) and three tasks, including "Record the deadline you were given" and "Verify any limitation… deadline". The matter was numbered `M-2026-0001`.
2. Evidence with a dated event was linked.
3. Research answered with a verified claim and was linked.
4. The drafting agent prepared a document, which was submitted, approved and linked.
5. A response deadline and a communication were recorded.
6. The agenda shows 1 deadline and 3 tasks.
7. Over HTTP on the built app:
   - an unauthenticated bundle download → **401**;
   - the bundle downloads (200, `X-Content-SHA256`) and contains the case report, chronology, the approved document (PDF and DOCX), the evidence manifest and the manifest;
   - **every manifest hash verifies**;
   - `pdftotext` reads the case report (parties, chronology, deadline, links);
   - `/dashboard`, `/matters` and `/matters/[id]` render with the agenda items;
   - the export is recorded in the matter history, and the audit chain is valid.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | CI green on the Phase 8 commit | Automatic on push |
| 2 | Phases 3–7 closed | Their own closeout items |
| 3 | Milestone **R1** acceptance: the product specification's P0 scope against real content and a live Auth provider | Task 2.8; ADR-0003 Stage 1 |

## 6. Decisions

- **No invented deadlines.** Deadlines are entered by people, with their basis. The assistant only reminds the user to verify them. Legal deadline computation needs authoritative rules per jurisdiction and is not attempted.
- **Matters are archives, not folders.** Nothing is deleted. Closing freezes the matter, and archiving needs a separate permission.
- **Bundles carry only approved work.** Drafts stay in the workspace. A bundle is evidence of what was approved, with hashes anyone can check.
