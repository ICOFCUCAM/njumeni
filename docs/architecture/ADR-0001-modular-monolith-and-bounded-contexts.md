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

## 6. Platform layers — original naming recovery is a blocking preservation gate

The binding Phase 0 checklist requires **the originally agreed eight platform layers**. The current checked-in master plan, product specification, phase register, architecture assessment and Phase 0 audit do not contain their eight canonical names, order or definitions. The available prior-conversation retrieval also did not recover those exact names.

To avoid silently replacing the original architecture with an invented taxonomy, this ADR does **not** assign substitute names or claim that the eight layers have been approved.

The eight-layer section remains intentionally open. Before task 0.6 can turn green, recover the original eight layer names and their intended order/definitions from the original source material, then add for each layer:
- purpose and responsibility;
- allowed contents and prohibited responsibilities;
- dependencies and permitted dependency direction;
- interfaces/contracts to adjacent layers;
- security/trust responsibilities;
- mapping to all twenty original sections and A–M modules (the detailed module mapping is task 0.7).

If the original source cannot be recovered, the product owner must explicitly approve a documented replacement through change control. No replacement is assumed by this ADR.

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
- [ ] Original eight platform-layer names/order/definitions recovered and recorded without substitution.
- [ ] Eight-layer dependency map reviewed for cycles and consistency.
- [ ] Task 0.7 maps all canonical A–M modules to the approved layers and contexts.

## 9. Related binding documents

- `docs/MASTER_IMPLEMENTATION_PLAN.md` — original twenty sections, A–M modules and Phase 0–13 execution order.
- `docs/PRODUCT_SPECIFICATION.md` — product scope, requirements, non-goals and release gates.
- `docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md` — upstream research and initial architecture assessment.
- `docs/PHASE_REGISTER.md` — live task and phase status.
