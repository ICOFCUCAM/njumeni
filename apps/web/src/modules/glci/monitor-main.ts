// GLCI monitoring worker (npm run worker:glci-monitor). Trusted environment only:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GLCI_MONITOR_WORKER_ID
//   optional: GLCI_MONITOR_INTERVAL_MS (default 60000), GLCI_MONITOR_ONCE=1 (one pass, then exit)
import { createClient } from '@supabase/supabase-js';
import { runMonitorCycle, type MonitorFetch } from './monitor.ts';
import { createSupabaseMonitorPersistence } from './monitor-persistence.ts';
import { glciMonitorAdapters } from './monitors/registry.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('GLCI_MONITOR_ENV_MISSING_' + name);
  return value;
}
const workerId = required('GLCI_MONITOR_WORKER_ID');
if (!/^[A-Za-z0-9._:-]{1,120}$/.test(workerId)) throw new Error('GLCI_MONITOR_WORKER_ID_INVALID');
const client = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const persistence = createSupabaseMonitorPersistence(client);
const interval = Number(process.env.GLCI_MONITOR_INTERVAL_MS ?? 60_000);
const controller = new AbortController();
process.once('SIGTERM', () => controller.abort());
process.once('SIGINT', () => controller.abort());
do {
  const result = await runMonitorCycle({ workerId, persistence, adapters: glciMonitorAdapters, fetch: globalThis.fetch as unknown as MonitorFetch });
  for (const item of result.outcomes) console.log(JSON.stringify({ event: 'glci.monitor', ...item, at: new Date().toISOString() }));
  if (process.env.GLCI_MONITOR_ONCE === '1') break;
  await new Promise(resolve => setTimeout(resolve, interval));
} while (!controller.signal.aborted);
