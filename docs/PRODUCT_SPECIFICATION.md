# Njumeni — Product Specification

**Product:** Njumeni — Global Legal Intelligence  
**Document status:** Phase 0 product baseline; strategic decision gates are explicitly identified below  
**Scope owner:** Njumeni product owner  
**Repository:** `ICOFCUCAM/njumeni`  
**Last updated:** 2026-11-10

## 1. Executive product definition

Njumeni is a jurisdiction-aware legal intelligence and work platform. It helps individuals, legal professionals, law firms and enterprises, and institutions find and understand legal authority, organise matters and evidence, analyse legal documents, develop and verify arguments, and carry out accountable legal workflows.

Njumeni combines legal knowledge, secure document and evidence management, research, AI-assisted analysis and matter-centred workspaces. It is a platform, not a single chatbot and not merely a document summariser.

**Product promise:** help people work with law, evidence and legal knowledge more accurately, transparently and efficiently, while preserving human responsibility for legal judgment and decisions.

**Brand descriptor:** Global Legal Intelligence.  
**Brand line previously proposed:** “Law. Evidence. Intelligence.”  
Brand identity and corporate presentation remain governed by master-outline section 1 and are not fully designed by this specification.

## 2. Product vision, mission and outcomes

### Vision
Make reliable, explainable and jurisdiction-aware legal intelligence and organised legal work more accessible across personal, professional, enterprise and institutional settings.

### Mission
Connect authoritative legal sources, user-controlled documents and evidence, and carefully governed AI workflows in one secure environment where users can inspect the basis of every material legal conclusion.

### Outcomes the product must enable
1. Find relevant law and legal materials for a stated jurisdiction and date.
2. Understand what a source says, where it came from, which version applies and what its limitations are.
3. Securely organise matters, documents, evidence, research and work history.
4. Analyse legal issues by connecting rules, facts, evidence, arguments and counterarguments.
5. Produce useful research and document-work outputs with traceable sources and human review.
6. Support work across individual, professional, firm/enterprise and institutional contexts without mixing tenants or matters.
7. Improve legal-work quality without presenting AI output as a substitute for qualified legal advice or professional judgment.

## 3. Target users and customer segments

| Segment | Primary users | Core needs | Primary workspace |
|---|---|---|---|
| Individuals | People researching a legal problem or organising their own documents and correspondence | Understand relevant law, organise facts/documents, prepare questions and identify when professional help is needed | Personal Legal Assistant (H) |
| Legal professionals | Lawyers, advocates, solicitors, barristers, legal advisers, paralegals and legal researchers | Reliable legal research, source verification, document/evidence analysis, argument development and drafting support | Professional Legal Workspace (I) |
| Law firms and enterprises | Firm owners, partners, in-house legal teams, compliance teams, matter managers and staff | Shared matters, team permissions, secure knowledge, repeatable workflows, oversight and reporting | Enterprise and Law Firm Workspace (J) |
| Institutions | Public bodies, institutional legal departments and other organisations with formal legal/governance responsibilities | Controlled institutional knowledge, policy and matter workflows, accountability, audit and administration | Institutional Workspace (K) |
| Platform operators | Authorised Njumeni support, security and operations personnel | Secure service administration, incident handling, tenant support and platform governance | Restricted platform operations; not a customer workspace |

A user may belong to more than one segment. Access is determined by organisation membership, role, matter membership and explicit permissions—not by a user-interface label.

## 4. Priority use cases and user journeys

### UJ-01 — Personal legal understanding
1. User selects or confirms the relevant country/jurisdiction and describes a legal question.
2. Njumeni clarifies material facts or missing context where necessary.
3. The research service retrieves relevant permitted legal sources and identifies jurisdiction, source type, publication/effective dates and coverage.
4. The user receives an understandable explanation with citations, links or references to source passages, uncertainty and limitations.
5. The user can save the research, attach their own documents, and identify when a qualified professional should review the issue.

**Acceptance outcome:** no unsupported claim of definitive legal advice; no fabricated authority; jurisdiction and source limitations are visible.

### UJ-02 — Professional legal research
1. Professional signs into an organisation and optionally selects a matter.
2. User defines jurisdiction, relevant date, issue and research question.
3. Njumeni searches approved legal sources and matter-authorised documents.
4. Results preserve source identity, version, exact passage/page and retrieval provenance.
5. User develops issues, rules, facts, arguments and counterarguments.
6. User verifies citations and saves the research history to the matter.

**Acceptance outcome:** every material generated legal claim can be traced to its supporting evidence or is clearly marked unsupported/uncertain.

### UJ-03 — Secure matter and document workspace
1. An authorised user creates or opens a matter.
2. User assigns matter participants and permissions.
3. User uploads permitted documents and evidence.
4. Njumeni validates files, records immutable originals and versions, captures metadata and audit events, and starts controlled processing.
5. Users search and review only the matters and documents they are authorised to access.
6. Users can inspect document history, provenance, access and export activity.

**Acceptance outcome:** tenant and matter isolation is enforced server-side and at the data boundary; originals and versions remain traceable.

### UJ-04 — Evidence and document analysis
1. User selects authorised matter documents/evidence.
2. Njumeni extracts text and structure while preserving document version, page and passage anchors.
3. AI-assisted analysis identifies relevant facts, dates, entities, issues, contradictions or gaps as candidate findings.
4. Each finding links back to the exact document version and passage.
5. A human reviewer accepts, rejects or annotates findings.
6. The resulting analysis is stored with provenance and audit history.

**Acceptance outcome:** extracted or inferred facts are distinguishable from source facts; no invented evidence or loss of provenance.

### UJ-05 — Argument and legal reasoning
1. User defines a legal issue and selects applicable jurisdiction/date.
2. User links rules, facts and evidence to the issue.
3. Njumeni proposes structured arguments, counterarguments, assumptions and unresolved questions.
4. Each material proposition links to a legal source or matter evidence where available.
5. User edits and approves the reasoning structure.

**Acceptance outcome:** reasoning is inspectable and revisable; assumptions, conflicts and evidence gaps are disclosed.

### UJ-06 — Firm or institutional collaboration
1. Organisation administrator configures membership, roles and workspace policies.
2. Matter owner assigns team access.
3. Team members collaborate on research, documents, evidence and tasks within assigned permissions.
4. Approvals, exports, AI actions and administrative changes are auditable.
5. Administrators review organisation-level activity and policy compliance without bypassing matter confidentiality.

**Acceptance outcome:** organisation-wide administration does not silently grant unrestricted access to every matter; exceptional access is explicit, authorised and audited.

### UJ-07 — Compliance and legal knowledge management
1. Authorised user selects an obligation, legal source, policy or managed knowledge item.
2. Njumeni records source, jurisdiction, version, effective date, owner and review status.
3. User links obligations to matters, controls, evidence or internal knowledge.
4. Updates and review tasks are tracked with history.
5. Users can inspect the basis and freshness of managed knowledge.

**Acceptance outcome:** source currency and ownership are visible; monitoring claims are limited to the sources and update coverage actually implemented.

## 5. Jurisdiction and legal coverage strategy

Njumeni is global in product ambition, but global ambition must not be confused with complete legal coverage at launch.

### Initial priority jurisdictions and bodies of law
The established priority list is:
1. Norway.
2. European Union law.
3. United Kingdom.
4. United States.
5. International law and relevant international legal instruments.
6. Cameroon.
7. Additional African and global jurisdictions through separately assessed jurisdiction packs.

This is a priority coverage list, not a claim that all listed sources are already integrated or that every jurisdiction must ship simultaneously. The exact first production jurisdiction, sequencing, source licensing and launch coverage must be confirmed at the relevant source-governance and release gates.

### Required jurisdiction model
- A jurisdiction is an explicit, versioned product entity—not a free-text prompt hint.
- Legal materials must be classified by jurisdiction, legal system, source type, issuing authority, publication date, effective date, repeal/status and language where known.
- Research must support an as-of date and distinguish current law from historical versions.
- Cross-border and multi-jurisdiction questions must identify each jurisdiction considered and avoid silently merging legal rules.
- International instruments must be distinguished from domestic implementing law and from non-binding materials.
- Source adapters and datasets must be replaceable and independently governed.
- Coverage gaps, update freshness, licensing limits and unavailable source categories must be visible to users.
- A missing search result is not evidence that no relevant law or authority exists.

### Source policy
Prefer official or otherwise authoritative sources with verified rights of access and reuse. Case law, legislation, regulations, guidance, treaties, commentary and user-provided materials must remain distinguishable. A jurisdiction pack is not production-ready until its sources, licences, update process, historical-version behaviour, citation format and coverage limitations are reviewed.

## 6. First-release definition

The first release is a **secure, responsive-web legal intelligence workspace with a useful, verifiable research-and-document vertical slice**. It is not the complete A–M vision.

### First-release capabilities (P0 — required)
1. **Account and workspace foundation:** authenticated users, organisation/workspace membership, roles and matter-level permissions sufficient for the initial customer model.
2. **Secure matter organisation:** create and manage matters/workspaces, assign participants and control access.
3. **Confidential document and evidence management:** secure upload, file validation, protected object storage, original-file preservation, version records, metadata, access control and audit.
4. **Document text and provenance foundation:** process supported file types; preserve page/passage anchors and links to the exact source version. Unsupported formats must fail safely and visibly.
5. **Jurisdiction and legal-source registry:** identify supported jurisdictions and approved source collections, with source type, authority, dates, version and coverage status.
6. **Legal research workflow:** search approved legal sources and authorised matter documents using the supported jurisdiction and date constraints.
7. **Grounded AI assistance:** generate structured explanations or research summaries only from retrieved/selected evidence where the workflow requires source support; distinguish facts, law, inference and uncertainty.
8. **Citation and quotation verification:** verify that cited sources and quoted passages resolve to the stored/retrieved source version; flag failures and gaps.
9. **Human review and correction:** users can inspect, correct, annotate, accept or reject AI-assisted findings and outputs.
10. **Audit and traceability:** record access, document operations, research/AI runs, evidence used, approvals, exports and relevant administrative actions.
11. **Basic responsive web experience:** accessible desktop and mobile-browser layouts for the first supported workflows.
12. **Operational controls:** safe error handling, rate limits, backup/restore plan, monitoring and support procedures appropriate to the launch environment.

### First-release capabilities (P1 — follow-on, not a launch blocker unless selected)
- More advanced argument graphs and counterargument management.
- Contract comparison, playbooks, clause-level review and suggested amendments.
- Advanced drafting and approval workflows.
- Organisation knowledge libraries and precedent management.
- Compliance obligation monitoring and risk dashboards.
- Advanced institutional administration and custom policy controls.
- Additional jurisdiction packs, languages and source collections.
- External integrations such as document editors, case-management systems and controlled MCP/agent interfaces.

### Explicitly deferred
- Native iOS and Android applications; responsive web is first.
- Full coverage of every country, court, tribunal, legal database and language at initial launch.
- Autonomous legal decisions, unsupervised filing, representation or submission to courts/authorities.
- Guaranteed legal outcomes, guaranteed completeness of research or automatic determination of a person's legal rights.
- A microservice fleet before operational need is demonstrated; start with a modular application architecture subject to the architecture decision in task 0.6.
- Wholesale import or deployment of upstream legal applications.
- Classified-information handling until the hosting environment and every relevant service provider are authorised for the applicable classification.

## 7. Functional requirements

Priority definitions: **P0** required for first release; **P1** planned follow-on; **P2** future/conditional capability.

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Support the defined user segments through controlled personal, professional, enterprise and institutional workspace models | P0 |
| FR-002 | Support organisation membership, roles, matter membership and explicit permissions | P0 |
| FR-003 | Enforce tenant and matter isolation in server-side services and database/storage boundaries | P0 |
| FR-004 | Create, update, archive and search matters with controlled membership and audit | P0 |
| FR-005 | Securely ingest supported legal documents/evidence and preserve originals and versions | P0 |
| FR-006 | Capture document metadata and stable page/passage provenance for extracted content | P0 |
| FR-007 | Provide a registry of jurisdictions, legal sources, source types, versions and coverage status | P0 |
| FR-008 | Search approved legal sources and authorised matter documents with jurisdiction/date filters | P0 |
| FR-009 | Return source-grounded answers with traceable citations and visible uncertainty/coverage limitations | P0 |
| FR-010 | Verify citation existence and quotation matching against the selected source version | P0 |
| FR-011 | Distinguish source facts, user-provided facts, extracted facts, AI inference and legal propositions | P0 |
| FR-012 | Record AI model/provider, prompt/workflow version, inputs/evidence references, outputs and verification result as appropriate to audit policy | P0 |
| FR-013 | Allow human review, correction, annotation, approval and rejection of AI-assisted outputs | P0 |
| FR-014 | Provide research history and save outputs to an authorised workspace/matter | P0 |
| FR-015 | Provide data export, retention, deletion and legal-hold controls consistent with approved policy | P0 |
| FR-016 | Provide audit records for sensitive access, document actions, AI operations, approvals, exports and administration | P0 |
| FR-017 | Support issue/rule/fact/evidence/argument/counterargument structures | P1 |
| FR-018 | Support contract clause extraction, comparison, review playbooks and suggested edits | P1 |
| FR-019 | Support collaborative drafting, approvals and advanced workflow automation | P1 |
| FR-020 | Support organisation knowledge libraries, precedents and institutional knowledge governance | P1 |
| FR-021 | Support compliance obligations, control mapping and risk monitoring | P1 |
| FR-022 | Support additional jurisdiction packs and multilingual workflows through governed extension points | P1 |
| FR-023 | Support external integrations and controlled agent/tool interfaces | P1 |

## 8. Non-functional and trust requirements

### Security and confidentiality
- Deny by default; enforce least privilege at every service and data boundary.
- Separate organisation and matter access; test both allowed and forbidden paths.
- MFA for privileged and high-risk access; secure session creation, expiry and revocation.
- Encrypt data in transit and at rest; protect keys and provider credentials separately.
- Keep originals and derivatives in protected runtime storage, never in Git, public website assets, CI logs or build artefacts.
- Validate uploads, scan for malware, and safely process files in isolated workers.
- Apply explicit data-sharing controls to every external AI, OCR, embedding and legal-source provider. Do not transmit customer content to a provider without an approved processing basis and configuration.
- Maintain tamper-evident audit events for sensitive access and operations.
- Support retention, legal hold, deletion, export, backup and recovery.
- Classified information is out of scope until the environment and all relevant providers are specifically authorised.

### Legal accuracy and AI safety
- Never fabricate statutes, cases, citations, quotations, holdings or source coverage.
- Show jurisdiction, source type, issuing authority, source date and effective date where available.
- Preserve historical legal versions and support as-of-date research when the source data supports it.
- Identify uncertainty, missing sources, conflicting authorities and incomplete coverage.
- Distinguish binding authority from persuasive, secondary or non-binding material.
- Keep a human responsible for final legal judgment, advice, approval and external action.
- Make AI-generated content identifiable and reviewable; preserve provenance and version history.
- Provide clear escalation to qualified professionals for personal users where the issue requires professional advice.

### Reliability, accessibility and performance
- Design for recoverable background processing, idempotency, retries and visible job status.
- Avoid silent data loss; preserve original documents and audit relevant transformations.
- Provide usable keyboard navigation, semantic structure and accessible forms; target WCAG 2.2 AA for the user-facing application, subject to formal accessibility testing.
- Use responsive layouts for desktop and mobile browsers.
- Establish numeric availability, latency, recovery-point and recovery-time objectives during infrastructure and operations design; do not invent targets before hosting and workload are verified.
- Support observability without logging document contents, credentials or unnecessary personal data.

### Privacy and governance
- Collect only data needed for defined product purposes.
- Define controller/processor roles, lawful processing basis, notices and contractual terms for each customer model before production use.
- Define data residency and cross-border transfer rules for each deployment/customer segment.
- Keep tenant content logically separated; any exceptional support access must be approved, time-limited and audited.
- Provide transparent retention, export and deletion processes, subject to legal hold and applicable law.

## 9. Product-wide design principles

1. **Jurisdiction first:** legal answers are contextual to a jurisdiction, legal system and relevant date.
2. **Evidence before assertion:** material legal claims should be traceable to authority or user-provided evidence.
3. **Human accountability:** AI supports, not replaces, legal professionals and responsible decision-makers.
4. **Confidential by design:** customer matters and documents are protected runtime data, not development artefacts.
5. **One platform, distinct workspaces:** personal, professional, enterprise and institutional experiences share governed platform services without collapsing their permission models.
6. **Modular and replaceable:** jurisdiction packs, source adapters, AI providers and processing components can evolve independently behind stable contracts.
7. **Transparent limitations:** source coverage, freshness, uncertainty and unsupported tasks are visible.
8. **Auditability:** important data access, transformations, AI actions, approvals and exports leave reviewable records.
9. **No false completeness:** absence of a source/result is never represented as proof that no law or evidence exists.
10. **Commercially and legally governable:** licensing, data rights, privacy, hosting and provider terms are release gates.

## 10. Product scope by canonical modules A–M

The complete portfolio remains intact. The first release delivers a controlled subset of each relevant capability; it does not rename, merge or remove modules.

| ID | Canonical module | Product responsibility | First-release position |
|---|---|---|---|
| A | Njumeni Legal Intelligence | Unified platform, navigation, context and intelligence experience | Core shell and integrated user journey |
| B | Legal Research Engine | Legal-source discovery, retrieval and research sessions | P0 basic governed research |
| C | Evidence Intelligence Engine | Evidence intake, provenance, relationships and analysis | P0 secure intake/provenance; advanced analysis P1 |
| D | Legal Case Management | Matters, teams, timelines and tasks | P0 minimal matter/workspace management |
| E | Legal Document Intelligence | Secure documents, versions, OCR/extraction and understanding | P0 secure storage and provenance; advanced extraction P1 |
| F | Legal Argument and Reasoning Engine | Structured legal reasoning and argument analysis | P0 grounded explanation; advanced argument graphs P1 |
| G | Jurisdiction and Legal Systems Engine | Jurisdiction, applicable law, legal systems and dates | P0 jurisdiction registry and supported source/date filters |
| H | Personal Legal Assistant | Personal legal research and organisation | P0 limited personal research journey with safeguards |
| I | Professional Legal Workspace | Professional research and matter work | P0 core professional workspace |
| J | Enterprise and Law Firm Workspace | Team, firm and enterprise operations | P0 minimum organisation and matter permissions; advanced admin P1 |
| K | Institutional Workspace | Institutional legal operations and governance | Architecture and requirements P0; advanced institutional features P1 |
| L | Legal Compliance and Risk Intelligence | Obligations, compliance and risk | Governance foundations P0; full monitoring P1 |
| M | Legal Knowledge Management | Managed sources, libraries, precedents and knowledge | P0 source registry/provenance; advanced knowledge libraries P1 |

Detailed module contracts, dependencies, APIs/events, ownership, permissions and phase allocation are task 0.7—not silently decided here.

## 11. Product success measures

Instrument these measures from the first controlled release. Establish numerical targets only after baseline measurement and customer validation.

- Research answer citation validity and quotation-match rate.
- Percentage of material generated claims linked to inspectable evidence.
- Rate of unsupported or unverifiable answer detection and safe abstention.
- Source coverage and freshness by jurisdiction/source category.
- Document-ingestion success, processing latency and recoverable failure rate.
- Tenant/matter isolation test coverage and security incident rate.
- User task completion and repeat use for priority journeys.
- Human correction/rejection rate for AI-assisted findings.
- User-reported usefulness and trust, segmented by user type.
- Availability, latency, recovery and support performance against formally approved service objectives.

Usage volume alone is not a measure of legal quality.

## 12. Explicit non-goals and exclusions

- Njumeni is not a law firm and does not itself become the user's lawyer.
- Njumeni does not guarantee legal advice, outcomes, court success or completeness of research.
- Njumeni does not replace a qualified lawyer, court, regulator or other competent authority.
- No autonomous filing, representation, legal commitment or irreversible external action without explicit authorised human approval.
- No unrestricted cross-tenant or cross-matter access for convenience, analytics or model training.
- No use of customer documents to train external models by default; any future use requires a separate explicit lawful and contractual basis and product decision.
- No unlicensed copying of upstream software, legal datasets, court decisions, commentary or templates.
- No claim of complete legal coverage for a jurisdiction until sources, rights, update process and quality are verified.
- No officially classified data until hosting and all relevant providers have the required authorisations.
- No mixing of CMP source or any unrelated product code into Njumeni.
- No live customer data, secrets or production exports in Git, fixtures, CI logs or marketing-site assets.
- No native mobile app in the first release.

## 13. Open product decisions and release gates

The product baseline above is sufficiently defined to guide architecture and foundation work. The following choices must be resolved before the dependent production/release decision; this specification does not invent answers.

| Decision | Current position | Required resolution point |
|---|---|---|
| Exact first jurisdiction and order of source-pack launch | Priority list is Norway, EU, UK, US, international law and Cameroon; no final launch sequence recorded | Before jurisdiction-source production integration and first public legal-coverage claims |
| First paid product/package | Combined secure legal workspace, document/evidence and grounded research is the recommended first-release product baseline; pricing/package not approved | Before commercial launch and billing implementation |
| Commercial/source model | Not finally recorded as proprietary, open source or mixed | Before any AGPL-3.0 or other reciprocal-licence code integration and before commercial terms are finalised |
| Hosting, data residency and customer classification | Requirements must be segmented by customer and jurisdiction; actual provider/environment not yet verified | Before live customer data or any classified-data use |
| Initial language set | Not yet approved; legal source language and UI language must be separately specified | Before localisation and jurisdiction-pack acceptance |
| Initial customer segment and pilot cohort | All four customer segments are in scope; launch cohort not selected | Before pilot recruitment and production onboarding |
| Numeric service objectives and pricing | Not yet baselined | During infrastructure/commercial design, before production commitments |

These are controlled decision gates, not permission to assume a value. Record each final choice in a decision log and update this specification when approved.

## 14. First-release acceptance criteria

The first release may be called ready only when all applicable criteria are demonstrated in the target deployment:

1. An authorised user can authenticate and access only the workspaces, matters and documents permitted by their role and membership.
2. A user can create a matter and securely upload a supported document without exposing the original outside protected storage.
3. Original file, version, metadata, extracted page/passage and audit records remain linked and retrievable.
4. A user can select a supported jurisdiction and relevant date and search the approved source collections actually available in that deployment.
5. A research answer can be inspected claim-by-claim against source passages and exact versions.
6. Invalid, unavailable, outdated or contradictory source evidence is disclosed; the system abstains or qualifies its answer rather than inventing support.
7. A user can correct, annotate or reject an AI-assisted finding and the review history is retained.
8. A professional can save research and evidence to an authorised matter and collaborate without breaching matter permissions.
9. Negative tenant and matter access tests pass, including direct API/storage access attempts.
10. Sensitive operations are auditable; retention, export, deletion and backup/restore procedures are tested.
11. Security, privacy, legal-source rights, provider processing and operational release gates are approved for the target customer segment.
12. User-facing workflows pass accessibility, usability and end-to-end acceptance testing.

## 15. Change control

This specification establishes the Phase 0 product baseline. Changes to target segments, first-release scope, jurisdiction priorities, data handling, AI autonomy, source rights or non-goals require a documented product decision and review of affected architecture, security, licensing, tests and roadmap tasks.

Do not silently expand first-release scope. Do not mark a capability delivered merely because it appears in this specification.
