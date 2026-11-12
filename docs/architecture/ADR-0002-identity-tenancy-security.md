# ADR-0002: Identity, tenancy and security architecture

- **Status:** **Accepted** (11 November 2026, at Phase 1 closeout). Originally proposed 10 November 2026 as the Phase 1 task 1.1 foundation contract. §12 records how each open decision was resolved or deferred
- **Date:** 10 November 2026
- **Decision scope:** identity, sessions, principals, organisations, workspaces, memberships, authorisation, RLS and audit boundaries
- **Depends on:** ADR-0001 modular monolith and bounded contexts; original master implementation plan sections 2, 7, 9, 10, 11, 12, 15, 16 and 19

## 1. Context

Njumeni serves individuals, legal professionals, law firms, enterprises and institutions. Its matters and evidence may contain highly confidential personal, commercial, employment, immigration, medical, litigation or institutional information. Identity and tenant isolation are therefore foundational controls, not optional application features.

The original master plan identifies Supabase Auth, PostgreSQL, role-based access control and PostgreSQL row-level security as the intended baseline. This ADR preserves that direction while requiring verification against a dedicated Njumeni environment. It does not claim that a Njumeni Supabase project or production trust boundary currently exists.

## 2. Decision

Adopt a layered identity and authorisation model:

1. **Identity provider:** Supabase Auth as the planned authentication provider, subject to dedicated-environment verification in task 1.2.
2. **Principal:** Njumeni maps the authenticated provider subject to an internal principal/user record. Provider identity is not itself tenant membership.
3. **Organisation:** a tenant boundary representing an individual-owned or organisation-owned account context.
4. **Workspace:** a scoped working area owned by an organisation/tenant, with its own members, resources and policy constraints.
5. **Membership:** an explicit relationship between a principal and an organisation/workspace, with lifecycle state and assigned role(s).
6. **Permission catalogue:** explicit named permissions; roles are collections of permissions, not hard-coded UI labels.
7. **Authorisation enforcement:** server-side application policy checks at every use-case boundary, backed by PostgreSQL RLS on tenant-owned data.
8. **Audit:** security-relevant changes and access decisions emit structured audit events.
9. **Storage:** private object storage is scoped by tenant/workspace and accessed through server-authorised, short-lived operations; storage paths are not authorisation.
10. **Background work:** jobs carry a validated tenant/workspace context and least-privilege service identity; workers re-check resource scope before acting.

Authentication answers who the principal is. Authorisation answers what that principal may do, to which resource, in which tenant/workspace, under which context. These are separate decisions.

## 3. Core domain concepts

| Concept | Meaning | Security rule |
|---|---|---|
| Principal | Authenticated human or explicitly registered service identity | Provider subject must map to a known active Njumeni principal |
| User profile | Njumeni-owned profile attributes | Profile fields never grant privileges |
| Organisation | Tenant/account boundary | Every organisation-owned record carries an organisation scope |
| Workspace | Work area within an organisation or individual account | Workspace membership and resource access are independently checked |
| Membership | Principal's relationship to organisation/workspace | Must be active and explicitly scoped |
| Role | Named bundle of permissions | Role assignment is server-controlled and audited |
| Permission | Atomic action on a resource class | Deny by default; explicit policy required |
| Resource | Matter, document, evidence item, research object or other protected record | Must resolve to an authoritative tenant/workspace owner |
| Session | Authenticated interaction context | Expiry, revocation and identity state are checked server-side |
| Invitation | Time-limited proposal to establish membership | Bound to target organisation, intended identity/email, expiry and single-use state |
| Audit event | Record of security-relevant activity | Append-only from ordinary application paths; sensitive content excluded |

An individual may own a personal organisation/workspace context; this avoids creating a separate bypass around the same tenant-isolation controls.

## 4. Trust boundaries and request flow

A protected request must follow this sequence:

1. Validate the session with the identity provider/server-side session adapter.
2. Resolve the internal principal from the authenticated provider subject.
3. Resolve the requested organisation/workspace from server-authoritative records.
4. Confirm active membership and current role assignments.
5. Evaluate the required permission against the target resource and action.
6. Execute the use case through the owning bounded context.
7. Execute database operations under a correctly scoped database identity/context so RLS independently enforces row boundaries.
8. Record the security-relevant outcome in the audit system.
9. Return only data authorised for the resolved context.

Client-supplied `user_id`, `organisation_id`, `workspace_id`, role, permission, storage key or resource ownership values are untrusted input. They may select a requested context but cannot establish authority.

## 5. Deny-by-default authorisation contract

- No session, invalid session, expired session or revoked session: deny.
- Unknown or disabled principal: deny.
- Missing, pending, suspended or revoked membership: deny.
- Missing tenant/workspace context: deny for scoped resources.
- Resource owner does not match resolved tenant/workspace: deny.
- Permission is absent or policy evaluation errors: deny.
- Resource not found and resource not authorised should not leak cross-tenant existence through distinguishable responses where inappropriate.
- Role changes, membership revocation and invitation acceptance are server-authorised and audited.
- UI visibility is never an authorisation mechanism.
- Service-role or database-owner privileges are not used in ordinary user request paths.

## 6. Initial permission model

The exact role catalogue and matrix will be finalised in task 1.7. The architecture must support, at minimum, the following permission dimensions:

- principal and profile administration;
- organisation/workspace administration;
- member and invitation administration;
- matter creation, read, update, archive and delete;
- document/evidence upload, read, annotate, export and delete;
- research creation, read, share and export;
- drafting, review, approval and publication;
- audit-event access;
- billing and entitlement administration;
- platform support/operations access under separately controlled, audited break-glass rules.

Do not assume that a single global role such as `admin` grants access to every organisation or matter. Privileges are scoped and contextual.

## 7. Database and RLS contract

- Every tenant-owned table must have an explicit tenant key; workspace-owned records also have a workspace key where appropriate.
- Ownership relationships must be referentially consistent and cannot be changed by arbitrary client updates.
- RLS is enabled on every exposed tenant-owned table before application access is enabled.
- Policies cover SELECT, INSERT, UPDATE and DELETE separately as appropriate.
- UPDATE policies enforce both row visibility and new-row ownership checks.
- SECURITY DEFINER helpers, if required, use a fixed safe search path, minimal grants, schema-qualified references and reviewed ownership.
- No client may write its own role, membership status, organisation ownership or trusted tenant context.
- Service-role access is server-only, narrowly scoped, monitored and never placed in browser bundles.
- Tests must execute as realistic non-owner/non-service principals; database-owner tests do not prove RLS.
- Cross-tenant negative tests are mandatory for every tenant-owned resource family.

## 8. Session and invitation security contract

Sessions must use secure transport and appropriate cookie protections; session refresh and revocation must be server-validated. Avoid storing long-lived privileged tokens in browser-accessible storage.

Invitations must be:
- generated with cryptographically secure, non-guessable tokens;
- stored as hashes where feasible;
- single-use and expiring;
- bound to the intended organisation/workspace and intended identity/email;
- revocable before acceptance;
- protected against replay, enumeration and privilege escalation;
- audited at creation, delivery attempt, acceptance, expiry and revocation.

Invitation acceptance must not allow the client to choose its own role or tenant scope.

## 9. Audit and privacy contract

Security audit events should contain:
- event ID and timestamp;
- actor principal and actor type;
- organisation/workspace scope;
- action and target resource identifier/type;
- outcome and reason code where safe;
- correlation/request ID;
- relevant authentication/session context without raw secrets.

Do not place legal document contents, full evidence text, access tokens, credentials or unnecessary personal data in ordinary logs. Audit access itself is permission-controlled. Retention, legal hold, tamper evidence and export policy must be specified before production use.

## 10. Threat model

| Threat | Required control | Verification |
|---|---|---|
| Client forges tenant/workspace ID | Resolve membership and ownership server-side; RLS context | Cross-tenant read/write negative tests |
| User changes own role or membership | Server-owned membership/role mutation use cases; DB constraints/RLS | Privilege-escalation tests |
| Inactive user retains access | Session revocation and membership-state check on protected requests | Revoked session/member tests |
| Invitation replay or theft | Single-use hashed token, expiry, identity binding and revocation | Replay, wrong-email and expired-token tests |
| IDOR across matters/documents | Resource-level policy check and tenant-aware queries | Random-ID cross-tenant tests |
| Privileged key leaks to browser | Server-only secrets, bundle scanning and narrow service interfaces | Build/env inspection and secret scan |
| RLS bypass via privileged function | Minimal SECURITY DEFINER surface, safe search path, reviewed grants | SQL review and tests under non-owner principals |
| Worker confused-deputy access | Signed/validated job context, least privilege and re-check before mutation | Cross-tenant job injection tests |
| Storage object path guessing | Private buckets, server-authorised signed access, tenant-bound object metadata | Cross-tenant download/upload tests |
| Audit log contains confidential content | Structured allow-listed event schema and redaction | Log-schema tests and review |
| Role change race/stale permissions | Transactional updates, current membership checks and cache invalidation | Concurrency/revocation tests |
| Enumeration of users/resources | Rate limits, generic failure semantics and scoped search | API behaviour tests |

## 11. Implementation boundaries

- Identity and organisation/membership domain logic belongs to the identity/organisation bounded context.
- Matter/document/evidence contexts own their resources and expose explicit authorisation-aware application contracts.
- Shared policy contracts may be used as a small kernel; contexts must not directly mutate one another's tables.
- The web layer may request actions but cannot decide access.
- Database access and identity-provider SDKs remain infrastructure adapters behind application-facing ports.
- This ADR does not authorise premature microservices or cross-context direct database writes.

## 12. Decisions still required before implementation

1. Verify the dedicated Njumeni Supabase project and its region; do not infer it from other products.
2. Confirm whether individual accounts are represented as personal organisations or another tenant subtype; default recommendation is a personal organisation to reuse the same isolation model.
3. Approve initial role catalogue and permission matrix in task 1.7.
4. Define support/break-glass access and approval/audit rules before any operator access to customer matters.
5. Select session duration, refresh/revocation behaviour and MFA requirements based on risk and provider capability.
6. Define audit retention, legal hold and export requirements.
7. Confirm production data classification, hosting authorisation and data residency before real legal data is accepted.

### 12.1 Resolution at acceptance (11 November 2026)

| # | Decision | Outcome | Evidence / owner phase |
|---|---|---|---|
| 1 | Dedicated Supabase project and region | **Resolved.** Project `Njumeni` (`vvjpsejeeffykaozfbik`), `eu-north-1`. No migrations are applied until all phases are complete (ADR-0003 §2.5) | Task 1.2 |
| 2 | Representation of individual accounts | **Resolved.** Personal organisations, using the same isolation model | Task 1.5 (implemented and pgTAP-verified) |
| 3 | Initial role catalogue and permission matrix | **Resolved.** Catalogue and scoped bindings implemented in `20261110164705_role_permission_foundation.sql` | Task 1.7 (`role_permission.test.sql`, 60/60) |
| 4 | Support/break-glass access | **Implemented in Phase 10** (migration `20261112500000`). Operators have no default access. A support operator requests access with a reason and duration (15–480 minutes); only the customer's organisation administrator can approve, deny or revoke it, never the operator. An approved grant gives **read-only** access to that organisation until it expires. Every step is audited. See [Phase 10 plan](../PHASE_10_PLAN.md) | Done (Phase 10) |
| 5 | Session duration, refresh/revocation, MFA | **Partly resolved.** Supabase defaults; refresh-token revocation on sign-out verified against a live Auth service (local stack, 11 November 2026). MFA (passkeys/TOTP) is required before R1. Leaked-password protection is an accepted Stage 0 risk (ADR-0003 §2.6) | Task 1.3; MFA before R1 |
| 6 | Audit retention, legal hold and export | **Deferred.** Sign-in, sign-out, refresh and revocation are recorded by the provider's `auth.audit_log_entries`; application audit is append-only. Failed-sign-in and denied-access events, hash-chaining, retention and legal hold are delivered with evidence custody | Phase 3 (master plan U-11, U-12) |
| 7 | Data classification, hosting authorisation, residency | **Deferred.** Synthetic data only at Stage 0; EU/EEA residency recommended (decision D-8) | Before Stage 1 |

## 13. Acceptance criteria for Phase 1 task 1.1

- [x] Identity is explicitly separated from tenant membership and authorisation.
- [x] Principal, organisation, workspace, membership, role, permission, resource, session and invitation concepts are defined.
- [x] Trust boundaries and protected request flow are documented.
- [x] Deny-by-default rules are explicit.
- [x] RLS, server-side authorisation and storage boundaries are specified.
- [x] Audit/privacy requirements are defined.
- [x] Threats are mapped to controls and verification.
- [x] Dependencies and owner/environment decisions are explicitly recorded.
- [x] Architecture is consistent with the original Njumeni plan and ADR-0001.
