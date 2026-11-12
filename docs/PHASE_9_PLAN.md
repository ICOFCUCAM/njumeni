# Phase 9 — Professional workspace

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): Module I (professional workspace), Module M (legal knowledge management), journey §15.2 (professional legal matter), U-16 (conflict checks and information barriers), §11.2 |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phase 8 (matters), Phases 5–7 (reasoning, verification, documents), Phase 1 (organisations, RBAC) |

## 1. Objective

Make Njumeni usable by a law firm under professional duties. Journey §15.2:

> Organisation → client registration → matter creation → **conflict check** → matter assignment → evidence → research → arguments → drafting → internal review → approval → client delivery → monitoring → closure

Firm knowledge is shared without leaking client files. Per U-16, conflict checks and information barriers are permission primitives at matter level, and **exclusion always overrides grant**.

## 2. Design

| Element | Implementation |
|---|---|
| Permissions | New organisation permissions: `client.read`, `client.manage`, `conflict.check`, `knowledge.read`, `knowledge.publish` and `template.manage`. Organisation admins get all of them; members get read access and `conflict.check` |
| Matter-opening policy | `private.organization_settings`. Law firms and enterprises **require a conflict check by default**; personal organisations do not. Admins set the policy and the check validity period (1–365 days, default 30) |
| Clients | `private.clients`: an organisation-wide register (individual or organisation, identifier, contact note). Matters can name their client, who also becomes a party |
| Conflict checks | `conflict_check_run`: names are normalised (case, Unicode, punctuation, company suffixes such as AS, ASA, Ltd, GmbH, and repeated spaces), then matched both ways (contains or is contained) against **all clients and all matter parties in the organisation**, across workspaces. Results show only the name, role, matter number and status, never matter content. Checks are retained and immutable once decided |
| Decisions | A check with no hits may be cleared. A check with hits must be recorded as a conflict, or **waived** by someone with organisation authority. A waiver needs a written justification (≥ 10 characters), and in a firm the person who ran the check cannot waive it. Every run and decision is audited |
| Gated opening | In organisations that require checks, `matter_create` refuses (`MATTER_CONFLICT_CHECK_REQUIRED`). `matter_open_checked` accepts only a check from the same organisation and workspace that is cleared or waived, unused and within the validity period. The check is **consumed** by the matter it opens and linked to it |
| Information barriers | `private.matter_barriers` (append-only). Workspace managers can exclude a named person from a matter, with a reason. **The barrier overrides every role** (enforced in `private.matter_for`, which every matter function uses). Barred matters vanish from lists, agendas and reports; a barred person loses their assignment and cannot be reassigned. Nobody can bar themselves |
| Matter team | `matter_assign`: responsible lawyer, team member or supervisor. The assignee must be a workspace member (or the owner) and not barred. `matter_team_candidates` lists the eligible people |
| Organisation knowledge (Module M) | `private.knowledge_items` (saved research, precedents, opinions, approved arguments, notes, template guidance), with tags, a review date and full-text search. **Promotion is explicit:** `knowledge.publish` is required; the source must be the organisation's own answered research, approved document or argument; it is stored as a reviewed summary snapshot, never as a live client file; and it is audited. The source link is shown only to readers who can access the source workspace. Items can be retired |
| Firm templates | `document_template_create`: sections are written one per line (`Title * \| guidance`) and parsed with unique, ASCII-safe keys. Firm templates are visible only inside their organisation, and the database refuses a document from another organisation that uses them |
| Reporting | `professional_report`: matters by status and area of law, overdue and upcoming deadlines, open tasks, documents in review and approved, pending quality reviews, research and AI activity. **Barred matters are excluded** from the counts |
| Interface | `/professional` (policy, conflict checks with hits and decisions, clients, links to reports, knowledge and templates); `/professional/reports`; `/knowledge` (search, promote) and `/knowledge/[id]`; `/documents/templates`; `/matters/new` (asks for a usable conflict check and client where required); the matter page's "Client, conflicts and team" panel (assignment and barriers) |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 9.1 | Client register | ✅ |
| 9.2 | Conflict checks with normalised matching across the organisation | ✅ |
| 9.3 | Conflict decisions, justified waivers and a configurable opening policy | ✅ |
| 9.4 | Information barriers that override every role | ✅ |
| 9.5 | Matter team assignment | ✅ |
| 9.6 | Internal review and approval in teams (four-eyes, Phase 7) through the journey | ✅ |
| 9.7 | Organisation knowledge with explicit, audited promotion | ✅ |
| 9.8 | Organisation document templates | ✅ |
| 9.9 | Professional reporting | ✅ |
| 9.10 | Billing integration | ⏸ Phase 11 (commercial infrastructure) |
| 9.11 | Browser end-to-end tests with Playwright | ⏸ Phase 13 (the HTTP journeys run in each phase) |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **581/581** in 20 files (`professional_workspace` 42/42) |
| Application tests | **241/241** (`professional-workspace` 2) |
| Root tests and release gates | 24/24; 12 gates evidenced (RG-01 now includes barrier and conflict-check isolation) |
| Type check, Prettier (CI set), content policy, migration guard, `next build` | ✅ |
| Journey 15.2 end to end, with three real users (synthetic) | ✅ See below |

pgTAP covers:
- the firm defaults; opening without a check is refused;
- clients;
- checks: an undecided check cannot open a matter; clear → open with the client as a party; single use;
- hits across clients and parties, ignoring case, suffixes and spacing; a check with hits cannot be cleared; a conflicted check cannot open a matter;
- partial-name hits;
- waivers: refused for a lawyer, refused without a justification, granted to the partner; decided checks are immutable;
- barriers: an editor reads before the barrier; an editor cannot impose one; nobody bars themselves; the barred person loses the assignment and cannot be reassigned; the barrier overrides the editor role; the matter is hidden from lists;
- knowledge promotion requires the permission and a valid source; members can search, with review status;
- templates: firm templates are not public; members draft from them; another organisation cannot use them;
- outsiders cannot read knowledge or run conflict checks.

Journey 15.2 run with a partner, an associate and a colleague with a prior conflict:
1. The law firm was created.
2. Client registered. Opening a matter without a check → `MATTER_CONFLICT_CHECK_REQUIRED`.
3. The associate's check hit the client itself. The associate's waiver was refused (`CONFLICT_WAIVER_NOT_AUTHORISED`); the partner waived it with a justification. The matter `M-2026-0001` opened with the check and client.
4. The associate was assigned as responsible lawyer. The colleague was barred, then denied the matter.
5. Research, an argument and a drafted document followed. The associate's self-approval was refused; the partner approved.
6. The research was promoted to firm knowledge and found by the associate.
7. The report counts the matter and the approved document, while the barred colleague's report shows none.
8. Over HTTP on the built app, `/professional`, `/professional/reports`, `/knowledge`, `/documents/templates`, the matter page (team and "barrier(s) in force"), `/matters/new` (conflict-check selector) and `/documents` render (200). The approved document exports as final.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | CI green on the Phase 9 commit | Automatic on push |
| 2 | Phases 3–8 closed | Their own closeout items |
| 3 | Conflict matching validated with a firm's real naming data (fuzzy and phonetic matching are candidates) | First professional pilot |

## 6. Decisions

- **Barriers are enforced at the single matter gate.** Adding the check to `matter_for` means every current and future matter function respects it. Artefacts that must also be walled off (evidence, documents) belong in a workspace the barred person is not a member of. The matter page states how many barriers are in force.
- **Conflict results are minimal by design.** A conflict search crosses workspaces, so it returns only what a decision needs.
- **Waivers are rare, justified and separated.** The person who found the hit cannot waive it in a firm, and the justification is kept with the check.
- **Knowledge is a snapshot, not a pointer.** Promotion copies a reviewed summary, so later changes to a client file never leak into firm knowledge. The source stays linked only for those who can already see it.
