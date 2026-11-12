# Njumeni — Security Architecture

| Field | Value |
|---|---|
| Status | Describes the **implemented** Phase 1 security architecture (verified on a local stack, 11 November 2026) and the controls planned for later phases |
| Sources | [ADR-0002](architecture/ADR-0002-identity-tenancy-security.md) (Accepted), [ADR-0003](architecture/ADR-0003-build-in-public-and-staged-infrastructure.md), Phase 1 task designs, migrations `20261110141433`–`20261110190000` |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §11 |
| Related | [MULTITENANCY.md](MULTITENANCY.md), [SECURITY.md](../SECURITY.md) |

## 1. Principles

1. **Deny by default.** A missing policy, membership, binding or context never grants access.
2. **Defence in depth.** Server-side authorisation *and* PostgreSQL RLS, each tested independently.
3. **Server-resolved identity.** User, tenant and role are resolved from the verified session, never from client input.
4. **Least privilege.** Internal tables live in `private`; browser roles cannot read them; privileged work goes through narrow `security definer` functions with fixed `search_path`.
5. **Open code, closed data (ADR-0003).** Security never relies on secrecy of the source code.
6. **Entitlement ≠ authorisation.** Billing state never grants data access.

## 2. Trust boundaries

```
Browser (untrusted)
   │  HttpOnly session cookies; publishable key only
   ▼
Next.js server (trusted)  ── Proxy refreshes session; layouts call auth.getUser();
   │                         Server Actions check has_permission before mutations
   │  user-scoped Supabase client (RLS applies)
   ▼
PostgreSQL (Supabase) ── RLS on public tenant tables; private schema revoked;
   │                     security-definer RPCs with explicit permission checks
   ▼
Trusted worker (service role) ── legal-source ingestion only; never in the browser;
                                 public legal data only at Stage 0
```

| Credential | Allowed location | Never |
|---|---|---|
| Publishable (anon) key | Browser, server | — |
| Service-role / secret key | Trusted worker and server-only modules (`server-only` import guard) | Browser bundles, Git, CI logs |
| Session tokens | HttpOnly cookies | Local storage, logs |

## 3. Authentication

| Control | Implementation | Verified |
|---|---|---|
| Identity provider | Supabase Auth via `@supabase/ssr` | ✅ |
| Session refresh | Next.js Proxy (`src/proxy.ts`, `lib/supabase/proxy.ts`) | ✅ mocked suite |
| Protected routes | `(workspace)/layout.tsx` calls `auth.getUser()` and redirects | ✅ contract tests |
| Sign-out revokes refresh token | Supabase sign-out (local scope) | ✅ live lifecycle test against a local Auth service, 11 November 2026 |
| Error hygiene | Sign-in errors do not disclose provider detail or account existence | ✅ |
| Provider mapping | `private.principal_identities` is immutable | ✅ pgTAP |
| Auth event log | Provider `auth.audit_log_entries`: login, logout, token refresh, revocation, sign-up, deletion | ✅ observed |
| MFA (passkeys/TOTP) | Planned | Before R1 |
| Leaked-password protection | Unavailable on Supabase Free; **accepted Stage 0 risk** | Stage 1 |
| OAuth, enterprise SSO | Planned | Phase 10 |

## 4. Authorisation

Evaluation: `private.has_permission(permission_key, organisation_id, workspace_id?)`. It returns true only when one of the following holds, and the principal's membership is active:
- the principal is the organisation owner;
- an active organisation binding grants the permission;
- (for workspace permissions) an active workspace binding grants it.

The table below lists the **implemented permission matrix**. The owner holds every organisation permission implicitly.

| Permission | Scope | Granted to |
|---|---|---|
| `organization.read` | org | org_admin, org_member, org_auditor, org_billing_manager |
| `organization.update` | org | org_admin |
| `organization.manage_members` | org | org_admin |
| `organization.manage_roles` | org | org_admin |
| `organization.manage_workspaces` | org | org_admin |
| `workspace.create` | org | org_admin |
| `audit.read` | org | org_auditor |
| `billing.read` / `billing.manage` | org | org_billing_manager |
| `usage.record` | org | org_admin (*to become server-only in Phase 11*) |
| `profile.read_own` / `profile.update_own` | org | Self (row ownership) |
| `workspace.read` | workspace | manager, editor, reviewer, viewer |
| `workspace.update`, `workspace.manage_members`, `workspace.manage_roles` | workspace | org_admin, workspace_manager |
| `matter.read`, `document.read`, `research.read` | workspace | manager, editor, reviewer, viewer |
| `matter.create`, `matter.update`, `document.upload`, `document.annotate`, `evidence.manage`, `research.create`, `research.export`, `research.share`, `draft.create`, `draft.update` | workspace | manager, editor (`document.annotate`: manager, editor) |
| `argument.manage` | workspace | manager, editor, reviewer |
| `draft.review` | workspace | manager, reviewer |
| `draft.approve`, `document.export`, `document.delete`, `matter.archive`, `matter.delete` | workspace | manager |
| `draft.publish` | workspace | *No role yet: reserved for human approval workflow (Phase 7)* |

Escalation controls:
- `private.can_assign_role`: **only the organisation owner** can assign privileged roles (`org_admin`, `org_auditor`, `org_billing_manager`, `workspace_manager`).
- Holders of `organization.manage_roles` can assign only `org_member`. Holders of `organization.manage_roles` or `workspace.manage_roles` can assign only `workspace_editor`, `workspace_reviewer` and `workspace_viewer`.
- Every assignment and revocation is written to `private.role_audit_events`.

**Mapping to the master plan's role list (§11.3):**

| Master plan role | Implemented as |
|---|---|
| Organisation owner | Owner predicate |
| Organisation administrator | `org_admin` |
| Legal professional, case manager | `workspace_editor` / `workspace_manager` (matter scope in Phase 8) |
| Senior reviewer, read-only reviewer | `workspace_reviewer` / `workspace_viewer` |
| Auditor | `org_auditor` |
| Researcher | `workspace_editor` (a dedicated role may follow in Phase 4) |
| Client | Not yet (Phase 8–9) |
| Platform administrator | Not yet (Phase 10). It will have **no default access** to matter content |

## 5. Data protection in the database

| Control | Detail |
|---|---|
| RLS | Enabled on all `public` tenant tables: organisations, workspaces, both membership tables, invitations, user profiles |
| Private schema | Catalogues, bindings, audit, billing and legal-knowledge tables. Direct `anon`/`authenticated` privileges revoked |
| Function hardening | `security definer` with `search_path = ''`; execute revoked from `public`/`anon` and granted narrowly |
| Immutability | Triggers prevent updates to provider identity mappings, organisation ownership, audit rows and legal authority versions |
| Invitation tokens | 256-bit random, hash-only storage, single use |

## 6. File storage

| Control | Detail |
|---|---|
| Bucket | `njumeni-workspace-files`, **private** (not public) |
| Object key | `organisation-uuid/workspace-uuid/file-uuid/filename`, exactly four segments, validated by `private.storage_object_scope_allows` |
| Policies | Read requires `document.read`; insert and rename require `document.upload`; delete requires `document.delete`. All are evaluated live against the object key's organisation and workspace |
| Access | Short-lived signed URLs from server helpers (`lib/workspace-storage.ts`) |
| Pending | Upload UI, malware scanning, content-type sniffing, content addressing: Phase 3 |

## 7. Audit

| Stream | Content |
|---|---|
| `private.security_audit_events` | Append-only (an update/delete trigger raises `55000`). Organisation and workspace lifecycle, membership and role events are mirrored in. Allow-listed metadata with a size cap; stable event IDs; correlation ID column |
| `private.membership_events`, `private.role_audit_events` | Domain lifecycle histories |
| `auth.audit_log_entries` | Provider authentication events |
| Read access | `list_security_audit_events` RPC: requires `audit.read`, tenant-scoped, bounded page size |

**Deferred to Phase 3** (master plan U-11/U-12):
- failed sign-in and denied-access events;
- hash-chained tamper evidence;
- retention and legal hold;
- setting `x-correlation-id` from the app.

## 8. Secrets and build-in-public controls

- Gitleaks and the repository content policy run on **every push** (`repository-security.yml`).
- `.env.example` contains placeholders only; populated `.env.*` files are ignored.
- CI logs are public: workflows must never print secrets.
- Only synthetic data is used at Stage 0. No migration is applied to the hosted project until all phases are complete.
- A suspected leak is treated as an exposure: rotate first, then investigate (SECURITY.md).

## 9. Threats and controls

| Threat | Control | Verification |
|---|---|---|
| Cross-tenant read/write | RLS + server permission checks | pgTAP negative tests (outsider principals) |
| Privilege escalation via role assignment | `can_assign_role` (privileged roles owner-only), owner predicate, audit | `role_permission` pgTAP |
| Invitation hijack/replay | Email binding, confirmed email, hash-only single-use tokens | `membership_invitation` pgTAP |
| Storage object access outside scope | Path validation + live permission policies | `storage_isolation` pgTAP |
| Session theft after logout | Refresh-token revocation | Live lifecycle test |
| Audit tampering | Append-only triggers, revoked grants (hash chain in Phase 3) | `security_audit` pgTAP |
| Service key exposure | `server-only` boundary; secret scanning | Gitleaks on push |
| Billing state granting data access | Entitlements separate from permissions | `subscription_entitlements` pgTAP |
| Prompt injection via documents | Documents are data, never instructions (Phase 4–5) | Planned |

## 10. Verification status

The full local run on 11 November 2026 replayed **23 migrations** from empty. Results:
- **pgTAP:** 272/272 passing.
- **`db lint`:** clean.
- **Live Auth lifecycle:** pass.
- **Web tests:** 161/161 passing.
- **Type check and production build:** pass.

Before Phase 1 closes, these runs are repeated as a manual run of the CI workflows.
