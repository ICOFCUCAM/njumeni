# Njumeni: system audit for the owner

*Read-only audit of `/home/user/njumeni`, branch `claude/nice-darwin-hu9xau`, head `f9838f9`, 12 November 2026. Nothing in the repository or the hosted database was changed.*

## 1. What Njumeni is

Njumeni is a legal research and legal intelligence platform. Lawyers, firms, companies, public bodies and individuals use it to ask legal questions and get answers built only from official legal texts. Every answer shows exact quotations and citations, and it says what the law was **on a chosen date**. If the system cannot support an answer from verified sources, it is designed to say so and not answer. It is not a chatbot that improvises. The founding rule is that AI assists, and it never replaces a qualified lawyer's judgement.

Around that research core sit the tools a legal team works with every day. These include a secure evidence store with tamper-evident custody records, matters (case files) with deadlines and tasks, drafting of legal documents with checked citations, argument building, human review and sign-off, conflict checks for law firms, compliance registers, billing, and an API for enterprise customers.

The newest and most distinctive part is **GLCI (Global Legal Change Intelligence)**. Laws keep changing, so GLCI watches official legal sources in each country and detects new or amended laws. It works out which customer research and documents are affected, checks whether Njumeni's own copy of the law is still current, and runs the fix through a governed approval process. Platform operators run all of this from a "Global Legal Observatory" with an AI command centre. Norway (Lovdata) is the reference country.

## 2. Who uses it

| Group | Who | Where in the app |
|---|---|---|
| **Customers** | Organisations of four kinds (personal, law firm, enterprise, institution) with workspaces. Organisation roles: admin, member, billing manager, auditor. Workspace roles: manager, editor, reviewer, viewer | `/dashboard`, `/research`, `/evidence`, `/matters`, `/documents`, `/arguments`, `/reviews`, `/professional`, `/knowledge`, `/compliance`, `/institutional`, `/organisation`, `/billing`, `/jurisdictions`, `/settings` |
| **Platform operators ("Super Admin")** | People listed in `private.platform_operators` with the role `platform_admin`, `support`, `knowledge_admin` or `ai_operations`. They see platform metadata, never customer content, except through customer-approved, time-limited "break-glass" access | `/admin` (back office) and `/admin/observatory` (GLCI). Customers get a 404 on both (`apps/web/src/app/(workspace)/admin/page.tsx:39-40`, `admin/observatory/page.tsx:210-211`) |

Operators have no sign-up screen. The owner becomes Super Admin by inserting their own record into `private.platform_operators` on the hosted database (`docs/operations/RUNBOOK.md:38`).

## 3. Capability inventory

**State key:**
- **LIVE**: deployed on hosted Supabase (all migrations up to `20261114300000`). Usable as soon as a web front end points at it.
- **WAITING**: built and tested, but needs an owner action.
- **NOT BUILT**: planned, or only a placeholder.

The web app itself is not hosted anywhere yet, so no "LIVE" item can be reached by a user today.

| Area | What it does | State | Evidence |
|---|---|---|---|
| Sign-in, profiles, organisations, workspaces, invitations, roles | Secure accounts; customer data strictly separated by organisation; role-based permissions | LIVE (database) / WAITING (web hosting) | migrations `…principal_and_user_profiles` to `…role_permission_foundation`; Phase 1 closed |
| Security audit log | Append-only, hash-chained log of security events | LIVE | `…security_audit_logging.sql`; `docs/SECURITY_AUDIT_REPORT.md` |
| Legal source registry and "law as of a date" | Stores laws with versions, effective periods and links between laws (amends, repeals…) | LIVE (empty on hosted) | `…legal_knowledge_foundation.sql`, `…legal_authority_temporal_and_graph_queries.sql` |
| Norwegian law corpus (Lovdata) | 753 acts, 31,007 sections, 4,487 links | **Local test machine only.** WAITING on Lovdata rights review and activation | `docs/PHASE_2_TASK_2_8_LOVDATA_PILOT.md`; register row 2.8 |
| Legal research | Question + jurisdiction + date → quoted, cited answer, or a refusal to answer | LIVE (database), but has no law to search on hosted | `modules/research/service.ts`; `/research` |
| Meaning-based ("semantic") search | Finds relevant law even when wording differs | Built for the evaluation tool and workers. **Not wired into the app**: the app runs keyword-only research | `research/actions.ts:27`, `api/v1/research/runs/route.ts:61` pass no embedder; `service.ts:52-54` |
| Evidence | Upload, quarantine, scan, text extraction, chronology, custody chain, legal hold | LIVE (database). Needs an evidence **worker host**. OCR and a full antivirus engine NOT BUILT | `modules/evidence/extractors.ts:279-295` (`OCR_NOT_CONFIGURED`), `scanner.ts:1-2` |
| Argument building, drafting, intake agents | Grounded arguments, document drafts, matter intake | Built, but run on a **deterministic "mock" engine only**. No real AI provider adapter exists for customer features | `modules/ai/core.ts:5-6`; `reasoning/argument.ts:415`; Anthropic seeded `disabled` in `…ai_reasoning_framework.sql:23` |
| Verification and human review | Re-checks earlier research for later changes; four-eyes review gates | LIVE | `…verification_and_legal_quality.sql`; `/reviews` |
| Documents | Templates, versions, citations checked at every save, approval, DOCX/PDF export | LIVE | `…document_intelligence.sql` |
| Matters (case files) | Parties, deadlines, tasks, history, ZIP case bundle | LIVE | `…case_management.sql` |
| Law-firm features | Clients, conflict checks, information barriers, firm knowledge | LIVE | `…professional_workspace.sql` |
| Enterprise and institutional features | Offices, retention, compliance register, EU AI Act gate, API keys, SSO domain checks | LIVE. Live SSO with a real identity provider NOT BUILT (Stage 2) | `…enterprise_institutional.sql` |
| Billing | Plans, quotas, AI credits, invoices, payment webhooks | LIVE (database). WAITING on a payment provider | `…commercial_infrastructure.sql`; `api/billing/webhooks/[provider]/route.ts` |
| Global framework and languages | 20+ jurisdictions catalogued; English, Norwegian and French interface; cross-language search | LIVE (framework); no content | `…global_expansion.sql` |
| GLCI-01 Country registry | One monitoring profile per country; 22 official targets, all inactive | LIVE | `…glci_jurisdiction_registry.sql` |
| GLCI-02 Source monitoring | Checks official listings; tells "unchanged" apart from "could not check" | LIVE (logic). WAITING: no target is active, and the monitor worker is not hosted or scheduled | `modules/glci/monitor-main.ts`; `.github/workflows` has no schedules |
| GLCI-03/04 Change detection and impact | Section-by-section comparison; publication ≠ in force; traces affected research, documents and matters | LIVE (triggers on ingestion) | `…glci_change_detection.sql`, `…glci_impact_analysis.sql` |
| GLCI-05 Currency verdict | Per country: current / behind / unverified / not monitored | LIVE. **Every country is currently "not monitored" or "unverified"** | `…glci_currency_verification.sql`; `docs/ONBOARDING_REGISTER.md` §2 |
| GLCI-06 Remediation and customer notices | Issues, approved fix proposals, notices on affected research | LIVE (database). **Customer notices have no screen** | `research_run_currency_notices` RPC (`…glci_remediation_workflows.sql:328`) is called nowhere in `apps/web/src` |
| GLCI-07 Observatory and command centre | Operator dashboard; answers the four example questions from live data | LIVE (database) / WAITING (web hosting) | `admin/observatory/page.tsx` |
| GLCI-08 AI engines | Claude Code routine → Anthropic API → rules engine, with a switch and a budget | WAITING: today only the rules engine answers | `modules/glci/ai-engines.ts`; `docs/GLCI_AI_ENGINES.md` |
| GLCI-09 Engineering tasks | Approved task → AI opens a pull request on its own branch | WAITING (routine or `GLCI_GITHUB_TOKEN`) | `.github/workflows/glci-engineering-task.yml`; `engineering-runner.ts` |
| GLCI-10 Onboarding and feed monitors | 10-stage onboarding per country; Atom/RSS/JSON monitors; UK, US and Denmark formats confirmed | LIVE (framework). WAITING on rights reviews | `docs/ONBOARDING_REGISTER.md` |
| GLCI-11 Governance | Four-eyes approvals, solo-owner mode, deployment register, tamper-evident audit export | LIVE | `…glci_governance.sql`; `docs/GLCI_GOVERNANCE.md` |
| GLCI-12 Continuous monitoring | Worker heartbeats, overdue and silent-worker alarms, hourly in-database housekeeping, rolled-back recovery drill | **IN PROGRESS** (uncommitted, no pgTAP test file yet) | `supabase/migrations/20261114400000_glci_continuous_monitoring.sql` (untracked) |
| Personal assistant (H), Legal intelligence hub (A) | Placeholder landing pages only | NOT BUILT as their own screens | `app/(workspace)/[slug]/page.tsx` renders `ModuleLanding` for `/intelligence` and `/assistant` |

## 4. What it does today if you logged in

Today you **cannot** log in to a live site, because the web app is not hosted. If you ran the app on a computer pointed at the hosted database, you would see the following:

- **As a customer.** You could create an organisation and workspaces, invite colleagues, open matters, upload evidence, draft documents, run conflict checks and see billing plans. However:
  - **Research would return nothing.** The hosted database holds no law, so every question ends with "cannot answer".
  - **Evidence uploads would stay in quarantine.** No scanning worker is running.
  - **Arguments, drafts and intake** come from the deterministic engine, not from a real AI model.
- **As Super Admin** (after adding yourself to `platform_operators`), you would see:
  - the back office;
  - the Global Legal Observatory, where all 22 official sources are *inactive* and every country reads *not monitored* or *unverified*. Norway is at stage 5 of 10; the next step is to activate monitoring of the Lovdata listing;
  - the onboarding register, the governance panel and the audit export;
  - the AI command centre. It answers questions only through the **rules engine**, and the panel shows that no Claude Code routine, API key or GitHub token is configured.

In short, the engine is built and deployed. It has no fuel (legal content), no driver seat (web hosting), and no AI connected yet.

## 5. What it will do when fully connected: a day in the life

*Assumptions: the web app is hosted; Lovdata is approved, activated and ingested; the monitor worker runs from a host that can reach Lovdata; the Claude Code routine, the API key and the GitHub token are set; GLCI-12 is finished.*

1. **06:00, detection.** Norway publishes an amendment to the Immigration Act. The monitor worker's scheduled check of the Lovdata listing records "changed". If Lovdata were down, the country would read "not verified", never "current". With GLCI-12, a silent worker or an overdue check also raises an alarm.
2. **Ingestion and comparison.** The ingestion worker fetches the new version. GLCI compares it with the old one section by section (for example: § 28 amended, § 28a added, § 31 renumbered). It records publication, effective and repeal dates separately. If the change only takes effect on 1 January, it is held as "published, pending": research dated before then still uses the old text.
3. **Impact.** The database traces every customer research finding that quoted § 28, then the documents and matters built on it, plus dependent regulations. Each affected item gets a severity rating and stays inside its customer's private space.
4. **Currency check.** Norway's verdict moves to *behind* until the new text is indexed. It moves back to *current* once freshness, completeness and citation checks pass.
5. **Remediation.** An issue opens in the observatory with proposals: re-sync the source, review the change, notify affected customers. Either a second operator approves, or you approve yourself in solo-owner mode, where the approval is recorded as "self-approved".
6. **Customer notice.** Affected workspaces receive a currency notice on the research that relied on § 28. The lawyer re-verifies the research in one click, and the review gate asks for human sign-off. *(The notice is stored in the database today, but no customer screen shows it yet. See §7.)*
7. **AI command centre.** You ask: "Is our Norwegian immigration coverage outdated?" Your Claude Code routine investigates the database and the repository and replies a few minutes later. If it is busy, the Anthropic API (`claude-opus-5-5`, within the monthly budget, default 25 USD) answers immediately. The rules engine is the last resort. Every answer is advice only.
8. **Engineering task.** If Lovdata changes its file format, the monitor classifies that as an *integration failure*, not as "no change", and opens an engineering issue. You approve an engineering task. Claude Code (or the GitHub Actions fallback) works on branch `glci/task-…`, runs the tests and opens a pull request. You review it, merge it and deploy it through the approved deployment workflow, which records the deployment in the register.
9. **Audit.** Every step above is in the hash-chained GLCI audit log. A daily checkpoint (GLCI-12) and a downloadable export let anyone check that nothing was altered.

## 6. Owner activation checklist (priority order)

1. **Host the web app** (for example on Vercel). Give it the hosted Supabase URL and the publishable key, but never the service-role key. Nothing reaches a user until this is done.
2. **Make yourself Super Admin.** Add your account to `private.platform_operators` as `platform_admin`. Then decide the approval policy: two-person approval is the default, so a single owner must switch on solo-owner mode (`glci_set_governance_policy`) or no approval can be completed.
3. **Turn on leaked-password protection** in Supabase Auth. It may need a paid plan; it was accepted as a Stage 0 risk (register 1.3).
4. **Lovdata.** Confirm the NLOD 2.0 text and attribution, record the rights review, then activate the source (`docs/PHASE_2_TASK_2_8_LOVDATA_PILOT.md` §6).
5. **Provide a worker host** that can reach Lovdata (it refuses this cloud environment with 405) and run three workers there:
   - `worker:legal-knowledge` to ingest and embed the law;
   - `worker:glci-monitor` to check sources;
   - `worker:evidence` to scan and extract uploads.

   The checklist in `ONBOARDING_REGISTER.md` §4 does not list this item.
6. **Activate Norwegian monitoring** in the observatory through "Request monitoring", then approve the request.
7. **AI for the command centre.** Set up either the Claude Code routine (`GLCI_CLAUDE_CODE_ROUTINE_URL` and `_TOKEN`) or `ANTHROPIC_API_KEY` on the web server, or both.
8. **Engineering-task fallback.** Add `GLCI_GITHUB_TOKEN` on the web server. Add the `ANTHROPIC_API_KEY` repository secret, plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if you want results reported back.
9. **Rights reviews** for the UK (legislation.gov.uk, OGL v3.0), the US (Federal Register), Denmark (Retsinformation), the EU (EUR-Lex: an interface still has to be chosen) and Cameroon. Then Sweden, Finland and Uganda.
10. **AI provider for customer features (D-5).** This needs both a decision and **new code**: a real provider adapter for the agents. Today only the mock engine exists.
11. **Payment provider** in staging, then live.
12. **Independent penetration test**, then pilot customers, then commercial launch.

## 7. Risks and gaps found by this audit

1. **No country is "verified current", and the hosted database holds no law.** All 22 monitoring targets are inactive, and Norway is at 5 of 10 onboarding stages (`docs/ONBOARDING_REGISTER.md` §2). The Lovdata corpus exists only on the local test stack.
2. **✅ Resolved after the audit (live research now embeds questions).** The research form and API pass a local query embedder (`apps/web/src/modules/research/query-embedder.ts`, setting `LEGAL_QUERY_EMBEDDER`), so research is hybrid when the embedding runtime is installed on the web server; otherwise it falls back to keyword search, records the run as lexical and tells the reader. Each answer shows which search it used. *Original finding:* **The app's research is keyword-only.** The research form and the API both call `runLegalResearch` without a query embedder (`apps/web/src/app/(workspace)/research/actions.ts:27`, `apps/web/src/app/api/v1/research/runs/route.ts:61`). The engine therefore falls back to `lexical` (`apps/web/src/modules/research/service.ts:52-54`). The quality figures that pass every gate (Precision@5 0.774, commit `1129b85`) were measured with **hybrid** (meaning-based) retrieval through the evaluation tool. The live product would not get that quality.
3. **Measured after the audit (2026-11-12): confirmed and worse than it looked.** A held-out set (`lovdata-no-holdout-v1`, 35 cases) gives R@10 0.778 and P@5 0.506 — below the gates — so the 0.774 did not generalise. Abstention: a temporal check now declines past-date questions whose law version is not held (3/3 held-out); out-of-scope questions are still answered (0/5), since no meaning-score threshold separates them. *Original finding:* **The evaluation has gaps.**
   - Abstention (the ability to refuse to answer) scores **0/2**.
   - The calibrated reranker was tuned on the same 41-question set it is scored on. No held-out set exists yet (commit `1129b85` message).
4. **✅ Resolved after the audit (customers see change notices).** The research answer page shows "The law has changed since this answer" from `research_run_currency_notices` (screenshot `docs/assets/research-change-notice.png`). *Original finding:* **Customer currency notices are invisible.** The `research_run_currency_notices` RPC exists, but no page calls it, so step 6 of the GLCI journey does not reach the customer.
5. **Customer-facing AI is mock-only.** Reasoning, drafting and intake run on deterministic mock providers (`apps/web/src/modules/ai/core.ts:5-6`). Anthropic is registered but `disabled`. The GLCI Anthropic integration serves operators only.
6. **Partly resolved (GLCI-12 deployed):** hourly housekeeping now runs inside the hosted database with pg_cron (`glci-housekeeping`), tested by `glci_continuous_monitoring.test.sql` (17); the workers still need a host. *Original finding:* **Nothing runs on a schedule yet.** No GitHub workflow has a cron schedule, and no worker is hosted. GLCI-12 adds hourly in-database housekeeping through pg_cron "where the extension exists", but it is uncommitted and has no pgTAP test file. Whether pg_cron is enabled on hosted Supabase was not checked (read-only audit).
7. **Evidence is incomplete.**
   - OCR is not configured, so scanned PDFs fail with `OCR_NOT_CONFIGURED`.
   - Only a structural scanner and EICAR test check exist; there is no full antivirus engine (`apps/web/src/modules/evidence/scanner.ts`).
8. **Security items are open.**
   - Leaked-password protection is off.
   - No independent penetration test has been done.
   - The CSP allows `'unsafe-inline'` scripts.
   - There is no application-level rate limiting.
   - Information barriers work per matter, not per artefact (`docs/SECURITY_AUDIT_REPORT.md` §3).
   - The Supabase connector used by the Claude Code routine can write. Only the routine's prompt keeps it read-only (`docs/GLCI_AI_ENGINES.md` §2, note).
9. **Several documents contradict the code or the hosted state.**
   - `README.md:53` says the hosted database is "intentionally empty".
   - `docs/PHASE_REGISTER.md:19` says "No migrations applied".
   - In fact 53 migrations are deployed, according to the same register's §5k and the GLCI journey register.
   - Register §2.1 and row 2.10 still say Norway fails Precision@5 (0.312). Commit `1129b85` reports 0.774.
   - `docs/VISION_AND_STATUS.md` is a stale 11 November snapshot ("Phases 3–13 have not started").
   - `.env.example` lists none of the `GLCI_*` variables.
10. **Placeholder modules.** "Legal Intelligence" (`/intelligence`) and "Personal Assistant" (`/assistant`) show only generic module landing pages (`apps/web/src/app/(workspace)/[slug]/page.tsx`).
11. **Phases are not formally closed.** Phases 2 to 13 are "implemented, verified locally", not closed. The Phase 12 gate (every jurisdiction at least `partial`) and the Phase 2 closeout both depend on real content.
12. **Other items.**
    - Live SSO with a real identity provider is not built (Stage 2).
    - The `phase-1-closed` tag was never pushed.
    - Work happens on a Claude working branch, and branch protection was flagged unverified in `docs/VISION_AND_STATUS.md`.
