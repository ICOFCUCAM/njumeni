# Njumeni — Multitenancy

| Field | Value |
|---|---|
| Status | Describes the **implemented** Phase 1 tenancy model (verified on a local stack, 11 November 2026) |
| Sources | [ADR-0002](architecture/ADR-0002-identity-tenancy-security.md); Task [1.5](PHASE_1_TASK_1_5_ORGANISATION_WORKSPACE_DESIGN.md), [1.6](PHASE_1_TASK_1_6_MEMBERSHIP_INVITATION_DESIGN.md) and [1.7](PHASE_1_TASK_1_7_RBAC_DESIGN.md) designs; migrations `20261110141433`–`20261110165538` |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §11.2 |
| Related | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) |

## 1. Tenant hierarchy

```
Platform
  └── Organisation            public.organizations          (the tenant)
       └── Workspace          public.workspaces             (isolated work context)
            └── Matter        — Phase 8 —
                 ├── Documents / Evidence   — Phase 3 —
                 ├── Research / Arguments   — Phases 4–5 —
                 └── Reviews                — Phase 6 —
```

| Level | Implemented as | Ownership rule |
|---|---|---|
| Principal | `private.principals`, plus `private.principal_identities` (immutable mapping to `auth.users`) | One principal per authenticated identity; the provider subject never changes |
| Organisation | `public.organizations` (`kind`: personal, law_firm, enterprise or institution; `status`: active, suspended or archived) | Exactly one `owner_principal_id`; ownership is immutable except through a controlled transfer |
| Workspace | `public.workspaces` (`kind`: personal, general, team, matter or research; `slug`; FK to organisation) | Always belongs to exactly one organisation; the creator is recorded and immutable |
| Matter | — | Phase 8: every matter belongs to an authorised workspace |

## 2. Individuals as personal organisations

Every new principal is automatically given a **personal organisation** with a default workspace (`private.provision_personal_organization` and `private.provision_default_workspace`). Individuals and firms therefore share **one isolation model**; there is no separate code path for personal data. Existing principals were backfilled idempotently.

## 3. Membership

| Table | Purpose | States |
|---|---|---|
| `public.organization_memberships` | Principal ↔ organisation | active, suspended, revoked |
| `public.workspace_memberships` | Principal ↔ workspace (requires active organisation membership) | active, suspended, revoked |
| `public.organization_invitations` | Email-bound invitation to an organisation or workspace | pending, accepted, revoked, expired |
| `private.membership_events` | Append-only lifecycle history | — |

Invitation security:
- 256-bit random tokens; **only the hash is stored**.
- Single use, expiring and revocable.
- Bound to a normalised email address.
- Acceptance requires a confirmed email on the accepting identity.
- Replay is rejected.

## 4. Authorisation inside a tenant

Permissions come from a catalogue (`private.permission_catalog`). Roles are bundles of permissions (`private.role_permissions`). Roles are granted through **scoped bindings**:
- `private.organization_role_bindings`: scope is the whole organisation.
- `private.workspace_role_bindings`: scope is one workspace.

The organisation **owner** is a predicate (`private.is_organization_owner`), not a role. The owner implicitly holds every organisation permission and cannot be removed by role revocation. Evaluation is deny-by-default through `private.has_permission(permission, organisation, workspace?)`; a public `has_permission` wrapper serves the UI.

Implemented roles:

| Role | Scope | Notes |
|---|---|---|
| `org_admin` | Organisation | Members, roles, workspaces, organisation settings |
| `org_member` | Organisation | Read organisation |
| `org_auditor` | Organisation | Audit read |
| `org_billing_manager` | Organisation | Billing read/manage |
| `workspace_manager` | Workspace | Full workspace content plus member/role management |
| `workspace_editor` | Workspace | Create and edit matters, documents, research, drafts |
| `workspace_reviewer` | Workspace | Read and review |
| `workspace_viewer` | Workspace | Read only |

The full permission matrix is in [SECURITY_ARCHITECTURE.md §4](SECURITY_ARCHITECTURE.md#4-authorisation).

## 5. Isolation enforcement

| Mechanism | Where |
|---|---|
| Row Level Security enabled on every tenant table in `public` (organisations, workspaces, memberships, invitations, profiles) | Migrations; verified by pgTAP with separate principals |
| Internal tables in the `private` schema, with direct grants revoked from `anon` and `authenticated` | All Phase 1 and Phase 2 migrations |
| Server-side guards: Server Actions call `has_permission` before every mutation | `apps/web/src/app/(workspace)/settings/**/actions.ts` |
| Private storage bucket `njumeni-workspace-files`, with object keys `organisation/workspace/file-uuid/filename` validated by policy against live permissions | `20261110171000_tenant_scoped_storage_policies.sql` |
| Session identity resolved server-side (`getUser()`); client-supplied IDs never trusted | `apps/web/src/proxy.ts`, `(workspace)/layout.tsx` |

## 6. Verification

On a local stack (11 November 2026), **272/272 pgTAP assertions pass** across nine files. The tenancy-relevant files are:
- `organisation_workspace`
- `membership_invitation`
- `role_permission`
- `storage_isolation`
- `phase1_security_contract`
- `profile_security`

They cover both authorised and **unauthorised** access: outsider reads, cross-tenant writes, privilege escalation, invitation replay, and malformed or out-of-scope storage object keys.

## 7. Not yet implemented

| Capability | Phase |
|---|---|
| Matters and matter-level permissions | 8 |
| Information barriers (ethical walls), conflict checks | 9 (U-16) |
| Teams, offices, enterprise administration, SSO | 10 |
| Client role (access to own authorised matters only) | 8–9 |
| Platform administrator role, break-glass support access | 10 |
