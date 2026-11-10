# Njumeni engineering standards

- **Status:** Phase 0 task 0.8 standard
- **Applies to:** all Njumeni application code, tests, scripts, migrations, infrastructure and documentation
- **Architecture authority:** ADR-0001 and the A–M module/layer maps
- **Enforcement:** normative now; automated formatter, linter, type-check and test enforcement is implemented in task 0.10 after the reproducible environment/toolchain is established.

## 1. Non-negotiable engineering principles

1. Preserve the canonical A–M module names, eight platform layers, bounded-context ownership and dependency direction.
2. Keep the initial product a modular monolith. Do not introduce microservices, frameworks or infrastructure without a documented need and approval.
3. Keep domain logic independent of UI frameworks, database clients, queues, cloud vendors and model-provider SDKs.
4. Use TypeScript strictness for application code. Do not weaken compiler settings to make a failing change pass.
5. Validate all untrusted inputs at system boundaries. TypeScript types do not validate runtime input.
6. Enforce authentication, tenant, workspace, matter and action permissions server-side and at database/storage boundaries. The UI is not a security boundary.
7. Preserve document, evidence, legal-source, passage, citation, retrieval and AI-run provenance.
8. Treat original customer documents and legal-source versions as immutable records; changes create new versions or explicit status events.
9. Keep confidential customer content, secrets, production records and classified material out of Git, test fixtures, CI logs and deployment artefacts.
10. No AI-generated legal content is implicitly verified, approved or authorised for submission.

## 2. Language and technology conventions

The product's approved baseline is:
- Frontend: Next.js, React and TypeScript.
- Styling/components: Tailwind CSS and shadcn/ui.
- Backend/runtime: Node.js and TypeScript.
- Validation: Zod at API, job, event and external-provider boundaries.
- Forms/server state/client state/editor/viewer/graph: React Hook Form, TanStack Query, Zustand, TipTap, PDF.js and React Flow where their respective workflows require them.
- Persistence and platform services follow the approved architecture decisions; this document does not authorise adding a dependency or deploying a service by itself.

Use the repository's pinned Node.js and package-manager versions once established in task 0.9. Do not use unpinned global tools for reproducible builds.

## 3. Formatting and file conventions

- UTF-8 text; LF line endings; final newline required.
- Two spaces for indentation in TypeScript, JSON, YAML and Markdown code examples.
- Prettier is the canonical formatter; proposed shared settings: 100-character print width, two-space tabs, single quotes in JS/TS, semicolons, trailing commas where valid.
- Do not manually reformat unrelated files in a feature change.
- Markdown headings use sentence case; use one H1 per document and do not skip heading levels.
- File and directory names use lowercase kebab-case unless a framework requires a conventional name (for example, Next.js route files or README.md).
- React components and component types use PascalCase.
- Variables, functions and methods use camelCase.
- Types, interfaces, classes and enums use PascalCase.
- Constants use UPPER_SNAKE_CASE only for true module-level constants; ordinary immutable local values remain camelCase.
- Database tables/columns and SQL functions use snake_case; tables are plural where consistent with the owning schema.
- API paths use lowercase, plural resource nouns and stable versioning where an external contract requires it.
- Domain events use past-tense PascalCase names (for example, EvidenceRegistered, MatterStatusChanged) and carry explicit schema versions.
- Environment variables use UPPER_SNAKE_CASE. Only public, non-secret browser configuration may use a framework's public prefix.

## 4. TypeScript and code quality

- Enable strict: true; retain noImplicitAny, strictNullChecks, noUncheckedIndexedAccess and exactOptionalPropertyTypes unless a documented compatibility decision justifies a narrowly scoped exception.
- Avoid any. Prefer unknown at untrusted boundaries and narrow it with runtime validation.
- Do not use non-null assertions to silence uncertainty; validate or model the state explicitly.
- Use discriminated unions for stateful workflows and result/error variants.
- Keep functions small and cohesive; separate orchestration from domain rules.
- Prefer immutable inputs/outputs and explicit dependencies over hidden global state.
- Avoid circular imports and cross-context private imports. Context-to-context communication uses published contracts.
- No direct SQL/table writes into another bounded context's owned records.
- Avoid premature abstraction, generic frameworks and duplicated infrastructure.
- No disabled lint/type rules without a comment explaining the specific risk and a linked follow-up decision.

## 5. Naming and domain language

Use the canonical domain vocabulary from the master plan and domain map. Distinguish:
- user, organisation, workspace and matter;
- original document, document version, evidence item, extracted passage and derived processing artefact;
- legal authority, authority version, provision and source passage;
- fact, allegation, inference, claim, issue, rule, argument and counterargument;
- AI output, verification result, human review and human approval.

Do not use these terms interchangeably. A user-facing label may be plain-language, but the underlying domain model must preserve the distinction.

## 6. Validation, errors and API contracts

- Validate HTTP input, uploaded metadata, queue payloads, events, environment configuration and third-party responses at runtime with explicit schemas.
- Reject unknown or invalid privileged fields; never accept a client-provided tenant/matter identifier as proof of access.
- Use stable machine-readable error codes and safe user-facing messages. Keep internal diagnostics separate from public responses.
- Do not return stack traces, SQL, provider credentials, internal prompts or sensitive source content to clients.
- Model expected failures as typed results or domain errors; do not swallow exceptions.
- Catch errors only where the layer can add context, retry safely, translate the error or terminate the workflow.
- Retries must be bounded, observable and idempotent. Do not retry non-idempotent actions without an idempotency key or equivalent guard.
- API contracts must document authentication, permission scope, request/response schema, error codes, pagination, idempotency and versioning where applicable.
- Breaking contract changes require an explicit compatibility/migration plan.

## 7. Logging, telemetry and audit

- Use structured logs with timestamp, severity, service/module, environment, correlation/request ID, trace ID where available, and stable event/error code.
- Never log raw legal documents, evidence text, full prompts, access tokens, passwords, API keys, session cookies, payment details or other sensitive personal data.
- Prefer opaque record IDs and minimised metadata; ensure the IDs themselves do not reveal sensitive content.
- Redact provider responses and user input by default. Add narrowly scoped, reviewed diagnostics only where necessary.
- Operational logs are not the legal audit trail. Sensitive business actions require explicit audit events with actor, tenant/workspace/matter scope, action, target reference, timestamp and outcome.
- Audit records must be access-controlled and tamper-evident; no ordinary application path may silently edit or delete them.
- Define retention and access policies for logs, traces and audit records before production.

## 8. Security and privacy coding rules

- Least privilege by default; deny access when scope cannot be resolved.
- Re-authorise sensitive actions in workers at execution time; queue payloads do not grant permissions.
- Use private object storage and short-lived, server-authorised download mechanisms.
- Do not expose provider keys or privileged credentials to browsers.
- External model/provider calls require an explicit, policy-controlled data-egress decision and approved processing terms.
- Never use customer documents, client material or private matter content as fixtures or model-training material without an explicit lawful and contractual basis.
- Use synthetic or properly anonymised test data only.
- Treat logs, analytics, exports, caches and search indexes as potential copies of confidential data and apply equivalent access controls.
- Dependencies and upstream code require security, licence, data-rights and maintenance review before adoption.

## 9. Testing conventions

- Unit tests cover domain rules and pure transformations.
- Integration tests cover database, storage, queue, provider adapters and bounded-context contracts.
- API tests cover schema validation, authentication, authorisation and stable errors.
- Security tests include negative tenant/matter access, privilege escalation, IDOR, storage access, prompt/tool permissions and audit integrity.
- End-to-end tests cover complete user journeys, not isolated screens.
- Legal-intelligence tests use licensed or synthetic material and measure source grounding, citation correctness, legal currency, jurisdiction selection, extraction and uncertainty handling.
- Tests must be deterministic where possible; isolate network/provider dependencies behind fakes or recorded fixtures.
- A failing test must not be deleted, skipped or weakened merely to obtain a green build. Any quarantine needs an owner, reason and expiry/follow-up issue.

## 10. Review and change management

Every pull request/change must:
- identify the task, module, bounded context and platform layer affected;
- describe user-visible and data/security effects;
- identify migrations, API/event changes and backward-compatibility impact;
- include tests for positive and negative permission cases where relevant;
- update architecture, API, operations or legal-governance documents when behaviour changes;
- include evidence that relevant checks passed;
- identify licence or third-party changes;
- avoid unrelated refactors and generated artefacts.

Reviewers must check domain ownership, dependency direction, tenant/matter scope, provenance, privacy/logging, failure/retry behaviour, migration safety and test coverage. Security-sensitive, migration, permission and legal-verification changes require explicit specialist review before release.

## 11. Commit and branch conventions

- Use short-lived task branches from the designated integration branch.
- Commit messages use Conventional Commits: type(scope): imperative summary.
- Approved types include feat, fix, docs, test, refactor, build, ci, chore and security.
- Keep each commit focused on one coherent task or document change.
- Do not commit secrets, generated build output, local databases, customer data or unreviewed vendor code.
- A task is not green until its commit SHA and required workflow/test results are verified and recorded in the Phase Register.

## 12. Enforcement plan

| Standard | Required enforcement | Phase 0 task |
|---|---|---|
| Formatting | Prettier check and EditorConfig | 0.10 |
| Linting | ESLint with TypeScript and framework rules | 0.10 |
| Type safety | TypeScript strict type-check | 0.10 |
| Runtime validation | Zod schemas and boundary tests | 0.10 / feature phases |
| Unit/integration/API tests | Test runner and CI jobs | 0.10 |
| Secret/content policy | Existing repository-security workflow; extend as needed | 0.10 |
| Dependency/licence review | Lockfile, audit and third-party register checks | 0.10 / ongoing |
| Architecture boundaries | Import/dependency checks and code review | 0.10 / ongoing |
| Migration discipline | Ordered migrations and replay/drift tests | 0.11 |
| Tenant/matter security | RLS, storage and negative-access tests | Phase 1 onward |

## 13. Explicit non-decisions

This standard does not select final logging, test-runner, package-manager, monorepo-task-runner, API-framework, queue, deployment or monitoring vendors. Those choices must be verified against the repository and environment in tasks 0.9–0.13. It also does not authorise adding application code or live infrastructure before the relevant phase gate.
