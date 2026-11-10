# Phase 1.7 — Roles, permissions and server-side authorisation design

- **Status:** Approved for implementation
- **Date:** 10 November 2026
- **Depends on:** Tasks 1.1–1.6
- **Architecture authority:** ADR-0001, ADR-0002, Phase 1 security invariants
- **Database target:** dedicated Njumeni Supabase project `vvjpsejeeffykaozfbik`
- **Deployment boundary:** local replay and synthetic-principal tests only; no hosted schema deployment.

## 1. Objective

Introduce an explicit, versioned permission catalogue; scoped organisation/workspace roles; role bindings; a central deny-by-default permission evaluator; owner/admin-controlled assignment and revocation; and server-side guards at the existing organisation/workspace use-case boundaries.

Authentication, membership and authorisation remain separate. A role is never a global privilege, and the UI is never an access-control boundary.

## 2. Scope model

- **Organisation scope:** role bindings apply only inside one organisation.
- **Workspace scope:** role bindings apply only inside one workspace and require active organisation and workspace membership.
- **Organisation owner:** ownership remains an immutable field on the organisation, not a mutable role binding. The owner receives the defined owner authority in the permission evaluator.
- **No global customer role:** there is no customer-assignable global administrator role.
- **Platform operations:** support/break-glass access is excluded from customer roles and requires a later separately approved platform-operations design.

## 3. Permission catalogue

Permission keys are stable machine identifiers; labels and descriptions are presentation metadata. Application code must check permission keys, not role names.

Initial permissions cover the current identity and tenancy operations and establish explicit future domain actions:

- Profile: `profile.read_own`, `profile.update_own`.
- Organisation: `organization.read`, `organization.update`, `organization.manage_members`, `organization.manage_roles`, `organization.manage_workspaces`.
- Workspace: `workspace.read`, `workspace.update`, `workspace.manage_members`, `workspace.manage_roles`.
- Matter: `matter.create`, `matter.read`, `matter.update`, `matter.archive`, `matter.delete`.
- Documents/evidence: `document.upload`, `document.read`, `document.annotate`, `document.export`, `document.delete`, `evidence.manage`.
- Research/reasoning: `research.create`, `research.read`, `research.share`, `research.export`, `argument.manage`.
- Drafting/review: `draft.create`, `draft.update`, `draft.review`, `draft.approve`, `draft.publish`.
- Governance: `audit.read`, `billing.read`, `billing.manage`.

Future permissions are catalogue entries only until their owning use-case context exists. A catalogue entry does not claim that the associated feature is implemented.

## 4. Built-in role catalogue

### Organisation roles

- **Organisation administrator** — manages organisation profile, members, invitations, workspaces and scoped role assignment, but cannot transfer ownership, assign another organisation administrator, or access platform operations.
- **Organisation member** — reads organisation context and may enter only workspaces to which they have active workspace membership and suitable workspace permissions.
- **Billing manager** — reads/manages billing context only; no matter/document access is implied.
- **Organisation auditor** — reads permitted organisation audit summaries; no mutation authority is implied.

### Workspace roles

- **Workspace manager** — manages workspace settings, membership and workspace role assignments; no authority over other workspaces or organisation ownership.
- **Workspace editor** — creates/updates matters and documents, manages evidence and research within the assigned workspace.
- **Workspace reviewer** — reads workspace materials, reviews drafts, and performs permitted review/verification actions; cannot publish or administer membership.
- **Workspace viewer** — read-only access to explicitly permitted workspace resources.

Built-in roles are immutable system definitions in this task. Custom roles, per-customer permission editing, temporary/delegated roles and approval chains are future capabilities.

## 5. Role/permission matrix

- Organisation owner: all organisation and descendant workspace permissions, excluding global platform-operation permissions.
- Organisation administrator: organisation read/update, member/invitation administration, workspace creation/administration and non-admin role assignment; cannot assign/revoke another org administrator or grant billing or audit permissions.
- Organisation member: organisation read only; no automatic workspace membership.
- Billing manager: organisation read plus billing read/manage only.
- Organisation auditor: organisation read plus audit read only.
- Workspace manager: workspace read/update/member/role administration and all workspace operational permissions except draft publication where the organisation owner has not explicitly enabled that capability.
- Workspace editor: workspace read, matter create/read/update, document upload/read/annotate, evidence manage, research create/read/share/export, draft create/update.
- Workspace reviewer: workspace read, matter read, document read, research read, draft review and argument verification.
- Workspace viewer: workspace read, matter read, document read and research read.

Role permission grants are stored as rows and seeded by migration. The application never hard-codes an assumption that a role name implies a permission.

## 6. Database contracts

Private, non-Data-API tables:

- `private.permission_catalog`: permission key, description, applicable scope, active/system flags.
- `private.role_catalog`: role key, scope, display label, description, immutable system marker.
- `private.role_permissions`: many-to-many role/permission grants.
- `private.organization_role_bindings`: organisation, principal, role, assigner and timestamp.
- `private.workspace_role_bindings`: workspace, principal, role, assigner and timestamp.
- `private.role_audit_events`: append-only assignment/revocation events with actor, target, scope, role, action, time and safe metadata.

All private tables have RLS enabled and ordinary direct privileges revoked. Customer-facing role metadata and binding views are exposed only through narrow authenticated RPCs returning the minimum fields needed by the UI.

Role binding constraints:
- One binding per principal/scope/role.
- Target principal must have active membership in the organisation; workspace roles also require active workspace membership.
- Role scope must match the binding scope.
- Role definitions and permission grants are system-managed and immutable to customer users.
- No caller can submit an actor principal, binding owner, permission list or privilege override.
- Owner identity is resolved from the authenticated provider subject and active principal mapping.

## 7. Central permission evaluator

`private.has_permission(permission_key, organisation_id, workspace_id)` is the sole database permission predicate:

1. Require `auth.uid()` and an active Njumeni principal.
2. Resolve the organisation from the supplied organisation/workspace context; reject mismatched IDs.
3. Reject inactive organisation/workspace and missing/invalid membership.
4. Grant owner authority only when the principal is the immutable organisation owner.
5. For organisation requests, evaluate active organisation role bindings.
6. For workspace requests, require active organisation membership and active workspace membership, then evaluate both organisation-level grants applicable to the requested workspace action and workspace-specific grants.
7. Return false for unknown permission, missing context, inactive principal/membership, mismatched scope or any exception path.

A narrow public RPC returns only a boolean for the authenticated caller. Internal database policies call the private predicate directly.

## 8. Assignment and revocation rules

- Organisation owner may assign/revoke any built-in organisation role and workspace role in their organisation, except no operation can create a customer-facing global role.
- Organisation administrator may assign/revoke only the non-privileged organisation member role and workspace roles below workspace manager; cannot grant or revoke org admin, billing manager or auditor.
- Workspace manager may assign/revoke only editor, reviewer and viewer roles in that workspace.
- A principal cannot grant a role with permissions exceeding the assigner's own effective grant set.
- The owner cannot be removed from immutable owner status. Owner authority is not represented by a role binding.
- Assignment/revocation is transactional, validates active membership, records an audit event and takes effect on the next permission evaluation.
- Revoking/suspending membership makes all associated scoped role bindings ineffective immediately; bindings may be retained for audit and reactivation decisions, but cannot confer access while membership is inactive.

## 9. Application integration

- Add server-only permission helper(s) that resolve the authenticated user and call the central permission RPC.
- Add explicit route/use-case guards for organisation and workspace settings operations.
- Replace owner-only checks on invitation, membership and workspace administration with named permission checks where the role matrix allows it.
- Preserve ownership invariants and database constraints; never trust role keys from the browser without server/database validation.
- Add role management UI to organisation/workspace settings with only the roles the caller is authorised to assign.
- Display role labels and scope; do not expose private permission rows or security-definer internals.
- No role assignment is accepted from public sign-up or user-editable metadata.

## 10. Verification

Local pgTAP tests must cover:
- Unknown permission and missing context deny.
- Owner receives only the scoped owner authority.
- Each built-in role grants exactly its seeded permissions and no others.
- Organisation roles do not confer membership in unrelated workspaces.
- Workspace roles do not cross workspace or organisation boundaries.
- Inactive organisation/workspace/principal and suspended/revoked membership deny.
- Role assignment requires authority and active membership.
- Admin cannot grant/revoke org admin, billing manager or auditor.
- Workspace manager cannot grant/revoke workspace manager.
- A caller cannot assign a role with permissions exceeding their effective grant set.
- A principal cannot self-assign or mutate private role bindings.
- Role catalog and role-permission definitions cannot be changed through the Data API.
- Revocation takes effect on the next permission evaluation.
- Role assignment/revocation creates private audit events.
- Security-definer function grants are minimal and anonymous execution is denied.

Application tests must cover unauthenticated actions, role-key validation, permission guard outcomes, owner/admin/member visibility, role assignment UI and error handling. CI requires clean migration replay, generated type verification, database lint, pgTAP, web tests, type-check and production build.

## 11. Explicit exclusions

- No global platform super-admin role.
- No support/break-glass access.
- No custom role builder or customer-editable permission grants.
- No cross-tenant role inheritance.
- No automatic access to all workspaces from organisation membership.
- No hosted schema migration or confidential customer data use.
- Audit retention/tamper evidence remains Task 1.9; this task creates only the role-domain event foundation.
