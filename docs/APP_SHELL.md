# Njumeni application shell and route boundaries

- **Status:** Phase 0 task 0.12 implementation
- **Application:** apps/web
- **Framework:** Next.js App Router, React, TypeScript and Tailwind CSS
- **Canonical module registry:** apps/web/src/modules/registry.ts
- **Architecture authority:** ADR-0001 and MODULE_LAYER_MAP.md

## 1. Route boundaries
| Route | Responsibility | Current state |
|---|---|---|
| / | Redirect to /dashboard | Active |
| /dashboard | Workspace overview and module launch points | Foundation preview; no live metrics |
| /intelligence | A — Njumeni Legal Intelligence | Route entry only |
| /research | B — Legal Research Engine | Route entry only |
| /evidence | C — Evidence Intelligence Engine | Route entry only |
| /matters | D — Legal Case Management | Route entry only |
| /documents | E — Legal Document Intelligence | Route entry only |
| /arguments | F — Legal Argument and Reasoning Engine | Route entry only |
| /jurisdictions | G — Jurisdiction and Legal Systems Engine | Route entry only |
| /assistant | H — Personal Legal Assistant | Route entry only |
| /professional | I — Professional Legal Workspace | Route entry only |
| /organisation | J — Enterprise and Law Firm Workspace | Route entry only |
| /institutional | K — Institutional Workspace | Route entry only |
| /compliance | L — Legal Compliance and Risk Intelligence | Route entry only |
| /knowledge | M — Legal Knowledge Management | Route entry only |
| /sign-in | Identity/tenancy boundary | Placeholder; real auth is Phase 1 |
| /api/health | Process health and connection-state metadata | Active; reports auth/database disconnected |

## 2. Layout and component boundaries
- Root app layout owns metadata, global CSS and document language.
- Workspace route group owns the workspace visual shell boundary. It is not yet protected by real authentication; Phase 1 adds the server-side identity/tenant guard before any private data is served.
- Auth route group reserves the sign-in boundary and does not simulate authentication.
- Module routes resolve only through the canonical A–M registry. Unknown module slugs return the application not-found boundary.
- WorkspaceShell owns navigation, mobile menu state and route-aware active state.
- ModuleLanding owns the common module entry presentation and explicitly communicates non-operational status.
- Domain services, data access, auth and provider calls do not belong in presentation components.

## 3. Security and legal-trust limits
- The current app is a foundation preview. No real account, organisation, matter, document or evidence data is queried.
- The health route returns connection flags and never returns secrets or environment values.
- Error boundary logging records only error name and digest; it does not log legal content or user data.
- Robots indexing is disabled in metadata for this non-production foundation shell.
- No client-side value is treated as proof of identity, tenant or matter permission.
- Phase 1 must add server-side authentication, tenant resolution and access guards before any private workspace data is connected.

## 4. Dependency and package baseline
The app package pins direct versions for Next.js 16.4.5, React 19.3.1, Tailwind CSS 4.3.5 and TypeScript 5.9.3. The npm lockfile is generated and committed as part of task 0.12 CI verification. Runtime packages are isolated in apps/web; the repository's foundation CI tooling remains at the root.

## 5. Deferred implementation
Authentication, database clients, RLS, storage, queues, AI providers, legal-source retrieval, evidence processing, reasoning, verification, document drafting and operational workflows are deliberately deferred to their numbered phases. This shell is a real route/layout implementation, not a claim that those features are already operational.
