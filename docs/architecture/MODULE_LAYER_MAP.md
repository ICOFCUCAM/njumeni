# Njumeni A–M module-to-layer and bounded-context map

- **Status:** Phase 0 task 0.7 working deliverable
- **Canonical source:** Original Njumeni — Complete Global Legal Intelligence Platform master architecture supplied 2026-11-10
- **Architecture authority:** [ADR-0001](ADR-0001-modular-monolith-and-bounded-contexts.md)
- **Execution authority:** [Master Implementation Plan](../MASTER_IMPLEMENTATION_PLAN.md) and [Phase Register](../PHASE_REGISTER.md)

## 1. Preservation and mapping rules

The thirteen module IDs and names below are preserved exactly. This map assigns implementation responsibility; it does not merge, rename or reduce the A–M product modules. The original capability-by-capability layer assignment is maintained in [MODULE_REQUIREMENTS_TRACEABILITY.md](MODULE_REQUIREMENTS_TRACEABILITY.md). A module may use capabilities owned by several bounded contexts and layers. That does not transfer data ownership.

The eight canonical platform layers remain exactly:

1. Experience
2. API
3. Workflow orchestration
4. Evidence
5. Legal knowledge
6. Reasoning
7. Verification
8. Infrastructure

The bounded contexts are those established in ADR-0001: Identity and organisation; Workspace and matter; Document and evidence; Document intelligence; Legal knowledge and jurisdiction; Research and retrieval; Legal reasoning and verification; Contract review and drafting; Workflow and orchestration; AI orchestration; Governance and audit.

**Ownership rule:** each module has one primary product owner-context and may consume other contexts through explicit application/query contracts or versioned events. The owner-context is authoritative for the records named in its row. No cross-context direct table writes are permitted.

## 2. Complete A–M responsibility map

| Module | Canonical module name | Primary user / product purpose | Primary bounded context(s) and authoritative ownership | Platform layers |
|---|---|---|---|---|
| A | **Njumeni Legal Intelligence** | Individuals and professionals; central legal intelligence interface and source-linked legal question/answer experience | Research and retrieval; Legal reasoning and verification; AI orchestration owns execution metadata, not source or matter records | Experience, API, Workflow orchestration, Legal knowledge, Reasoning, Verification, Infrastructure |
| B | **Legal Research Engine** | Individuals, professionals, firms and institutions; dedicated jurisdiction-aware legal research and authority discovery | Research and retrieval owns queries, research sessions, retrieval runs and findings; Legal knowledge and jurisdiction owns authority/source records and versions | API, Workflow orchestration, Legal knowledge, Reasoning, Verification, Infrastructure |
| C | **Evidence Intelligence Engine** | All authorised workspace users; secure evidence intake, extraction, chronology, contradictions and provenance | Document and evidence owns originals, versions, exhibits, metadata, custody and evidence relationships; Document intelligence owns OCR/extraction/chunk/index processing artefacts | Experience, API, Workflow orchestration, Evidence, Verification, Infrastructure |
| D | **Legal Case Management** | Individuals, practitioners, firms and institutions; matter lifecycle and case operations | Workspace and matter owns matters, parties, assignments, tasks, deadlines, events, status and case communications; Document and evidence owns linked assets | Experience, API, Workflow orchestration, Evidence, Infrastructure |
| E | **Legal Document Intelligence** | All authorised users; create, analyse, compare, revise, verify and export legal documents | Contract review and drafting owns draft artefacts, review playbooks, clause findings and approval/version relationships; Document and evidence owns originals and immutable document versions; Document intelligence owns derived extraction | Experience, API, Workflow orchestration, Evidence, Reasoning, Verification, Infrastructure |
| F | **Legal Argument and Reasoning Engine** | Legal professionals and supported individual users; structured legal issues, rules, facts, claims, arguments and counterarguments | Legal reasoning and verification owns argument graphs, reasoning assessments, claim/evidence links and uncertainty records; source records remain owned by Evidence and Legal knowledge | API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification, Infrastructure |
| G | **Jurisdiction and Legal Systems Engine** | All users and all research/analysis modules; jurisdiction profiles, legal systems, courts, sources, languages and applicable-law context | Legal knowledge and jurisdiction owns jurisdiction profiles, legal-system metadata, court hierarchy, source coverage and jurisdiction-specific provenance | API, Workflow orchestration, Legal knowledge, Verification, Infrastructure |
| H | **Personal Legal Assistant** | Individuals without a lawyer; plain-language intake, personal legal workspace, document explanation, chronology, deadlines and preparation support | Workspace and matter owns personal workspace/matter records, intake and tasks; Evidence owns personal documents; Research/reasoning contexts own linked research and analysis | Experience, API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification, Infrastructure |
| I | **Professional Legal Workspace** | Lawyers, legal advisers and practitioners; client/matter research, evidence, argument, drafting, review, collaboration and work product | Workspace and matter owns client/matter workspace metadata, assignments and tasks; Research/retrieval, Document/evidence, Reasoning/verification and Contract review/drafting own their respective artefacts | Experience, API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification, Infrastructure |
| J | **Enterprise and Law Firm Workspace** | Law firms and multi-user organisations; teams, offices, invitations, role-based access, shared libraries, workflows, usage and administration | Identity and organisation owns organisations, memberships, roles and invitations; Workspace and matter owns team/matter assignment; Governance and audit owns policy/audit evidence; Knowledge context owns governed knowledge items | Experience, API, Workflow orchestration, Evidence, Legal knowledge, Infrastructure |
| K | **Institutional Workspace** | Public institutions and institutional legal departments; isolated repositories, policy/regulatory research, administrative decision review, compliance and oversight | Identity and organisation owns institutional membership and role assignments; Workspace and matter owns institutional case/workspace metadata; Legal knowledge owns authorities; Governance and audit owns oversight/retention evidence | Experience, API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification, Infrastructure |
| L | **Legal Compliance and Risk Intelligence** | Enterprises, law firms and institutions; traceable obligations, regulatory monitoring, policy/contract analysis and compliance evidence | Legal knowledge and jurisdiction owns regulatory source/version records; Legal reasoning and verification owns source-linked obligation interpretations and assessments; Governance and audit owns review evidence | API, Workflow orchestration, Legal knowledge, Evidence, Reasoning, Verification, Infrastructure |
| M | **Legal Knowledge Management** | Professional users and institutions; controlled reusable research, precedents, opinions, templates, arguments, notes and collections | Legal knowledge and jurisdiction owns public/official authority metadata; Governance and audit owns access policies and review/retention evidence; Workspace and matter controls matter-scoped knowledge; Document/evidence owns source documents | Experience, API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification, Infrastructure |

## 3. Module contracts: inputs, outputs, APIs/events and permission boundaries

These are domain-level contracts, not final URL routes or database schemas. Exact API schemas and event payload versions are implementation tasks for the relevant delivery phases. The contracts deliberately identify the direction and owner now, so later implementation cannot create implicit cross-context coupling.

| Module | Inputs / required references | Outputs / owned artefacts | Application contracts and events | Permission boundary |
|---|---|---|---|---|
| A — Njumeni Legal Intelligence | Authenticated actor; selected workspace/matter; question; jurisdiction and relevant-period hints; authorised research/evidence references | Research response, structured findings, source-linked claims, uncertainty and limitation statements, saved research session | `submit-legal-question`, `get-research-result`, `save-research`; consumes `ResearchRunCompleted`, `VerificationCompleted`; emits `LegalQuestionSubmitted` | Actor must have workspace/matter access; each retrieved source/evidence reference is re-authorised; AI tools receive only scoped context |
| B — Legal Research Engine | Research query; jurisdiction; applicable date; source-registry filters; authorised workspace context | Research session/run, selected authority references, ranked passages, research findings and provenance | `start-research`, `retrieve-authorities`, `compare-authorities`; emits `ResearchRunStarted`, `ResearchRunCompleted`, `SourceRetrievalFailed` | Query and result access are scoped to actor/workspace; licensed-source permissions and source-use rights are enforced |
| C — Evidence Intelligence Engine | User-uploaded file; matter or permitted research-workspace reference; metadata and processing instructions | Evidence item, immutable file/version reference, extracted metadata, passages, chronology events, relationships, custody events and processing status | `register-evidence`, `get-evidence`, `request-extraction`, `link-evidence-to-claim`; emits `EvidenceRegistered`, `EvidenceVersionCreated`, `EvidenceExtractionCompleted`, `CustodyEventRecorded` | Upload, read, export and relationship changes require matter/workspace permission; originals are immutable; derived artefacts inherit source scope |
| D — Legal Case Management | Authorised workspace; case/matter details; parties/representatives; jurisdiction/category; tasks, dates and communications | Matter record, lifecycle/status history, parties, assignments, deadlines, tasks, events and case reports | `create-matter`, `transition-matter`, `assign-matter`, `record-deadline`; emits `MatterCreated`, `MatterStatusChanged`, `MatterAssignmentChanged`, `MatterDeadlineAdded` | Matter owner/member roles govern read/write/transition/export; every lifecycle transition is permission-controlled and audited |
| E — Legal Document Intelligence | Template or authorised source document/version; drafting instructions; jurisdiction; approved clauses; verified source references | Draft/document version, analysis findings, comparison result, tracked revisions, citation references, approval state and export | `create-draft`, `analyse-document`, `compare-versions`, `request-document-review`, `approve-document`, `export-document`; emits `DraftCreated`, `DocumentAnalysisCompleted`, `DocumentReviewRequested`, `DocumentApproved`, `DocumentExported` | Draft edit, review, approval and export are separate permissions; only authorised humans approve; AI output is never implicitly approved |
| F — Legal Argument and Reasoning Engine | Legal issue/question; authorised facts, evidence references, authority/version references; jurisdiction and relevant period | Structured issue/rule/fact/claim/argument/counterargument graph, assessments, missing-fact list, uncertainty and remedy options | `build-argument-graph`, `assess-claim-support`, `test-counterarguments`; emits `ArgumentGraphCreated`, `ReasoningAssessmentCompleted` | Matter scope applies to every node and edge; only authorised actors can view/edit; source references are rechecked; reasoning does not approve legal action |
| G — Jurisdiction and Legal Systems Engine | Country/territory or supranational system; legal question context; event/effective date; language | Jurisdiction profile, legal-system classification, court/authority hierarchy, source coverage and applicable-law context | `resolve-jurisdiction`, `get-jurisdiction-profile`, `get-source-coverage`; emits `JurisdictionProfileUpdated`, `SourceCoverageChanged` | Public jurisdiction metadata may be broadly readable; administrative changes and source-provider credentials are restricted; unsupported coverage must be disclosed |
| H — Personal Legal Assistant | Authenticated individual; personal workspace; guided intake answers; uploaded official letters/documents; selected jurisdiction and dates | Plain-language explanation, issue flags, chronology, lawyer-preparation questions, draft responses/appeals and deadline reminders | `start-personal-intake`, `explain-document`, `prepare-lawyer-questions`, `create-personal-draft`; emits `PersonalIntakeCompleted`, `PersonalDeadlineCreated` | Private personal workspace by default; no sharing with firms/institutions without explicit user action; high-impact output includes limitations and referral prompts |
| I — Professional Legal Workspace | Verified professional account; organisation membership where applicable; client/matter assignment; authorised research/evidence | Professional matter workspace, review tasks, research libraries, collaboration records, approved work product and reports | `create-client-workspace`, `assign-review`, `share-matter-resource`, `generate-matter-report`; emits `ProfessionalReviewAssigned`, `MatterResourceShared` | Professional role and matter assignment required; client confidentiality and ethical walls enforced; sharing requires explicit scope and audit |
| J — Enterprise and Law Firm Workspace | Organisation owner/admin; team/office definitions; membership/invitation requests; organisation policies and subscription entitlements | Organisation, teams, offices, memberships, invitations, role/policy settings, usage and administrative reports | `create-organisation`, `invite-member`, `assign-organisation-role`, `configure-workspace-policy`; emits `OrganisationCreated`, `MemberInvited`, `MembershipChanged`, `OrganisationPolicyChanged` | Organisation administration is distinct from matter access; least-privilege RBAC; membership revocation takes effect across all services |
| K — Institutional Workspace | Verified institution; institutional tenant/workspace; case/policy records; authorised source and retention configuration | Institutional repositories, decision reviews, compliance cases, oversight records, reports and archival actions | `create-institutional-workspace`, `review-administrative-decision`, `apply-retention-policy`, `export-institutional-report`; emits `InstitutionalReviewOpened`, `InstitutionalDecisionReviewed`, `RetentionActionRecorded` | Strict institutional tenant isolation; no cross-organisation exposure; restricted oversight roles; retention/legal-hold and export actions audited |
| L — Legal Compliance and Risk Intelligence | Jurisdiction/regulatory source references; organisation policy; contracts/obligations; evidence of controls; review period | Obligation register, source-linked interpretation, regulatory change item, assessment, evidence links, review schedule and report | `extract-obligations`, `monitor-regulatory-changes`, `assess-compliance`, `schedule-compliance-review`; emits `RegulatoryChangeDetected`, `ObligationAssessmentCompleted`, `ComplianceReviewDue` | Organisation/institution scope; obligation evidence is access-controlled; risk/assessment outputs are explainable and source-linked, not generic unsupported scores |
| M — Legal Knowledge Management | User-approved research, precedent, opinion, template, argument or note; classification/tags; target collection and access policy | Knowledge item/version, collection, taxonomy, relationships, review/expiry state and access decision | `save-knowledge-item`, `publish-to-collection`, `review-knowledge-item`, `expire-knowledge-item`; emits `KnowledgeItemSaved`, `KnowledgeItemPublished`, `KnowledgeItemReviewed`, `KnowledgeItemExpired` | Matter/client material remains private by default; promotion to shared knowledge requires explicit authorised approval and redaction/permission checks; no automatic model training |

## 4. Cross-module dependency graph

The following dependency direction is binding. A module may call another module's published contract, but may not write its tables or import private internals.

- **A** composes B, F and G; uses C/E references where authorised; consumes verification results from the verification context.
- **B** depends on G for jurisdiction/source scope and on the Legal knowledge context for authorities; it may use C/E-derived text only where the source asset is authorised for the research workspace.
- **C** supplies evidence references and extraction results to D, E, F, H, I, K and L according to permissions.
- **D** coordinates matter lifecycle and links records owned by C, B, E, F and M without taking ownership of those records.
- **E** consumes templates/knowledge from M, evidence/source references from C/B/G, reasoning from F and verification results from the verification context.
- **F** consumes facts/evidence from C and legal authorities/rules from B/G; it produces structured arguments for A/E/I/K/L and verification.
- **G** supplies jurisdiction profiles and source coverage to B, A, F, E and L.
- **H** is a personal-user experience composition over D/C/B/A/F/E; it does not bypass those domain contracts.
- **I** composes D/B/C/E/F/M for professional work.
- **J** provides organisation, membership, team and policy capabilities used by I/K and all organisation-scoped modules; it does not grant matter access merely by virtue of organisation administration.
- **K** composes D/B/C/E/F/G/L/M within a strictly isolated institutional tenant.
- **L** consumes G/B legal-source data, E/C contract and evidence references, F reasoning and verification results.
- **M** stores only user-approved knowledge artefacts and references; it can be used by A/B/E/F/I/J/K/L under explicit access policy.

### 4.1 Dependency safeguards

1. A composition module does not become the owner of the domain artefacts it displays.
2. No module can elevate a user's permissions by passing a different tenant, workspace or matter identifier.
3. Organisation membership does not automatically confer access to every matter.
4. Institutional and enterprise tenants remain isolated even where they use the same shared engine.
5. Personal documents and client material are not automatically promoted into shared knowledge.
6. Source-version and evidence-version references remain stable through research, reasoning, drafting and verification.
7. Events are versioned facts, not a substitute for querying authoritative domain records.
8. AI agents operate only through the same authorised contracts available to the workflow that invoked them.

## 5. Phase delivery map

The phase assignments below preserve the established Phase 0–13 roadmap. A module can span multiple phases; a phase entry means the relevant capability is delivered there, not that the whole module is complete.

| Module | Foundation / enabling phase | Main delivery phases | Later maturity / expansion |
|---|---|---|---|
| A — Njumeni Legal Intelligence | 0 (architecture/contracts), 1 (identity/scope) | 5 (research interface), 6 (reasoning composition), 7 (verification and trust) | 9–10 workspace editions; 12 jurisdiction expansion; 13 launch hardening |
| B — Legal Research Engine | 0 (contracts), 1 (access), 2 (source foundation) | 5 (hybrid legal research and RAG) | 7 verification; 12 source/jurisdiction expansion; 13 quality hardening |
| C — Evidence Intelligence Engine | 0 (provenance/security contracts), 1 (tenant/matter security) | 3 (secure evidence), 4 (OCR/extraction/indexing) | 6 evidence-to-argument links; 7 verification; 9–10 workspace rollout; 13 hardening |
| D — Legal Case Management | 0 (domain contract), 1 (identity/tenancy) | 9 (personal and case workspace) | 10 professional/institutional workflows; 13 hardening |
| E — Legal Document Intelligence | 0 (document boundaries), 1 (access), 3–4 (document/evidence foundation and extraction) | 8 (drafting, comparison, review and export) | 9–10 workspace integration; 13 hardening |
| F — Legal Argument and Reasoning Engine | 0 (domain boundaries), 1 (authorisation), 2–5 (knowledge/evidence/retrieval dependencies) | 6 (argument graph and reasoning) | 7 verification; 8 drafting integration; 13 evaluation/hardening |
| G — Jurisdiction and Legal Systems Engine | 0 (domain contract), 1 (access) | 2 (jurisdiction/source registry and legal knowledge) | 5 retrieval filters; 12 jurisdiction coverage expansion; 13 coverage validation |
| H — Personal Legal Assistant | 0 (experience and workflow contracts), 1 (personal workspace security) | 9 (personal workspace and assistant workflows) | 5–8 research/evidence/drafting integration; 12 localisation; 13 hardening |
| I — Professional Legal Workspace | 0 (workspace contracts), 1 (organisation/matter security) | 9 (professional matter foundation), 10 (professional edition) | 5–8 core intelligence integrations; 11 entitlements; 13 hardening |
| J — Enterprise and Law Firm Workspace | 0 (tenancy contracts), 1 (organisation, roles, invitations and RLS) | 10 (enterprise/law firm controls) | 11 billing/usage; 12 regional controls; 13 SSO/security hardening |
| K — Institutional Workspace | 0 (isolation and governance contracts), 1 (tenant security) | 10 (institutional workspace and administration) | 2/5/7/8 legal knowledge, research, verification and document integration; 12 institutional jurisdiction packs; 13 hardening |
| L — Legal Compliance and Risk Intelligence | 0 (domain and source contracts), 1 (organisation isolation), 2 (regulatory sources) | 10 (compliance workflows and institutional/enterprise use) | 5–7 source-linked research/reasoning/verification; 12 regulatory coverage; 13 evaluation |
| M — Legal Knowledge Management | 0 (knowledge ownership and sharing policy), 1 (access control), 2 (legal knowledge provenance) | 9–10 (personal/professional/enterprise knowledge workflows) | 11 entitlements; 12 multilingual/jurisdiction expansion; 13 governance hardening |

## 6. Permission and data-ownership invariants

- Every matter belongs to an authorised workspace; every organisation/workspace/matter relationship is resolved server-side.
- Evidence is attached to a matter or explicitly permitted research workspace. Evidence access cannot be inferred from a search result or object key.
- Legal authorities and their versions are owned by Legal knowledge and jurisdiction; matter documents are owned by Document and evidence.
- Findings, arguments and drafts retain references to exact source/evidence versions and relevant passages.
- AI workflow execution is bound to a user, tenant, workspace and (where relevant) matter scope; retries do not widen that scope.
- Human review and document approval are attributable to an authorised human and recorded as distinct events.
- Personal and client information is never silently made available to another tenant, a shared collection or model training.
- Institutional records are strictly separated from unrelated institutions and commercial tenants.
- Every sensitive read, write, export, share, approval, retention or deletion action is auditable.
- All permissions are enforced server-side and at database/storage boundaries; the UI is never the security boundary.

## 7. Open implementation decisions (not silently assumed)

The map does not decide final REST/GraphQL route naming, event broker choice, physical schema placement, package names, SLOs or exact role matrices. Those are specified in the relevant Phase 0 engineering standards, environment and CI tasks, then implemented in the appropriate feature phase. The map also does not assert that every jurisdiction or source provider is licensed or supported.

## 8. Acceptance checklist for task 0.7

- [x] Canonical A–M IDs and names preserved exactly.
- [x] Each module assigned primary bounded-context ownership and platform-layer responsibilities.
- [x] Inputs, outputs and high-level application contracts/events recorded for every module.
- [x] Permission and confidentiality boundaries recorded for every module.
- [x] Cross-module dependency direction and prohibited ownership coupling recorded.
- [x] Phase 0–13 delivery mapping recorded without declaring future-phase features implemented.
- [x] Every original A–M module capability and its primary layer/context assignment is preserved in [MODULE_REQUIREMENTS_TRACEABILITY.md](MODULE_REQUIREMENTS_TRACEABILITY.md).
- [ ] Independent consistency review and repository checks passed; task commit verified.
