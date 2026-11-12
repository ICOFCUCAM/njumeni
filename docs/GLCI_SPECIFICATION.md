# Njumeni Global Legal Change Intelligence (GLCI) — owner specification

| Field | Value |
|---|---|
| Status | **Adopted** as a permanent, core Njumeni subsystem (owner, 2026-11-12) |
| Formal name | Njumeni Global Legal Intelligence and Currency System (GLICS); built as the GLCI programme |
| Delivery record | [GLCI journey register](GLCI_JOURNEY_REGISTER.md) |
| Relation to the master plan | Extends the Phase 2 legal-knowledge architecture ([master plan](NJUMENI_MASTER_PLAN.md)). It is not a separate application |

This is the owner's specification as sent on 2026-11-12, recorded verbatim apart from formatting. The illustrative images and external product names that came with it were reference material only. They are not reproduced, and Njumeni does not copy any of those products. Where it meets an existing architecture decision, the delivery record notes how (§10).

## Owner's request

> I think we shall also need to build a system that re-examines these laws nationally and internationally, a system that can scale to check other nations, to always compare the new laws that are added and if Njumeni is up to date — if not, a chat section in the super admin where one can communicate with Claude Code or the Anthropic API to fix. This is because people keep changing laws and we must adjust to them.

## 1. Purpose

A Global Legal Intelligence Monitoring and Adaptation System. It:
- continuously watches changes in the world's legal systems;
- determines what has changed;
- checks whether Njumeni understands those changes;
- coordinates updates when necessary.

Legislation is never static.

## 2. The seven engines

| # | Engine | Responsibility |
|---|---|---|
| 1 | Global Legal Observatory | Continuously monitors official legal sources across countries: national gazettes, parliaments, ministries, regulators, courts and official legal databases |
| 2 | Legislation Change Detection Engine | Detects new legislation, amendments, repeals, corrections and commencement dates. Compares successive official versions, not just publication dates |
| 3 | Legal Impact Analysis Engine | Determines which existing Njumeni legal records, legal relationships, research materials and reasoning workflows are affected. Identifies conflicts, obsolete provisions and dependencies |
| 4 | Njumeni Currency Verification Engine | Checks whether Njumeni's knowledge base reflects the latest authoritative legal position. Measures source freshness, completeness, temporal validity and citation accuracy |
| 5 | AI Remediation Engine | Investigates detected problems and proposes corrections: ingestion updates, database migrations and tests. Uses Anthropic and other supported AI providers through Njumeni's provider-independent orchestration |
| 6 | Super Admin AI Command Centre | Administrators communicate with Njumeni's AI agents, investigate problems and initiate remediation. Anthropic API for reasoning; Claude Code integration for controlled repository changes |
| 7 | Legal Governance and Audit Engine | Records every detected change, AI assessment, human decision, source update and deployment. Provides traceability and accountability |

## 3. How the system operates (Norway as the first implementation)

Example: Norway publishes an amendment to its immigration legislation. The following should happen automatically:

1. **Official publication detected.** The observatory detects the new amendment from an authorised Norwegian source.
2. **Previous and new versions compared.** The engine identifies exactly which sections changed.
3. **Legal implications examined.** AI examines the changes, effective dates, transitional provisions and affected legal relationships.
4. **Njumeni knowledge checked.** Does the legal database and retrieval engine contain the updated provisions?
5. **Discrepancies reported.** If Njumeni is outdated, an issue is created with the affected records and recommended corrections.
6. **AI remediation initiated.** The AI prepares updated source records, ingestion tasks, tests or software changes where necessary.
7. **Human review and approval.** An authorised administrator approves consequential legal interpretations, source activation and production changes.
8. **Updated knowledge published.** The corrected legal material becomes available to research and reasoning, with its provenance preserved.

**Requirement:** publication does not mean a law is in force. Njumeni must distinguish:
- publication date;
- enactment date;
- effective date;
- repeal date;
- transitional provisions.

## 4. Global expansion: a monitoring configuration per country

Do not build a Norwegian system and duplicate it 190 times. Build a reusable jurisdiction adapter architecture.

| Jurisdiction | Initial monitoring targets |
|---|---|
| Norway | Lovdata, Stortinget, government and official gazettes |
| Sweden | Sveriges Riksdag, Svensk författningssamling |
| Denmark | Retsinformation, Folketinget |
| Finland | Finlex, Eduskunta |
| United Kingdom | legislation.gov.uk, Parliament |
| United States | Federal Register, Congress, state legislatures |
| European Union | EUR-Lex, Official Journal |
| Cameroon | Official Gazette, government and parliamentary publications |
| Uganda | Uganda Gazette, Parliament, government legal publications |
| Other countries | Country-specific official authorities |

Each country must have:
- its own source registry;
- source licensing and access rules;
- official language configuration;
- legal hierarchy and authority classification;
- publication and update schedules;
- amendment and repeal detection;
- legal effective-date rules;
- verification and review procedures.

Countries can be added without rewriting the core platform.

## 5. The Super Admin AI Command Centre

A dedicated, conversational interface inside the Super Admin dashboard. Example requests:

1. "Examine all Norwegian immigration legislation and identify whether Njumeni is using outdated provisions." The AI examines the sources, reports discrepancies and proposes actions.
2. "Why is our legal knowledge base behind the latest amendments?" The AI investigates ingestion logs, source health, migration status and indexing failures.
3. "Update the Norwegian legal ingestion connector to support the latest official source format." The AI examines the repository, implements the changes, runs tests and prepares a pull request.
4. "Check whether our European legal coverage is current." The AI produces a coverage report, jurisdiction by jurisdiction.

**Two integrations:**

| Integration | Responsibility |
|---|---|
| Anthropic API | Legal change analysis, investigations, explanations and orchestration |
| Claude Code | Repository inspection, code changes, tests and proposed commits |

Reuse the existing Claude Code runner architecture where appropriate.

The Super Admin must never give an AI unrestricted production access. Required controls:
- role-based permissions;
- isolated execution environments;
- repository-scoped access;
- approval before production deployments;
- audit trails for every action;
- secret isolation;
- explicit tool permissions.

The AI may prepare a fix autonomously. Production legal knowledge and software changes follow their own approval policies.

## 6. The monitoring dashboard: "Global Legal Observatory"

The headline figures are illustrative layout, not live measurements:
- potential jurisdictions;
- monitoring capability;
- verified legal currency;
- unresolved legal changes.

**Sections:**
- global jurisdiction map;
- source availability and health;
- newly published legislation;
- amendments and repeals;
- legal changes awaiting review;
- outdated legal knowledge;
- failed ingestion and synchronisation;
- AI remediation tasks;
- Claude Code execution history;
- human approval queue;
- complete audit history.

## 7. Fit with the existing architecture

Extend what exists; do not create competing infrastructure.

| Existing component | New responsibility |
|---|---|
| Legal source registry | Global authority and source monitoring |
| Legal ingestion workers | Continuous change ingestion |
| Legal versioning | Historical legislation comparison |
| Legal relationship graph | Dependency and impact analysis |
| Evidence intelligence | Evaluating source authority and evidence |
| Verification and legal quality | Currency and completeness verification |
| AI reasoning framework | Analysing legal implications |
| Redis/BullMQ workers | Scheduling and executing monitoring tasks |
| Supabase/PostgreSQL | Persisting changes, findings and audit events |
| Super Admin | Global monitoring and the AI command centre |

## 8. Roadmap

| Phase | Deliverable |
|---|---|
| GLCI-01 | Global jurisdiction and authority registry |
| GLCI-02 | Automated legal source monitoring |
| GLCI-03 | Legislation version comparison |
| GLCI-04 | Legal change impact analysis |
| GLCI-05 | Njumeni currency and coverage verification |
| GLCI-06 | Automated discrepancy and remediation workflows |
| GLCI-07 | Super Admin Global Legal Observatory |
| GLCI-08 | Anthropic API integration |
| GLCI-09 | Claude Code controlled execution integration |
| GLCI-10 | Global multilingual legal monitoring |
| GLCI-11 | Approval, audit and production governance |
| GLCI-12 | Continuous monitoring and recovery testing |

**Additional requirement.** Njumeni must distinguish a source that has *not changed* from one that has *not been successfully checked*. If a government website is unavailable, Njumeni must not report its legislation as current merely because no new changes were recorded.

## 9. Fundamental responsibility (GLICS)

> Njumeni must continuously examine authoritative legal developments, compare them with its existing legal knowledge, identify outdated or incomplete information, assess the implications of changes, and coordinate verified updates so that its legal intelligence remains aligned with the current law of every supported jurisdiction.

The system also monitors its own software. When a legal source changes its API, data format or publication method, Njumeni detects the integration failure and asks its engineering agent to prepare a correction.

Build this as an extension of the existing Phase 2 architecture. Start with Norway as the reference jurisdiction and prove the whole lifecycle. Then add countries through reusable adapters.

## 10. Reconciliation with existing decisions (delivery notes)

| Specification item | Existing decision | Delivery |
|---|---|---|
| Redis/BullMQ workers (§7) | ADR-0003: no paid infrastructure; Phase 2 built a durable PostgreSQL queue (`legal_source_ingestion_jobs`, leases, heartbeats, backoff) | Monitoring tasks use the same durable PostgreSQL queue pattern. A Redis/BullMQ backend can be added behind the queue interface later |
| Anthropic API (§5, GLCI-08) | D-5: the AI provider is an owner decision; provider-independent orchestration (Phase 5) | Built behind the provider-independent interface. It is off until the owner configures a provider key, and every call is audited and budgeted. No AI output changes legal knowledge without human approval |
| Claude Code (§5, GLCI-09) | Repository changes go through branches, CI and review | Engineering tasks are records that a scoped runner executes in an isolated environment on a task branch, ending in a pull request. Never a direct push to production branches or databases |
| Licensing (§4) | Source rights review and source-specific licence policies (Tasks 2.3, 2.8b) | Every monitored source keeps its own rights and licence rules. Monitoring a source's official listing does not authorise ingesting it |
