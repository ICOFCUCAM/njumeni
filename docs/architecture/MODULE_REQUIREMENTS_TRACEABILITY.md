# Njumeni original A–M capability traceability

This register preserves the original module-level capability requirements from the Njumeni master architecture supplied on 2026-11-10 and assigns their implementation layer. It supplements, and does not replace, [MODULE_LAYER_MAP.md](MODULE_LAYER_MAP.md). The original module names and capability wording are retained; implementation details may be elaborated but not silently removed. The exact layer names are defined in the original source; table shorthand maps as follows: Experience = Experience Layer; API = API Layer; Workflow orchestration = Workflow Orchestration Layer; Evidence = Evidence Layer; Legal knowledge = Legal Knowledge Layer; Reasoning = Reasoning Layer; Verification = Verification Layer; Infrastructure = Infrastructure Layer.

## Module A — Njumeni Legal Intelligence

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Natural-language legal questions | Experience, API, Workflow orchestration | Research and retrieval; scoped to an authorised workspace |
| Legal issue identification | Reasoning | Legal reasoning and verification |
| Jurisdiction-aware research | Legal knowledge, Reasoning | Legal knowledge and jurisdiction; Research and retrieval |
| Legal concept explanation | Reasoning, Verification | Claims must be source-linked and qualified |
| Legislation interpretation assistance | Legal knowledge, Reasoning, Verification | Exact authority version and effective period retained |
| Case-law research | Legal knowledge, Reasoning | Research and retrieval |
| Precedent comparison | Legal knowledge, Reasoning, Verification | Authority relationships and currency checked |
| Legal argument development | Reasoning | Structured argument graph |
| Identification of relevant legal principles | Legal knowledge, Reasoning | Authority-linked principle records |
| Counterargument identification | Reasoning, Verification | Counterarguments and adverse authority included |
| Legal risk identification | Reasoning, Verification | Explainable and source-linked |
| Legal position assessment | Reasoning, Verification | Assumptions and uncertainty surfaced |
| Evidence-to-law relationship analysis | Evidence, Legal knowledge, Reasoning | Preserve evidence and authority references |
| Legal research reports | Experience, Workflow orchestration, Reasoning, Verification | Exportable with provenance |
| Research history and saved investigations | Experience, API, Workflow orchestration | Research and retrieval owns session records |
| Source-linked responses | Legal knowledge, Reasoning, Verification | Exact source/version/passage references |
| Follow-up questioning | Experience, API, Workflow orchestration | Conversation context remains permission-scoped |
| Research export | Experience, API, Infrastructure | Export is an authorised, audited action |
| Multi-jurisdiction comparisons | Legal knowledge, Reasoning, Verification | Jurisdiction and applicable-period separation |
| Human review and approval | Verification, Workflow orchestration, API | Authorised human action; never inferred from AI completion |

Every substantive legal answer must distinguish:
- Verified legal authority.
- Interpretation of the authority.
- Factual assumptions.
- Inferences.
- Unresolved questions.
- Potentially conflicting authorities.

## Module B — Legal Research Engine

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Legislation and statutory instruments | Legal knowledge | Legal knowledge and jurisdiction |
| Regulations and administrative rules | Legal knowledge | Legal knowledge and jurisdiction |
| Court judgments | Legal knowledge | Legal knowledge and jurisdiction |
| Tribunal decisions | Legal knowledge | Legal knowledge and jurisdiction |
| Case citations | Legal knowledge, Verification | Citation/source identity validation |
| Legal doctrines | Legal knowledge, Reasoning | Source-linked doctrine records |
| Treaties and international conventions | Legal knowledge | International/supranational source profiles |
| Constitutional law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Administrative law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Employment law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Immigration law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Criminal law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Civil law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Commercial and corporate law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Contract law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Human rights | Legal knowledge, Reasoning | Domestic and international source relationships |
| Property law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Family law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Tax law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Intellectual property | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Environmental law | Legal knowledge, Reasoning | Jurisdiction-filtered retrieval |
| Procedural law | Legal knowledge, Reasoning | Applicable court/procedure context |
| Receive the user's legal question | Experience, API, Workflow orchestration | Validated research intake |
| Identify the legal subject | Reasoning | Structured issue/subject classification |
| Determine the relevant jurisdiction | Legal knowledge, Reasoning | Jurisdiction profile and source coverage |
| Identify the relevant period and applicable law | Legal knowledge, Verification | Effective dates and historical versions |
| Retrieve authoritative legal material | Legal knowledge, Workflow orchestration | Source registry and retrieval contracts |
| Search related judicial decisions | Legal knowledge, Workflow orchestration | Research and retrieval |
| Identify conflicting or superseded authorities | Legal knowledge, Reasoning, Verification | Authority graph and status history |
| Build relationships between authorities | Legal knowledge | Authority graph relationships |
| Produce a structured research result | Reasoning, Experience | Structured findings and source references |
| Verify citations against original sources | Verification | Exact source and passage check |
| Present findings with source references and limitations | Experience, Verification | Human-readable limitations and provenance |

Every legal source must support: jurisdiction; issuing authority; document type; citation; publication date; effective date; amendment date; repeal or expiry date; version history; legal status; source URL; retrieval date; language; relationships with other authorities. Historical versions must be preserved; applicable law for the relevant period must not be silently replaced by today's law.

## Module C — Evidence Intelligence Engine

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Upload PDF, DOCX, XLSX, TXT, email and image files | Experience, API, Evidence, Infrastructure | Secure file intake and validation |
| Extract scanned documents through OCR | Workflow orchestration, Evidence, Infrastructure | Document intelligence owns derived processing artefacts |
| Extract document metadata | Evidence | Document and evidence |
| Identify dates, names, organisations and events | Evidence, Reasoning | Extraction outputs remain linked to source versions |
| Extract relevant quotations | Evidence, Verification | Page/passage anchors retained |
| Identify contradictions | Evidence, Reasoning | Findings remain evidence-linked |
| Identify missing evidence | Evidence, Reasoning | Evidential gap is an assessment, not a fact |
| Link evidence to legal issues | Evidence, Reasoning | Explicit graph relationship |
| Link evidence to claims and arguments | Evidence, Reasoning | Explicit graph relationship |
| Organise evidence into exhibits | Experience, Evidence | Matter-scoped exhibit management |
| Maintain original documents | Evidence, Infrastructure | Immutable originals |
| Preserve document hashes | Evidence, Infrastructure | Integrity metadata |
| Track document versions | Evidence | Immutable version history |
| Record chain of custody | Evidence, Verification | Append-only custody events |
| Record access and modification history | API, Evidence, Infrastructure | Auditable access and mutation |
| Evidence classification | Evidence | Controlled metadata/classification |
| Chronological reconstruction | Evidence, Reasoning | Event chronology with source anchors |
| Witness statement comparison | Evidence, Reasoning | Comparative analysis |
| Contract comparison | Evidence, Reasoning | May feed Module E review |
| Correspondence analysis | Evidence, Reasoning | Source-linked extraction |
| Medical and employment document analysis where lawfully provided | Evidence, Reasoning, Verification | Sensitive material; lawful basis and strict access required |
| Identification of inconsistencies | Evidence, Reasoning | Contradiction candidates require review |
| Identification of corroborating evidence | Evidence, Reasoning | Supporting relationship with source references |
| Identification of evidential gaps | Evidence, Reasoning | Gap assessment and limitations |
| Relevance assessment | Reasoning | Legal issue and matter context |
| Reliability considerations | Reasoning, Verification | No unsupported credibility conclusions |
| Fact-versus-allegation separation | Evidence, Reasoning | Explicit proposition status |

Evidence must support explicit relationships where an item can support, contradict or qualify factual propositions, linked to legal issues and authorities. Evidence-supported assessments must retain limitations and source verification.

## Module D — Legal Case Management

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Create and register cases | Experience, API, Workflow orchestration | Workspace and matter |
| Assign case numbers | Workflow orchestration | Matter identifier/number policy |
| Define jurisdiction and legal category | Legal knowledge, Workflow orchestration | Jurisdiction reference |
| Create parties and representatives | Workflow orchestration | Workspace and matter |
| Record opposing parties | Workflow orchestration | Workspace and matter |
| Record legal questions | Reasoning, Workflow orchestration | Matter issue references |
| Store relevant facts | Evidence, Workflow orchestration | Fact/proposition ownership must be explicit |
| Manage documents and evidence | Evidence, Workflow orchestration | Document/evidence remains separately owned |
| Maintain case chronology | Evidence, Workflow orchestration | Source-linked events |
| Track deadlines | Workflow orchestration, Infrastructure | Scheduled jobs and notifications |
| Manage hearings | Workflow orchestration | Matter event/calendar |
| Record procedural history | Workflow orchestration | Auditable case events |
| Create tasks | Workflow orchestration | Task ownership and status |
| Assign responsibilities | Workflow orchestration, API | Permission-controlled assignment |
| Track progress | Experience, Workflow orchestration | Matter lifecycle read model |
| Record communications | Workflow orchestration | Confidential communication records |
| Maintain research notes | Legal knowledge, Workflow orchestration | Matter-scoped knowledge |
| Build legal arguments | Reasoning | Module F graph |
| Generate case reports | Experience, Workflow orchestration, Evidence, Reasoning | Permission-controlled export |
| Export case bundles | Experience, API, Evidence, Infrastructure | Audit and access check |
| Archive completed cases | Workflow orchestration, Infrastructure | Retention/legal-hold policy |

Case lifecycle is preserved exactly: **New → Intake → Investigation → Research → Analysis → Drafting → Review → Submission/Action → Monitoring → Closed**. Every transition must be recorded and permission-controlled.

## Module E — Legal Document Intelligence

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Legal letters; complaints; appeals; administrative submissions; legal memoranda; statements of facts; witness statements; affidavits; contracts; agreements; legal opinions; case summaries; research memoranda; motions and applications; regulatory submissions; responses to legal notices; evidence indexes; chronologies; legal briefs | Experience, Workflow orchestration, Evidence, Reasoning, Verification | All listed document types are in scope; templates and jurisdiction-specific rules are versioned |
| Extract document structure | Evidence | Document intelligence derived artefact |
| Identify legal references | Legal knowledge, Evidence | Link references to authority records |
| Detect missing sections | Reasoning, Verification | Template/document completeness checks |
| Check internal consistency | Reasoning, Verification | Structured findings and review |
| Compare document versions | Evidence, Reasoning | Version-aware comparison |
| Verify citations | Verification | Citation and source validation |
| Identify unsupported assertions | Reasoning, Verification | Claim-to-evidence/authority coverage |
| Flag ambiguous language | Reasoning | Suggested edits, not silent rewrite |
| Identify contradictions | Evidence, Reasoning | Cross-document and internal consistency |
| Suggest improvements | Reasoning, Experience | Preserve original and user-approved wording |
| Maintain tracked revisions | Evidence, Workflow orchestration | Version and revision history |
| Preserve user-approved wording | Evidence, Workflow orchestration | Explicit protected spans/approval semantics |
| Produce professionally formatted exports | Experience, Infrastructure | Controlled DOCX/PDF export |

Document lifecycle is preserved exactly: **Template → Draft → AI Analysis → Citation Verification → Human Review → Approved → Exported**. AI-generated documents must never be silently treated as approved legal submissions.

## Module F — Legal Argument and Reasoning Engine

The structured argument graph must support these node/relationship concepts: legal issues; legal questions; applicable rules; statutory provisions; judicial interpretations; facts; evidence; claims; arguments; counterarguments; exceptions; defences; procedural requirements; remedies; conclusions.

| Original reasoning capability | Primary layer(s) | Owning context / notes |
|---|---|---|
| Issue identification | Reasoning | Structured issue nodes |
| Rule identification | Legal knowledge, Reasoning | Rule linked to authority/version |
| Fact application | Evidence, Reasoning | Fact and inference kept distinct |
| Evidence assessment | Evidence, Reasoning, Verification | Source-linked assessment and uncertainty |
| Counterargument analysis | Reasoning | Adverse case and opposing positions |
| Distinguishing adverse precedents | Legal knowledge, Reasoning | Precedent relationship and fact comparison |
| Identifying missing facts | Evidence, Reasoning | Evidential gap record |
| Identifying legal uncertainty | Reasoning, Verification | Uncertainty and conflict surfaced |
| Evaluating competing interpretations | Legal knowledge, Reasoning, Verification | Competing rule/authority links |
| Producing structured reasoning | Reasoning | Explicit argument graph, not only unstructured text |

Argument relationships must be implemented as explicit data rather than storing everything as unstructured AI-generated text.

## Module G — Jurisdiction and Legal Systems Engine

Each jurisdiction profile must preserve: country; legal system; court hierarchy; administrative authorities; legislation sources; case-law sources; procedural rules; official languages; legal citation conventions; applicable dates; territorial scope; international treaty relationships.

| Original priority | Jurisdiction | Primary layer(s) |
|---:|---|---|
| 1 | Norway | Legal knowledge, Verification |
| 2 | European Union | Legal knowledge, Verification |
| 3 | United Kingdom | Legal knowledge, Verification |
| 4 | United States | Legal knowledge, Verification |
| 5 | International law | Legal knowledge, Verification |
| 6 | Cameroon | Legal knowledge, Verification |
| 7 | Other African jurisdictions | Legal knowledge, Verification |
| 8 | Additional global jurisdictions | Legal knowledge, Verification |

The platform must support common-law and civil-law traditions, mixed legal systems, supranational legal frameworks and international law. A jurisdiction must not be advertised as fully supported until its sources, coverage, updates, citation verification and legal-content quality have been tested.

## Module H — Personal Legal Assistant

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Personal legal workspace | Experience, API, Workflow orchestration | Personal workspace/matter scope |
| Guided legal intake | Experience, API, Workflow orchestration | Intake records and consent |
| Explain legal rights and obligations | Legal knowledge, Reasoning, Verification | Plain-language, source-linked explanation |
| Identify potential legal issues | Reasoning | Potential issues, not legal determinations |
| Organise personal documents | Experience, Evidence | Private personal document store |
| Explain official letters | Evidence, Reasoning, Verification | Source/passage grounded |
| Create case chronologies | Evidence, Workflow orchestration | Traceable events |
| Prepare questions for a lawyer | Reasoning, Experience | Human professional referral support |
| Help prepare administrative responses | Reasoning, Verification, Workflow orchestration | Draft only; human review |
| Assist with appeals and complaints | Reasoning, Verification, Workflow orchestration | Draft only; human review |
| Track important dates | Workflow orchestration, Infrastructure | Deadline scheduler and notifications |
| Maintain personal legal records | Evidence, Workflow orchestration | Private records |
| Generate document drafts | Workflow orchestration, Reasoning, Evidence | Module E lifecycle and approval gate |
| Refer users to qualified legal professionals where appropriate | Experience, Workflow orchestration | Referral information; no representation claim |

The interface must use plain language without sacrificing legal precision.

## Module I — Professional Legal Workspace

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Client management | Experience, API, Workflow orchestration | Workspace and matter; professional permissions |
| Matter management | Workflow orchestration | Module D |
| Research workspace | Experience, Legal knowledge, Workflow orchestration | Module B |
| Evidence analysis | Evidence, Reasoning, Verification | Module C |
| Case-law search | Legal knowledge, Workflow orchestration | Module B |
| Argument graph | Reasoning | Module F |
| Document drafting | Experience, Workflow orchestration, Reasoning, Verification | Module E |
| Citation verification | Verification | Exact source checks |
| Internal knowledge base | Legal knowledge, Workflow orchestration | Module M with access policies |
| Research libraries | Legal knowledge, Experience | Collections and permissions |
| Collaboration | Experience, API, Workflow orchestration | Workspace/matter roles |
| Document versioning | Evidence | Immutable versions |
| Task assignments | Workflow orchestration | Audited assignments |
| Review and approval | Verification, Workflow orchestration, API | Human approval |
| Matter reporting | Experience, Workflow orchestration | Permission-scoped reports |
| Client communication records | Workflow orchestration | Confidential matter activity |
| Billing integration readiness | API, Infrastructure | Commercial/billing boundary |
| Exportable professional work product | Experience, API, Infrastructure | Authorised export |

Professional users must be able to review the original authority and underlying evidence behind every material AI conclusion.

## Module J — Enterprise and Law Firm Workspace

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Organisation accounts | API, Workflow orchestration | Identity and organisation |
| Multiple teams | Experience, API, Workflow orchestration | Organisation/workspace model |
| Multiple offices | Experience, API, Workflow orchestration | Organisation structure |
| User invitations | API, Workflow orchestration | Invitation and acceptance lifecycle |
| Role-based access | API, Infrastructure | Server-side and database enforcement |
| Matter ownership | Workflow orchestration | Workspace and matter |
| Team assignments | Workflow orchestration | Matter membership/assignment |
| Shared document libraries | Experience, Evidence, Legal knowledge | Explicit sharing policy |
| Organisation-wide templates | Experience, Evidence, Workflow orchestration | Governed template collection |
| Knowledge repositories | Legal knowledge, Workflow orchestration | Module M |
| Custom workflows | Workflow orchestration | Versioned workflow definitions |
| Usage monitoring | Infrastructure, API | Minimise confidential payloads |
| Subscription management | API, Workflow orchestration, Infrastructure | Commercial boundary |
| Audit trails | Infrastructure, API, Workflow orchestration | Governance and audit context |
| API access | API, Infrastructure | Scoped credentials and revocation |
| Single sign-on readiness | API, Infrastructure | Identity-provider adapter |
| Data retention policies | API, Workflow orchestration, Infrastructure | Governance and audit |
| Custom branding | Experience | Tenant-scoped configuration |
| Enterprise administration | Experience, API, Workflow orchestration | Least-privilege admin roles |

## Module K — Institutional Workspace

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Institutional case repositories | Experience, API, Workflow orchestration, Evidence | Strict institutional tenant |
| Policy and regulatory research | Legal knowledge, Reasoning, Verification | Source-linked |
| Administrative decision analysis | Evidence, Legal knowledge, Reasoning, Verification | Decision record and applicable law |
| Document review | Evidence, Reasoning, Verification | Access-controlled |
| Compliance workflows | Workflow orchestration, Legal knowledge, Verification | Module L |
| Legal knowledge repositories | Legal knowledge, Workflow orchestration | Module M with institutional access policy |
| Institutional templates | Experience, Evidence, Workflow orchestration | Governed template lifecycle |
| Access-controlled collaboration | Experience, API, Workflow orchestration | Institutional roles |
| Oversight and audit | API, Workflow orchestration, Infrastructure | Governance and audit |
| Retention and archival policies | API, Workflow orchestration, Infrastructure | Legal hold and retention controls |
| Institutional reporting | Experience, Workflow orchestration, Infrastructure | Permission-scoped exports |

Institutional data must be strictly separated and confidential case materials must never be exposed across unrelated organisations.

## Module L — Legal Compliance and Risk Intelligence

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Regulatory research | Legal knowledge, Workflow orchestration | Official/licensed sources |
| Regulatory change monitoring | Legal knowledge, Workflow orchestration, Infrastructure | Versioned ingestion and scheduled monitoring |
| Compliance obligation registers | Legal knowledge, Reasoning, Workflow orchestration | Traceable obligations |
| Policy analysis | Evidence, Reasoning, Verification | Source-linked policy versions |
| Contractual obligation extraction | Evidence, Reasoning | Module E/C input |
| Risk identification | Reasoning, Verification | Explainable, not generic risk scores |
| Regulatory comparison | Legal knowledge, Reasoning, Verification | Jurisdiction and effective date aware |
| Compliance evidence | Evidence, Workflow orchestration | Evidence provenance |
| Compliance reporting | Experience, Workflow orchestration | Audited reports |
| Review schedules | Workflow orchestration, Infrastructure | Recurring tasks/reminders |
| Audit records | API, Workflow orchestration, Infrastructure | Governance and audit context |

The compliance engine must be built around traceable obligations and source-linked rules, not generic AI risk scores.

## Module M — Legal Knowledge Management

| Original capability / requirement | Primary layer(s) | Owning context / notes |
|---|---|---|
| Saved research | Experience, Legal knowledge, Workflow orchestration | User/organisation scope |
| Legal precedents | Legal knowledge | Authority and internal precedent distinguished |
| Internal legal opinions | Evidence, Legal knowledge, Workflow orchestration | Confidential access policy |
| Document templates | Experience, Evidence, Workflow orchestration | Versioned and approved |
| Approved arguments | Reasoning, Legal knowledge, Workflow orchestration | Approval provenance retained |
| Legal notes | Experience, Legal knowledge | Scope and confidentiality retained |
| Matter knowledge | Workspace and matter, Legal knowledge | Matter scope is not automatically shared |
| Research collections | Experience, Legal knowledge | Collection ACL |
| Taxonomies | Legal knowledge | Governed vocabulary |
| Tags | Legal knowledge | Scoped metadata |
| Relationships | Legal knowledge, Reasoning | Typed relationships |
| Knowledge access permissions | API, Infrastructure | Server-side and database policy |
| Version histories | Legal knowledge, Evidence | Immutable history |
| Review and expiry dates | Workflow orchestration, Infrastructure | Scheduled review/expiry |

Private client information must not automatically become shared institutional knowledge or AI training data.

## 14. Original architecture preservation note

The source master architecture also contains the original eight platform layers, the complete AI agent/orchestration/RAG/governance requirements, technical stack, domain data inventory, critical database relationships, legal-source infrastructure, security/privacy/governance requirements, API/integration framework, hosting/deployment, user journeys, administration, commercial architecture, testing/evaluation, repository structure, Phase 0–13 roadmap, definition of completion, strategic priorities and permanent decisions. This module traceability file does not claim to reproduce those other sections; they must remain mapped and reconciled in the master-plan preservation audit before Phase 0 closeout.
