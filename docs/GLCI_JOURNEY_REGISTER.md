# GLCI journey register

The delivery ledger for [Global Legal Change Intelligence](GLCI_SPECIFICATION.md). A phase is complete only when:
- its acceptance criteria are evidenced;
- CI is green on its commit;
- any migration is applied and verified on hosted (the resulting state, not the SQL response).

Each phase is one commit and push. The journeys (§2) are the end-to-end behaviours the programme must prove. Each journey step names the phase that delivers it.

Status: ⚪ PLANNED · 🟡 IN PROGRESS · 🔵 IMPLEMENTED (verified locally) · 🟢 DONE (CI green, hosted verified) · ⛔ BLOCKED (owner decision)

## 1. Phases

| Phase | Deliverable | Acceptance criteria | Status | Evidence |
|---|---|---|---|---|
| GLCI-00 | Specification, journey register | Owner document recorded verbatim; register opened; reconciled with ADR-0003 and D-5 | 🟢 DONE | [Specification](GLCI_SPECIFICATION.md) |
| GLCI-01 | Global jurisdiction and authority registry | Per-jurisdiction monitoring profile: languages, hierarchy, publication schedule, effective-date rules, review procedure. Monitoring targets per country (spec §4), adding a country needs no code change, sources inactive until rights review | 🟢 DONE | Migration `20261113200000`; `glci_registry.test.sql` (22); `glci-registry.test.mjs`. 9 profiles, 22 targets (all inactive), SE/DK/FI/UG catalogued; activation gated by rights review or licence policy; hash-chained GLCI audit. Hosted: 42/42 history and catalogue fingerprints identical to local |
| GLCI-02 | Automated legal source monitoring | Monitor adapters, durable monitoring checks, append-only observations. "Unchanged" is distinct from "not checked" or "check failed"; a format change is detected as an integration failure | 🟢 DONE | Migration `20261113300000`; `glci_monitoring.test.sql` (27); `glci-monitor.test.mjs` (3); worker `npm run worker:glci-monitor`; Lovdata listing monitor. Live run: Lovdata unreachable from this environment → `unreachable` / `check_failing`, never "current" (J-GLCI-2). Hosted: 43/43 history and catalogue fingerprints identical to local |
| GLCI-03 | Legislation version comparison | Section-level comparison of successive versions (added, amended, removed, renumbered), new and withdrawn authorities. Publication, enactment, effective, repeal dates and transitional provisions kept apart | 🟢 DONE | Migration `20261113400000`; `glci_change_detection.test.sql` (26), through the real ingestion RPC. Deferred trigger compares each new version with the previous one, section by section (added, amended, removed, renumbered); five date kinds; pending commencement (J-GLCI-6); transitional provisions flagged; withdrawn and reinstated from dataset sync; first ingestion is a baseline; changes immutable, only review status moves. Hosted: 44/44 history and catalogue fingerprints identical to local |
| GLCI-04 | Legal change impact analysis | For each change: affected research findings and claims, relationship edges, matters and documents, with dependency paths | 🟢 DONE | Migration `20261113500000`; `glci_impact_analysis.test.sql` (16). Runs at commit after detection: findings and claims citing changed sections → run → documents and issues → matters, plus evidence links and dependent authorities, each with dependency path, severity and tenant. Proven on a genuine commit, not only in tests. Hosted: 45/45 history and catalogue fingerprints identical to local |
| GLCI-05 | Currency and coverage verification | Per-jurisdiction currency: freshness, completeness, temporal validity, citation accuracy. "Unverified" never shown as "current" | 🟢 DONE | Migration `20261113600000`; `glci_currency.test.sql` (17). Verdict per jurisdiction: current / behind / unverified / not_monitored, from freshness, knowledge lag, completeness (listed vs present, unindexed passages), temporal validity and citation accuracy. Append-only reports; verdict changes audited; worker or operator runs. Hosted: 46/46 identical. Knowledge-lag defect found in GLCI-06 and corrected by `20261113700000` |
| GLCI-06 | Discrepancy and remediation workflows | Issues opened from outdated knowledge, failed checks and integration failures. Remediation proposals (re-sync, re-verify, adapter fix); approval before execution | 🟢 DONE | Migration `20261113700000`; `glci_remediation.test.sql` (22) runs the whole spec §3 lifecycle (J-GLCI-1 steps 1–8). Issues opened, de-duplicated, reopened and auto-resolved from signals; proposals (re-sync, review, notify, engineering task) need approval and four eyes; customers receive currency notices on affected research (tenant-scoped). Hosted: 47/47 identical |
| GLCI-07 | Super Admin Global Legal Observatory | Operator-only dashboard with every section of spec §6; command centre with the four example requests (spec §5) | 🟢 DONE | Migration `20261113800000`; `glci_observatory.test.sql` (17); `glci-command-centre.test.mjs` (6); browser journey "journey GLCI" (customer 404; coverage answered live; connector request queued; self-approval refused). `/admin/observatory` covers every section of spec §6. The command centre answers the four spec §5 requests from live data with a deterministic engine until GLCI-08 adds the AI provider. Conversations are logged append-only. [Screenshot](assets/glci-observatory.png). Hosted: 48/48 history and catalogue fingerprints identical to local |
| GLCI-08 | Anthropic AI engines with an operator switch | Owner decision: Claude Code first, Anthropic API as fallback, operator switch; rules engine as last resort. Budgeted, audited, advisory | 🟢 DONE | Migration `20261113900000`; `glci_ai_engines.test.sql` (15); `glci-ai-engines.test.mjs` (5); browser journey (visible fallback when nothing is configured). [Setup guide](GLCI_AI_ENGINES.md). Hosted: 49/49 history and catalogue fingerprints identical; switch defaults to Claude Code with fallback. Live run pending the owner's routine and API key |
| GLCI-09 | Claude Code controlled execution | Approved engineering tasks run in the owner's Claude Code routine, else the GitHub Actions workflow (claude-code-action), on their own branch, ending in a pull request; results reported back; no production access | 🔵 IMPLEMENTED | Migration `20261114000000`; workflow `glci-engineering-task.yml`; `glci_engineering_tasks.test.sql` (18); `glci-engineering-runner.test.mjs` (4); browser journey (approve, execute, recorded hand-off failure and retry). [Guide](GLCI_AI_ENGINES.md) §2a. Live run pending the owner's routine or GitHub token |
| GLCI-10 | Global multilingual monitoring and onboarding | Onboarding register (ten stages per jurisdiction, next step, owner actions), monitor adapter catalogue, generic Atom/RSS/JSON monitors configured as data on the official host only, UK and US monitors prepared; multilingual: monitoring languages per profile, answers in the language of the question | 🔵 IMPLEMENTED | Migration `20261114100000`; `glci_onboarding_register.test.sql` (14); `glci-feed-monitors.test.mjs` (3); [Onboarding register](ONBOARDING_REGISTER.md). Live formats confirmed 2026-11-12 for UK (Atom), US (JSON) and Denmark (daily harvesting API) by migration `20261114200000`; EU has no feed; Finland needs a token |
| GLCI-11 | Approval, audit and production governance | Append-only, hash-chained GLCI audit of every detection, assessment, decision, source update and deployment; four-eyes rules for consequential actions | ⚪ PLANNED | |
| GLCI-12 | Continuous monitoring and recovery testing | Scheduled monitoring, stale-check alarms, recovery drill (source outage, failed sync, replay) | ⚪ PLANNED | |

## 2. Journeys

### J-GLCI-1: A Norwegian amendment reaches Njumeni (spec §3)

| Step | Behaviour | Phase |
|---|---|---|
| 1 | Official publication detected from an authorised Norwegian source | GLCI-02 |
| 2 | Previous and new versions compared section by section | GLCI-03 |
| 3 | Implications examined: effective dates, transitional provisions, relationships (rules first, AI-assisted when configured) | GLCI-03, GLCI-04, GLCI-08 |
| 4 | Njumeni knowledge checked: is the updated provision in the database and retrieval index? | GLCI-05 |
| 5 | Discrepancy reported as an issue with affected records and recommended corrections | GLCI-06 |
| 6 | Remediation prepared: ingestion task, re-verification, tests or code change | GLCI-06, GLCI-09 |
| 7 | Authorised administrator approves | GLCI-06, GLCI-11 |
| 8 | Updated knowledge published with provenance | GLCI-06 |

### J-GLCI-2: A source goes dark

If a source is unreachable or its check fails, the jurisdiction reads "not verified" with the failure, never "current". After repeated failures, an issue is opened. Phases: GLCI-02, GLCI-05, GLCI-06, GLCI-12.

### J-GLCI-3: A source changes its format

The monitor or adapter fails in a way classified as an integration failure. An engineering issue is opened. An engineering task is proposed for the agent, and its pull request is reviewed before merge. Phases: GLCI-02, GLCI-06, GLCI-09.

### J-GLCI-4: Add a country without changing the core

An operator registers a jurisdiction profile and its sources (rights review pending). Monitoring and currency reporting cover it with no code change. A new official-source format needs only a new monitor adapter. Phases: GLCI-01, GLCI-02, GLCI-10.

### J-GLCI-5: The administrator asks the command centre

Status 2026-11-12: example requests 1 to 4 are answered from live data (GLCI-07, deterministic engine). The browser journey covers examples 3 and 4. AI-assisted analysis follows in GLCI-08, and engineering execution in GLCI-09.


The four example requests from spec §5 are answered from live data, with sources and next actions. Repository work becomes an approved engineering task. Phases: GLCI-07, GLCI-08, GLCI-09.

### J-GLCI-6: Publication is not commencement

A law published today with a later effective date is recorded as published and pending, not in force. Research as of a date before commencement does not treat it as current law. Phases: GLCI-03, GLCI-05.

## 3. Change log

| Date | Phase | Commit | Note |
|---|---|---|---|
| 2026-11-12 | GLCI-00 | `3ab5642` | Specification and register opened |
| 2026-11-12 | GLCI-01 | `064f2d2` | Jurisdiction and authority registry; hosted verified |
| 2026-11-12 | GLCI-02 | `34dbe65` | Automated source monitoring; hosted verified |
| 2026-11-12 | GLCI-03 | `a13ab98` | Legislation version comparison; hosted verified |
| 2026-11-12 | GLCI-04 | `a7a6ff1` | Legal change impact analysis; hosted verified |
| 2026-11-12 | GLCI-05 | `59226d8` | Currency and coverage verification; hosted verified |
| 2026-11-12 | GLCI-06 | `629de8d` | Discrepancy and remediation workflows; GLCI-05 lag correction; hosted verified |
| 2026-11-12 | GLCI-10 | `6d18a3c` + (this commit) | Onboarding register and generic feed monitors; live formats confirmed |
| 2026-11-12 | GLCI-09 | `913c3b5` | Controlled Claude Code execution of engineering tasks |
| 2026-11-12 | GLCI-08 | `4f1925e` | AI engines: Claude Code (owner's routine) → Anthropic API → rules, with a switch |
| 2026-11-12 | GLCI-07 | `1e30bae` | Super Admin Global Legal Observatory and command centre; hosted verified (owner-approved deployment) |
