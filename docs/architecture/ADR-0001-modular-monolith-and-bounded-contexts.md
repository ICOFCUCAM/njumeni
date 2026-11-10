# ADR-0001 — Njumeni modular-monolith architecture and bounded contexts

- **Status:** Accepted for the modular-monolith decision and bounded-context/dependency rules; **incomplete for Phase 0 task 0.6** pending recovery of the originally agreed eight platform-layer names and definitions.
- **Date:** 2026-11-10
- **Decision owners:** Njumeni product owner and architecture workstream
- **Scope:** Njumeni application repository only. This ADR does not cover the independent marketing website or CMP archive.

## 1. Context and constraints

Njumeni is a jurisdiction-aware global legal intelligence platform. It must securely ingest, store, organise, process, retrieve and govern confidential legal documents, case files and evidence. It must preserve source, document-version, page/passage and AI-operation provenance.

The binding scope is the original twenty-section outline and canonical A–M modules in `docs/MASTER_IMPLEMENTATION_PLAN.md`, together with the functional, trust and first-release requirements in `docs/PRODUCT_SPECIFICATION.md`.

The architecture must:
- preserve all twenty original workstream sections and A–M module identities;
- support personal, professional, enterprise and institutional workspaces;
- enforce organisation and matter access at server and data boundaries;
- keep legal-source provenance, document provenance and AI provenance traceable;
- avoid premature distributed-system complexity;
- keep upstream applications as references or separately assessed adapters, not wholesale imports;
- keep live customer records and secrets out of Git, fixtures, CI output and deployment artefacts;
- exclude officially classified information until the hosting environment and all relevant providers are authorised.

## 2. Decision

Adopt a **modular monolith** for the initial Njumeni application.

The application is one deployable product with explicit bounded contexts, internal contracts and independently testable domain/application modules. Background workers and external adapters may be separate runtime processes where required by workload, security or operational isolation, but they remain parts of the same product architecture and must use explicit contracts. This is not approval to create a fleet of independently owned microservices.

This decision is consistent with the product specification's explicit deferral of a microservice fleet until operational need is demonstrated.

## 3. Bounded contexts

The following bounded contexts define responsibility boundaries. They are not replacements for, or renamings of, the canonical A–M product modules. Task 0.7 will map every A–M module onto these contexts and the approved platform layers.

| Bounded context | Owns / is authoritative for | Must not become |
|---|---|---|
| Identity and organisation | User identity references, organisations, memberships, roles, invitations, authentication/session policy and organisation-level authorisation | A holder of matter content or document bytes |
| Workspace and matter | Matter/client workspace metadata, matter membership, matter lifecycle, teams, tasks and matter activity | A duplicate identity provider or document repository |
| Document and evidence | Document records, immutable originals/versions, evidence records, metadata, annotations, provenance and access decisions for those assets | A legal-source registry or AI answer store |
| Document intelligence | Processing lifecycle, OCR/extraction outputs, page/layout structures, chunks, embeddings and indexing state, all linked to source document versions | An owner of original files or authoritative legal interpretation |
| Legal knowledge and jurisdiction | Jurisdiction registry, source registry, source versions, legal-text provenance, effective dates, coverage and source synchronisation state | A matter workspace or generic document store |
| Research and retrieval | Research sessions, queries, retrieval runs, selected evidence references, ranking and research history | An authority that silently changes source text or bypasses access checks |
| Legal reasoning and verification | Structured claims, issues/rules/facts/arguments, claim-evidence mappings, citation/quotation checks, uncertainty and verification results | An autonomous legal decision-maker or substitute for professional judgment |
| Contract review and drafting | Review playbooks, clause findings, comparison results, draft artefacts, approval state and version relationships | An unreviewed route to alter immutable originals |
| Workflow and orchestration | Versioned workflow definitions/runs, job state, retries, approvals and coordination across contexts | A second owner of the domain records it coordinates |
| AI orchestration | Provider/model adapters, prompt and tool versions, policy checks, budgets, structured execution metadata and AI-run provenance | A bypass around domain permissions, source validation or audit |
| Governance and audit | Audit/event records, policy decisions, retention/legal-hold actions, export/deletion evidence and operational governance records | A place to duplicate all business data without ownership boundaries |

A context may be implemented as one or more internal packages initially. Physical separation is not implied by the table.

## 4. Dependency rules

The following rules are binding for implementation:

1. **Dependency direction:** presentation and delivery adapters call application use cases; application use cases coordinate domain behaviour through declared interfaces; domain rules do not depend on UI frameworks, databases, queues, cloud vendors or model-provider SDKs.
2. **Infrastructure inversion:** database, object-storage, search, queue, email, identity-provider and model-provider implementations sit behind ports/interfaces owned by the application/domain boundary they serve.
3. **No cross-context table writes:** one bounded context must not directly mutate another context's owned tables. It must call an application contract or publish/consume a versioned domain event.
4. **No hidden shared database contract:** physical database co-location is allowed initially, but schema ownership remains explicit. Cross-context reads use a declared query contract/read model; they do not create implicit write authority.
5. **Explicit orchestration:** multi-context workflows are coordinated by application/workflow orchestration, with idempotency, retry and failure state. A context must not reach into another context's private internals.
6. **Events are facts:** events describe committed domain facts, carry stable identifiers and schema versions, and contain no unnecessary confidential document text or secrets. Delivery must be idempotent and auditable.
7. **Shared kernel is deliberately small:** only stable primitives such as identifiers, clock abstractions, result/error types and approved security primitives may be shared. No shared "god" model or catch-all business service.
8. **Authorisation is not delegated to the UI:** every application/API/storage access resolves the authenticated actor, organisation membership, matter scope and action permission server-side. Database/storage policies independently enforce the applicable boundary.
9. **AI is a consumer of authorised capabilities:** AI tools receive only explicitly authorised context and evidence references. AI orchestration cannot query private tables or object storage around domain policy.
10. **Provenance crosses boundaries:** document, legal-source, passage, citation, retrieval and AI-run identifiers must be retained across contracts so a generated claim can be traced to the exact authorised evidence and source version.
11. **No circular dependencies:** bounded contexts may not form compile-time dependency cycles. If two contexts need each other, extract a stable contract, use an application orchestrator, or publish an event.
12. **No premature microservices:** split a runtime only when a measured scaling, isolation, reliability, team-ownership or regulatory requirement justifies the operational cost. A split requires a separate ADR and explicit data/API/event ownership.
13. **Upstream isolation:** external legal software is accessed through reviewed adapters or isolated processes. Licence and data rights are assessed at the exact version/commit before reuse. AGPL components are not silently linked into proprietary application modules.
14. **Confidentiality by default:** original documents, extracted text and matter content remain in protected runtime storage; logs and events use references and minimised metadata, not raw customer content.

## 5. Data ownership and security boundaries

- Identity/organisation context owns organisation membership and role assignment; matter context owns matter membership and matter lifecycle.
- Document/evidence context owns original document references, immutable versions, evidence records and asset-level provenance.
- Document-intelligence context owns derived processing artefacts and index lifecycle, each tied to a document version and protected by the source asset's access scope.
- Legal-knowledge context owns approved legal-source metadata and versioned source references; source rights and coverage are explicit.
- Research/reasoning contexts own research and reasoning artefacts, but retain references to the source/evidence records rather than copying authoritative source ownership.
- AI orchestration owns execution metadata, not the underlying matter/document/legal-source data.
- Governance owns audit and policy evidence, with access restricted and tamper-evident controls designed in later security tasks.
- Every tenant-owned record has an organisation scope. Matter-owned data additionally has a matter scope. Cross-tenant access is denied by default.
- Object storage is private by default. File access is mediated by server-side authorisation and short-lived access mechanisms; a guessed object key is never sufficient authority.
- Provider egress is an explicit policy-controlled operation. No provider receives customer content merely because an SDK is configured.
- Retention, deletion, legal hold, export, backup and restore must preserve legal and audit obligations and will be specified/tested in the relevant Phase 0/1/3 tasks.

## 6. The eight canonical platform layers

The original Njumeni master architecture supplied on 2026-11-10 establishes the following eight layers, in this exact order and with these canonical names and responsibilities. These names and base responsibilities are preserved verbatim; the contracts below elaborate them without renaming or replacing them.

| Order | Canonical layer | Original architectural responsibility |
|---:|---|---|
| 1 | **Experience** | Web applications, dashboards, mobile-ready interfaces |
| 2 | **API** | Authentication, API gateway, tenant and permission enforcement |
| 3 | **Workflow orchestration** | Case workflows, queues, tasks, AI agent execution |
| 4 | **Evidence** | Documents, exhibits, chronology, provenance and extraction |
| 5 | **Legal knowledge** | Legislation, cases, regulations, treaties and legal authorities |
| 6 | **Reasoning** | Legal issue identification, argument graphs, analysis and research |
| 7 | **Verification** | Citations, source validation, legal currency and human review |
| 8 | **Infrastructure** | Database, storage, AI providers, security, monitoring and deployment |

These are logical responsibility layers, not a requirement for eight separate deployables or a strictly linear request path. They are implemented within the approved modular monolith and may use separately operated infrastructure or worker processes where justified.

### 6.1 Layer contracts

| Layer | Purpose and permitted responsibilities | Exclusions / prohibited ownership | Interfaces and dependencies | Security and trust responsibilities |
|---|---|---|---|---|
| **1. Experience** | Personal, professional, enterprise and institutional web experiences; dashboards; responsive/mobile-ready interaction; accessible presentation; document and argument visualisation; user-facing review and approval controls | No authoritative business rules, direct database access, direct object-store access, secret-bearing provider calls, or client-only authorisation | Calls the API layer through typed contracts; renders workflow state and authorised read models; no direct dependency on internal domain tables | Presents only server-authorised data; handles session state safely; avoids leaking confidential content through browser storage, telemetry or client logs; makes AI status and human approval explicit |
| **2. API** | Authenticated application/API entry points; request validation; identity resolution; tenant/workspace/matter scope; permission enforcement; rate limits; stable versioned API contracts | No domain ownership of evidence, legal authorities, arguments or workflow state; no trust in client-supplied tenant IDs or permission claims | Exposes application use cases to Experience and approved integrations; delegates orchestration to Workflow orchestration; uses identity, tenancy and permission contracts; does not expose private context internals | Server-side authentication and authorisation; object-level checks; input validation; abuse controls; secure response shaping; auditable sensitive actions |
| **3. Workflow orchestration** | Coordinates case lifecycles, queues, tasks, AI-agent execution, multi-context processes, retries, idempotency, deadlines, approvals and workflow state transitions | Does not become the authoritative owner of evidence, legal knowledge, reasoning artefacts or provider data; does not bypass domain contracts | Invokes Evidence, Legal knowledge, Reasoning and Verification through explicit application contracts; emits/consumes versioned events; calls Infrastructure ports for queues and scheduling | Re-checks actor and scope at execution time; propagates least-privilege context; enforces approval gates; prevents duplicate or stale execution; records traceable run state |
| **4. Evidence** | Manages documents, exhibits, immutable originals and versions, metadata, extraction references, chronology, provenance, evidence relationships and custody events | Does not own legal authority records, final legal interpretations, AI provider configuration or workflow orchestration | Supplies authorised evidence and provenance references to Workflow orchestration, Reasoning and Verification; uses Infrastructure storage/database/OCR ports; receives processing results through controlled contracts | Private-by-default assets; matter/tenant scope; immutable original/version history; hashes and custody records; secure upload/download; minimised event payloads; derived data inherits source access scope |
| **5. Legal knowledge** | Manages legislation, cases, regulations, treaties, legal authorities, jurisdiction/source metadata, historical versions, effective dates, source status and legal-source provenance | Does not own user matter files, evidence originals, legal argument conclusions or generic AI-generated knowledge | Supplies versioned authority/source/passage references to Workflow orchestration, Reasoning and Verification; uses Infrastructure persistence, retrieval and ingestion ports; source updates enter through controlled ingestion contracts | Records source identity, licence/rights, retrieval time, authority status, jurisdiction and effective dates; preserves historical versions; filters retrieval by permitted source and jurisdiction; never treats public access as reuse permission |
| **6. Reasoning** | Identifies legal issues and questions; structures rules, facts, claims, arguments, counterarguments, exceptions, defences, procedural requirements and remedies; builds argument graphs; performs analysis and research synthesis | Does not make autonomous legal decisions, approve submissions, mutate source authorities or evidence originals, or assert unsupported certainty | Consumes authorised Evidence and Legal knowledge references; produces structured reasoning artefacts for Workflow orchestration and Verification; provider/model calls are mediated by approved orchestration/infrastructure contracts | Every material proposition retains source/evidence links and uncertainty; scope is matter-authorised; distinguishes facts, allegations, inferences and legal interpretation; human judgement remains central |
| **7. Verification** | Checks citations, quotations, source identity, source validity, authority currency, historical applicability, conflicts, support for claims and human-review decisions | Does not silently rewrite original authorities, substitute current law for historical law, or grant legal approval without an authorised human | Reads outputs from Reasoning and source references from Evidence/Legal knowledge; returns structured verification results to Workflow orchestration and Experience; human decisions are recorded through authorised API workflows | Fails closed on material unverified citations where required; records exact source/version/passage; surfaces conflicts and uncertainty; approval is attributable to an authorised human; verification cannot be bypassed by an AI agent |
| **8. Infrastructure** | Provides database, object storage, AI-provider adapters, security primitives, monitoring, deployment, queues, backups and operational runtime capabilities | Is not a business-domain owner and must not embed legal rules, matter lifecycle or product policy in vendor-specific infrastructure code | Implements ports used by all other layers; offers managed capabilities through adapters; infrastructure dependencies point inward through interfaces, not from domain logic to vendor SDKs | Secrets management; encryption; network and provider-egress controls; tenant-aware storage policies; observability without confidential payload leakage; backup/restore, incident response and environment separation |

### 6.2 Dependency and interaction rules

The canonical layer order is preserved, but dependencies are responsibility-based rather than a simplistic rule that every layer may call only the immediately adjacent layer.

The approved high-level dependency model is:

- Experience → API.
- API → Workflow orchestration and the relevant application/security contracts.
- Workflow orchestration → Evidence, Legal knowledge, Reasoning and Verification through declared contracts.
- Reasoning → authorised Evidence and Legal knowledge read contracts.
- Verification → Reasoning outputs and authorised Evidence/Legal knowledge source references; it returns verification findings rather than mutating their source records.
- Infrastructure implements persistence, storage, queue, provider, security and monitoring ports consumed by the other layers. It is a supporting layer, not a domain service called to make legal decisions.

Workflow orchestration coordinates the end-to-end process: it requests evidence processing and legal research, supplies authorised references to reasoning, submits material outputs for verification, and then presents review/approval tasks through the API and Experience layers. This avoids a compile-time Reasoning ↔ Verification cycle: Reasoning does not import Verification; Workflow orchestration coordinates the sequence. Verification reads reasoning outputs through a contract and returns findings to the orchestrator.

### 6.3 Cross-layer invariants

1. No layer bypasses API/server-side authorisation to access tenant or matter data.
2. Evidence originals and legal-source versions remain owned by their respective layers and are referenced, not silently copied as authoritative records.
3. Reasoning outputs preserve links to exact evidence, authority versions and passages.
4. Verification is independent of the model that generated the proposition being checked.
5. Human approval is a distinct, permission-controlled action; AI generation or verification is not approval.
6. Infrastructure credentials and provider access are never exposed to Experience clients.
7. Events carry stable references and minimal metadata, not confidential document contents or secrets.
8. All cross-layer calls use explicit, testable contracts; cross-layer table writes are prohibited.
9. Layer boundaries do not imply eight microservices; implementation remains a modular monolith unless a later ADR approves a justified extraction.
10. The twenty original product/workstream sections and A–M module names remain binding. Task 0.7 will produce the detailed module-to-layer/context mapping.

### 6.4 Consistency review

The dependency model is acyclic at the compile-time contract level: Experience depends on API; API delegates to Workflow orchestration; Workflow orchestration coordinates domain capabilities; Reasoning and Verification consume read contracts from Evidence and Legal knowledge; Infrastructure implements ports without becoming an upstream business dependency. The runtime workflow may return verification findings to the orchestrator, but this is a directed result/contract, not a code dependency cycle.

The layer definitions are consistent with the original product architecture: Experience/API/Workflow provide controlled interaction and execution; Evidence and Legal knowledge provide distinct factual and authoritative source foundations; Reasoning structures legal analysis; Verification tests provenance and correctness; Infrastructure supports all layers. Detailed mapping of every A–M module and all twenty outline sections remains task 0.7 and is not claimed complete here.

### 6.5 Relationship to the original twenty-section plan

This is a high-level responsibility map, not a replacement for the original section titles or the detailed A–M module mapping owned by task 0.7.

| Original section | Primary platform-layer responsibility |
|---|---|
| 1. Brand/corporate identity | Experience |
| 2. Product architecture | All eight layers as one integrated platform |
| 3. Complete product modules | Experience, API, Workflow orchestration, Evidence, Legal knowledge, Reasoning, Verification |
| 4. Complete AI architecture | Workflow orchestration, Reasoning, Verification, Infrastructure; API governs authorised access |
| 5. Technical architecture/stack | All eight layers and their implementation contracts |
| 6. Legal knowledge infrastructure | Legal knowledge, Verification, Infrastructure |
| 7. Security/privacy/governance | API, Workflow orchestration, Evidence, Legal knowledge, Verification, Infrastructure |
| 8. Open-source research/software reuse | Infrastructure, API and Legal knowledge integration boundaries |
| 9. API/integration framework | API, Workflow orchestration, Infrastructure |
| 10. Infrastructure/hosting/deployment | Infrastructure, with API and Workflow orchestration runtime contracts |
| 11. User journeys/operational workflows | Experience, API, Workflow orchestration and the domain layers used by each journey |
| 12. Administration/platform operations | Experience, API, Workflow orchestration, Infrastructure |
| 13. Commercial architecture/monetisation | API, Workflow orchestration, Infrastructure |
| 14. Testing/evaluation/QA | All eight layers |
| 15. Repository/development structure | All eight layers and their package boundaries |
| 16. Complete implementation roadmap | All eight layers, delivered according to dependency order |
| 17. Definition of completion | All eight layers and their release/verification controls |
| 18. Initial strategic priorities | Evidence, Legal knowledge, Reasoning and Verification, supported by the other layers |
| 19. Permanent architectural decisions | All eight layers |
| 20. Immediate execution/foundation | All eight layers, beginning with architecture and infrastructure foundations |

## 7. Consequences

### Positive
- One product can be delivered without premature network and deployment complexity.
- Domain ownership and access boundaries are explicit before schema and feature work.
- Internal modules can be tested independently and extracted later if evidence justifies it.
- Provider and upstream legal-software dependencies remain replaceable and reviewable.
- The architecture supports traceability across documents, legal sources, retrieval, reasoning and AI runs.

### Costs and risks
- A modular monolith requires discipline around package boundaries and database ownership.
- Shared deployment creates a common release unit until justified runtime splits are approved.
- The exact eight-layer architecture remains unapproved until its original names and definitions are recovered.
- A–M mapping, engineering enforcement, runtime topology and concrete technology choices remain later Phase 0 tasks.

## 8. Acceptance checks for this decision

- [x] Modular-monolith decision recorded with rationale.
- [x] Bounded contexts and ownership boundaries recorded.
- [x] Dependency direction and prohibited coupling recorded.
- [x] Tenant, matter, document, legal-source and AI provenance boundaries recorded.
- [x] No premature microservice fleet approved.
- [x] Original eight platform-layer names/order/definitions recovered from the original source and recorded without substitution in the master plan and this ADR.
- [x] Eight-layer contracts, dependency map and relationship to all twenty original sections reviewed; no compile-time dependency cycle is introduced.
- [ ] Detailed task 0.7 mapping of all canonical A–M modules to the approved layers and contexts is tracked separately in the Phase Register.

## 9. Related binding documents

- `docs/MASTER_IMPLEMENTATION_PLAN.md` — original twenty sections, A–M modules and Phase 0–13 execution order.
- `docs/PRODUCT_SPECIFICATION.md` — product scope, requirements, non-goals and release gates.
- `docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md` — upstream research and initial architecture assessment.
- `docs/PHASE_REGISTER.md` — live task and phase status.
