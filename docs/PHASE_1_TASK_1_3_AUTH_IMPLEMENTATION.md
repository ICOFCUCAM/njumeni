# Phase 1 task 1.3 — Supabase identity integration and secure session lifecycle

- **Status:** IN PROGRESS — production email/password sign-in, authenticated dashboard persistence after browser refresh, and sign-out returning to the sign-in page have been owner-tested successfully. Sign-out error handling and regression coverage are implemented; provider-backed lifecycle and revocation tests remain.
- **Date opened:** 10 November 2026
- **Repository:** `ICOFCUCAM/njumeni`
- **Dedicated Supabase project:** `Njumeni` (`vvjpsejeeffykaozfbik`), `eu-north-1`
- **Architecture authority:** ADR-0001, ADR-0002, Phase 1 security invariants
- **Scope:** Supabase Auth integration, request-scoped server client, cookie session lifecycle, sign-in/sign-out, refresh, protected route boundary and automated session tests.
- **Explicit exclusions:** user profile schema (1.4), organisation/workspace schema (1.5), membership/invitations (1.6), role/permission engine (1.7), RLS and storage policies (1.8), audit persistence (1.9), billing identity (1.10).

## 1. Implementation decision

Use the official Supabase JavaScript SSR integration for the Next.js 16 App Router. The intended packages are:

- `@supabase/ssr` — cookie-aware browser/server client and refresh-token cookie handling.
- `@supabase/supabase-js` — supported Supabase client and Auth API.

The current Supabase documentation distinguishes cookie-based SSR sessions from header-based server authentication and recommends `@supabase/ssr` for Next.js. Do not substitute deprecated `@supabase/auth-helpers-nextjs`.

The exact direct dependency versions are pinned: `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.119.0. Their complete transitive dependency graph was resolved by npm in GitHub Actions and committed in `apps/web/package-lock.json` (lockfile blob `1bf9df67e9e86f10112e44e16052d0a2fe93fd6c`, generated on commit `228e094c0135942b1b8e6aca898668038aadbac2`).

## 2. Required implementation layout

| Path | Responsibility |
|---|---|
| `apps/web/src/lib/supabase/client.ts` | Intentionally omitted: all current Auth interactions are server actions; no browser-side session client is needed |
| `apps/web/src/lib/supabase/server.ts` | Request-scoped server client using Next.js `cookies()`; no global user client |
| `apps/web/src/lib/supabase/proxy.ts` | Session refresh helper; propagate request and response cookies and cache headers correctly |
| `apps/web/src/proxy.ts` | Next.js 16 Proxy entry point; refresh session before protected rendering |
| `apps/web/src/app/(auth)/actions.ts` | Server Actions for email/password sign-in and sign-out |
| `apps/web/src/app/(auth)/sign-in/page.tsx` | Real sign-in form with safe error handling; no sign-up or simulated identity |
| `apps/web/src/app/(workspace)/layout.tsx` | Server-side authenticated-user guard before rendering workspace routes |
| `apps/web/src/app/api/health/route.ts` | Report configuration state only; never expose secrets or infer user authentication from process health |

The route paths were reconciled with the existing tree. The implementation uses `apps/web/src/app`, route groups `(auth)` and `(workspace)`, and `apps/web/src/proxy.ts` for the Next.js 16 Proxy convention.

## 3. Session and security rules

1. Use the official SSR cookie adapter and PKCE-compatible Auth flow where applicable.
2. Use a fresh Supabase server client for each request; never cache a request-bound client globally.
3. Keep the publishable key public and all secret/service-role/database-owner credentials server-only. The service-role key is not needed for ordinary user authentication.
4. Store session state in the SSR package's secure cookie mechanism; do not put access or refresh tokens in localStorage, URLs, client logs or analytics.
5. In Next.js 16, use the `proxy.ts` convention (not the pre-16 `middleware.ts` convention) to refresh the session. Preserve refreshed cookies on both the forwarded request and response, and preserve Supabase cache-control headers.
6. Use `auth.getClaims()` in the Proxy to validate/refresh JWT claims according to current Supabase guidance. Use `auth.getUser()` in the protected server boundary where current provider-side user/session state and revocation checks are required. Never use `getSession()` alone as proof of identity in server code.
7. Redirect unauthenticated users to sign-in. Preserve only a validated same-origin relative return path; reject protocol-relative URLs and external origins.
8. Sign-out must call the provider and clear session cookies. Use `scope: 'local'` so the current session is ended without signing the user out on other devices. Supabase removes the local session first and then makes a best-effort refresh-token revocation request; if that request fails, the client remains locally signed out but the refresh token may remain valid until expiry. The server action now distinguishes a returned revocation error from an unexpected failure and does not silently report full success. The owner has confirmed the production Sign out control returns to the sign-in page; browser cookie clearing and provider-side revocation still need automated verification.
9. No open registration, tenant selection, role assignment or privileged user creation is introduced in this task. Those require their own approved onboarding and tenancy tasks.
10. All Auth/network responses are non-cacheable. Do not log credentials, tokens, raw provider payloads or confidential legal content.
11. No real customer legal data is used in tests. No service-role credential is introduced into the browser bundle.
12. Missing environment configuration must fail closed for authentication routes and protected workspace access; it must never silently fall back to a mock identity.

## 4. Environment contract

The web application requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These must be supplied through the deployment/local environment secret/configuration system. A publishable key is not an access-control boundary; RLS and server-side authorisation remain mandatory. No live key value is to be committed to Git or written into CI logs.

The dedicated project is provisioned. The owner confirmed the Site URL `https://njumeni-web.vercel.app` and redirect allow-list `https://njumeni-web.vercel.app/**`; the connected management interface cannot independently read these dashboard settings back. The Njumeni Vercel project is linked, and the Supabase URL and publishable key are configured for Production, Preview and Development. Vercel's project Node.js runtime was found set to `26.x`, while `apps/web/package.json` explicitly requires Node `>=22.13.0 <23`; the project setting has now been aligned to `22.x` and independently re-read from Vercel to verify the change. The previously working production deployment remains the last confirmed READY version. A later deployment on commit `b71b744dd9b44b5081488e22b298f7d3c9a997ea` failed at TypeScript validation in `src/app/(auth)/sign-in/page.tsx` because a `string | undefined` value was assigned to `string | null`; the page now guards the error-map lookup, and the current branch passes GitHub CI. A fresh Vercel deployment has not yet been verified: Vercel rejected the deployment request with HTTP 402 (`api-deployments-free-per-day`) and a 24-hour retry window. Do not describe the current branch as deployed until a new READY deployment is observed. A dedicated confirmed test identity now exists in `auth.users` (count 1). The owner reports successfully signing in through the production application and reaching the protected dashboard. Email provider/SMTP, MFA policy, password policy, rate limits and other provider security settings still require review. Supabase security advisors currently report Leaked Password Protection disabled; enable it before production onboarding.

## 5. Test and acceptance matrix

| Test | Required result |
|---|---|
| Missing environment variables | Auth setup fails closed; protected routes do not render |
| No session | Workspace routes redirect to sign-in |
| Valid session | Server validates provider identity and permits the authenticated boundary only |
| Tampered/invalid JWT | Rejected; no protected content rendered |
| Expired access token with valid refresh state | Proxy refreshes and propagates replacement cookies |
| Expired access token with a revoked/invalid refresh token | Provider rejects refresh; protected request fails closed and the user must sign in again |
| Provider-side revoked/deleted user | Protected server boundary rejects user |
| Sign-out | Provider sign-out invoked and cookies cleared; owner confirmed production flow returned to sign-in. Direct navigation to a protected route after sign-out, browser cookie clearing and provider revocation still need verification |
| External/protocol-relative return URL | Rejected; redirect remains same-origin |
| Cookie security | HttpOnly, Secure in production, SameSite policy and path/domain scope reviewed |
| Cache handling | Auth responses and user-specific content are not publicly cached |
| Browser bundle | No secret/service-role key or server-only module included |
| Concurrent refresh | Document and test refresh-token rotation behaviour; handle stale-session races without granting access |
| SSR mocked lifecycle tests | Local sign-out, local cookie clearing, returned revocation errors, refresh-token rotation and rejected refresh responses behave as expected |
| Provider integration test | Opt-in test signs in to the dedicated Supabase project, validates the user, refreshes, signs out and confirms the revoked refresh token cannot establish a new session |
| CI | Locked install, mocked lifecycle tests, typecheck, Next.js production build, secret scan and policy checks pass; provider integration is skipped unless its dedicated test environment variables are configured |

A passing unit test with mocked Auth is not sufficient by itself. Four provider-independent SSR lifecycle tests now exercise local sign-out/cookie clearing, remote revocation failure, refresh-token rotation, and rejection of a refresh attempt without issuing a replacement session. An opt-in provider integration test is also implemented at `apps/web/scripts/auth-provider.integration.test.mjs`; it signs in with the dedicated test identity, verifies the user, refreshes the session, signs out, and attempts to reuse the revoked refresh token. CI runs the harness but skips the live provider test when the required environment variables are absent. Before task completion, execute it against the dedicated Njumeni project using the dedicated non-production test identity, then remove the test identity and confirm the project has no residual test data. To run it locally, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NJUMENI_TEST_EMAIL`, and `NJUMENI_TEST_PASSWORD` in the environment and run `npm run test:auth-integration` from `apps/web`. Never commit or paste the test password into chat. The project currently contains one email-confirmed test Auth identity, provisioned through the Supabase Dashboard by the owner. The connected Supabase tool surface does not expose user-creation/admin-invite capability. Retain this test identity until lifecycle and revocation tests are complete, then remove it through the approved dashboard/admin workflow and verify that no test data remains. No confidential matter data may be used.

## 6. Dependency resolution and implementation evidence

The local execution container could not reach the npm registry. Rather than bypassing the committed lockfile, a restricted GitHub Actions workflow was added to resolve exact dependency graphs on the implementation branch, run `npm ci`, type-check and build the web app, commit only the generated lockfile, and dispatch the full repository CI/security workflow. The workflow was smoke-tested successfully on the existing app before the SDK dependency update.

The package manifest pins `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.119.0. GitHub Actions generated the lockfile and verified a clean `npm ci`, application type-check and production build before committing the lockfile. The initial repository CI run on the manifest-only commit failed because its lockfile was awaiting generation; the generated-lockfile commit then triggered a fresh full CI run.

No floating dependency ranges, hand-written integrity hashes or lockfile bypasses were used.

## 7. Acceptance status

- [x] Existing app routes, framework version and placeholder Auth boundary inspected.
- [x] Dedicated Njumeni project and publishable-key availability verified in Task 1.2.
- [x] Current Supabase SSR documentation and package-selection guidance reviewed.
- [x] Next.js 16 Proxy convention and current Supabase cookie/session requirements identified.
- [x] Security, session, redirect, cache and test acceptance contract documented.
- [x] Exact SDK dependency versions pinned (`@supabase/ssr` 0.12.7; `@supabase/supabase-js` 2.119.0).
- [x] Committed npm lockfile generated by npm and reproducible `npm ci` verified in GitHub Actions.
- [x] Request-scoped SSR server client, Next.js 16 Proxy refresh helper and server-side protected workspace user check implemented.
- [x] Email/password sign-in and local sign-out server actions implemented; returned revocation errors and unexpected sign-out failures are handled distinctly; public self-registration remains disabled.
- [x] Source-contract regression tests cover the explicit local sign-out scope, revocation-warning path and unexpected sign-out failure path.
- [x] Four mocked SSR lifecycle tests cover local sign-out/cookie clearing, remote revocation failure, refresh-token rotation and rejected refresh responses; all four pass in CI.
- [x] An opt-in provider integration test is implemented for sign-in, user verification, refresh, sign-out and reuse rejection of the revoked refresh token.
- [ ] The opt-in provider integration test has not yet run against the live Njumeni project because its dedicated test environment variables are not configured in GitHub Actions. Provider-side deleted-user and browser-based protected-route/cookie tests also remain outstanding.
- [x] Dedicated test identity provisioned through the Supabase Dashboard; `auth.users` count is 1 and the account is email-confirmed.
- [x] Owner-reported production sign-in completed successfully and reached the protected dashboard.
- [x] Owner verified that refreshing the production dashboard preserves the authenticated session without requesting sign-in again.
- [x] Owner verified production Sign out returns to the sign-in page.
- [ ] Owner to verify that directly opening `/dashboard` after sign-out redirects back to sign-in.
- [ ] Verify token refresh/rotation under expiry, cookie clearing at the browser/provider boundary, and revoked-session rejection; the owner-observed sign-out navigation alone does not prove all of these.
- [x] Full repository CI/security workflow succeeds on current branch head `77076d6df3992a678ea36c3dd258cde0ea5c07dd`; run `42786940182` SUCCESS. All three jobs passed: formatting/lint/type/tests/build/migration policy, content policy, and secret scanning. The app build and four mocked SSR lifecycle tests passed; the opt-in live provider test was skipped because its dedicated credentials were not configured. The opt-in live provider test was correctly skipped because its four dedicated environment variables were not configured.
- [x] Dedicated Supabase project and Vercel environment variables re-verified. Health advisor has no reported notices; security advisor still reports Leaked Password Protection disabled.
- [x] Vercel project Node runtime aligned from `26.x` to `22.x` to match the application's declared engine range `>=22.13.0 <23`; setting re-read and verified. A new deployment is still required to verify the build under the corrected runtime.
- [x] Full GitHub CI workflow `42787710335` passed on commit `0fdf6a02e4724c6638452355e0a197d30069f631` after the runtime alignment documentation update; app-shell build, formatting, lint, type checks, foundation/migration tests, secret scan and private-data-path policy all passed.
- [x] A prior production deployment reached Vercel READY and the owner manually verified sign-in, refresh persistence and sign-out navigation on the production site. The latest auth-hardening branch now passes GitHub CI, but the latest Vercel build has not been verified. The last failed Vercel build's exact TypeScript error is corrected in the current branch. A fresh deployment attempt was blocked by Vercel's daily deployment API quota (HTTP 402, retry after 24 hours). The Vercel project runtime is now aligned to Node 22.x, but no new deployment has yet confirmed that runtime and the code correction together; do not assume a passing GitHub CI run means the latest commit is live.
- [x] Owner-confirmed Supabase Site URL and production redirect allow-list recorded; direct dashboard read-back is not available through the connected interface.

**Task state:** 🟡 IN PROGRESS. The last previously confirmed production deployment was READY, and the owner successfully signed in with a confirmed test identity, reached the protected dashboard, refreshed the dashboard without being asked to sign in again, and used Sign out to return to the sign-in page. The current branch's latest code has not yet been deployed. These are owner-confirmed production browser tests for login, refresh persistence and sign-out navigation. They do not by themselves prove refresh-token rotation after expiry, browser cookie deletion, provider-side revocation, or the full session security matrix. Source-contract regression tests and four mocked SSR lifecycle tests now pass. The full repository CI/security workflow passes on commit `0f5e08393b612978482edfad3edda5b818e152d7` (run `42786737406`), including a successful application build. An opt-in live Supabase provider test is implemented but was skipped because the required test-only environment variables are not configured. The project has one email-confirmed test identity. Supabase's security advisor still reports Leaked Password Protection disabled; enable it and review the remaining Auth provider controls. Keep public self-registration disabled and do not accept confidential legal content until tenant isolation, RLS, storage, audit and provider-egress controls are implemented and verified.
