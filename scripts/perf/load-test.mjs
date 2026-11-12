#!/usr/bin/env node
// Load test (Phase 13). Concurrent requests against a running build, reporting latency
// percentiles and error rates per endpoint, and failing when a budget is exceeded.
// Usage: BASE_URL=… COOKIE=… PATHS='/api/v1/…,/…' CONCURRENCY=20 REQUESTS=400 P95_MS=800 node scripts/perf/load-test.mjs
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const COOKIE = process.env.COOKIE ?? '';
const PATHS = (process.env.PATHS ?? '/api/health').split(',').filter(Boolean);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const REQUESTS = Number(process.env.REQUESTS ?? 200);
const P95_BUDGET = Number(process.env.P95_MS ?? 800);

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
let failed = false;
for (const path of PATHS) {
  const timings = [];
  let errors = 0;
  let next = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < REQUESTS) {
      next += 1;
      const t0 = performance.now();
      try {
        const res = await fetch(`${BASE}${path}`, { headers: COOKIE ? { cookie: COOKIE } : {} });
        await res.arrayBuffer();
        if (res.status >= 500 || res.status === 429) errors += 1;
      } catch {
        errors += 1;
      }
      timings.push(performance.now() - t0);
    }
  }));
  const seconds = (Date.now() - started) / 1000;
  timings.sort((a, b) => a - b);
  const p50 = percentile(timings, 50), p95 = percentile(timings, 95), p99 = percentile(timings, 99);
  const ok = p95 <= P95_BUDGET && errors === 0;
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${path}  n=${timings.length} c=${CONCURRENCY}  ${(timings.length / seconds).toFixed(1)} req/s  p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms  errors=${errors}`);
}
process.exit(failed ? 1 : 0);
