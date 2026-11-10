# Njumeni Legal AI Platform — Architecture Assessment

Status: proposed architecture, not yet implemented.
Purpose: establish a safe integration plan for the five legal-technology research repositories.

## 0. Confirmed product and repository boundaries

The product owner has confirmed the following decisions:

- `ICOFCUCAM/njumeni` is the dedicated Njumeni legal-platform application repository.
- Njumeni is intended to securely ingest, store, organise, process, retrieve and govern confidential legal documents, case files and evidence through its protected application data architecture.
- Live customer documents and production records belong in runtime storage, not Git history or source commits.
- The legacy CMP project is unrelated software. Keep its source, build and deployment separate; preserve and archive it independently before removing any legacy CMP files from this repository.
- The public Njumeni marketing website is maintained independently in `ICOFCUCAM/marketing-website`; it is not the legal application and must not host matter data or authenticated workflows.
- Upstream legal-technology repositories remain references or isolated adapters unless a deliberate component-level reuse and licence review is approved.

The current repository still contains legacy CMP files. Their presence is an unresolved Phase 0 repository-cleanup item, not a reason to combine CMP and Njumeni. Follow `docs/MASTER_IMPLEMENTATION_PLAN.md` for the binding execution order and acceptance gates.

## 1. Product architecture recommendation

Build Njumeni as an original, jurisdiction-aware legal research and document-work platform. Use upstream projects as references and optional isolated services, not as the platform's core identity.

The platform should have these bounded domains:

1. Identity and organisations — users, firms/organisations, memberships, roles, invitations, MFA and tenant isolation.
2. Matters and workspaces — client/matter metadata, teams, permissions, status and matter activity.
3. Document management — upload, source file, immutable versions, metadata, access control, retention and export.
4. Document intelligence — file validation, OCR, layout-aware extraction, structured parsing, chunking, embeddings and indexing.
5. Legal knowledge — legislation, case law, regulations, official guidance, legal commentary and source provenance, kept distinct by jurisdiction and source type.
6. Research — keyword and semantic retrieval, source-grounded answers, claim-level citations, citation validation and research history.
7. Contract review and drafting — clause extraction, playbooks, comparison, issue detection, suggested amendments and human approval.
8. Workflow automation — repeatable review/research sequences, background jobs, approvals, retries and versioned workflow definitions.
9. AI orchestration — provider abstraction, model selection, prompt/version registry, tool permissions, budgets and evaluation.
10. Governance — audit events, data export, retention, consent, security controls and operational observability.

## 2. Proposed high-level topology

```
Web application
    |
    v
Njumeni API / application layer
    |---------------- Identity, organisations, roles
    |---------------- Matters and document permissions
    |---------------- Document and version registry
    |---------------- Research / review / drafting APIs
    |
    +---- Document processing workers
    |       upload validation -> OCR/parser -> layout extraction
    |       -> chunks + page/span anchors -> text/vector indexes
    |
    +---- Retrieval and citation service
    |       keyword + vector retrieval -> reranking
    |       -> claim/source mapping -> citation verification
    |
    +---- Legal-source adapters
    |       Norwegian legislation adapter (Lovspor/Lovdata)
    |       case-law adapters (jurisdiction-specific)
    |       official guidance and other approved collections
    |
    +---- AI orchestration
            model/provider adapters -> tool execution
            -> structured outputs -> policy checks -> audit
    |
    v
Data layer
    relational metadata + tenant-scoped access policies
    object storage for originals and rendered derivatives
    full-text index + vector index
    queue/cache for background work
```

Keep the initial implementation modular within one deployable application unless measured scale or operational isolation justifies splitting a service. Do not begin with five imported applications or a microservice fleet.

## 3. What to learn or reuse from each source

### OpenContracts — document intelligence substrate

Useful patterns:
- document/corpus and annotation data model;
- structured text and page-layout preservation;
- parsers, embedders and thumbnailer interfaces;
- document relationships and citation graph;
- extraction tasks and human review;
- MCP surface for controlled agent access.

Recommendation: prototype the document representation and annotation model against Njumeni's own requirements. Do not adopt its whole Django/React application merely to obtain these capabilities. Upstream README identifies MIT licensing; preserve copyright and licence notices for any substantial reused code.

### CaseCite — strongest end-to-end product reference

Useful patterns:
- self-hosted legal RAG and BYOK provider configuration;
- hybrid retrieval combining keyword and vector search;
- clause/page-aware chunks and inline source citations;
- contract comparison and tabular review;
- workflows with approvals, retry/resume and versioned steps;
- matters, access scoping, audit and security controls.

Recommendation: use CaseCite as the primary product-workflow reference and perform a focused technical review of its data model, retrieval pipeline, security controls and workflow engine. Apache-2.0 is permissive, subject to its licence, NOTICE and attribution requirements. Its own documentation warns that citation checking is not a substitute for authoritative citator coverage or professional judgment.

### Lawgent — limited concept reference

Useful patterns:
- upload and analyse common legal document formats;
- Q&A, summarisation and translation;
- simple Next.js / Gemini implementation patterns.

Recommendation: treat it as a UI/feature reference only. The initial repository inspection did not find a LICENSE file. Do not copy, adapt or distribute its code unless the maintainer provides a clear licence or permission.

### Lovspor — Norwegian legislation adapter

Useful patterns:
- machine-readable Norwegian legislation corpus sourced from Lovdata public data;
- daily synchronisation and change classification;
- Git-based version history;
- exact citation and quotation verification;
- MCP tools for current law and historical versions.

Important limits:
- the project's stated corpus covers current acts and central regulations, not court decisions or preparatory works;
- absence from the corpus must not be presented as proof that a legal rule or source does not exist;
- legal text data and the Lovspor engine have distinct licences: its README identifies NLOD 2.0 for corpus data and AGPL-3.0 for current engine code; versions through commit `632dae8` were MIT.

Recommendation: integrate through a replaceable legal-source adapter or MCP boundary. Do not embed its AGPL engine into proprietary Njumeni code without a specific licence assessment. Confirm source attribution and permitted data use for every jurisdiction and dataset.

### Mike — workflow and document-review reference

Useful patterns:
- matter-centred document workspace;
- document review and suggested edits;
- reusable assistant and tabular-review workflows;
- CourtListener integration and citation checks;
- Word add-in and local-model support.

Recommendation: inspect architecture and workflow ideas, but do not copy its application into Njumeni's proprietary codebase without assessing AGPL-3.0 obligations. Keep any evaluation deployment isolated. Bundled templates and third-party content may have separate licences.

## 4. Core data model to design

Initial conceptual entities (not migration-ready SQL):

- `organisations`
- `organisation_memberships`
- `roles` and `permissions`
- `matters`
- `matter_memberships`
- `documents`
- `document_versions`
- `document_processing_jobs`
- `document_pages`
- `document_chunks`
- `document_annotations`
- `legal_sources`
- `legal_source_versions`
- `legal_citations`
- `research_sessions`
- `research_messages`
- `retrieval_evidence`
- `ai_runs`
- `review_templates`
- `review_jobs`
- `review_results`
- `workflow_definitions`
- `workflow_versions`
- `workflow_runs`
- `approval_tasks`
- `audit_events`

Every tenant-owned record must have an explicit organisation scope. Matter-owned records must additionally be scoped to the matter. Enforce access in the server and database policies; never rely only on frontend filtering.

Store original files and derived content separately. Every extracted passage must retain stable provenance: document version, page, text offsets and, where available, page coordinates. A citation must resolve to the exact version and passage used to generate the answer.

## 5. Retrieval and answer integrity

Recommended research path:

1. Resolve user, organisation, matter and jurisdiction permissions.
2. Parse the question into research intent and jurisdiction constraints.
3. Retrieve from permitted documents and approved legal-source adapters using hybrid keyword/vector retrieval.
4. Rerank evidence while retaining source identifiers and exact spans.
5. Generate a structured answer whose substantive claims map to evidence records.
6. Verify each citation against the stored source text and version; distinguish exact quotation from paraphrase.
7. Label source date, jurisdiction, source type and coverage limitations.
8. If evidence is missing or contradictory, say so; do not fabricate a citation or state that no law exists solely because search returned nothing.
9. Store the question, model/provider, prompt version, evidence IDs, citations, verification outcome and final answer in the audit trail.

No generated legal answer should be presented as a guaranteed legal opinion. Build clear review and escalation paths for professional users.

## 6. Security and privacy baseline

- Tenant isolation enforced at every API and data access boundary.
- Deny-by-default authorisation; least-privilege roles and matter-level access.
- MFA for privileged accounts; secure sessions and revocation.
- Private object storage; short-lived signed download links.
- Encryption in transit and at rest; separate key management for provider credentials and sensitive secrets.
- Document upload validation, malware scanning and safe file conversion.
- Explicit outbound-data controls for LLM, embedding, OCR and external legal-source providers.
- Per-tenant/provider BYOK options where commercially appropriate.
- Immutable or tamper-evident audit trail for access, export, AI actions, approvals and administrative changes.
- Retention, deletion, legal hold and data export policies.
- Rate limits, abuse protection, backups, restore tests and incident response.
- Never place API keys, secrets, customer documents or real personal data in source control or test fixtures.

## 7. Licensing and source governance

| Source | Initial licence finding | Engineering rule |
|---|---|---|
| OpenContracts | MIT | Reuse possible with notices and licence text |
| CaseCite | Apache-2.0 | Reuse possible with licence, NOTICE and change attribution obligations |
| Lawgent | No licence file found in initial check | No code reuse pending permission/licence |
| Lovspor | Current engine AGPL-3.0; corpus data NLOD 2.0 | Isolate as service/adapter pending AGPL and data-licence review |
| Mike | AGPL-3.0 | Study freely; isolate or obtain legal review before integration |

Re-check licence files at the exact commit used. Review dependencies, bundled templates, datasets, model licences and API terms separately. Public availability is not itself a reuse licence.

## 8. Recommended implementation sequence

### Phase A — product and repository boundary
- Confirm whether Njumeni's existing CMP skeleton is repurposed, retained as a marketing site, or separated.
- Define target users, jurisdictions, launch use cases and commercial/professional scope.
- Select the first supported jurisdiction and authoritative sources.
- Decide whether the legal application is in this repository or a separate app repository.

### Phase B — technical discovery
- Clone the five upstream sources locally using the bootstrap script.
- Pin each source to a reviewed commit.
- Map their schemas, dependencies, APIs, security controls and licences.
- Produce a component-by-component reuse matrix; no code imports yet.

### Phase C — Njumeni foundation
- Define tenancy, identity, roles, matters and audit model.
- Define document/version/provenance model.
- Establish API contracts, storage boundaries and background job lifecycle.
- Add automated tenant-isolation and permission tests before document ingestion.

### Phase D — first useful vertical slice
- Secure document upload and versioning.
- Text extraction with page/span provenance.
- Search across one organisation's documents.
- Answers with passage-level citations and verification.
- Human feedback and audit history.

### Phase E — legal-source integration
- Add the first jurisdiction's official source adapter.
- Add citation existence and exact-quote checks.
- Clearly report coverage, dates and source limitations.
- Add case-law only through a separate, authoritative source integration.

### Phase F — advanced legal workflows
- Contract review and comparison.
- Structured/tabular review with human approvals.
- Drafting from selected evidence and approved templates.
- Workflow orchestration, Word integration and MCP tools.

## 9. Decision gates before production code

Do not begin importing upstream modules until these questions are answered:

1. Is the current CMP site the intended Njumeni product, a temporary shell, or a separate project?
2. Which jurisdiction is the first launch target (Norway, another country, or multi-jurisdiction from day one)?
3. Is the first paid product legal research, document intelligence, contract review/drafting, or a combined workspace?
4. Will Njumeni be proprietary SaaS, open source, or a mixed model? This materially affects AGPL reuse decisions.
5. Which hosting and data-residency requirements apply to the first customer segment?

**Current recommendation:** make CaseCite the primary workflow/architecture reference; OpenContracts the document-intelligence reference; Lovspor an optional Norwegian-law adapter; Mike a separately reviewed AGPL reference; and Lawgent a non-code feature reference until licensed. Build Njumeni's own domain model, permissions, provenance and user experience.
