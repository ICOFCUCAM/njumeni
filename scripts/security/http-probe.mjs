#!/usr/bin/env node
// Automated penetration probes against a running Njumeni build (Phase 13).
// Usage: BASE_URL=http://127.0.0.1:3000 [COOKIE='sb-…'] node scripts/security/http-probe.mjs
// Checks: security headers; every API refuses anonymous callers; unknown or foreign identifiers
// are indistinguishable from missing ones (no IDOR oracle); malformed input is rejected; forged
// API keys and webhook signatures fail; error bodies never leak internals; protected pages redirect.
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const COOKIE = process.env.COOKIE ?? '';
const RANDOM = '00000000-0000-4000-8000-0000000000ff';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const get = (path, headers = {}) => fetch(`${BASE}${path}`, { headers, redirect: 'manual' });

const home = await get('/');
for (const header of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
  check(`header ${header}`, home.headers.has(header), home.headers.get(header) ?? 'missing');
}
check('no x-powered-by', !home.headers.has('x-powered-by'));
check('framing forbidden', /frame-ancestors 'none'/.test(home.headers.get('content-security-policy') ?? ''));

const anonymous = [
  ['GET', '/api/v1/research/runs?organizationId=' + RANDOM + '&workspaceId=' + RANDOM],
  ['POST', '/api/v1/research/runs'],
  ['GET', `/api/v1/research/runs/${RANDOM}`],
  ['GET', '/api/v1/matters?organizationId=' + RANDOM + '&workspaceId=' + RANDOM],
  ['GET', `/api/v1/matters/${RANDOM}/export`],
  ['GET', `/api/v1/documents/${RANDOM}/export?format=pdf`],
  ['GET', `/api/v1/billing/invoices/${RANDOM}/pdf`],
];
for (const [method, path] of anonymous) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
  const body = await res.text();
  check(`anonymous ${method} ${path.split('?')[0]} → 401`, res.status === 401, String(res.status));
  check(`anonymous ${path.split('?')[0]} leaks nothing`, !/stack|at Object|postgres|supabase|sql/i.test(body));
}
for (const page of ['/dashboard', '/matters', '/admin', '/billing']) {
  const res = await get(page);
  check(`anonymous page ${page} redirects`, res.status >= 300 && res.status < 400, `${res.status} → ${res.headers.get('location')}`);
}

const forgedKey = { authorization: `Bearer njk_00000000_${'0'.repeat(48)}` };
check('forged API key → 401', (await get(`/api/v1/research/runs/${RANDOM}`, forgedKey)).status === 401);
check('malformed API key → 401', (await get('/api/v1/matters', { authorization: 'Bearer njk_bad' })).status === 401);
const webhook = await fetch(`${BASE}/api/billing/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00' }, body: '{"id":"evt","type":"invoice.paid"}' });
check('forged billing webhook → 401', webhook.status === 401, String(webhook.status));
check('unknown webhook provider name rejected', (await fetch(`${BASE}/api/billing/webhooks/..%2Fadmin`, { method: 'POST', body: '{}' })).status >= 400);

if (COOKIE) {
  const auth = { cookie: COOKIE };
  const missing = await get(`/api/v1/research/runs/${RANDOM}`, auth);
  check('unknown research run → 404 (no existence oracle)', missing.status === 404, String(missing.status));
  check('invalid UUID → 400', (await get('/api/v1/research/runs/not-a-uuid', auth)).status === 400);
  check('document export with bad format → 400', (await get(`/api/v1/documents/${RANDOM}/export?format=exe`, auth)).status === 400);
  check('foreign matter export → 404', (await get(`/api/v1/matters/${RANDOM}/export`, auth)).status === 404);
  check('foreign invoice → 404', (await get(`/api/v1/billing/invoices/${RANDOM}/pdf`, auth)).status === 404);
  const forbiddenScope = await get(`/api/v1/matters?organizationId=${RANDOM}&workspaceId=${RANDOM}`, auth);
  check('matters of a foreign workspace refused', [403, 404].includes(forbiddenScope.status), String(forbiddenScope.status));
  const admin = await get('/admin', auth);
  check('back office hidden from customers', admin.status === 404, String(admin.status));
  const big = await fetch(`${BASE}/api/v1/research/runs`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: RANDOM, workspaceId: RANDOM, question: 'x'.repeat(5000), jurisdictionCode: 'NO', asOfDate: '2026-01-01', languageCodes: ['nb'] }) });
  check('oversized question rejected', big.status === 400 || big.status === 403, String(big.status));
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} probes passed.`);
process.exit(failed.length ? 1 : 0);
