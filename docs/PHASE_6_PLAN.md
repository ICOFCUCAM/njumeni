# Phase 6 — Verification and legal quality

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): §8.3 verification checks (the Phase 6 rows), §8.4 confidence and limitation reporting, §8.5 human oversight gates, §18.2 evaluation thresholds, §18.3 release gates |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phase 4 (claim ledger and recording-time verification), Phase 2 (versions, relationships, coverage), Phase 1 (RBAC, audit) |

## 1. Objective

Phase 4 verifies a research answer when it is recorded. Phase 6 adds the trust layer around it:
- **Re-verification.** Is what the answer relied on still right, as of any later date? Has the law changed? Has an authority been overruled? Do the cited authorities conflict? Do they belong to the right jurisdiction? Is the source still permitted? Are the limitations disclosed?
- **Human review gates** wherever §8.5 requires a person, decided under a four-eyes rule and audited.
- **Automated release gates** (§18.3) and **non-regressing evaluation thresholds** (§18.2) in CI.

## 2. Design

| Element | Implementation |
|---|---|
| Re-verification | `verification_check_research_run(run, check_date)` (migration `20261112100000`). It checks every verified claim of a run against the law as stored now, without changing the run. Checks below |
| Currency | The cited version was in force on the research date, else `VERSION_NOT_IN_FORCE_ON_RESEARCH_DATE` (blocking). Changed between the research date and the check date: `LAW_CHANGED_SINCE_RESEARCH` (warning). A change scheduled after the check date: `CHANGE_SCHEDULED` (note) |
| Treatment | Overruled, repealed or replaced. Effective by the research date: `ADVERSE_TREATMENT_AT_RESEARCH_DATE` (blocking). Effective since: `…_SINCE_RESEARCH` (warning). Effective later: `…_SCHEDULED` (note). Distinguished: `DISTINGUISHED` (note) |
| Conflict detection | `conflicts_with` relationships between authorities the run relies on: `CONFLICTING_AUTHORITIES`. Conflicting authority disclosed by the run itself: `CONFLICTING_AUTHORITY_DISCLOSED` (both warnings) |
| Jurisdiction fit | The authority's jurisdiction must be the run's jurisdiction or one of its ancestors (e.g. supranational law). Otherwise `JURISDICTION_MISMATCH` (blocking) |
| Source rights | The source is still approved, active and display-permitted. Otherwise `SOURCE_NO_LONGER_PERMITTED` (blocking) |
| Uncertainty and limitations | Coverage below `supported` with no disclosed limitation: `LIMITATION_NOT_DISCLOSED` (blocking). With limitations disclosed: `COVERAGE_LIMITED` (warning). Abstention, withheld claims and unresolved questions are noted |
| Outcome | `blocked` if any finding blocks; `review_required` if any warns; else `clear`. Reports and findings are append-only (findings use a deferred foreign key, so a report is written once, with its outcome). Each check is audited (`quality.verification_checked`) |
| Review gates (§8.5) | `private.review_requests`. Opened automatically from findings: `verification_failure`, `conflicting_authority`, `low_coverage`, `changed_law`. Opened on request (`review_request_create`): `high_impact`, `sensitive_evidence`, `institutional_output`, for research runs or argument issues. One pending request per subject and gate; re-checking does not duplicate |
| Decisions | `review_decide`: approve, reject or request changes (a note is required for the last two). Requires the new `quality.review` permission (workspace managers and reviewers). **Four-eyes:** in team organisations the requester cannot decide their own request. In personal organisations self-review is allowed and recorded as such. A decision is final; the row is otherwise immutable. Each decision is audited in the hash-chained log |
| Confidence (§8.4) | No numeric confidence is shown, because none is calibrated yet. The interface reports a verdict, its findings and the open gates. `qualityStatus` marks a run verified only when its latest check is clear, or every gate is approved and nothing blocks |
| Release gates (§18.3) | `quality/release-gates.json` maps all 12 gates (the 9 original and 3 added) to the tests and workflow steps that enforce them. `scripts/ci/check-release-gates.mjs` fails CI if any referenced assertion or step disappears |
| Evaluation thresholds (§18.2) | `quality/evaluation-thresholds.json` lists the 11 measurable thresholds. CI fails if a threshold is lowered or removed compared with the base commit without a recalibration entry (metric, reason, evidence), or if a gate enforced in code (`DEFAULT_RETRIEVAL_GATES`) is weaker than the file |
| Interface | `/research/[runId]`: a **Verification and review** panel (status, findings by severity, gates, "Re-verify against today's law", "Ask for a review"). `/reviews`: the workspace's review queue with approve, request changes and reject. Navigation: "Human review" |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 6.1 | Currency re-verification at any check date | ✅ |
| 6.2 | Treatment (overruled, repealed, replaced, distinguished) | ✅ |
| 6.3 | Conflict detection between relied-on authorities | ✅ |
| 6.4 | Jurisdiction fit, including parent jurisdictions | ✅ |
| 6.5 | Source rights still in force | ✅ |
| 6.6 | Uncertainty and limitation reporting | ✅ |
| 6.7 | Human review gates with four-eyes, permissions and audit | ✅ |
| 6.8 | Confidence policy (no uncalibrated scores) | ✅ |
| 6.9 | Release gates automated in CI | ✅ |
| 6.10 | Evaluation-threshold regression guard | ✅ |
| 6.11 | Interface: verification panel and review queue | ✅ |
| 6.12 | Evaluation runs for currency, jurisdiction, grounding and limitation metrics on real data | ⏸ Task 2.8 (real content); the thresholds and guard are in place |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **463/463** in 17 files (`verification_legal_quality` 36/36) |
| Application tests | **226/226** (`verification-quality` 3) |
| Root tests | **24/24** (`release-gates` 5) |
| Release gates | 12 gates evidenced; 11 thresholds held |
| Type check, Prettier (CI set), content policy, migration guard, `next build` | ✅ (`/reviews` built) |
| End-to-end on the local stack (synthetic) | ✅ See below |

pgTAP covers:
- every outcome: clear (including law of a parent jurisdiction); scheduled change versus changed law depending on the check date; jurisdiction mismatch; overruling since the research; conflicting authorities; undisclosed and disclosed limited coverage;
- a check dated before the research is rejected;
- gates opened per finding, never duplicated, none for clear runs;
- a note is required to reject; invalid decisions are refused; decisions are final;
- append-only reports and findings; immutable decided requests;
- four-eyes in a team organisation, recorded self-review in a personal one;
- a viewer cannot decide; a reviewer cannot create reports; an outsider is denied;
- decisions are audited.

The end-to-end run as a real signed-in user:
1. Research answered with the 2015 text, as of 2025-06-01.
2. Re-verified as of 2025-12-01: a scheduled change, plus limited coverage. As of today: `LAW_CHANGED_SINCE_RESEARCH` and `COVERAGE_LIMITED`.
3. Two gates were opened and approved (recorded as self-review); a second decision was refused.
4. The review queue lists the run; an outsider is denied.
5. The audit has `quality.verification_checked` ×2 and `quality.review_decided` ×2, and the hash chain is valid.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | CI green on the Phase 6 commit | Automatic on push |
| 2 | Phases 3–5 closed | Their own closeout items |
| 3 | §18.2 metrics measured on real data and the thresholds calibrated | Task 2.8 |

## 6. Decisions

- **Re-verification never rewrites history.** A research run stays exactly as recorded. Each check adds a dated report, so you can see what was true when.
- **Approval does not turn a blocked report green.** A reviewer can accept a warning (e.g. weighing conflicting authorities), but a blocking finding needs new research.
- **Four-eyes in teams, recorded self-review for individuals.** A sole practitioner can still work, and the record shows that no second person reviewed it.
- **No uncalibrated numbers.** §8.4 forbids confidence scores that are not calibrated, so none are shown.
- **Gates are tied to evidence, not to promises.** A release gate passes only while the tests that enforce it still exist. Thresholds can rise freely, but lowering one needs a written recalibration.
