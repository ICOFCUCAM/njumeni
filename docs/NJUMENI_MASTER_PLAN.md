# NJUMENI — Global Legal Intelligence Platform

## Master Plan · Version 2.0

**Research. Evidence. Reasoning. Confidence.**
*Global legal intelligence, with human judgement at its centre.*

---

### Document control

| Field | Value |
|---|---|
| Document | Njumeni Master Plan |
| Version | 2.0 (governing) |
| Status | **Approved baseline for execution.** Owner decisions still open are listed in §24.4 |
| Date | 2026-11-11 |
| Owner | Njumeni product owner |
| Repository | `ICOFCUCAM/njumeni` (public, built in public; see ADR-0003) |
| Supersedes | The live overlay in [MASTER_IMPLEMENTATION_PLAN.md](MASTER_IMPLEMENTATION_PLAN.md), as the governing plan |
| Preserves | [ORIGINAL_MASTER_PLAN_SOURCE.md](ORIGINAL_MASTER_PLAN_SOURCE.md): the immutable original 20-section source, SHA-256 `4dce9574…f71992fe0` |
| Operational status | [PHASE_REGISTER.md](PHASE_REGISTER.md) is the live source of truth for task and phase state |

### How to read this document

- **Normative language.**
  - **MUST** / **MUST NOT**: mandatory requirements.
  - **SHOULD**: the default, which may be changed only through a recorded decision.
  - **MAY**: optional.
- **Upgrade markers.** **▲ U-nn** marks where version 2.0 extends or changes the original plan. Every upgrade is listed with its rationale in [Appendix B](#appendix-b--upgrade-register-u-01u-27).
- **Traceability.** Every original section (§1–§20) maps to a section of this document in [Appendix A](#appendix-a--traceability-to-the-original-20-section-source). Nothing from the original has been removed. Where the original is superseded, the original text stays preserved and the change is recorded.
- **Status vocabulary.** The terms used in this plan and the register are defined in §21.2.

### Contents

**Part I — Strategy and product**
1. Brand and corporate identity
2. Vision, mission and founding principles
3. Product architecture: complete system
4. Product modules A–M

**Part II — Intelligence architecture**
5. AI architecture
6. Legal knowledge infrastructure
7. Evidence architecture
8. Reasoning, verification and human oversight

**Part III — Platform architecture**
9. Technical architecture and technology stack
10. Data architecture
11. Security, privacy and governance
12. Open-source research and third-party software
13. API architecture and integration framework
14. Infrastructure, hosting and deployment

**Part IV — Operations and commercial**
15. User journeys and operational workflows
16. Administration and platform operations
17. Commercial architecture and monetisation
18. Testing, evaluation and quality assurance

**Part V — Delivery**
19. Repository, documentation and development model
20. Implementation roadmap
21. Definition of completion and status vocabulary
22. Strategic priorities
23. Permanent architectural decisions
24. Current position, open decisions and next actions

**Appendices:** A. Traceability · B. Upgrade register (U-01–U-27) · C. Glossary

---

# PART I — STRATEGY AND PRODUCT

## 1. Brand and corporate identity

### 1.1 Identity

| Element | Definition |
|---|---|
| Name | **NJUMENI** |
| Descriptor | **GLOBAL LEGAL INTELLIGENCE** |
| Brand line (original) | *Research. Evidence. Reasoning. Confidence.* |
| Supporting line | *Global legal intelligence, with human judgement at its centre.* |
| Alternative line (product specification) | *Law. Evidence. Intelligence.* Kept for consideration; the original line is the default until the owner decides |
| Company ambition | A complete international legal technology company, not an AI chatbot, document generator or online research tool |

### 1.2 Brand positioning

| Attribute | Meaning for the product |
|---|---|
| Institutional credibility | Sober, precise interface; claims backed by sources; no hype about "AI lawyers" |
| Premium international identity | A consistent identity across jurisdictions and languages |
| AI-native technology | AI is built into the workflows, but always grounded and reviewable |
| Accessible to individuals and professionals | Plain language for individuals, depth for professionals, on the same engine |
| Expandable across jurisdictions and legal systems | Jurisdictions are added as data and configuration, never by forking the product |
| Distinctive identity | No reliance on generic "Legal", "Law" or "Juris" naming |

### 1.3 Naming decision record

| Candidate | Decision | Reason |
|---|---|---|
| JuriPro | Do not adopt | Historical French JURIPRO registration, an existing Dutch business using the name, and unresolved clearance in Norway, the EU, UK and US |
| JurisAI | Do not keep as the main identity | Generic; research heritage only |
| Auctorium | Considered, not selected | — |
| Lexavion | Considered, not selected | — |
| Juralis | Considered, not selected | — |
| Argentis | Considered, not selected | — |
| Ordelyx | Considered, not selected | — |
| **Njumeni** | **Adopt as the working brand** | Distinctive. Clearance is still required (§1.4) |

The JuriPro findings are reasons for moving away from that name. They are not proof that "Njumeni" is available.

### 1.4 Domains and trademark clearance

| Asset | Purpose | Action | Timing |
|---|---|---|---|
| `njumeni.com` | Global corporate identity | Recheck availability; acquire | **▲ U-24: early.** The name becomes public as soon as the code is built in public |
| `njumeni.ai` | Primary AI platform | Recheck; acquire | Before public demo (Milestone M1) |
| `njumeni.io` | Technology ecosystem / developer portal | Recheck; acquire when budget allows | Before public API |
| Trademark search | NJUMENI and confusingly similar marks | Search Norway, the EU (EUIPO), UK (UKIPO), US (USPTO) and WIPO international records in **classes 9, 42, 45 and 35** | **▲ U-24:** a knock-out search (free, self-service) now; a professional search before public launch |

**▲ U-24, building in public raises brand exposure.** A public repository and a public build log publish the name before it is protected. The knock-out search and the primary domain are the only spends this plan recommends during the zero-cost stage (§14.1).

---

## 2. Vision, mission and founding principles

### 2.1 Vision and mission

| | Statement |
|---|---|
| **Vision** | Make reliable, explainable, jurisdiction-aware legal intelligence and well-organised legal work accessible to individuals, professionals, enterprises and institutions worldwide |
| **Mission** | Connect authoritative legal sources, user-controlled documents and evidence, and carefully governed AI workflows in one secure environment where users can inspect the basis of every material legal conclusion |
| **Objective** | Build the entire platform from its foundations: infrastructure, legal knowledge, evidence management, AI reasoning, research, document preparation, case management, professional workspaces, institutional services, security, commercial operations and international expansion |
| **Heritage** | Carry forward the JuriPro/JurisAI research and architectural decisions, under Njumeni as the product and development identity |

### 2.2 The fundamental principle

> **AI assists with legal research, analysis, evidence and reasoning. It does not pretend to be a lawyer, independently exercise legal authority or replace qualified human judgement.**

### 2.3 Founding product principles

| # | Principle | Consequence in the architecture |
|---|---|---|
| P1 | Human judgement at the centre | Review and approval gates (§8.5). No AI output is silently treated as approved |
| P2 | Source before statement (**▲ U-09**) | Every material legal claim cites a retrievable source version; otherwise the system abstains or qualifies the claim |
| P3 | Law as it stood | Authorities are versioned in time; the applicable version is selected by date (§6.4) |
| P4 | Evidence is sacred | Originals are preserved, hashed and kept in custody; every derivation traces back to the original (§7) |
| P5 | Isolation by default | Tenant, workspace and matter isolation is enforced in the database, not only in the UI (§11.2) |
| P6 | Structure over prose | Arguments, evidence links and authority relationships are explicit data, not AI-generated text blobs |
| P7 | Provider independence | No single model, cloud or legal-data vendor is required for core legal records |
| P8 | Honest coverage | A jurisdiction is never advertised beyond its tested coverage (§6.7) |
| P9 | Open code, closed data (**▲ U-01**) | Source code is public; customer data, secrets and production configuration never are (§11.7) |
| P10 | Verified, not merely written | A feature counts only when it meets the definition of completion (§21) |

### 2.4 Customer segments

| Segment | Primary users | Core needs | Workspace (module) |
|---|---|---|---|
| Individuals | People with a legal problem, self-represented parties | Understand rights, organise facts and documents, prepare questions, know when to seek a lawyer | Personal (H) |
| Legal professionals | Lawyers, advocates, solicitors, barristers, advisers, paralegals, researchers | Reliable research, verification, evidence analysis, argument development, drafting | Professional (I) |
| Law firms and enterprises | Partners, in-house legal, compliance teams, matter managers | Shared matters, permissions, knowledge reuse, workflows, oversight, reporting | Enterprise and Law Firm (J) |
| Institutions | Public bodies, institutional legal departments, regulators | Controlled knowledge, policy and administrative work, accountability, audit | Institutional (K) |
| Platform operators | Njumeni support, security and operations staff | Secure administration, incident handling, governance | Back office (§16); not a customer workspace |

---

## 3. Product architecture: complete system

### 3.1 System overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     NJUMENI — Global Legal Intelligence Platform             │
├──────────────────┬───────────────────┬──────────────────┬────────────────────┤
│ Personal         │ Professional      │ Enterprise       │ Institutional      │
│ Workspace        │ Workspace         │ Workspace        │ Workspace          │
│ Individuals and  │ Lawyers and legal │ Law firms and    │ Public bodies and  │
│ self-represented │ practitioners     │ organisations    │ institutions       │
├──────────────────┴───────────────────┴──────────────────┴────────────────────┤
│                       SHARED LEGAL INTELLIGENCE ENGINE                       │
│     Research · Evidence · Knowledge · Reasoning · Verification · Drafting    │
├──────────────────────────────────────────────────────────────────────────────┤
│                    PLATFORM SERVICES AND INFRASTRUCTURE                      │
│     API · Database · AI orchestration · Storage · Security · Integrations    │
│                                   · Audit                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

The architecture has four customer experiences, one underlying intelligence platform, shared services and controlled access between tenants. A workspace is an experience and permission context. It is **not** a separate codebase or a separate database.

### 3.2 The eight architectural layers

Every layer is required. The layers are designed as one integrated system, not as independent features. A user-facing feature MUST connect to the relevant underlying services. These layer names are canonical and are enforced by CI.

| # | Layer | Responsibility | Owns | Must not |
|---|---|---|---|---|
| 1 | **Experience** | Web applications, dashboards, mobile-ready interfaces | Routes, components, accessibility, client state | Hold authorisation logic or call providers directly |
| 2 | **API** | Authentication, API gateway, tenant and permission enforcement | Request validation, versioned contracts, rate limits, tracing | Contain domain logic beyond orchestration |
| 3 | **Workflow orchestration** | Case workflows, queues, tasks, AI agent execution | Job queue, state machines, approval gates, retries | Bypass permission checks for agents |
| 4 | **Evidence** | Documents, exhibits, chronology, provenance and extraction | Originals, hashes, versions, extractions, custody | Mix customer evidence with legal-source content |
| 5 | **Legal knowledge** | Legislation, cases, regulations, treaties and legal authorities | Source registry, authority versions, graph, retrieval | Ingest a source without approved rights |
| 6 | **Reasoning** | Legal issue identification, argument graphs, analysis and research | Issues, rules, arguments, assessments | Present unverified conclusions as authority |
| 7 | **Verification** | Citations, source validation, legal currency and human review | Citation/quote/currency checks, review records | Be weakened by a model fallback |
| 8 | **Infrastructure** | Database, storage, AI providers, security, monitoring and deployment | Environments, secrets, backups, observability | Leak production data into development |

**Dependency rule.** Calls flow downward or sideways through published contracts only. There MUST be no compile-time dependency cycle between bounded contexts (ADR-0001).

---

## 4. Product modules A–M

Each module below has a card, the full capability list from the original plan, and its non-negotiable rules. The detailed layer mapping is in [MODULE_LAYER_MAP.md](architecture/MODULE_LAYER_MAP.md); capability-level traceability is in [MODULE_REQUIREMENTS_TRACEABILITY.md](architecture/MODULE_REQUIREMENTS_TRACEABILITY.md).

### 4.0 Module overview

| ID | Module | Primary layers | Delivery phase(s) | Strategic pillar |
|---|---|---|---|---|
| A | Njumeni Legal Intelligence | Experience, Reasoning, Verification | 4–6 | Reasoning |
| B | Legal Research Engine | Legal knowledge, Reasoning | 2, 4 | Knowledge |
| C | Evidence Intelligence Engine | Evidence, Workflow orchestration | 3 | Evidence |
| D | Legal Case Management | Workflow orchestration, Experience | 8 | — |
| E | Legal Document Intelligence | Evidence, Reasoning, Verification | 7 | — |
| F | Legal Argument and Reasoning Engine | Reasoning | 5 | Reasoning |
| G | Jurisdiction and Legal Systems Engine | Legal knowledge | 2, 12 | Knowledge |
| H | Personal Legal Assistant | Experience | 8 | — |
| I | Professional Legal Workspace | Experience | 9 | — |
| J | Enterprise and Law Firm Workspace | Experience, API | 10 | — |
| K | Institutional Workspace | Experience, API | 10 | — |
| L | Legal Compliance and Risk Intelligence | Reasoning, Legal knowledge | 10 | — |
| M | Legal Knowledge Management | Legal knowledge, Experience | 9–10 | — |

### Module A — Njumeni Legal Intelligence

| Card | |
|---|---|
| Purpose | The central intelligence interface: one place to ask, research, reason and review |
| Users | All segments |
| Depends on | B, C, F, G, Verification |
| Benchmark category | Enterprise legal research AI (for example LexisNexis-class research assistants) |

**Functions (20):**
1. Natural-language legal questions
2. Legal issue identification
3. Jurisdiction-aware research
4. Legal concept explanation
5. Legislation interpretation assistance
6. Case-law research
7. Precedent comparison
8. Legal argument development
9. Identification of relevant legal principles
10. Counterargument identification
11. Legal risk identification
12. Legal position assessment
13. Evidence-to-law relationship analysis
14. Legal research reports
15. Research history and saved investigations
16. Source-linked responses
17. Follow-up questioning
18. Research export
19. Multi-jurisdiction comparisons
20. Human review and approval

**Answer composition contract.** Every substantive legal answer MUST separate the following six categories. **▲ U-09:** each is a typed field in the answer record, not a formatting convention.

| Category | Definition | Required source |
|---|---|---|
| Verified legal authority | Text of a law or decision that resolves to a stored source version | Authority version and passage anchor |
| Interpretation of the authority | What the authority is taken to mean | The authority plus the interpreting source, where one exists |
| Factual assumptions | Facts taken as given, not established | User input or evidence reference |
| Inferences | Conclusions drawn from the above | The claims they depend on |
| Unresolved questions | What cannot be answered from the available material | — |
| Potentially conflicting authorities | Authorities pointing the other way | Authority references |

### Module B — Legal Research Engine

| Card | |
|---|---|
| Purpose | A dedicated legal research system. It is **not** a web search box connected to an LLM |
| Users | All segments, through Module A and the professional research workspace |
| Depends on | G (jurisdictions), legal knowledge infrastructure (§6), Verification |

**Research coverage.** Every category below is a filterable dimension of the source registry.

| Material types | Areas of law |
|---|---|
| Legislation and statutory instruments | Constitutional law |
| Regulations and administrative rules | Administrative law |
| Court judgments | Employment law |
| Tribunal decisions | Immigration law |
| Case citations | Criminal law |
| Legal doctrines | Civil law |
| Treaties and international conventions | Commercial and corporate law |
| | Contract law |
| | Human rights |
| | Property law |
| | Family law |
| | Tax law |
| | Intellectual property |
| | Environmental law |
| | Procedural law |

**Research workflow (11 steps):**

| Step | Activity | Output |
|---|---|---|
| 1 | Receive the user's legal question | Question record |
| 2 | Identify the legal subject | Area-of-law classification |
| 3 | Determine the relevant jurisdiction | Jurisdiction profile reference |
| 4 | Identify the relevant period and applicable law | As-of date (§6.4) |
| 5 | Retrieve authoritative legal material | Ranked authority-version passages |
| 6 | Search related judicial decisions | Case-law set |
| 7 | Identify conflicting or superseded authorities | Graph traversal results (§6.5) |
| 8 | Build relationships between authorities | Research sub-graph |
| 9 | Produce a structured research result | Answer record (Module A contract) |
| 10 | Verify citations against original sources | Verification results (§8.3) |
| 11 | Present findings with source references and limitations | Report with a disclosed limitations section |

**Legal source metadata.** Every legal source MUST support the fields below. The schema introduced in Phase 2 implements them.

| Field | Field | Field |
|---|---|---|
| Jurisdiction | Effective date | Source URL |
| Issuing authority | Amendment date | Retrieval date |
| Document type | Repeal or expiry date | Language |
| Citation | Version history | Relationships with other authorities |
| Publication date | Legal status | ▲ Content hashes (source and normalised) |

Historical versions MUST be preserved. A judgment or statute is assessed using the law that applied in the relevant period, not automatically today's law.

### Module C — Evidence Intelligence Engine

| Card | |
|---|---|
| Purpose | Turn documents into structured, provenance-preserving evidence linked to facts, issues and law. **One of the most important proprietary components** |
| Users | All segments |
| Depends on | Object storage, OCR, extraction, F, Verification |
| Benchmark category | Legal workflow automation and document intelligence |

**Evidence management:**
- Upload PDF, DOCX, XLSX, TXT, email and image files
- OCR for scanned documents
- Document metadata extraction
- Dates, names, organisations and events
- Relevant quotations
- Contradictions
- Missing evidence
- Links to legal issues
- Links to claims and arguments
- Exhibit organisation
- Original document preservation
- Document hashes
- Document versions
- Chain of custody
- Access and modification history

**Evidence analysis:**
- Classification
- Chronological reconstruction
- Witness statement comparison
- Contract comparison
- Correspondence analysis
- Medical and employment document analysis, only where lawfully provided
- Inconsistencies
- Corroborating evidence
- Evidential gaps
- Relevance assessment
- Reliability considerations
- Separation of fact from allegation

**Evidence-to-law relationship model** (the central differentiator):

| Node | Example | Relationship to the next |
|---|---|---|
| Evidence **E-001** | Employer correspondence, 14 March | *supports / contradicts / qualifies* |
| Factual proposition **F-001** | The employer received notification of the incident | *is material to* |
| Legal issue **L-001** | Whether the notification requirement was satisfied | *is governed by* |
| Legal authority **A-001** | The applicable statutory notification provision (version in force on 14 March) | *is applied in* |
| Reasoned assessment | Evidence-supported analysis with limitations and source verification | — |

One piece of evidence can support, contradict or qualify one or more factual propositions. Details are in §7.

### Module D — Legal Case Management

| Card | |
|---|---|
| Purpose | A complete workspace for each legal matter |
| Users | All segments (scope differs by workspace) |
| Depends on | Tenancy, C, B, F, E |

**Capabilities:**
- Create and register cases
- Assign case numbers
- Define jurisdiction and legal category
- Create parties and representatives
- Record opposing parties
- Record legal questions
- Store relevant facts
- Manage documents and evidence
- Maintain case chronology
- Track deadlines
- Manage hearings
- Record procedural history
- Create tasks
- Assign responsibilities
- Track progress
- Record communications
- Maintain research notes
- Build legal arguments
- Generate case reports
- Export case bundles
- Archive completed cases

**Case lifecycle:**

```
New → Intake → Investigation → Research → Analysis → Drafting → Review → Submission/Action → Monitoring → Closed
```

Every transition is recorded in `matter_status_history`, permission-controlled and audited. A transition MAY carry a required human approval (configurable per workspace).

### Module E — Legal Document Intelligence

| Card | |
|---|---|
| Purpose | Prepare, analyse and revise legal documents |
| Users | All segments |
| Depends on | C, B, F, Verification, the document editor |
| Benchmark category | Litigation drafting assistants |

| Document creation | Document intelligence |
|---|---|
| Legal letters | Extract document structure |
| Complaints | Identify legal references |
| Appeals | Detect missing sections |
| Administrative submissions | Check internal consistency |
| Legal memoranda | Compare document versions |
| Statements of facts | Verify citations |
| Witness statements | Identify unsupported assertions |
| Affidavits | Flag ambiguous language |
| Contracts | Identify contradictions |
| Agreements | Suggest improvements |
| Legal opinions | Maintain tracked revisions |
| Case summaries | Preserve user-approved wording |
| Research memoranda | Produce professionally formatted exports |
| Motions and applications | |
| Regulatory submissions | |
| Responses to legal notices | |
| Evidence indexes | |
| Chronologies | |
| Legal briefs | |

**Document lifecycle:**

```
Template → Draft → AI Analysis → Citation Verification → Human Review → Approved → Exported
```

AI-generated documents MUST NOT be silently treated as approved legal submissions. The `Approved` state can be set only by an authorised human, and that decision is attributable and audited.

### Module F — Legal Argument and Reasoning Engine

| Card | |
|---|---|
| Purpose | Build and evaluate structured argument graphs. A separate domain service (bounded context) |
| Users | Professionals, and individuals in simplified form |
| Depends on | B, C, Verification |

The argument graph contains these node types:
- legal issues
- legal questions
- applicable rules
- statutory provisions
- judicial interpretations
- facts
- evidence
- claims
- arguments
- counterarguments
- exceptions
- defences
- procedural requirements
- remedies
- conclusions

Edge types are in §8.1.

**Reasoning capabilities:**
1. Issue identification
2. Rule identification
3. Fact application
4. Evidence assessment
5. Counterargument analysis
6. Distinguishing adverse precedents
7. Identifying missing facts
8. Identifying legal uncertainty
9. Evaluating competing interpretations
10. Producing structured reasoning

Argument relationships are explicit data, never only unstructured AI text.

### Module G — Jurisdiction and Legal Systems Engine

| Card | |
|---|---|
| Purpose | First-class jurisdiction profiles; global support is never an afterthought |
| Users | All modules |
| Depends on | Legal knowledge infrastructure |

**Jurisdiction profile fields:**
- country
- legal system
- court hierarchy
- administrative authorities
- legislation sources
- case-law sources
- procedural rules
- official languages
- legal citation conventions
- applicable dates
- territorial scope
- international treaty relationships

▲ The profile also records coverage level (§6.7) and the supported languages for search (**U-22**).

**Initial jurisdiction framework:**

| Priority | Jurisdiction | Legal tradition | Languages (search) | Current state |
|---|---|---|---|---|
| 1 | Norway | Civil law (Nordic) | Norwegian (Bokmål/Nynorsk), English | `pilot` (catalogued; no content) |
| 2 | European Union | Supranational | 24 official; English and French first | `planned` |
| 3 | United Kingdom | Common law (three legal systems) | English | `planned` |
| 4 | United States | Common law (federal and state) | English | `planned` |
| 5 | International law | Treaty-based / customary | English, French | `planned` |
| 6 | Cameroon | Mixed (civil and common law) | French, English | `planned` |
| 7 | Other African jurisdictions | Various | Various | Not catalogued |
| 8 | Additional global jurisdictions | Various | Various | Not catalogued |

The platform MUST support common-law, civil-law and mixed legal systems, supranational frameworks and international law. A jurisdiction MUST NOT be advertised as fully supported until its sources, coverage, updates, citation verification and content quality have been tested (§6.7).

### Module H — Personal Legal Assistant

| Card | |
|---|---|
| Purpose | A legal workspace for individuals without a lawyer |
| Tone | Plain language without sacrificing legal precision |

**Features:**
- Personal legal workspace
- Guided legal intake
- Explaining legal rights and obligations
- Identifying potential legal issues
- Organising personal documents
- Explaining official letters
- Creating case chronologies
- Preparing questions for a lawyer
- Helping prepare administrative responses
- Assisting with appeals and complaints
- Tracking important dates
- Maintaining personal legal records
- Generating document drafts
- Referring users to qualified legal professionals where appropriate

▲ Referral triggers are explicit rules: high stakes, deadlines, criminal exposure, or conflicting authority with low confidence. They are not left to model discretion.

### Module I — Professional Legal Workspace

**Features:**
- Client management
- Matter management
- Research workspace
- Evidence analysis
- Case-law search
- Argument graph
- Document drafting
- Citation verification
- Internal knowledge base
- Research libraries
- Collaboration
- Document versioning
- Task assignments
- Review and approval
- Matter reporting
- Client communication records
- Billing integration readiness
- Exportable professional work product

Professional users MUST be able to review the original authority and the underlying evidence behind every material AI conclusion. ▲ **U-16:** conflict checks and information barriers (ethical walls) are permission primitives at matter level.

### Module J — Enterprise and Law Firm Workspace

**Features:**
- Organisation accounts
- Multiple teams
- Multiple offices
- User invitations
- Role-based access
- Matter ownership
- Team assignments
- Shared document libraries
- Organisation-wide templates
- Knowledge repositories
- Custom workflows
- Usage monitoring
- Subscription management
- Audit trails
- API access
- Single sign-on readiness
- Data retention policies
- Custom branding
- Enterprise administration

### Module K — Institutional Workspace

**Features:**
- Institutional case repositories
- Policy and regulatory research
- Administrative decision analysis
- Document review
- Compliance workflows
- Legal knowledge repositories
- Institutional templates
- Access-controlled collaboration
- Oversight and audit
- Retention and archival policies
- Institutional reporting

This module MUST strictly separate institutional data and MUST NEVER expose confidential case materials across unrelated organisations. ▲ **U-14:** institutional deployments that assist judicial authorities may fall into the EU AI Act's high-risk category for the administration of justice. Such deployments require the conformity work described in §11.6 before onboarding.

### Module L — Legal Compliance and Risk Intelligence

**Features:**
- Regulatory research
- Regulatory change monitoring
- Compliance obligation registers
- Policy analysis
- Contractual obligation extraction
- Risk identification
- Regulatory comparison
- Compliance evidence
- Compliance reporting
- Review schedules
- Audit records

The compliance engine is built on traceable obligations and source-linked rules, **not** generic AI risk scores. Every obligation references an authority version and its effective period. Regulatory change monitoring reuses source monitoring (§6.6).

### Module M — Legal Knowledge Management

**Capabilities:**
- Saved research
- Legal precedents
- Internal legal opinions
- Document templates
- Approved arguments
- Legal notes
- Matter knowledge
- Research collections
- Taxonomies
- Tags
- Relationships
- Knowledge access permissions
- Version histories
- Review and expiry dates

Private client information MUST NOT automatically become shared institutional knowledge or AI training data. Promotion from matter knowledge to organisation knowledge is an explicit, permissioned and audited act.

---

# PART II — INTELLIGENCE ARCHITECTURE

## 5. AI architecture

### 5.1 Principles

1. **Provider-independent.** Njumeni MUST NOT be permanently dependent on one model company or inference API.
2. **Grounded.** Legal claims are generated from retrieved, permitted sources (§5.5).
3. **Authorised.** Agents act inside the caller's tenant, workspace and matter scope and can never widen it.
4. **Governed.** Every execution is recorded (§5.6) and evaluated (§18.2).
5. **▲ U-13, data-minimising.** Only the minimum necessary content is sent to a provider, under the workspace's AI processing settings.

### 5.2 Orchestration architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Njumeni AI Orchestrator                                          │
│ Model routing · prompts · context · permissions · budgets        │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ Research     │ Evidence     │ Reasoning    │ Drafting            │
│ agents       │ agents       │ agents       │ agents              │
│ discovery,   │ OCR,         │ issues,      │ creation and        │
│ retrieval,   │ extraction,  │ rules,       │ revision            │
│ comparison   │ chronology   │ arguments    │                     │
├──────────────┴───────┬──────┴──────────────┴─────────────────────┤
│ Verification agents  │ Compliance agents                         │
│ source checks,       │ obligations, changes, risk checks         │
│ citation validation  │                                           │
├──────────────────────┴───────────────────────────────────────────┤
│ Provider-independent model adapter                               │
│ Commercial APIs · self-hosted models · embeddings · OCR ·        │
│ reranking                                                        │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Agent registry

Every agent MUST have a defined function, permission scope, inputs, outputs, model requirements and evaluation tests. ▲ The registry also records each agent's *autonomy level*:
- **A0** — deterministic; no model.
- **A1** — proposes; a human approves.
- **A2** — acts within a workflow, with automatic verification.

No agent operates above A2.

| Agent | Responsibility | Key inputs | Key outputs | Autonomy | Phase |
|---|---|---|---|---|---|
| Intake Agent | Understand legal questions and collect facts | User narrative | Structured question, fact list, missing facts | A1 | 5/8 |
| Jurisdiction Agent | Determine the applicable legal system | Facts, locations, dates | Jurisdiction and as-of date candidates | A1 | 4 |
| Research Agent | Discover legal sources | Question, jurisdiction | Search plan | A2 | 4 |
| Retrieval Agent | Retrieve relevant authorities | Search plan | Ranked passages with provenance | A2 | 4 |
| Case Law Agent | Analyse judicial decisions | Decisions | Holdings, reasoning, treatment | A1 | 5 |
| Legislation Agent | Analyse statutory material | Provisions (version-pinned) | Elements, conditions, exceptions | A1 | 5 |
| Evidence Agent | Extract and organise evidence | Documents | Entities, passages, classifications | A2 | 3 |
| Chronology Agent | Reconstruct events | Dated passages | Timeline with source anchors | A2 | 3 |
| Contradiction Agent | Identify inconsistencies | Propositions and passages | Contradiction records | A1 | 3 |
| Issue Agent | Identify legal questions | Facts, question | Issue list | A1 | 5 |
| Reasoning Agent | Build legal arguments | Issues, rules, facts | Argument sub-graph | A1 | 5 |
| Counterargument Agent | Test opposing positions | Argument graph | Counterarguments, distinguishing points | A1 | 5 |
| Drafting Agent | Prepare legal documents | Template, matter context | Draft with citations | A1 | 7 |
| Citation Agent | Verify citations | Draft or answer | Citation check results | A0/A2 | 4/6 |
| Currency Agent | Check whether authorities are current | Authority references, as-of date | Currency results | A0/A2 | 6 |
| Compliance Agent | Map obligations and requirements | Regulatory sources, policies | Obligation register entries | A1 | 10 |
| Translation Agent | Translate legal material | Text, language pair | Translation, marked non-authoritative | A1 | 12 |
| Quality Agent | Review accuracy and completeness | Any output | Quality findings | A2 | 6 |
| Safety Agent | Enforce boundaries and identify inappropriate use | Requests and outputs | Allow/deny/escalate decisions | A0/A2 | 5 |

Agents MUST NOT bypass platform authorisation or access data outside their assigned tenant and matter. Agent tool access is granted through `ai_tool_permissions` and checked by the API layer, not by the prompt.

### 5.4 Orchestrator responsibilities

| Area | Responsibilities |
|---|---|
| Registry | Agent registration, agent versions, agent selection |
| Execution | Workflow execution, queue management, retry logic, failure handling, structured outputs |
| Models | Model selection, provider fallback, model evaluation |
| Context | Context construction, prompt versioning |
| Control | Tool permissions, token budgets, cost controls, human approval gates |
| Accountability | Audit records |

A model fallback MUST NOT silently weaken citation verification or privacy requirements. If the fallback model cannot meet the same verification and egress policy, the workflow fails visibly.

### 5.5 Legal retrieval-augmented generation (RAG)

**Pipeline:**

| # | Stage | Contract | Implementation status |
|---|---|---|---|
| 1 | Source ingestion | Rights-gated adapter runs (§6.3) | Framework built; no adapters |
| 2 | Normalisation | Unicode/whitespace normalisation, canonical metadata | Built (unit-tested) |
| 3 | Metadata extraction | Source metadata fields (Module B) | Built (contract) |
| 4 | Versioning | Append-only authority versions, effective periods | Built (schema) |
| 5 | Chunking | Passage anchors (section/page/offset) | Built (unit-tested) |
| 6 | Embeddings | Versioned embedding profile (§5.7) | **Built:** profile `multilingual-e5-small-v1` (384 dimensions); local embedder and backfill; real-model run pending a host with model download access |
| 7 | Indexing | PostgreSQL full-text (GIN) and pgvector (HNSW) | Built (schema) |
| 8 | Retrieval | Hybrid lexical + semantic with metadata and jurisdiction filters | Built against an empty corpus |
| 9 | Reranking | Cross-encoder or LLM reranker behind an adapter | Not started |
| 10 | Context assembly | Citation bundles with rights-aware quoting | Built |
| 11 | AI reasoning | Grounded generation | Not started (Phase 5) |
| 12 | Citation verification | Claim → passage resolution | Not started (Phase 4 core) |

**Technology:**
- PostgreSQL for canonical legal records
- pgvector for semantic retrieval
- PostgreSQL full-text search for lexical retrieval
- Metadata and jurisdiction filters
- Hybrid retrieval
- Reranking
- Exact source passage retrieval
- Citation and source provenance

Legal RAG MUST understand that two documents can contain the same legal phrase but differ in authority, dates, jurisdiction or legal status. Retrieval ranks *authority versions*, not text alone. ▲ **U-22:** lexical search uses language-specific text-search configurations, for example `norwegian`, `english` and `french`, selected by passage language; the current `simple` configuration is an interim baseline.

### 5.6 Model governance record

Every AI execution records:

| Field | Field | Field |
|---|---|---|
| Model provider | Agent version | Token usage |
| Model identifier | Input and output references | Estimated cost |
| Model version (where available) | Retrieval references | Verification outcome |
| Prompt version | Execution time | Human review status |
| ▲ Workspace AI processing policy applied | ▲ Data egress classification | ▲ Fallback event (if any) |

Records reference content by ID. They do not copy confidential text into logs.

### 5.7 ▲ U-13 AI safety and data-protection controls

| Control | Requirement |
|---|---|
| Prompt-injection isolation | Ingested documents and evidence are *data, never instructions*. Retrieved text is delimited and tool calls are allow-listed; an instruction inside a document cannot change the agent's permissions |
| Provider data terms | Production providers MUST offer no-training terms and, where available, zero or limited data retention. These terms are recorded per provider in `ai_providers` |
| Workspace AI processing consent | Each workspace sets whether, and which, external providers may process its content. The default for confidential matters is the most restrictive available option |
| Egress classification | Content is classified before sending (public legal source, user narrative, confidential evidence). The policy decides which providers may receive each class |
| Abstention | When grounding fails, the system answers "insufficient verified authority" rather than generating unsupported content |
| Embedding profile | A versioned record of model key, dimensions, language coverage and licence (`private.legal_embedding_profiles`). Embeddings from different profiles are never mixed. ▲ **Decided (D-3):** `multilingual-e5-small-v1`, 384 dimensions; the passage column was forward-migrated from the 1536 placeholder to `vector(384)` |
| Cost guardrails (▲ U-23) | Per-workspace and per-plan token budgets with hard stops; no unlimited high-cost usage on low-priced plans |

---

## 6. Legal knowledge infrastructure

The legal knowledge system is one of Njumeni's most valuable long-term assets. It is built as a **source-ingestion framework**. Legal documents are never placed into an AI knowledge base by hand.

### 6.1 Legal source registry

Each source provider has a registration record (`private.legal_sources` and related tables):

| Field | Purpose | Implemented |
|---|---|---|
| Provider identity | Who publishes the source | ✅ |
| Jurisdiction | Scope | ✅ |
| Source category | Legislation, case law, treaty and so on | ✅ |
| Official or secondary status | Authority weight | ✅ |
| Access method | API, bulk download, feed, permitted import | ✅ |
| Licence | Licence identifier and evidence | ✅ (rights evidence) |
| Redistribution permission | Separate gates for ingestion, display, quotation and redistribution | ✅ |
| API limits | Rate and quota limits | Partial |
| Update frequency | Monitoring cadence | ✅ |
| Language | Source languages | ✅ |
| Coverage | Classes, date intervals, known gaps | ✅ (coverage review) |
| Last successful retrieval | Freshness | ✅ |
| Source quality status | Quality evaluation | Partial |
| ▲ Adapter pin | Exact adapter key and version permitted to ingest | ✅ |

### 6.2 Source acquisition channels

| # | Channel | Typical rights posture | Default treatment |
|---|---|---|---|
| 1 | Official legal APIs | Often open-licensed; check terms | Preferred |
| 2 | Government open-data portals | Open licence common | Preferred |
| 3 | Official court repositories | Varies; sometimes restricted for computational use | Rights review required |
| 4 | Official legislation databases | Varies | Rights review required |
| 5 | Treaty repositories | Generally open for reference | Rights review required |
| 6 | Licensed legal databases | Contractual | Only under a signed licence |
| 7 | Permitted document imports | Per agreement | Per agreement |
| 8 | User-provided legal materials | User's own rights | Tenant-scoped; never pooled |

Public accessibility is **not** permission to scrape, redistribute or reuse material commercially. Each source passes three independent gates: **rights review**, **operator activation** and **ingestion enablement** (already implemented as separate audited RPCs).

### 6.3 ▲ Candidate initial sources (subject to rights review)

The entries below are *candidates for rights review*, not approvals. Licence terms MUST be verified against the provider's current published terms before activation.

| Jurisdiction | Candidate source | Content | Rights note to verify |
|---|---|---|---|
| Norway | Lovdata public data (current acts and central regulations) | Legislation | Reported to be available under the Norwegian Licence for Open Government Data (NLOD); confirm scope and attribution |
| Norway | Courts' published decisions | Case law | Lovdata's case-law collection is commercial; open alternatives are limited and need separate review |
| EU | EUR-Lex / Publications Office (CELLAR) | Legislation, case law | Commission reuse policy generally permits reuse with attribution; confirm |
| UK | legislation.gov.uk | Legislation | Open Government Licence; confirm |
| UK | Find Case Law (The National Archives) | Case law | Open Justice Licence; computational analysis may require a separate licence |
| US | Congress.gov API, govinfo | Federal legislation | Public domain for federal works; API terms apply |
| US | Free Law Project / CourtListener | Case law | Check the data licence and API terms |
| International | UN Treaty Collection | Treaties | Confirm reuse terms |
| Cameroon | Official Gazette and government portals | Legislation | Digital availability limited; a known coverage gap |

### 6.4 ▲ U-07 Temporal model: law as it stood

Legal applicability requires two distinct time axes:

| Axis | Question answered | Stored as |
|---|---|---|
| **Valid time** | When was this text legally in force? | `effective_from` / `effective_to` on authority versions |
| **System (knowledge) time** | When did Njumeni learn this version? | `retrieved_at` / `recorded_at`, append-only |

An **as-of query** selects the version valid on the relevant event date, using the knowledge Njumeni held at a chosen system time. This makes it possible to reproduce *exactly* what a past research answer relied on, even after corrections are ingested. Each update creates a new version or a status event; historical content is never overwritten.

### 6.5 Legal authority graph

| Relationship | Direction | Typical example |
|---|---|---|
| Amends | New → old | An amending act changes a provision |
| Repeals | New → old | A provision ceases to have effect |
| Replaces | New → old | A consolidated act replaces predecessors |
| Interprets | Decision → provision | A court construes a statutory term |
| Applies | Decision → provision | A court applies a rule to facts |
| Distinguishes | Decision → decision | A later court distinguishes a precedent |
| Overrules | Decision → decision | A higher court departs from a precedent |
| Refers to | Any → any | A citation without treatment |
| Implements | National → supranational | A national act implements an EU directive |
| Conflicts with | Any ↔ any | A recorded inconsistency between authorities |
| Supplements | Any → any | Regulations supplement an act |

Each edge has a type, effective date and provenance (the source and the passage stating the relationship). This lets Njumeni detect, for example, that a provision was amended after the relevant event, and distinguish the historical text from the current one.

### 6.6 Legal source monitoring

Recurring jobs detect and record each of the following as new versions or status events. They never silently overwrite.
- New legislation
- Amendments
- Repeals
- New judgments
- New regulations
- Official corrections
- Updated procedural rules
- Changes in source availability

### 6.7 ▲ U-21 Jurisdiction coverage levels

| Level | Meaning | Evidence required | May be marketed as |
|---|---|---|---|
| `catalogued` | Known sources listed | Catalogue entry | Not marketed |
| `planned` | Scheduled for work | Roadmap entry | "Coming" |
| `pilot` | Some sources live with restrictions | Approved rights, active adapter, coverage review | "Preview: limited coverage" with disclosed gaps |
| `partial` | Defined classes and periods covered | Coverage review per class, freshness SLA met, evaluation set passing | "Supported for [classes, period]" |
| `supported` | Fully supported scope | All of the above, plus citation verification passing thresholds and an update monitoring SLA | "Supported" |

**Enforcement (implemented, Task 2.7).** `private.jurisdictions.status` uses exactly these levels, plus `suspended`. A database trigger refuses any published level above its recorded evidence: `pilot` needs a live, rights-approved source; `partial` also needs the latest recorded retrieval evaluation to have passed within the review interval; `supported` is refused until citation-verification and update-monitoring evidence exist (Phases 4 and 6). Evaluation runs are stored append-only in `private.legal_retrieval_evaluations`.

### 6.8 ▲ U-08 Identifiers and document standards

Where a source provides them, Njumeni stores standard identifiers alongside its own stable IDs:
- **ELI** (European Legislation Identifier) for legislation
- **ECLI** (European Case Law Identifier) for decisions
- Native citation keys, such as national act identifiers

Structured legislation SHOULD be mapped to an **Akoma Ntoso**-compatible structural model (sections, provisions, points) to support provision-level versioning. These identifiers are optional mappings; Njumeni's internal IDs remain authoritative.

---

## 7. Evidence architecture

### 7.1 Evidence lifecycle

| Stage | Control |
|---|---|
| Upload | Type and size validation, malware scanning, quarantine until clean |
| Original preservation | **▲ U-11:** content-addressed storage (the object key derives from the SHA-256 hash); originals are immutable |
| Hash and metadata | SHA-256 recorded at intake; file metadata extracted without modifying the original |
| OCR and extraction | Derivatives are stored separately and linked to the original hash |
| Entities and dates | Extraction records with passage anchors |
| Classification | Evidence type, sensitivity and ▲ privilege tags |
| Chronology | Events linked to source passages |
| Contradiction analysis | Contradiction records between propositions |
| Claim relationships | supports / contradicts / qualifies edges |
| Legal issue mapping | Links to issues and authorities |
| Evidence report | Exportable, with provenance |

### 7.2 Chain of custody

Every access, export, modification of a derivative, sharing change and deletion request produces an `evidence_custody_events` record. ▲ **U-11:** custody events are **hash-chained**, so each record includes the hash of the previous record for that evidence item. Silent alteration is therefore detectable. The same mechanism serves the audit log (§11.5, U-12).

### 7.3 ▲ Evidence governance additions

| Capability | Purpose |
|---|---|
| Legal hold | Blocks deletion and retention expiry while a hold is active |
| Privilege tagging | Marks legally privileged material, to restrict sharing and AI egress |
| Redaction | Produces redacted derivatives without altering the original |
| Sensitive categories | Medical, employment and similar categories are processed only where lawfully provided, with stricter AI egress defaults |

---

## 8. Reasoning, verification and human oversight

### 8.1 Argument graph edge types

| Edge | From → To |
|---|---|
| `raises` | Fact/evidence → issue |
| `governed_by` | Issue → rule/provision |
| `interpreted_by` | Provision → judicial interpretation |
| `supports` / `contradicts` / `qualifies` | Evidence → fact/claim |
| `argues_for` / `argues_against` | Argument → claim/conclusion |
| `rebuts` | Counterargument → argument |
| `excepts` | Exception/defence → rule |
| `requires` | Claim → procedural requirement |
| `yields` | Conclusion → remedy |
| `distinguishes` | Argument → adverse precedent |

Every node that asserts law MUST reference an authority version; every node that asserts fact MUST reference evidence or be marked as an assumption.

### 8.2 ▲ U-09 Verified-or-abstain contract and claim ledger

Each generated answer or draft is decomposed into a **claim ledger**. Each claim is classified by the six answer categories (Module A) and linked to its support. A claim that asserts law without a resolving passage cannot be presented as verified. It is either removed, downgraded to "interpretation" or "inference" with a disclosed basis, or the system abstains.

### 8.3 Verification checks

| Check | Question | Phase |
|---|---|---|
| Citation existence | Does the cited authority exist in a registered source? | 4 |
| Citation resolution | Does the citation resolve to a specific stored version and passage? | 4 |
| Quotation fidelity | Does quoted text match the stored passage exactly (after normalisation)? | 4 |
| Source validation | Is the source approved, active and within its rights to display or quote? | 4 |
| Currency | Was this version in force on the as-of date? Has it since changed? | 6 |
| Treatment | Has the authority been overruled, distinguished or repealed? | 6 |
| Conflict detection | Do retrieved authorities conflict? | 6 |
| Jurisdiction fit | Does the authority belong to the applicable jurisdiction and hierarchy? | 6 |
| Uncertainty and limitation reporting | Are the gaps disclosed? | 6 |

▲ **U-10:** the first four checks are pulled forward into Phase 4. No research output ships without them.

### 8.4 Confidence and limitation reporting

Answers report coverage limits (§6.7), unresolved questions and conflicting authority explicitly. Numeric confidence scores, where shown, MUST be calibrated against evaluation data (§18.2). Otherwise they MUST NOT be shown.

### 8.5 Human oversight gates

Review gates are required for:
- High-impact legal conclusions
- Final legal document approval
- Sensitive evidence interpretation
- Institutional outputs
- Conflicting authorities
- Low-confidence research
- Matters involving significant legal uncertainty

The user MUST always be able to inspect the source material behind important findings. Every review and approval is attributable to an authorised human.

---

# PART III — PLATFORM ARCHITECTURE

## 9. Technical architecture and technology stack

### 9.1 Architectural style

Njumeni is built as a **modular monolith** with clearly separated domain modules (bounded contexts) and service boundaries (ADR-0001). This gives faster development without sacrificing the ability to scale into independently deployed services.

Do not start with dozens of microservices. Separate the domains in code, database access, queues and APIs first, and extract services only when actual scaling or operational requirements justify it. ▲ **U-01:** the monolith's *code* is public; its *deployments and data* are private (ADR-0003).

### 9.2 Frontend architecture

| Technology | Responsibility | Status |
|---|---|---|
| Next.js | Main web application | ✅ In use (v16, App Router) |
| React | User interface | ✅ In use (v19) |
| TypeScript | Type safety | ✅ Strict mode |
| Tailwind CSS | Design system | ✅ In use (v4) |
| shadcn/ui | Reusable interface components | Planned |
| React Hook Form | Forms | Planned |
| Zod | Validation; ▲ also the source of the OpenAPI schemas (U-26) | Planned |
| TanStack Query | Server-state management | Planned |
| Zustand | Client-state management | Planned (only where server state is insufficient) |
| TipTap | Legal document editor | Planned (Phase 7) |
| PDF.js | PDF viewing | Planned (Phase 3) |
| React Flow | Argument graphs and evidence relationships | Planned (Phase 5) |

**Target frontend structure:**

```
apps/web/
  app/
    (marketing)/  (auth)/  (personal)/  (professional)/
    (enterprise)/  (institutional)/  admin/
  components/
  features/
    intelligence/ research/ evidence/ cases/ documents/
    arguments/ compliance/ knowledge/ billing/
  hooks/  lib/  styles/
apps/mobile/   (after core workflows are stable)
```

The first release is responsive web. A mobile application follows once the core workflows are stable.

### 9.3 Backend architecture

TypeScript and Node.js for the core backend.

| Deployable | Responsibility |
|---|---|
| `apps/api` | Public application API (versioned REST) |
| `apps/worker` | Asynchronous processing and AI tasks |
| `apps/scheduler` | Recurring legal-source updates, monitoring and deadlines |

| Package | Responsibility | Package | Responsibility |
|---|---|---|---|
| core | Domain logic, common services | ai-orchestration | Model and agent coordination |
| auth | Identity integration | ai-agents | Agent definitions |
| tenancy | Organisation/workspace isolation | ai-providers | Provider adapters |
| permissions | Access-control enforcement | retrieval | Hybrid retrieval |
| legal-intelligence | Module A orchestration | citations | Citation parsing and resolution |
| legal-research | Research workflows | verification | Source and citation validation |
| legal-sources | Ingestion and authority management | compliance | Obligations |
| jurisdiction | Jurisdiction profiles | knowledge | Knowledge management |
| evidence | Evidence domain | billing | Plans, entitlements, metering |
| documents | Document domain | notifications | Email and in-app |
| case-management | Matters | audit | Audit stream |
| legal-reasoning | Reasoning services | storage | Object storage |
| argument-graph | Graph model | integrations | External adapters |
| shared-types | Shared types | validation | Shared validation |

Each package has explicit interfaces, tests and ownership boundaries.

### 9.4 ▲ U-06 Incremental monorepo

The target structure above is the destination, not a prerequisite. Today the modules live in `apps/web/src/modules/*` with enforced import boundaries.

| Trigger | Action |
|---|---|
| A second deployable needs a module (for example the legal-knowledge worker) | Extract that module to `packages/<name>` with its own tests |
| Two or more packages exist | Introduce pnpm workspaces and Turborepo (`pnpm-workspace.yaml`, `turbo.json`) |
| The API is consumed by a non-Next client | Create `apps/api` |

The **first extraction candidate** is `legal-sources` plus `retrieval`, because the worker process already exists.

### 9.5 Database and storage architecture

| Component | Role | ▲ Stage 0 choice (U-03) |
|---|---|---|
| PostgreSQL | Primary transactional database and canonical legal records; **the authoritative system of record** | Supabase Postgres (free tier) |
| pgvector | Legal and document embeddings | Supabase Postgres extension |
| Full-text search | Exact terminology and citations | PostgreSQL FTS, language-aware |
| Redis | Caching, rate limiting, transient coordination | **▲ U-04: deferred.** Not needed at Stage 0 |
| BullMQ | Background job processing | **▲ U-04: deferred.** Postgres-backed durable queue (leases, retries, dead letters) is already implemented |
| Object storage | Documents, exhibits, source files, generated files | **▲ U-05:** Supabase Storage (S3-compatible API) |
| Dedicated search infrastructure | Only if retrieval volume justifies it | Not planned |

**▲ U-04 graduation trigger to Redis/BullMQ:** sustained queue throughput or latency that the Postgres queue cannot meet within SLOs, *or* rate-limiting needs that Postgres cannot serve. The queue interface is kept abstract so that the switch is an adapter change, not a rewrite. Avoid unnecessary infrastructure duplication.

---

## 10. Data architecture

### 10.1 Domain inventory and implementation status

This is the domain inventory, **not** a requirement to create every table in one migration. The schema is introduced through versioned, tested migrations. Names in *italics* are the names actually implemented where they differ from the original inventory.

| Domain | Planned tables (original inventory) | Implemented today | Phase |
|---|---|---|---|
| Identity and tenancy | users, profiles, organisations, organisation_members, workspaces, workspace_members, roles, permissions, role_permissions, invitations, sessions | *principals, principal_identities, user_profiles, organizations, organization_memberships, workspaces, workspace_memberships, role_catalog, permission_catalog, role_permissions, organization_role_bindings, workspace_role_bindings, organization_invitations, membership_events, role_audit_events*; sessions handled by Supabase Auth | 1 |
| Legal matters | matters, matter_parties, matter_representatives, matter_assignments, matter_facts, matter_issues, matter_tasks, matter_deadlines, matter_events, matter_notes, matter_status_history | — | 8 |
| Evidence | evidence_items, evidence_files, evidence_versions, evidence_metadata, evidence_extractions, evidence_passages, evidence_entities, evidence_relationships, evidence_claims, evidence_contradictions, evidence_custody_events | — (private workspace storage bucket only) | 3 |
| Legal authorities | jurisdictions, legal_systems, legal_authorities, authority_versions, authority_provisions, authority_sections, authority_citations, authority_relationships, authority_status_history, legal_source_providers, legal_source_ingestion_jobs | *jurisdictions, legal_sources, legal_authorities, legal_authority_versions, legal_authority_passages, legal_authority_relationships, legal_source_ingestion_jobs/runs/checkpoints/failures, legal_source_rights_evidence*, plus rights/activation/coverage audit tables | 2 |
| Research and reasoning | research_projects, research_queries, research_runs, research_sources, research_findings, legal_issues, legal_rules, legal_arguments, argument_nodes, argument_edges, argument_evidence_links, argument_authority_links, counterarguments, reasoning_assessments | — | 4–5 |
| Documents | documents, document_versions, document_templates, document_sections, document_citations, document_reviews, document_comments, document_approvals, document_exports | — | 7 |
| AI | ai_providers, ai_models, ai_agents, ai_agent_versions, ai_prompts, ai_prompt_versions, ai_workflows, ai_workflow_runs, ai_execution_steps, ai_tool_permissions, ai_usage, ai_evaluations | — | 5 |
| Verification | citation_checks, source_checks, authority_currency_checks, verification_results, human_reviews, review_decisions | — | 4, 6 |
| Compliance and knowledge | compliance_frameworks, compliance_obligations, compliance_assessments, compliance_evidence, knowledge_items, knowledge_collections, knowledge_relationships, knowledge_access_policies | — | 9–10 |
| Commercial and administration | subscription_plans, subscriptions, billing_customers, invoices, payments, usage_entitlements, usage_records, api_keys, audit_logs, notifications | *subscription_plans, subscriptions, billing_customers, billing_provider_events, subscription_entitlements, usage_records, security_audit_events* | 1 (identity), 11 |

Naming convention: the database uses US spelling (`organizations`) for identifiers, matching the Supabase and PostgreSQL ecosystem; documentation uses British spelling. Tenant-sensitive tables are protected by RLS. Internal tables live in the `private` schema with direct grants revoked.

### 10.2 Critical integrity rules and how they are enforced

These are foundational integrity rules, not optional application-level conventions.

| Rule | Enforcement mechanism |
|---|---|
| Every matter belongs to an authorised workspace | NOT NULL foreign key plus RLS on workspace membership |
| Every workspace belongs to a user or organisation | Ownership FK and check constraint (implemented) |
| Every evidence item belongs to a matter or an explicitly permitted research workspace | FK plus check constraint |
| Every legal finding references its supporting evidence or authority where applicable | Claim ledger link tables; verification blocks unsupported legal claims |
| Every legal authority has a jurisdiction and source provenance | NOT NULL FKs plus hashes (implemented) |
| Every authority version preserves its effective dates | Append-only trigger plus period constraints (implemented) |
| Every argument node can reference facts, evidence and legal authorities | Typed link tables |
| Every document version maintains its revision history | Append-only versions |
| Every AI workflow belongs to an authorised execution context | Workflow run FK to workspace/matter plus caller principal |
| Every AI execution records the sources it used | `ai_execution_steps` → retrieval references |
| Every review and approval is attributable to an authorised human | Principal FK plus a permission check in the RPC |
| Every sensitive operation produces an audit record | Triggers and RPC-level audit writes (implemented for Phase 1 scope) |

---

## 11. Security, privacy and governance

This is a legal platform. Security is built into the domain architecture, not added at the end.

### 11.1 Identity and authentication

| Requirement | Status |
|---|---|
| Supabase Auth or a compatible identity provider | ✅ Supabase Auth (SSR, server-side `getUser()`) |
| Email verification | ✅ (invitation acceptance requires a confirmed email) |
| Secure password recovery | Planned |
| MFA | Planned (TOTP); ▲ **U-17:** passkeys (WebAuthn) as the preferred second factor |
| Session management | ✅ Proxy refresh, HttpOnly cookies |
| OAuth | Planned |
| Enterprise SSO readiness | Planned (SAML/OIDC) — Phase 10 |
| Device and session revocation | Planned |
| Account recovery procedures | Planned |
| Leaked-password protection | Requires a paid Supabase plan; **accepted risk at Stage 0** (ADR-0003), mitigated by minimum password strength and MFA |

### 11.2 Multi-tenant security

```
Platform
  └── Organisation
       └── Workspace
            └── Matter
                 ├── Documents
                 ├── Evidence
                 ├── Research
                 ├── Arguments
                 └── Reviews
```

- A user only sees records they are authorised to access.
- PostgreSQL Row Level Security protects tenant-sensitive records, supplemented by backend authorisation checks.
- Security rules are tested for both authorised and unauthorised access (pgTAP, with separate principals).
- ▲ **U-16:** information barriers can exclude named principals from a matter even when their role would otherwise grant access. Exclusion always overrides grant.

### 11.3 Role-based access control

| Role | Scope | Example permissions |
|---|---|---|
| Platform administrator | Platform operations | Tenant support, source administration; **no default access to matter content** |
| Organisation owner | Organisation administration | Ownership transfer, billing, all admin |
| Organisation administrator | Membership and configuration | Invitations, roles, workspace creation |
| Legal professional | Assigned matters | Read/write matter content, research, drafting |
| Senior reviewer | Review and approval | Approve documents and findings |
| Researcher | Research and permitted evidence | Research, read-only permitted evidence |
| Case manager | Matter administration | Matter lifecycle, tasks, deadlines |
| Client | Own authorised matters | Read shared outputs, upload to own matters |
| Read-only reviewer | Restricted viewing | Read without export |
| Auditor | Authorised audit access | Read audit records |

Permission granularity: **organisation → workspace → matter → document.** Permissions come from a catalogue; roles are bundles of permissions; bindings are scoped. Billing entitlements never grant data access (they are separate from authorisation).

### 11.4 Confidentiality controls

| Control | Stage 0 implementation |
|---|---|
| Encryption in transit | TLS everywhere (provider-managed) |
| Encryption at rest | Provider-managed |
| Managed secrets | Provider secret stores and GitHub Actions secrets; never in Git |
| Short-lived signed file URLs | Supabase Storage signed URLs |
| Malware scanning | Required before evidence intake opens (Phase 3) |
| Upload validation | Type, size and content sniffing |
| Access logs | Audit stream |
| Sensitive-data classification | Evidence classification and egress classes |
| Retention policies | Per workspace |
| Secure deletion workflows | Verified deletion, honouring legal hold |
| Backup protection | Required before Stage 1 (§14.1) |
| Data export controls | Permissioned, audited exports |
| AI-provider disclosure and consent | Workspace AI processing settings (§5.7) |
| No unauthorised model training on customer material | Provider terms plus policy |

### 11.5 Audit and accountability

Events recorded:
- Authentication
- Login failures
- Permission changes
- Matter access
- Document access
- Evidence uploads
- Evidence modifications
- AI executions
- Research activity
- Citation checks
- Document approvals
- Exports
- Deletions
- Organisation changes
- Billing and administrative actions

Audit records are append-only at the application level. ▲ **U-12:** they are also **hash-chained for all tenants**, not only sensitive institutional deployments. The mechanism is cheap and makes silent modification detectable; external anchoring (periodic publication of chain heads) is added for institutional deployments. Audit records never contain confidential document content.

### 11.6 Legal and regulatory governance

| Framework / concern | Njumeni approach |
|---|---|
| GDPR (EU/EEA, including Norway) | Controller/processor roles defined per segment; records of processing |
| Data protection impact assessments | DPIA before processing confidential matters at scale |
| Data subject rights | Access, rectification, erasure (subject to legal hold and professional obligations), portability |
| Data residency | EU/EEA region by default (database in `eu-north-1`) |
| Data processing agreements | With every subprocessor (hosting, AI, email) |
| Records retention | Configurable per workspace and jurisdiction |
| Confidentiality and professional secrecy | Lawyer confidentiality obligations respected; privilege tagging (§7.3) |
| AI transparency | AI-generated content labelled; governance records kept (§5.6) |
| Human oversight | Review gates (§8.5) |
| Risk classification | ▲ **U-14:** EU AI Act classification per workspace type; administration-of-justice use by judicial authorities treated as potentially high-risk; EEA incorporation tracked for Norway |
| Security incident response | Documented runbook; notification duties |
| International data transfers | Transfer mechanisms recorded per subprocessor |
| ▲ Cameroon | National personal-data protection framework to be reviewed before Cameroonian customer onboarding |

Njumeni MUST NOT claim certification or regulatory compliance merely because these controls exist in code. Actual compliance requires documented policies, testing, operational procedures and appropriate legal review.

### 11.7 ▲ U-01 Build-in-public security model

The repository is public (ADR-0003). Security therefore MUST NOT depend on secrecy of code ("no security through obscurity").

| Public | Never public |
|---|---|
| Source code, migrations, RLS policies, tests | Customer data, documents, evidence, matter metadata |
| Architecture and plans | Secrets, API keys, service-role keys, tokens |
| Synthetic fixtures | Production project references beyond what is already disclosed, production configuration, backups and dumps |
| CI configuration | CI logs containing sensitive values (logs are public on a public repository) |

Controls: Gitleaks and a repository content policy on every push, the placeholder-only `.env.example`, synthetic data only, and a vulnerability disclosure route in `SECURITY.md`. Any committed secret is treated as exposed and rotated immediately.

---

## 12. Open-source research and third-party software

Njumeni should not reinvent every component. It MUST distinguish reusable infrastructure, architectural inspiration and software that can legally be incorporated into its own product.

### 12.1 Upstream reference projects

| Project | Intended treatment | Licence note (verify at the exact version) | Status |
|---|---|---|---|
| OpenContracts | Study and selectively reuse suitable components after licence review | Verify | Not cloned |
| CaseCite | Study citation and case-law architecture; assess permitted reuse | Verify | Not cloned |
| Lawgent | Study legal-agent and workflow patterns | No licence observed: **study only, no code reuse** | Not cloned |
| Lovspor | Separate integration, with explicit licence controls | AGPL: adapter boundary only | Not cloned |
| Mike | Study useful capabilities; avoid direct AGPL reuse in the core | AGPL: study only | Not cloned |

For each capability the outcome is one of: adopt, adapt, reimplement in Njumeni-owned code, isolate behind an adapter, replace, or discard. Wholesale copying and licence circumvention are not authorised. These five are the initial reference set, not an exclusive list.

### 12.2 Proprietary core

Njumeni's own intellectual property:
- Legal intelligence orchestration
- Legal argument graph
- Evidence-to-law relationship engine
- Jurisdiction engine
- Legal authority versioning
- Citation verification
- AI workflow orchestration
- Legal research workflows
- Multi-tenant legal workspaces
- Case and evidence domain models
- Legal quality evaluation framework

This is where long-term commercial differentiation resides. ▲ **U-02:** building in public does not make the core open source. Until the owner chooses a licence, the code is **all rights reserved**: publicly visible, but not licensed for reuse. Choosing a licence (proprietary source-available, open-core or open source) is an explicit owner decision (§24.4). It MUST be made before accepting outside contributions, and those contributions require a contributor agreement.

### 12.3 Third-party software governance

Maintain `THIRD_PARTY_SOFTWARE.md`, which consolidates the current `THIRD_PARTY_NOTICES.md`, and a software bill of materials (SBOM). For every dependency, record:

| Field | Field | Field |
|---|---|---|
| Repository | Modification obligations | Attribution requirements |
| Version | Distribution requirements | Commercial restrictions |
| Licence | Network-use provisions | Approved use |
| Copyright obligations | | Security assessment |

No component enters the proprietary core until its licence has been reviewed. Take particular care with AGPL, GPL and commercially restricted AI-model licences.

### 12.4 Integration boundary

```
Njumeni Core
    │
    └── Internal application interface
             │
             └── External integration adapter
                        │
                        └── Third-party system
```

The adapter isolates licence obligations, data flows, credentials and failure handling.

---

## 13. API architecture and integration framework

### 13.1 API domains

| Endpoint | Module / context | Phase |
|---|---|---|
| `/api/v1/auth` | Identity | 1 |
| `/api/v1/users` | Identity | 1 |
| `/api/v1/organisations` | Tenancy | 1 |
| `/api/v1/workspaces` | Tenancy | 1 |
| `/api/v1/matters` | D | 8 |
| `/api/v1/parties` | D | 8 |
| `/api/v1/evidence` | C | 3 |
| `/api/v1/documents` | E | 7 |
| `/api/v1/research` | A, B | 4 |
| `/api/v1/authorities` | B | 2/4 |
| `/api/v1/jurisdictions` | G | 2 |
| `/api/v1/arguments` | F | 5 |
| `/api/v1/verification` | Verification | 4/6 |
| `/api/v1/compliance` | L | 10 |
| `/api/v1/knowledge` | M | 9 |
| `/api/v1/agents` | AI orchestration | 5 |
| `/api/v1/workflows` | Workflow orchestration | 5 |
| `/api/v1/billing` | Commercial | 11 |
| `/api/v1/usage` | Commercial | 11 |
| `/api/v1/audit` | Audit | 1/10 |
| `/api/v1/admin` | Back office | 10 |

Today, server actions and server-only RPCs serve the web app. The public REST API is introduced per domain in the phase shown.

### 13.2 API requirements

- REST API with versioning
- OpenAPI documentation (▲ **U-26:** generated from Zod schemas, contract-first)
- Structured request and response schemas
- Consistent error codes
- Authentication and authorisation
- Tenant isolation
- Rate limiting
- Idempotency for appropriate operations
- Pagination
- Request tracing (correlation IDs)
- API key management
- Webhook infrastructure
- Audit logging

### 13.3 External integration categories

| Category | Integrations |
|---|---|
| Legal information | Official legislation repositories, court and tribunal databases, government legal information services, licensed research databases |
| AI and machine learning | OpenAI, Anthropic, other permitted commercial providers, self-hosted models, embedding providers, reranking providers |
| Document processing | OCR engines, PDF extraction, DOCX processing, office document conversion, electronic signature providers |
| Communications | Email, notifications, calendar integrations, secure collaboration |
| Commercial | Subscription billing, payment providers, invoice generation, tax calculation |
| ▲ Agent interfaces | A controlled MCP or agent-tool interface for external assistants, permission-scoped like any API client (P1, after Phase 6) |

Each integration MUST be optional and replaceable. Core legal records MUST NOT become dependent on one external provider.

---

## 14. Infrastructure, hosting and deployment

### 14.1 ▲ U-03 Staged infrastructure: zero-cost first

The deployment architecture must support international operations while keeping infrastructure costs under control. Because the owner's decision is to **spend nothing for now**, infrastructure is staged, with explicit graduation triggers.

| Component | Original proposal | **Stage 0 (now, zero cost)** | Stage 1 (pilot) | Stage 2 (production) |
|---|---|---|---|---|
| Source control | Private GitHub | **Public GitHub** (ADR-0003) | Public or private | Owner decision |
| CI/CD | GitHub Actions and Vercel | GitHub Actions (free on public repositories) | Same | Same, plus protected environments |
| Web hosting | Vercel | Local development; Vercel Hobby for non-commercial previews only | Vercel Pro (Hobby forbids commercial use) | Vercel Pro/Enterprise or equivalent |
| Database and auth | Supabase Postgres and Auth | Supabase Free (`Njumeni`, `eu-north-1`) | Supabase Pro (backups, no pausing) | Supabase Pro/Team with PITR |
| Database security | PostgreSQL RLS | RLS | RLS | RLS |
| Vector search | pgvector | pgvector | pgvector | pgvector (dedicated search only if justified) |
| Background jobs | BullMQ | **Postgres queue** (U-04) | Postgres queue | Redis/BullMQ if the trigger is met |
| Queue/cache | Redis | None | None, or a managed free tier | Managed Redis |
| Worker hosting | Dedicated container service | Local, or a scheduled GitHub Actions job for **public legal sources only** | Small container service | Dedicated workers |
| Object storage | S3-compatible | Supabase Storage (free quota; synthetic data only) | Supabase Storage | Supabase Storage or S3-compatible |
| DNS and security | Cloudflare | None, or Cloudflare Free once a domain exists | Cloudflare Free/Pro | Cloudflare with WAF |
| Monitoring | Sentry and infrastructure monitoring | Sentry free developer tier, structured logs | Sentry paid tier | Full monitoring and alerting |
| Embeddings | — | Open multilingual model run locally or in the worker (U-22) | Same, or a hosted provider under DPA | Per evaluation results |
| LLM | — | Mock provider by default; pay-as-you-go only under hard budget caps | Provider under DPA with no-training terms | Multi-provider with fallback |

**Graduation triggers to Stage 1:**
- The first real (non-synthetic) user data, or any commercial use.
- Supabase Free limits reached or inactivity pausing becomes disruptive.
- A backup or point-in-time recovery requirement.

**Stage 0 hard rules:**
- Synthetic data only.
- Nothing commercial on Vercel Hobby.
- Free-tier limits change: re-verify them before relying on them.

Supabase is suitable for the initial database and authentication architecture, provided migration discipline is maintained and processing logic is not all pushed into database functions.

### 14.2 Deployment topology (Stage 2 target)

```
Cloudflare        DNS · WAF · traffic protection
   │
Vercel            Next.js application
   │
API hosting       Application backend
   │
Supabase          PostgreSQL · Auth · RLS · pgvector · Storage metadata
   │
Worker services   OCR · AI · Research · Ingestion
   │
Redis and queues  Asynchronous execution
   │
Object storage    Legal documents and evidence
   │
AI providers      Model APIs and self-hosted inference
```

### 14.3 Environments

| Environment | Composition | Data |
|---|---|---|
| Development | Local Next.js, local backend, local Supabase (CLI), local queue, test object storage, mock AI providers, automated test data | Synthetic only |
| Test/CI | Ephemeral local Supabase stack in GitHub Actions; migrations replayed from zero; pgTAP and app tests | Synthetic only |
| Staging | Separate Supabase project, separate storage, realistic AI integrations, migration testing, security testing, release acceptance | Synthetic or consented test data |
| Production | Production database and storage, dedicated workers, production secrets, monitoring and alerts, automated backups, disaster recovery, restricted admin access | Customer data |

Never use production legal documents as casual development or test data. At Stage 0, the single hosted project acts as the future staging/production environment. It holds no customer data. ▲ **U-27:** by owner decision, **no migration is applied to it until all phases are complete**. The cumulative migration set is deployed once, in Phase 13. All development and testing runs against local and CI stacks.

### 14.4 Deployment services

| Initial service | Later extraction (by workload only) |
|---|---|
| `njumeni-web` | `njumeni-research-worker` |
| `njumeni-api` | `njumeni-evidence-worker` |
| `njumeni-worker` | `njumeni-document-worker` |
| `njumeni-scheduler` | `njumeni-ingestion-worker` |
| `njumeni-redis` (Stage 2) | `njumeni-ai-worker` |
| `njumeni-supabase` | `njumeni-verification-worker` |
| `njumeni-object-storage` | |

Services are extracted based on workload, not because separate service names look sophisticated.

### 14.5 Reliability architecture

| Capability | Status |
|---|---|
| Database backups | Stage 1 (Supabase Pro) |
| Point-in-time recovery where supported | Stage 2 |
| Restore testing | Stage 1, then quarterly |
| Queue retries | ✅ Implemented (Postgres queue) |
| Dead-letter handling | ✅ Implemented |
| Idempotent job execution | ✅ Implemented (idempotency keys, checkpoints) |
| Worker health checks | Partial (lease heartbeats) |
| Graceful shutdown | Partial |
| Rate limiting | Planned |
| Circuit breakers | Planned |
| Provider timeout controls | Partial (bounded fetch) |
| Structured logging | Partial |
| Centralised error reporting | Planned (Sentry) |
| Database connection pooling | Provider-managed (Supavisor) |
| Disaster recovery procedures | Stage 2 |

For a legal platform, preserving evidence and audit records during outages is particularly important.

---

# PART IV — OPERATIONS AND COMMERCIAL

## 15. User journeys and operational workflows

A platform can have impressive features and still fail commercially if its workflows are incomplete. Each journey below is an end-to-end acceptance test.

### 15.1 Individual legal assistance

| # | Step | Module / layer |
|---|---|---|
| 1 | Registration | Identity |
| 2 | Personal workspace | H, tenancy |
| 3 | Legal issue selection | A |
| 4 | Jurisdiction selection | G |
| 5 | Guided factual intake | H, Intake Agent |
| 6 | Document upload | C |
| 7 | Evidence extraction | C |
| 8 | Chronology generation | C |
| 9 | Legal research | B |
| 10 | Legal analysis | F |
| 11 | Citation verification | Verification |
| 12 | Draft preparation | E |
| 13 | Human review | Verification |
| 14 | Export and case archive | D |

### 15.2 Professional legal matter

| # | Step | Module / layer |
|---|---|---|
| 1 | Organisation | J |
| 2 | Client registration | I |
| 3 | Matter creation | D |
| 4 | Conflict-check workflow | I (▲ U-16) |
| 5 | Matter assignment | D |
| 6 | Evidence collection | C |
| 7 | Research and authorities | B |
| 8 | Argument development | F |
| 9 | Drafting | E |
| 10 | Internal review | Verification |
| 11 | Approval | Verification |
| 12 | Export / client delivery | E |
| 13 | Matter monitoring | D, L |
| 14 | Closure and retention | D |

Conflict checking is permission-controlled and configurable according to each firm's procedures.

### 15.3 Legal research

```
Question → Issue classification → Jurisdiction and time selection → Authority discovery →
Source retrieval → Version validation → Precedent analysis → Argument mapping →
Counterargument analysis → Citation verification → Research memorandum
```

### 15.4 Evidence investigation

```
Upload → Original file preservation → File hash and metadata → OCR and extraction →
Entities and dates → Evidence classification → Chronology → Contradiction analysis →
Claim relationships → Legal issue mapping → Evidence report
```

### 15.5 AI document production

```
Document request → Template selection → Case and research context → Draft generation →
Section-level analysis → Authority validation → Evidence validation → Quality review →
Human approval → DOCX / PDF export
```

The platform MUST keep the relationship between the final document and its source materials, so that users can trace how its material statements were developed.

---

## 16. Administration and platform operations

Njumeni needs its own comprehensive back office. Administrative functions have **separate permissions** from ordinary legal workspace functions.

| Administrator | Responsibilities |
|---|---|
| **Platform administrator** | User administration, organisation administration, subscription administration, jurisdiction configuration, legal-source administration, AI-provider management, model configuration, agent management, prompt management, workflow management, usage and cost management, security alerts, audit access, system health, feature flags, release management |
| **Legal knowledge administrator** | Source registration, source licensing, source ingestion, authority review, duplicate detection, metadata correction, version verification, source health, update monitoring, jurisdiction coverage. *Rights review, activation and coverage review RPCs are already implemented* |
| **AI operations administrator** | Provider status, model availability, agent versions, prompt versions, token usage, execution failures, citation failures, evaluation scores, cost per workflow, safety incidents, model fallback events |
| **Organisation administrator** | Team membership, roles and permissions, workspace creation, matter access, templates, usage allocation, billing, organisation policies, retention settings, audit reports |

Platform administrators have **no default access to customer matter content**. Support access requires time-bound, audited, customer-approved access ("break-glass", ADR-0002).

---

## 17. Commercial architecture and monetisation

Njumeni does not rely on a single subscription model. It supports individual subscriptions, professional subscriptions, enterprise contracts, usage-based AI services and licensed institutional deployments.

### 17.1 Plans (pricing hypotheses to test, not established prices)

| Plan | Target customer | Proposed monthly price | ▲ Indicative AI allowance (U-23) |
|---|---|---|---|
| Free | General public | $0 | Very low monthly cap; public-law research only |
| Personal | Individuals | $19 | Capped |
| Personal Plus | Individuals with ongoing legal matters | $39 | Capped, larger |
| Professional | Lawyers and advisers | $79 | Capped, with paid top-ups |
| Professional Plus | High-volume practitioners | $149 | Higher cap, with top-ups |
| Law Firm | Small legal practices | $299+ | Pooled per seat |
| Enterprise | Large organisations | Custom | Contracted |
| Institutional | Public institutions | Contract | Contracted |

### 17.2 Revenue streams

1. Monthly subscriptions
2. Annual subscriptions
3. Professional workspace licences
4. Additional user seats
5. AI usage allowances and additional credits
6. Premium legal research
7. Advanced document intelligence
8. Enterprise deployments
9. Institutional licensing
10. API access
11. Custom integrations
12. Private deployments
13. Professional knowledge management
14. Additional storage and retention services

### 17.3 Usage metering

| Category | Metering unit (proposed) |
|---|---|
| Research operations | Research run |
| AI reasoning | Tokens (normalised credits) |
| Evidence extraction | Document |
| OCR pages | Page |
| Document generation | Generated document |
| Citation verification | Checked citation |
| Translation | Characters |
| Storage | GB-month |
| API requests | Request |

Every plan defines quotas, limits and overage rules. Unlimited high-cost AI usage on low-priced subscriptions MUST be avoided.

### 17.4 Billing architecture

```
Plans → Subscriptions → Entitlements → Usage metering → Quota enforcement →
Invoices and payments → Revenue analytics
```

Billing is independent of legal matter data, so that changes to commercial arrangements cannot compromise legal records. *The provider-neutral billing identity, entitlements and usage ledger already exist from Phase 1, Task 1.10. Payment provider integration is Phase 11.*

---

## 18. Testing, evaluation and quality assurance

Njumeni is evaluated as a legal intelligence system, not simply as a software application.

### 18.1 Software testing

| Type | Tooling / approach | Status |
|---|---|---|
| Unit testing | Node test runner | ✅ 161 web tests, 19 root tests |
| Integration testing | Supabase local stack | Partial |
| API testing | Contract tests from OpenAPI | Planned |
| Database testing | pgTAP | ✅ (some files currently failing; see the register) |
| RLS testing | pgTAP as separate principals | ✅ |
| Authentication testing | Mocked lifecycle tests, plus a live provider test | Mocked ✅ / live pending |
| Tenant-isolation testing | Consolidated security contract suite | Authored |
| End-to-end testing | Playwright | Planned |
| Performance testing | k6 or similar | Phase 13 |
| Load testing | k6 or similar | Phase 13 |
| Migration testing | Clean replay from zero in CI | ✅ |
| Backup restoration testing | Restore drill | Stage 1 |
| Security testing | Gitleaks, dependency audit, penetration test | Partial / Phase 13 |

### 18.2 Legal intelligence evaluation

A permanent legal evaluation dataset of properly licensed or synthetic material, ▲ **U-15:** held **per jurisdiction** and run in CI as a release gate once Phase 4 begins.

| Evaluation | What it tests | ▲ Initial gate (to calibrate) |
|---|---|---|
| Retrieval recall | Whether relevant authorities are found | Recall@10 ≥ 0.80 on the golden set |
| Retrieval precision | Whether irrelevant authorities are excluded | Precision@5 ≥ 0.60 |
| Citation accuracy | Whether citations identify real sources | **100%** (fabricated citations block release) |
| Source grounding | Whether conclusions are supported | ≥ 0.95 of legal claims grounded |
| Currency accuracy | Whether the applicable legal versions are identified | ≥ 0.95 on as-of test cases |
| Jurisdiction accuracy | Whether the correct legal system is applied | ≥ 0.98 |
| Evidence extraction | Whether source information is extracted correctly | Field-level F1 ≥ 0.90 |
| Chronology accuracy | Whether dates and events are ordered correctly | ≥ 0.95 |
| Contradiction detection | Whether inconsistencies are identified | Recall ≥ 0.80 |
| Reasoning quality | Whether arguments are logically structured | Rubric-scored by a human panel |
| Draft completeness | Whether required document sections are present | 100% of required sections |
| Safety | Whether limitations and uncertainty are communicated | 100% of limitation-required cases |

Thresholds are initial targets. They are recalibrated with the first real evaluation data, and changes are recorded.

### 18.3 Mandatory release gates

No release proceeds if:
- Cross-tenant access is possible.
- Material legal citations are fabricated.
- Historical legal versions are silently substituted.
- Documents are lost or corrupted.
- Evidence provenance is broken.
- AI agents can bypass authorisation.
- A critical migration fails.
- An unauthorised user can approve legal documents.
- Audit records can be silently modified.

▲ Added gates:
- CI is not green on the release commit.
- A secret appears in the repository or its history.
- The evaluation thresholds in §18.2 regress.

### 18.4 Human oversight

The review gates are defined in §8.5. The user MUST always be able to inspect the source material behind important findings.

---

# PART V — DELIVERY

## 19. Repository, documentation and development model

### 19.1 ▲ U-01 Repository visibility

The original plan required a private repository. **The owner has decided to build in public, to avoid cost and to build openly** (ADR-0003, 2026-11-11). The private-repository requirement is replaced by the build-in-public security model (§11.7). Moving to private remains possible at any time. It does not remove history already published.

### 19.2 Target monorepo structure

```
njumeni/
├── apps/            web/ api/ worker/ scheduler/ mobile/
├── packages/        core/ auth/ tenancy/ permissions/ legal-intelligence/ legal-research/
│                    legal-sources/ jurisdiction/ evidence/ documents/ case-management/
│                    legal-reasoning/ argument-graph/ ai-orchestration/ ai-agents/
│                    ai-providers/ retrieval/ citations/ verification/ compliance/
│                    knowledge/ billing/ notifications/ audit/ integrations/ storage/
│                    shared-types/ validation/
├── supabase/        migrations/ functions/ seed/ tests/
├── infrastructure/  docker/ deployment/ monitoring/ backups/ security/
├── legal-data/      source-registry/ jurisdiction-registry/ ingestion-schemas/
│                    evaluation-datasets/
├── docs/            architecture/ product/ database/ api/ security/ legal-governance/
│                    integrations/ operations/ decisions/
├── tests/           unit/ integration/ e2e/ security/ legal-evaluation/ performance/
├── .github/workflows/
├── THIRD_PARTY_SOFTWARE.md  SECURITY.md  CONTRIBUTING.md  README.md
└── package.json  pnpm-workspace.yaml  turbo.json
```

**Current structure:** `apps/web` (with modules under `src/modules`), `supabase/`, `scripts/`, `tests/`, `docs/`. Evolution follows §9.4.

### 19.3 Mandatory architecture documentation

These documents describe the actual implementation and are not marketing documents.

| Required document | Purpose | Current home | Action |
|---|---|---|---|
| PRODUCT_SPECIFICATION.md | Complete product requirements | `docs/PRODUCT_SPECIFICATION.md` | Maintain |
| SYSTEM_ARCHITECTURE.md | Overall architecture | ADR-0001 and `LEGAL_AI_PLATFORM_ARCHITECTURE.md` | Consolidate in Phase 2 closeout |
| DOMAIN_MODEL.md | Legal and business domain definitions | [`docs/DOMAIN_MODEL.md`](DOMAIN_MODEL.md) | ✅ Created (Phase 3) |
| DATABASE_ARCHITECTURE.md | Entities and relationships | §10 of this plan, plus migrations | Create (Phase 2 closeout) |
| AI_ARCHITECTURE.md | Models, agents and orchestration | [`docs/AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md) | ✅ Created (Phase 5) |
| LEGAL_KNOWLEDGE_ARCHITECTURE.md | Authority and source management | `PHASE_2_TASK_2_*` documents | Consolidate (Phase 2 closeout) |
| EVIDENCE_ARCHITECTURE.md | Evidence provenance and relationships | [`docs/EVIDENCE_ARCHITECTURE.md`](EVIDENCE_ARCHITECTURE.md) | ✅ Created (Phase 3) |
| SECURITY_ARCHITECTURE.md | AuthN, AuthZ, privacy | [`docs/SECURITY_ARCHITECTURE.md`](SECURITY_ARCHITECTURE.md) | ✅ Created (Phase 1 closeout) |
| MULTITENANCY.md | Organisation/workspace isolation | [`docs/MULTITENANCY.md`](MULTITENANCY.md) | ✅ Created (Phase 1 closeout) |
| API_SPECIFICATION.md | API contracts | `GET /api/v1/openapi.json` (OpenAPI 3.1, contract-tested) | ✅ Served from Phase 4 |
| DEPLOYMENT_ARCHITECTURE.md | Hosting and infrastructure | `ENVIRONMENT_STRATEGY.md`, `INFRASTRUCTURE_AUDIT.md`, ADR-0003 | Refresh |
| TESTING_STRATEGY.md | Quality and evaluation | [`docs/TESTING_STRATEGY.md`](TESTING_STRATEGY.md) | ✅ Created (Phase 4) |
| COMMERCIAL_MODEL.md | Pricing, entitlements, billing | Task 1.10 design, §17 | Create (Phase 11 entry) |
| IMPLEMENTATION_ROADMAP.md | Development phases | §20 of this plan and `PHASE_REGISTER.md` | This plan |
| THIRD_PARTY_SOFTWARE.md | Open-source and licence register | `THIRD_PARTY_NOTICES.md` | Rename and extend with an SBOM |
| ARCHITECTURE_DECISIONS.md | Permanent decisions | `docs/architecture/ADR-*` | Create an index |

### 19.4 ▲ U-18 Development cadence

The previous cadence ("no intermediate commits; one phase batch; verify once at the end") is **retired**. It produced large unverified batches, corrupted migration delimiters and a long run of red CI.

| Rule | Requirement |
|---|---|
| Commit cadence | ▲ One commit per completed phase (owner decision, supersedes "small commits" for the autonomous build). Every phase commit must pass the full local verification first |
| Checks green | ▲ **Owner decision (11 November 2026): continuous autonomous mode with one commit and push per completed phase.** Each phase is verified locally (`scripts/ci/local-checks.sh` plus the local Supabase pgTAP suite) before its commit; automatic CI then runs on the push (free on the public repository). A red CI run is fixed before the next phase continues |
| Migrations (▲ U-27) | **All migrations are kept in the repository and run only on local and CI stacks until every phase is complete. The hosted database receives the cumulative set once, in Phase 13** (ADR-0003 §2.5). Until then, corrections are permitted but must be hash-pinned in `scripts/ci/migration-predeployment-corrections.json`. After deployment, migrations are immutable and changes are forward-only |
| Phase closeout | Acceptance report, then a closeout commit, then a green CI run and a Git tag `phase-N-closed` |
| Parallel phases | Allowed when the upstream *contract* is stable; acceptance stays sequential |
| Generated artefacts | Database types are regenerated and checked for drift in CI |

---

## 20. Implementation roadmap

Each phase must produce working, tested functionality before the dependent phase proceeds. ▲ **U-25:** the original roadmap order is restored; the register had drifted to a different ordering of Phases 3–8. ▲ **U-10:** the verification core is moved into Phase 4.

### 20.1 Phase overview

| Phase | Name | Theme | Key deliverables | Exit criteria (summary) | State (2026-11-11) |
|---|---|---|---|---|---|
| 0 | Architecture and project foundation | Foundation | Product specification, coding standards, domain boundaries, architecture documents, environment strategy, CI, migration discipline, app shell | All Phase 0 tasks green and a verified closeout | 🟢 **CLOSED** (`6cbcf03`) |
| 1 | Identity, tenancy and security | Security foundation | Authentication, user profiles, organisations, workspaces, invitations, roles and permissions, RLS, audit logging, subscription identity, tenant-isolation tests | All pgTAP and app tests green; live Auth checks; isolation suite passing | 🟢 **CLOSED** (11 November 2026) |
| 2 | Legal knowledge infrastructure | Knowledge foundation | Jurisdiction registry, source registry, authority models, versioning, source ingestion, normalisation, full-text search, pgvector, provenance; ▲ first pilot adapter and embedding profile | Clean replay; pgTAP green; one rights-approved pilot source ingested end-to-end | 🟡 **IN PROGRESS** (parallel) |
| 3 | Evidence intelligence | Evidence engine | Document upload, object storage, OCR, extraction, classification, entity extraction, chronology, contradiction analysis, evidence relationships, chain of custody; ▲ content addressing, hash-chained custody and audit | Journey 15.4 passes end-to-end on synthetic data | 🔵 **IMPLEMENTED** (verified locally; closeout pending Phase 1 and OCR/AV items) |
| 4 | Legal research engine | Research engine | Jurisdiction-aware retrieval, legal RAG, authority discovery, case-law search, legislation search, source comparison, citation retrieval, historical version selection; ▲ verification core (U-10), evaluation harness (U-15) | Journey 15.3 passes; evaluation gates met for the pilot jurisdiction | 🔵 **IMPLEMENTED** (verified locally; extractive; real content pending Task 2.8) |
| — | ▲ **Milestone M1** | Public demo | Grounded research over public Norwegian law, with verification, on a public demo | M1 criteria (§20.2) | — |
| 5 | AI reasoning and agent framework | Intelligence engine | AI provider adapters, agent registry, workflow orchestration, issue identification, argument graphs, counterargument generation, evidence-to-law mapping, reasoning evaluation | Agents operate only within scope; reasoning evaluation passing | 🔵 **IMPLEMENTED** (verified locally; mock provider; real provider awaits D-5) |
| 6 | Verification and legal quality | Trust layer | Citation validation, source validation, authority currency, conflict detection, legal uncertainty, confidence and limitation reporting, human review, quality gates | Release gates §18.3 automated | 🔵 **IMPLEMENTED** (verified locally; release gates in CI; calibration awaits Task 2.8) |
| 7 | Document intelligence | Document engine | Legal document editor, templates, drafting agents, version management, citation insertion, document comparison, approval workflow, DOCX and PDF exports | Journey 15.5 passes | 🔵 **IMPLEMENTED** (verified locally; journey 15.5 passed on synthetic data) |
| 8 | Case management and personal workspace | Individual product | Matter creation, case parties, case chronology, evidence library, research projects, tasks and deadlines, personal legal assistant, case exports | Journey 15.1 passes | 🔵 **IMPLEMENTED** (verified locally; journey 15.1 passed on synthetic data) |
| — | ▲ **Release R1** | First release | Product specification P0 scope (§20.2) | First-release acceptance criteria | — |
| 9 | Professional workspace | Professional product | Client management, professional research, matter collaboration, internal reviews, knowledge management, professional templates, document approval, professional reporting; ▲ conflict checks and information barriers | Journey 15.2 passes | 🔒 LOCKED |
| 10 | Enterprise and institutional systems | Enterprise product | Organisation administration, teams and offices, advanced permissions, enterprise knowledge repositories, compliance workflows, institutional reporting, SSO readiness, enterprise APIs, custom deployment options | Enterprise isolation and SSO verified | 🔒 LOCKED |
| 11 | Commercial infrastructure | Revenue infrastructure | Subscription plans, billing, usage metering, AI credits, entitlements, invoices, payment integration, commercial analytics | Billing end-to-end in staging | 🔒 LOCKED |
| 12 | Global expansion | Global readiness | Norway, EU, UK, US, international law and Cameroon legal content; additional African jurisdictions; multilingual support; jurisdiction-specific testing | Each jurisdiction reaches at least `partial` (§6.7) | 🔒 LOCKED |
| 13 | Production hardening and launch | Production release | Security audits, penetration testing, performance testing, AI evaluation, disaster recovery, backup restoration, monitoring, operational documentation, ▲ **first deployment of the cumulative migration set to hosted Supabase (U-27)**, pilot customers, commercial launch | All release gates; Stage 2 infrastructure; hosted schema equals repository migrations | 🔒 LOCKED |

The phase names above are canonical. The register uses shortened names where CI requires them.

### 20.2 ▲ U-20 Milestones

| Milestone | Definition | Why |
|---|---|---|
| **M1: Grounded-research demo** | A demo answering questions over *public* Norwegian legislation, with claim-level citations that resolve to stored versions, abstention when unsupported, and a visible coverage disclosure. No customer data. ▲ Because migrations are not deployed before Phase 13 (U-27), M1 runs on the **local stack** (recorded or screen-shared demo). A hosted public demo needs an explicit owner exception | Proves the core thesis early, at zero cost; suits building in public; uses only public-law content |
| **R1: First release** | The product specification's P0 scope: auth, tenancy, matters, confidential document and evidence storage, source registry, jurisdiction- and date-aware research, grounded AI, citation verification, human review, audit, responsive web and operational controls | First paying pilot; requires Stage 1 infrastructure |

### 20.3 Dependency graph

```
P0 ─► P1 ─┬─► P3 (evidence) ─────────────┐
          │                              ├─► P5 (reasoning) ─► P6 (verification) ─► P7 (documents) ─► P8 ─► R1
          └─► P2 (knowledge) ─► P4 (research + verification core) ─► M1
P8 ─► P9 ─► P10 ─► P11 ─► P12 ─► P13 (launch)
```

Phase 2 runs in parallel with Phase 1 verification, by owner authorisation. Phase 3 needs the Phase 1 storage and RLS boundary to be accepted.

---

## 21. Definition of completion and status vocabulary

### 21.1 Definition of completion

A feature that has been *created* is not the same as one that is *production-ready*. Every module must pass these conditions:

1. Its database schema and migrations exist.
2. Its API contracts are implemented.
3. Its user interface is connected to real backend functionality.
4. Authentication and permissions are enforced.
5. Tenant isolation is tested.
6. Error handling is implemented.
7. Audit requirements are satisfied.
8. Automated tests pass.
9. Documentation is maintained.
10. Deployment has been verified.
11. The complete workflow works from beginning to end.
12. Monitoring and operational recovery are in place.

A placeholder dashboard, simulated search result or non-functional button does **not** count as a completed feature.

### 21.2 ▲ U-19 Status vocabulary

| Indicator | Meaning |
|---|---|
| ⚪ NOT STARTED | No work begun |
| 🟡 IN PROGRESS | Work under way; not yet complete |
| 🔵 IMPLEMENTED | Code and tests committed; verification not yet run or not yet passing everywhere |
| 🟠 VERIFICATION FAILING | Verification has run and failed; fixing it is the next action |
| 🟢 GREEN / VERIFIED | Acceptance criteria met, CI green, evidence recorded (commit and run IDs) |
| 🔴 BLOCKED | A named external dependency or decision is required |
| 🔒 LOCKED | Future phase; no implementation |
| ⚠️ REGRESSION | Was green; a later change broke it |

**Task-level GREEN** requires completion conditions 1, 4, 5, 6, 7, 8 and 9 as applicable. **Phase-level CLOSED** requires all tasks to be green, an acceptance report and a verified closeout. Conditions 10–12 (deployment, monitoring, recovery) are required for **release**, not for phase closure at Stage 0.

---

## 22. Strategic priorities

Although the ultimate objective is the complete platform, the order of implementation matters. Three foundational assets form the intellectual foundation of the company:

| Priority | Asset | Why it comes first |
|---|---|---|
| **First** | Legal knowledge and authority infrastructure | Without reliable sources, jurisdictional information, version histories and provenance, Njumeni cannot provide trustworthy legal intelligence |
| **Second** | Evidence intelligence | A key commercial differentiator. Connecting documents, facts, events, claims and authorities makes a stronger product than a conventional legal chatbot |
| **Third** | Legal reasoning and verification | Turns retrieved information into structured, traceable analysis while keeping human judgement central |

---

## 23. Permanent architectural decisions

These decisions govern development unless a documented architecture review (ADR) approves a change.

| Decision | Original direction | v2.0 position | Record |
|---|---|---|---|
| Product name | Njumeni | Unchanged; clearance pending | §1 |
| Market | Global | Unchanged | — |
| Customer segments | Individuals, professionals, enterprises and institutions | Unchanged | — |
| AI role | Legal assistant, not autonomous lawyer | Unchanged; autonomy capped at A2 | §5.3 |
| Core architecture | Private modular monolith | **Modular monolith; public source, private data** | ADR-0001, ADR-0003 |
| Frontend | Next.js, React, TypeScript | Unchanged | — |
| Backend | Node.js, TypeScript | Unchanged | — |
| Database | PostgreSQL | Unchanged (Supabase) | — |
| Vector search | pgvector | Unchanged | — |
| Authentication | Supabase Auth | Unchanged; passkeys and MFA added | ADR-0002 |
| Authorisation | RBAC and PostgreSQL RLS | Unchanged; information barriers added | ADR-0002 |
| Background jobs | Redis and BullMQ | **Postgres queue first; Redis/BullMQ on trigger** | ADR-0003 |
| Storage | S3-compatible object storage | **Supabase Storage (S3-compatible) first** | ADR-0003 |
| AI architecture | Provider-independent | Unchanged; data-minimising egress policy | §5.7 |
| Legal research | Hybrid retrieval and RAG | Unchanged; verified-or-abstain | §8.2 |
| Legal knowledge | Structured, versioned authority graph | **Bitemporal**, versioned authority graph | §6.4 |
| Evidence | Provenance-preserving evidence graph | Plus content addressing and hash-chained custody | §7 |
| Reasoning | Structured legal argument graph | Unchanged | §8.1 |
| Verification | Citation, source and currency validation | Core pulled into Phase 4 | §8.3 |
| Development | Private GitHub monorepo | **Public GitHub; incremental monorepo** | ADR-0003, §9.4 |
| Commercial model | SaaS, professional, enterprise and institutional | Unchanged; licence posture pending | §12.2 |
| Deployment | Separate development, staging and production | **Staged (0 → 1 → 2)** with graduation triggers | §14.1 |
| Open-source policy | Selective reuse with licence review | Unchanged | §12 |

The architecture carries forward the earlier decisions:
- a shared multi-tenant intelligence engine
- separate personal and professional experiences
- structured legal authorities and argument relationships
- proprietary control over the core

---

## 24. Current position, open decisions and next actions

### 24.1 Original Phase 0 execution checklist: outcome

| # | Original checklist item | Outcome |
|---|---|---|
| 1 | Verify the existing legal platform repository and preserve useful previous work | ✅ Audit done; legacy CMP archived to a separate repository |
| 2 | Establish the private Njumeni repository and monorepo structure | ✅ Repository established; ▲ public by decision (ADR-0003); monorepo incremental (§9.4) |
| 3 | Write the complete product and technical architecture documents | ✅ Product specification, ADRs, module maps; consolidation tracked in §19.3 |
| 4 | Define domain boundaries and dependency rules | ✅ ADR-0001 |
| 5 | Establish the Supabase development and staging environments | ✅ Local CLI stack; hosted `Njumeni` project (unmigrated) |
| 6 | Create the initial database schema and migration strategy | ✅ Migration policy; 23 migrations replay cleanly |
| 7 | Configure authentication and tenant-isolation foundations | 🟡 Implemented; verification failing (Phase 1) |
| 8 | Set up CI/CD, automated tests and deployment environments | 🟡 CI in place (currently red); no app deployment (Stage 0) |
| 9 | Create a working Njumeni application shell | ✅ Next.js shell with all A–M entry points |
| 10 | Verify the foundation before beginning the legal knowledge engine | 🟡 Phase 0 verified; Phase 1 verification outstanding |

### 24.2 Where we are (2026-11-11)

- **Done:** Phase 0 is closed.
- **Phase 1:** identity, tenancy, RBAC, storage policies, audit and billing identity are implemented.
- **Phase 2:** the legal-knowledge schema, ingestion framework, retrieval and governance are implemented, but have no content, no adapters and no embeddings.
- **Broken:** CI is red.
  - The migration-policy guard fails on an unregistered correction.
  - pgTAP fixture bugs in `role_permission`, `security_audit` and `legal_knowledge_foundation`.
  - The worker is missing its `server-only` dependency.
- **Not started:** Phases 3–13. Nothing is deployed. No customer data is permitted.

### 24.3 Next actions (ordered)

| # | Action | Phase |
|---|---|---|
| 1 | Fix the failing checks: the three pgTAP files, the migration correction entry, `server-only`, `test:legal-knowledge` in CI (verified locally while CI is paused) | 1/2 |
| 2 | Close Phase 1: run the live Auth test, accept the leaked-password risk under ADR-0003, regenerate the database types, write the acceptance report, make the closeout commit and tag | 1 |
| 3 | Update stale documents (README, health endpoint, infrastructure/CI documents) | 1 |
| 4 | Rights-review the Norwegian legislation source; build the first adapter | 2 |
| 5 | Select the embedding profile (multilingual, zero-cost); forward-migrate the vector dimension; make search language-aware | 2 |
| 6 | Create the first evaluation set (Norway); close Phase 2 | 2 |
| 7 | Phase 4 research with the verification core, leading to Milestone M1 | 4 |

### 24.4 Open owner decisions

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| D-1 | Code licence posture (U-02) | Keep all rights reserved for now; decide before accepting outside contributions | Before the first external contribution |
| D-2 | Primary domain and trademark knock-out search (U-24) | Acquire `njumeni.com` (low cost); run a free knock-out search now | Before M1 |
| ✅ D-3 | Embedding model profile | **Decided 2026-11-11:** `intfloat/multilingual-e5-small` (MIT, 384 dimensions, about 100 languages including Norwegian, English and French), run locally on CPU at zero cost; profile key `multilingual-e5-small-v1` | — |
| D-4 | First jurisdiction launch order | Norway first (already `pilot`), then the EU | Before M1 |
| D-5 | LLM provider for M1 | Pay-as-you-go with a hard monthly cap, or self-hosted; mock by default | Phase 4/5 |
| D-6 | Leaked-password protection | Accept as a Stage 0 risk; enable at Stage 1 | Phase 1 closeout |
| D-7 | Pricing, pilot cohort, SLOs, UI languages | Defer until after M1 | Before R1 |
| D-8 | Data residency beyond the database | EU/EEA for all components | Before Stage 1 |
| ✅ D-9 | Hosted migration deployment | **Decided 2026-11-11:** keep all migrations in the repository; deploy to hosted Supabase only after all phases are complete (U-27) | — |
| ✅ D-10 | Repository visibility | **Decided 2026-11-11:** build in public at zero cost (ADR-0003) | — |

---

## Appendix A — Traceability to the original 20-section source

| Original § | Title | v2.0 section(s) |
|---|---|---|
| Preamble | Company ambition, fundamental principle | §2.1–2.2 |
| 1 | Brand and corporate identity | §1 |
| 2 | Product architecture: complete system (incl. 2.1 eight layers) | §3 |
| 3 | Complete product modules (A–M) | §4, §7, §8 |
| 4 | Complete AI architecture (4.1–4.4) | §5 |
| 5 | Technical architecture and technology stack (5.1–5.5) | §9, §10 |
| 6 | Legal knowledge infrastructure (6.1–6.4) | §6 |
| 7 | Security, privacy and governance (7.1–7.6) | §11 |
| 8 | Open-source research and software reuse (8.1–8.3) | §12 |
| 9 | API architecture and integration framework (9.1–9.3) | §13 |
| 10 | Infrastructure, hosting and deployment (10.1–10.5) | §14 |
| 11 | User journeys and operational workflows (11.1–11.5) | §15 |
| 12 | Administration and platform operations | §16 |
| 13 | Commercial architecture and monetisation (13.1–13.4) | §17 |
| 14 | Testing, evaluation and quality assurance (14.1–14.4) | §18, §8.5 |
| 15 | Repository and development structure (15.1) | §19 |
| 16 | Complete implementation roadmap | §20 |
| 17 | Definition of completion | §21 |
| 18 | Initial strategic priorities | §22 |
| 19 | Permanent architectural decisions | §23 |
| 20 | Immediate execution: establish the Njumeni foundation | §24.1 |

## Appendix B — Upgrade register (U-01–U-27)

| ID | Upgrade | Rationale | Section |
|---|---|---|---|
| U-01 | Build in public: open code, closed data | Owner decision to avoid cost; supersedes the private-repository requirement | §2.3, §11.7, §19.1, ADR-0003 |
| U-02 | Licence posture explicit (all rights reserved until decided) | Public visibility is not a licence; protects the proprietary core | §12.2 |
| U-03 | Staged zero-cost infrastructure with graduation triggers | No spend now, with a clear path to production | §14.1 |
| U-04 | Postgres-first job queue; Redis/BullMQ deferred | Already implemented; removes a paid component | §9.5 |
| U-05 | Supabase Storage as the S3-compatible store | Included in the existing provider | §9.5 |
| U-06 | Incremental monorepo with extraction triggers | Avoids premature structure | §9.4 |
| U-07 | Bitemporal authority model (valid time and system time) | Reproducible past answers; law as it stood | §6.4 |
| U-08 | ELI, ECLI and Akoma Ntoso mappings | Interoperability with official identifiers | §6.8 |
| U-09 | Verified-or-abstain contract and claim ledger | Turns the anti-hallucination principle into data | §4 Module A, §8.2 |
| U-10 | Verification core pulled into Phase 4 | No research output without verification | §8.3, §20 |
| U-11 | Content-addressed evidence; hash-chained custody | Tamper evidence for evidence | §7 |
| U-12 | Hash-chained audit for all tenants | Cheap tamper evidence everywhere | §11.5 |
| U-13 | AI safety and data-protection controls | Prompt injection, provider terms, consent, egress | §5.7 |
| U-14 | EU AI Act and EEA regulatory mapping | Institutional and justice use cases | §11.6, Module K |
| U-15 | Per-jurisdiction evaluation sets as release gates | Quality is measured, not asserted | §18.2 |
| U-16 | Conflict checks and information barriers | Professional duties in firms | §11.2, Module I |
| U-17 | Passkeys/WebAuthn and SSO readiness | Modern phishing-resistant authentication | §11.1 |
| U-18 | Verified commits with green checks; since 11 November 2026, one commit per completed phase in autonomous mode, always after full local verification | Avoids the unverified-batch failure mode while honouring the owner's cadence | §19.4 |
| U-19 | Refined status vocabulary | Distinguishes "implemented" from "verified" | §21.2 |
| U-20 | Milestones M1 (public demo) and R1 (first release) | Early proof of the thesis; build-in-public showcase | §20.2 |
| U-21 | Jurisdiction coverage levels with evidence | Honest coverage claims | §6.7 |
| U-22 | Multilingual from the start (Norwegian, English, French) | Norway and Cameroon are not English-only | §5.5, Module G |
| U-23 | Cost guardrails and AI allowances per plan | Prevents unbounded AI cost | §5.7, §17.1 |
| U-24 | Early domain and trademark knock-out search | Building in public exposes the name | §1.4 |
| U-25 | Original roadmap order restored | The register had drifted from the source | §20 |
| U-26 | OpenAPI generated from Zod; controlled agent interface | Contract-first API | §13 |
| U-27 | Migrations saved in the repository; hosted deployment deferred until all phases complete (Phase 13) | Owner decision 2026-11-11; avoids hosted drift and cost; one controlled cut-over | §14.3, §19.4, §20, ADR-0003 §2.5 |

## Appendix C — Glossary

| Term | Meaning |
|---|---|
| Authority | A legal source with legal force or persuasive weight (an act, provision, judgment, treaty and so on) |
| Authority version | An immutable text of an authority valid for a defined period |
| As-of query | Retrieval of the version valid on a given date |
| Bitemporal | Tracking both legal validity time and system knowledge time |
| Claim ledger | A per-answer list of claims with their category and support |
| Coverage level | The tested extent of support for a jurisdiction (§6.7) |
| Matter | A legal case or work item inside a workspace |
| Principal | An authenticated identity known to Njumeni |
| RLS | PostgreSQL Row Level Security |
| Tenant | The organisation (or personal owner) that owns workspaces and data |
| Workspace | An isolated work context inside a tenant |
