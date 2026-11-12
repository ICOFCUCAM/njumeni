# Njumeni — Domain Model

| Field | Value |
|---|---|
| Status | Living document. Describes the domains **implemented** so far (Phases 1–3) and names those still planned |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §10 (data architecture) |

## 1. Bounded contexts

| Context | Core concepts | Status | Details |
|---|---|---|---|
| Identity and tenancy | Principal, organisation, workspace, membership, invitation, role, permission | Implemented (Phase 1) | [MULTITENANCY.md](MULTITENANCY.md), [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) |
| Legal knowledge | Jurisdiction, legal source, authority, authority version, passage, relationship, coverage | Implemented (Phase 2; no content yet) | [PHASE_2_PLAN.md](PHASE_2_PLAN.md) |
| Evidence | Evidence item, file version, extraction, passage, entity, event, factual proposition, link, redaction, custody event | Implemented (Phase 3) | [EVIDENCE_ARCHITECTURE.md](EVIDENCE_ARCHITECTURE.md) |
| Research | Research project, query, run, finding, claim ledger | Planned (Phase 4) | — |
| Reasoning | Legal issue, rule, argument node and edge, counterargument | Planned (Phase 5) | — |
| Verification | Citation, source and currency checks; human review | Planned (Phases 4 and 6) | — |
| Documents | Document, version, template, review, approval, export | Planned (Phase 7) | — |
| Matters | Matter, party, deadline, task, status history | Planned (Phase 8) | — |
| Commercial | Plan, subscription, entitlement, usage | Identity implemented (Phase 1); billing in Phase 11 | — |
| Audit | Security audit event (hash-chained) | Implemented (Phases 1 and 3) | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) |

## 2. Core definitions

| Term | Definition |
|---|---|
| **Principal** | An authenticated identity known to Njumeni, mapped immutably to a provider subject |
| **Organisation** | The tenant. Every individual has a personal organisation |
| **Workspace** | An isolated work context in an organisation; the unit of evidence and research scope |
| **Legal authority** | A law, regulation, judgment, treaty or similar, identified by source and external ID |
| **Authority version** | Immutable text of an authority, valid for a period (valid time) and recorded at a moment (system time) |
| **Evidence item** | A piece of evidence in a workspace, with classification, sensitivity, privilege and legal-hold state |
| **Evidence file** | One immutable version of the original bytes, identified by SHA-256 |
| **Passage** | A span of extracted text with exact offsets and a hash, the unit of citation for evidence |
| **Factual proposition** | A statement of fact, alleged, established, disputed or withdrawn |
| **Evidence link** | Evidence (optionally a passage) that *supports*, *contradicts* or *qualifies* a proposition |
| **Custody event** | A hash-chained record of an action on an evidence item |

## 3. The evidence-to-law chain

| Link | Implemented in | Phase |
|---|---|---|
| Evidence (E) → passage | `evidence_passages` | 3 ✅ |
| Passage → factual proposition (F) | `evidence_proposition_links` | 3 ✅ |
| Proposition → legal issue (L) | Reasoning | 5 |
| Issue → legal authority (A), as in force on the event date | `legal_authority_version_as_of` + reasoning | 2 ✅ / 5 |
| Reasoned assessment | Argument graph + verification | 5–6 |

## 4. Invariants

1. Every evidence item belongs to exactly one workspace of exactly one organisation; links never cross workspaces.
2. Original files and extracted text are immutable; corrections are new versions or new records.
3. Nothing is readable before a clean scan by the trusted worker.
4. Every action on evidence is in the item's custody chain; every security-relevant action is in the audit chain.
5. Legal text is selected by the date of the relevant event, not by today's date.
