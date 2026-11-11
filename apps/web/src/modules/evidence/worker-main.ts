// Evidence worker entrypoint: `npm run worker:evidence`. Runs only in a trusted environment with
// the service-role key; never import this module from the web application.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { processPendingEvidence } from './pipeline.ts';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    JSON.stringify({
      component: 'njumeni-evidence-worker',
      type: 'startup_failed',
      code: 'EVIDENCE_WORKER_CONFIG_MISSING',
    }),
  );
  process.exit(2);
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let total = 0;
for (let round = 0; round < 100; round += 1) {
  const result = await processPendingEvidence({ client, limit: 10 });
  total += result.processed;
  console.log(JSON.stringify({ component: 'njumeni-evidence-worker', type: 'batch', ...result }));
  if (result.processed === 0 || result.errors.length === result.processed) break;
}
console.log(
  JSON.stringify({ component: 'njumeni-evidence-worker', type: 'drained', processed: total }),
);
