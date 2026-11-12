# Phase 10 — Enterprise and institutional systems

| Field | Value |
|---|---|
| Phase state | 🔵 **IMPLEMENTED: verified locally.** Formal closeout pending §5 |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md): Module J (enterprise), Module K (institutional), Module L (compliance and risk), §16 (administration and platform operations), U-14 (EU AI Act), [ADR-0002](architecture/ADR-0002-identity-tenancy-security.md) deferred item 4 (break-glass) |
| Execution mode | Owner-directed continuous autonomous mode: one commit per completed phase |
| Depends on | Phases 1, 5, 8 and 9 |
| Acceptance (master plan) | Enterprise isolation and SSO verified |

## 1. Objective

Run Njumeni for large organisations and public institutions:
- **Administration:** offices and teams, retention, single sign-on and API access.
- **Platform operations:** a back office whose operators **cannot see customer content** unless the customer grants time-limited, read-only access.
- **Compliance:** an obligation register anchored in verified law that detects regulatory change.
- **AI governance:** gating for workspaces that the EU AI Act treats as high-risk.

## 2. Design

| Element | Implementation |
|---|---|
| Offices and teams | `private.org_units` (offices and teams, nested) and their members (organisation members only). `matter_assign_team` assigns every eligible member (workspace member, not barred) to a matter. `org_structure`, `org_member_directory` |
| Platform operators | `private.platform_operators` (platform admin, support, knowledge admin, AI operations). `platform_overview` shows organisations (names, kinds, member and workspace counts), totals, AI activity, failures, refusals and cost, provider status, audit-chain validity and active grants. **It shows no customer content** |
| Break-glass support access | `support_access_request` (operator, with reason and 15–480 minutes) → `support_access_decide` (**only the customer's administrator**, never the operator; approve, deny, revoke) → while approved and unexpired, read permissions (`organization.read`, `workspace.read`, `matter.read`, `document.read`, `research.read`) for that organisation only. Implemented by wrapping the unchanged role evaluator (renamed `has_permission_roles`) in `has_permission`, so every function inherits the rule. Writes are never granted. Expiry and revocation take effect immediately. All steps are audited |
| Retention | `retention_set_policy` per artefact class (closed matters, evidence, documents, research, AI executions). `retention_report` lists what is past its period; **evidence on legal hold is never due**. Disposal itself is a reviewed Phase 13 operation |
| Compliance obligations (Module L) | `private.compliance_obligations` anchored in an **approved, active authority passage** (source-linked rules, no generic risk scores), with owner, review interval and status. Assessments are append-only, with a note and optional evidence from the same workspace. `compliance_register` flags **review required** when an obligation is unassessed, overdue, or its law changed after the last assessment (a newer version, or amendment, repeal, replacement or overruling recorded since) |
| EU AI Act classification (U-14) | Workspaces are `standard` or `high_risk_justice`, set by organisation administrators. The public `ai_authorise_execution` refuses every agent (`AI_CONFORMITY_REQUIRED`) in a high-risk workspace until a conformity assessment reference is recorded. The Phase 5 authoriser is kept unchanged as `private.ai_authorise_execution_base`, which clients cannot call |
| Institutional reporting | `institutional_report` gives per-workspace aggregates (AI classification and conformity, matters, overdue deadlines, approved documents, obligations and non-compliance, AI runs and refusals) plus pending reviews, conflict checks and active support grants. Open to administrators and auditors; **no content** |
| SSO readiness | `sso_configure` (SAML or OIDC, issuer, metadata URL, enforced). **SSO cannot be enforced before a domain is verified.** `sso_add_domain` returns a DNS TXT challenge, and a platform operator confirms ownership (`platform_verify_sso_domain`). `sso_discover(email)` (pre-sign-in) reveals only whether SSO is enforced for the domain and its protocol, never the organisation. Connecting the identity provider to Supabase Auth SAML needs the hosted project (Stage 2) |
| Enterprise API keys | `api_key_create` (workspace managers): `njk_<prefix>_<secret>`, shown **once**, stored as SHA-256, with scopes (`research.read`, `matters.read`) and an expiry (≤ 365 days). Keys can be revoked and record their last use. Requests use `Authorization: Bearer`: the key resolves inside the database and **acts as its creator** for that transaction, so roles, barriers and workspace scope still apply, and the key's scopes narrow them further. Endpoints: `GET /api/v1/research/runs/{id}` and `GET /api/v1/matters`, documented in OpenAPI 3.1 with security schemes. **The web app still holds no service-role key** |
| Interface | `/organisation` (structure, AI classification, retention, SSO, support access, API keys with one-time display); `/compliance` (register, assessments, new obligations from verified provisions); `/institutional`; `/admin` (operators only; others get 404) |

## 3. Tasks

| # | Task | State |
|---|---|---|
| 10.1 | Offices and teams; team assignment to matters | ✅ |
| 10.2 | Platform back office without content access | ✅ |
| 10.3 | Break-glass support access (ADR-0002 item 4) | ✅ |
| 10.4 | Retention policies and report (legal hold respected) | ✅ |
| 10.5 | Compliance obligation register with regulatory change detection | ✅ |
| 10.6 | EU AI Act risk classification gating AI | ✅ |
| 10.7 | Institutional reporting | ✅ |
| 10.8 | SSO readiness (configuration, domain verification, discovery) | ✅ |
| 10.9 | Enterprise API keys and key-authenticated endpoints | ✅ |
| 10.10 | Live SAML/OIDC sign-in | ⏸ Hosted Supabase Auth SSO (Stage 2, Phase 13) |
| 10.11 | Custom deployments (dedicated or self-hosted) | ⏸ Documented option for institutional contracts; no code needed until a customer requires it |

## 4. Verification (local, 2026-11-12)

| Check | Result |
|---|---|
| pgTAP | **627/627** in 21 files (`enterprise_institutional` 46/46). Every earlier suite passes unchanged with the wrapped permission and AI authorisation functions |
| Application tests | **243/243** (`enterprise` 2; API contract extended to `/matters` and key-authenticated research) |
| Root tests and release gates | 24/24; 12 gates evidenced (RG-01 now includes operator isolation and read-only support access; RG-06 the AI conformity gate) |
| Type check, Prettier (CI set), content policy, migration guard, `next build` | ✅ |
| End-to-end over HTTP on the built app (synthetic) | ✅ See below |

pgTAP covers:
- units, membership limited to organisation members, team assignment, members cannot restructure;
- support access:
  - operators are denied by default but see metadata;
  - an operator cannot self-approve; a member cannot grant; customers cannot use the back office;
  - an approved grant reads but cannot write; revoked and expired grants give nothing; expired grants are listed as expired;
- retention;
- compliance: the source must be approved; unassessed → review; assessed → no review; append-only assessments; a later version of the law is detected;
- AI classification: members cannot change it; high-risk blocks AI; the base authoriser cannot be called directly; a conformity record unblocks; the report shows the class;
- SSO: enforcement requires a verified domain; operator verification; anonymous discovery;
- API keys: shown once, only the hash is stored, key access works without a session, scope is enforced, unknown keys are refused.

End to end with a real administrator and a real support operator:
1. An institution was created.
2. A high-risk workspace refuses AI (`AI_CONFORMITY_REQUIRED`).
3. API key over HTTP: research run read; `/matters` without scope → **403**; forged → **401**; malformed → **401**; revoked → **401**. The session `/matters` lists the matter.
4. `/admin` → 200 for the operator, **404** for the customer.
5. The operator was denied the matter page (404). After the customer approved, the operator could read it (200).
6. `/organisation`, `/compliance` and `/institutional` render the classification ("AI blocked"), support access, API keys and the register.
7. The audit log records the classification, key creation, request, approval and revocation, and the hash chain is valid.

## 5. Closeout conditions outstanding

| # | Condition | Dependency |
|---|---|---|
| 1 | ~~CI green on the Phase 10 commit~~ ✅ `29a526e`: runs `43135869994` (CI and security) and `43135870022` (database verification), both successful | Done |
| 2 | **SSO verified against a real identity provider** (master plan acceptance) | Hosted Supabase Auth SAML (Stage 2) |
| 3 | Conformity assessment content for high-risk deployments (§11.6) | Legal and regulatory work before any justice-sector customer |
| 4 | Phases 3–9 closed | Their own closeout items |

## 6. Decisions

- **Wrap, don't rewrite, the security core.** Break-glass and AI conformity are added by renaming the proven functions and putting a thin wrapper in front. The original logic is untouched, and every existing test still runs against it.
- **The customer holds the key to support access.** Operators can only ask. Grants are short, read-only and audited, and the customer sees and can revoke them.
- **API keys are delegations, not service accounts.** A key can never do more than the person who issued it, and less if its scopes say so. Revoking that person's access (or a barrier) also limits the key.
- **High-risk AI is off until it is lawful.** The default for justice-sector workspaces is "no AI", not "AI with a warning".
