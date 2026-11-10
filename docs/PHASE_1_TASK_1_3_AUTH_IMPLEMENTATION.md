# Phase 1 task 1.3 — Supabase identity integration and secure session lifecycle

- **Status:** IN PROGRESS — owner-tested production sign-in, refresh persistence, sign-out, protected-route redirect and absence of Supabase auth cookies after logout. CI run `42828804207` passed all three jobs on `9f395b41190d00b46d10c6591725f3d3d5435041`; eight SSR lifecycle tests and seven auth-boundary contract tests passed. The protected workspace layout now explicitly sets `dynamic = 'force-dynamic'`, and CI confirms `/dashboard` is request-dynamic (`ƒ`). Tests also enforce HttpOnly, production Secure, SameSite=Lax and root-path cookie settings, Supabase cache-header forwarding, generic sign-in errors and local-only sign-out. A mocked provider-side user-rejection test verifies the `getUser()` failure path. Live provider lifecycle/revocation and Auth security configuration remain outstanding.
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
7. Redirect unauthenticated users to sign-in. No user-controlled return URL is currently accepted: successful sign-in always redirects to the fixed `/dashboard` route. Contract tests assert that `returnTo`, `redirectTo`, `callbackUrl` and `next` parameters are not consumed. If post-login deep-link restoration is introduced later, implement and test strict same-origin relative-path validation before enabling it.
8. Sign-out must call the provider and clear session cookies. Use `scope: 'local'` so the current session is ended without signing the user out on other devices. With a successful local sign-out request, Supabase terminates the current session and destroys its refresh token while leaving other device/browser sessions active. The access JWT already issued for that session is not immediately invalidated and remains cryptographically usable until its `exp` time; protected server routes must therefore use `getUser()` for provider-side session validation, not rely on `getClaims()` alone. If the remote sign-out request itself fails, local cookies are still cleared but server-side refresh-token revocation is unconfirmed and the refresh token may remain usable. Supabase documents these distinctions in [Signing out](https://supabase.com/docs/guides/auth/signout) and the [JavaScript signOut reference](https://supabase.com/docs/reference/javascript/auth-signout). The server action now distinguishes a returned revocation error from an unexpected failure and does not silently report full success. The owner has confirmed the production Sign out control returns to the sign-in page, direct navigation to `/dashboard` after sign-out redirects back to sign-in, and no `sb-…-auth-token` cookies remain in the browser cookie store after sign-out. This is owner-observed browser evidence of local cookie removal; it does not by itself prove provider-side refresh-token revocation or rejection of an already-issued access JWT. The auth boundary contract suite also verifies the fixed post-login destination, the absence of untrusted return-URL handling, server-side `getUser()` enforcement, and the server-only publishable-key client boundary.
9. No open registration, tenant selection, role assignment or privileged user creation is introduced in this task. Those require their own approved onboarding and tenancy tasks.
10. All Auth/network responses are non-cacheable. Do not log credentials, tokens, raw provider payloads or confidential legal content.
11. No real customer legal data is used in tests. No service-role credential is introduced into the browser bundle.
12. Missing environment configuration must fail closed for authentication routes and protected workspace access; it must never silently fall back to a mock identity.

## 4. Environment contract

The web application requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These must be supplied through the deployment/local environment secret/configuration system. A publishable key is not an access-control boundary; RLS and server-side authorisation remain mandatory. No live key value is to be committed to Git or written into CI logs. The normal CI build receives only non-routable placeholder values so Next.js cannot statically prerender the protected `/dashboard` route when CI lacks provider configuration; the separate optional live-integration step alone receives the dedicated test secrets. The latest CI build output classifies `/dashboard` as dynamic server-rendered (`ƒ /dashboard`).

The dedicated project is provisioned. The owner confirmed the Site URL `https://njumeni-web.vercel.app` and redirect allow-list `https://njumeni-web.vercel.app/**`; the connected management interface cannot independently read these dashboard settings back. The Njumeni Vercel project is linked, and the Supabase URL and publishable key are configured for Production, Preview and Development. The Vercel project Node.js runtime setting is `22.x`, aligned with `apps/web/package.json` (`>=22.13.0 <23`). The current production deployment `dpl_88BG3yBjtdhsPgadJZpE8TZ23c2R` is `READY`, and the `njumeni-web.vercel.app` production alias is attached. Its build completed successfully with Next.js 16.4.5, TypeScript validation and static generation. The deployment commit is a documentation commit; the application code it contains was already CI-verified on `77076d6df3992a678ea36c3dd258cde0ea5c07dd`. The earlier Vercel HTTP 402 quota blocker is no longer active. Owner testing on the current production application confirms sign-in, dashboard persistence after refresh, sign-out returning to sign-in, and direct `/dashboard` navigation after sign-out redirecting to sign-in. A dedicated confirmed test identity now exists in `auth.users` (count 1). The owner reports successfully signing in through the production application and reaching the protected dashboard. Email provider/SMTP, MFA policy, password policy, rate limits and other provider security settings still require review. Supabase security advisors currently report Leaked Password Protection disabled. The connected Supabase organisation is on the Free plan; current Supabase documentation states that leaked-password protection is available on Pro and above. This is therefore a plan/owner decision, not a setting that can be enabled on the current plan. Do not silently upgrade or represent the control as enabled. Keep production onboarding gated until the project is upgraded and the setting verified, or the owner explicitly accepts a documented residual-risk exception for a limited non-production scope.

## 5. Test and acceptance matrix

| Test | Required result |
|---|---|
| Missing environment variables | Auth setup fails closed; protected routes do not render |
| No session | Workspace routes redirect to sign-in |
| Valid session | Server validates provider identity and permits the authenticated boundary only |
| Tampered/invalid JWT | Rejected; no protected content rendered |
| Expired access token with valid refresh state | Proxy refreshes and propagates replacement cookies |
| Expired access token with a revoked/invalid refresh token | Provider rejects refresh; protected request fails closed and the user must sign in again |
| Provider-side revoked/deleted user | Protected server boundary rejects user; mocked Auth `getUser()` 401/user-not-found response is covered. Live provider-side deletion/revocation remains to be exercised against the dedicated project |
| Sign-out | Owner confirmed production flow returns to sign-in, direct `/dashboard` navigation redirects to sign-in, and no Supabase auth-token cookies remain after logout. Provider-side refresh-token revocation still needs live verification |
| External/protocol-relative return URL | No return URL is accepted at present; sign-in uses fixed `/dashboard` destination. Contract test asserts no untrusted `returnTo`, `redirectTo`, `callbackUrl` or `next` input is consumed |
| Cookie security | HttpOnly, Secure in production, SameSite policy and path/domain scope reviewed |
| Cache handling | Auth responses and user-specific content are not publicly cached |
| Browser bundle | No secret/service-role key or server-only module included |
| Concurrent refresh | Document and test refresh-token rotation behaviour; handle stale-session races without granting access |
| SSR mocked lifecycle tests | Local sign-out, local cookie clearing, returned revocation errors, refresh-token rotation and rejected refresh responses behave as expected |
| Provider integration test | Opt-in test signs in to the dedicated Supabase project, validates the user, refreshes, signs out and confirms the revoked refresh token cannot establish a new session |
| Auth boundary contract tests | Fixed sign-in destination, no untrusted return URL, server-side `getUser()` protected boundary and server-only Supabase client are enforced by `apps/web/tests/auth-boundary-contract.test.mjs` |
| CI | CI run `42826379493` passed all three jobs on commit `214acf15b938ccf8aef9c59a7872cf2b24c1785c`; application auth test command includes both SSR lifecycle and boundary-contract tests. Provider integration is skipped unless its dedicated test environment variables are configured |

Eight provider-independent SSR lifecycle tests now exercise local sign-out/cookie clearing, remote revocation failure, refresh-token rotation, rejected refresh, and provider-side user rejection; seven additional source-contract tests enforce fixed redirects, server-side `getUser()`, server-only client boundaries, generic credential errors, local-only sign-out, cookie security attributes, forwarded cookies/cache headers and forced dynamic workspace rendering. CI run `42826878557` on commit `e922d8f30dfdcf1d7e4375ce07065b2da7c8f2da` passed all three jobs, including formatting, lint, strict typecheck, all tests and Next.js production build. Follow-up CI run `42827266951` on commit `911ff81e4abf9b32af8f572d570158e211efef9d` passed all three jobs and confirmed `/dashboard` is request-dynamic under the non-routable CI configuration. The latest run `42828804207` on `9f395b41190d00b46d10c6591725f3d3d5435041` also passed all three jobs after explicitly forcing dynamic rendering on the protected workspace layout and expanding the boundary suite to seven tests. An opt-in live provider integration test is implemented at `apps/web/scripts/auth-provider.integration.test.mjs`; it signs in with the dedicated test identity, verifies the user, refreshes the session, signs out, and attempts to reuse the revoked refresh token. CI now maps four optional repository Actions secrets into this test: `NJUMENI_TEST_SUPABASE_URL`, `NJUMENI_TEST_SUPABASE_PUBLISHABLE_KEY`, `NJUMENI_TEST_EMAIL`, and `NJUMENI_TEST_PASSWORD`. The test was skipped in run `42826878557` because these secrets are not configured. Before task completion, execute it against the dedicated Njumeni project using the dedicated non-production test identity, then remove the test identity and confirm the project has no residual test data. The same four values can be set in a secure local environment to run `npm run test:auth-integration` from `apps/web`. Never commit or paste the test password into chat. The project currently contains one email-confirmed test Auth identity, provisioned through the Supabase Dashboard by the owner. The connected Supabase tool surface does not expose user-creation/admin-invite capability. Retain this test identity until lifecycle and revocation tests are complete, then remove it through the approved dashboard/admin workflow and verify that no test data remains. No confidential matter data may be used.

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
- [x] Owner verified that directly opening `/dashboard` after sign-out redirects back to sign-in on the production application.
- [ ] Verify token refresh/rotation under expiry, cookie clearing at the browser/provider boundary, and revoked-session rejection; the owner-observed sign-out navigation alone does not prove all of these.
- [x] Full repository CI/security workflow succeeds on current branch head `77076d6df3992a678ea36c3dd258cde0ea5c07dd`; run `42786940182` SUCCESS. All three jobs passed: formatting/lint/type/tests/build/migration policy, content policy, and secret scanning. The app build and four mocked SSR lifecycle tests passed; the opt-in live provider test was skipped because its dedicated credentials were not configured. The opt-in live provider test was correctly skipped because its four dedicated environment variables were not configured.
- [x] Dedicated Supabase project and Vercel environment variables re-verified. Health advisor has no reported notices; security advisor still reports Leaked Password Protection disabled.
- [x] Vercel project Node runtime aligned from `26.x` to `22.x` to match the application's declared engine range `>=22.13.0 <23`; setting re-read and verified. A new deployment is still required to verify the build under the corrected runtime.
- [x] Full GitHub CI workflow `42787710335` passed on commit `0fdf6a02e4724c6638452355e0a197d30069f631` after the runtime alignment documentation update; app-shell build, formatting, lint, type checks, foundation/migration tests, secret scan and private-data-path policy all passed.
- [x] A prior production deployment reached Vercel READY and the owner manually verified sign-in, refresh persistence and sign-out navigation on the production site. The latest auth-hardening branch now passes GitHub CI, but the latest Vercel build has not been verified. The last failed Vercel build's exact TypeScript error is corrected in the current branch. A fresh deployment attempt was blocked by Vercel's daily deployment API quota (HTTP 402, retry after 24 hours). The Vercel project runtime is now aligned to Node 22.x, but no new deployment has yet confirmed that runtime and the code correction together; do not assume a passing GitHub CI run means the latest commit is live.
- [x] Owner-confirmed Supabase Site URL and production redirect allow-list recorded; direct dashboard read-back is not available through the connected interface.

**Task state:** 🟡 IN PROGRESS. The last previously confirmed production deployment was READY, and the owner successfully signed in with a confirmed test identity, reached the protected dashboard, refreshed the dashboard without being asked to sign in again, and used Sign out to return to the sign-in page. The current branch's latest code has not yet been deployed. These are owner-confirmed production browser tests for login, refresh persistence and sign-out navigation. They do not by themselves prove refresh-token rotation after expiry, browser cookie deletion, provider-side revocation, or the full session security matrix. Source-contract regression tests and four mocked SSR lifecycle tests now pass. The full repository CI/security workflow passes on commit `0f5e08393b612978482edfad3edda5b818e152d7` (run `42786737406`), including a successful application build. An opt-in live Supabase provider test is implemented but was skipped because the required test-only environment variables are not configured. The project has one email-confirmed test identity. Supabase's security advisor still reports Leaked Password Protection disabled; enable it and review the remaining Auth provider controls. Keep public self-registration disabled and do not accept confidential legal content until tenant isolation, RLS, storage, audit and provider-egress controls are implemented and verified.


## 8. Current evidence and remaining acceptance work — 10 November 2026

This section is the current status snapshot and supersedes older branch-head/run references in the historical evidence above.

### Verified now

- Branch: `claude/wonderful-franklin-lt09d7`.
- Current application code passed full CI on commit `77076d6df3992a678ea36c3dd258cde0ea5c07dd`, workflow `42786940182`.
- The Vercel project runtime is `22.x`, verified by reading the project setting back after changing it from `26.x`. This matches the web app's declared Node engine `>=22.13.0 <23`.
- The documentation commit `616f06bafd1b83c169d33ce521df1defe68ac9fc` passed full CI, workflow `42822494156`. All three jobs passed, including the Next.js app-shell production build, tests, secret scan and private-data-path policy.
- The last confirmed production deployment is `dpl_A1TveayEG9TtkQrbrSEu7RLN1Go6`, state READY, commit `06ae0269a1b7b6032410a398921e7e9eb02ddf1c`. It still owns `njumeni-web.vercel.app`.
- The latest attempted deployment remains ERROR (`dpl_8LuL6S2REM7rDDBcw2pX7qS5T9co`, commit `b71b744dd9b44b5081488e22b298f7d3c9a997ea`). It did not take over the production alias. Its TypeScript error is corrected in the current branch.
- A new production deployment is still outstanding because Vercel returned HTTP 402 `api-deployments-free-per-day` with a 24-hour retry window. The existing READY deployment predates the Node 22.x project setting change, so the new runtime has not yet been proven by a Vercel production build.
- Supabase security advisor still reports `auth_leaked_password_protection` as WARN. No project plan upgrade or Auth security setting change has been made.

### Next acceptance sequence

1. After Vercel's deployment quota retry window has elapsed, create one fresh deployment from the current branch head. Do not create repeated attempts while the quota is active.
2. Confirm Vercel reports READY, the deployment was built with Node 22.x, and `njumeni-web.vercel.app` points to that deployment.
3. Run the opt-in provider lifecycle test against the dedicated Njumeni test identity. It must verify sign-in, provider user lookup, refresh, successful local sign-out and rejection of reuse of the revoked refresh token.
4. In a private browser session, verify sign-in, dashboard access, refresh persistence, sign-out, direct navigation to `/dashboard` after sign-out, and that the browser no longer sends the session cookies.
5. Verify the distinction between refresh-token revocation and access-token expiry: an already issued access JWT may remain valid until expiry, while the protected server boundary must reject a revoked session through provider-side `getUser()` validation.
6. Verify invalid/expired refresh token, provider-side deleted/revoked user, missing environment configuration, and safe redirect handling. Keep all test data synthetic.
7. Review the Supabase Auth controls. Enable leaked-password protection if the subscription tier supports it; otherwise record the plan limitation and do not claim the control is enabled.
8. Remove the dedicated test identity only after all tests are complete, then verify no residual test data remains.

**Gate:** Task 1.3 stays IN PROGRESS until the current branch is deployed and the live provider/browser tests above are recorded. Tasks 1.4–1.12 remain locked. No customer legal matter, document or confidential case data may be entered before the identity, tenancy, RLS, storage, audit and security gates are accepted.


## 9. Deployment update — 10 November 2026

The previous Vercel deployment quota blocker is no longer active. A new production deployment was created automatically from the current implementation branch and has been independently verified:

- Deployment: `dpl_88BG3yBjtdhsPgadJZpE8TZ23c2R`
- State: `READY`
- Commit: `72eb93c030888e437ccc53309a6d4a9f35f67bfc` (`docs(plan): refresh auth acceptance evidence and blockers`), which includes the already CI-verified application code from `77076d6df3992a678ea36c3dd258cde0ea5c07dd`.
- Production alias: `njumeni-web.vercel.app` — alias attachment independently confirmed by Vercel.
- Project Node.js runtime setting: `22.x`.
- Build evidence: Vercel logs show Next.js 16.4.5, successful compilation, successful TypeScript validation, 18/18 static generation steps, `/dashboard` emitted as a dynamic server-rendered route, Proxy emitted, and `Deployment completed`.
- Vercel production build completed without the earlier TypeScript error.

The public web inspection tool could not independently open the production sign-in/dashboard URLs, so HTTP/browser behaviour is not claimed from that check. The owner must now run the remaining live browser acceptance sequence against the newly deployed alias. The previous owner-observed sign-in, dashboard refresh persistence and sign-out navigation predate this latest deployment and should be repeated once on the new deployment.

### Updated acceptance sequence

1. [x] Fresh production deployment from current branch is READY.
2. [x] Confirm `njumeni-web.vercel.app` is attached to that READY deployment.
3. [ ] Confirm the deployed application uses the configured Node 22.x runtime (project setting is verified; build logs do not explicitly print the Node patch version).
4. [ ] Owner re-test sign-in, dashboard access, refresh persistence and sign-out on the newly deployed production alias.
5. [ ] Directly open `/dashboard` after sign-out and verify redirect to sign-in.
6. [ ] Run the opt-in provider lifecycle test against the dedicated Njumeni test identity; verify sign-in, provider user lookup, refresh, successful local sign-out and rejection of reuse of the revoked refresh token.
7. [ ] Inspect browser cookies after sign-out and verify session cookies are no longer sent; review HttpOnly, Secure, SameSite, path and domain scope.
8. [ ] Verify invalid/expired refresh token, provider-side deleted/revoked user, missing environment configuration and safe same-origin redirect handling. Keep all test data synthetic.
9. [ ] Review Supabase Auth controls. Enable leaked-password protection if the subscription tier supports it; otherwise record the plan limitation and do not claim the control is enabled.
10. [ ] Remove the dedicated test identity only after all tests are complete, then verify no residual test data remains.

**Current gate:** Task 1.3 remains IN PROGRESS. Deployment is no longer the blocker; live provider and browser acceptance, and the remaining Auth security configuration review, are the active acceptance work. Tasks 1.4–1.12 remain locked until Task 1.3 is accepted.


### Owner browser acceptance update — 10 November 2026

The owner has now confirmed on the current production application that, after signing out, directly navigating to `/dashboard` leads back to the sign-in page. This closes the direct protected-route-after-sign-out browser check. It does not by itself prove cookie deletion, refresh-token revocation, expired-token rejection or provider-side user revocation; those remain separate acceptance tests.
