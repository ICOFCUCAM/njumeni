// Runs a retrieval evaluation dataset against a Supabase database through the real search pipeline.
// Usage (from apps/web; trusted environment only):
//   NJUMENI_EVAL_SUPABASE_URL=... NJUMENI_EVAL_SERVICE_KEY=... \
//   npm run eval:retrieval -- ../../legal-data/evaluation-datasets/synthetic-no-v1.json [lexical|semantic|hybrid]
// Set NJUMENI_EVAL_RECORD_AS=<reviewer> to record the run as coverage evidence (Task 2.7).
// Exit code 0 when every gate passes, 1 otherwise. Never run against data you may not process.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createRetrievalPlan, executeLegalRetrieval } from '../src/modules/legal-knowledge/retrieval.ts';
import { createSupabaseLegalPassageSearchProvider } from '../src/modules/legal-knowledge/supabase-retrieval-provider.ts';
import { evaluateRetrieval } from '../src/modules/legal-knowledge/retrieval-evaluation.ts';
import { recordRetrievalEvaluation } from '../src/modules/legal-knowledge/coverage-admin-core.ts';
import { createLocalLegalEmbedder } from '../src/modules/legal-knowledge/local-embedder.ts';

const [datasetPath, defaultMode] = process.argv.slice(2);
const url = process.env.NJUMENI_EVAL_SUPABASE_URL;
const key = process.env.NJUMENI_EVAL_SERVICE_KEY;
if (!datasetPath || !url || !key) {
  console.error('Usage: NJUMENI_EVAL_SUPABASE_URL and NJUMENI_EVAL_SERVICE_KEY must be set; pass a dataset path.');
  process.exit(2);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
// Semantic and hybrid modes embed each question with the active profile's local model (worker-only
// runtime: see docs/PHASE_2_TASK_2_5_WORKER_DEPLOYMENT.md). Lexical runs need no model.
const needsEmbeddings = (defaultMode ?? 'hybrid') !== 'lexical' ||
  dataset.cases?.some((item) => item.mode && item.mode !== 'lexical');
const provider = createSupabaseLegalPassageSearchProvider(
  client,
  needsEmbeddings ? createLocalLegalEmbedder().embedQuery : undefined,
);
const report = await evaluateRetrieval({
  dataset,
  defaultMode: defaultMode ?? 'hybrid',
  search: (query) => executeLegalRetrieval(createRetrievalPlan(query), provider),
});

console.log(`Dataset ${report.datasetKey} v${report.datasetVersion}: ${report.caseCount} cases`);
for (const [metric, value] of Object.entries(report.metrics)) {
  console.log(`  ${metric.padEnd(20)} ${value === null ? 'n/a' : value.toFixed(3)}`);
}
for (const gate of report.gates) {
  console.log(`  gate ${gate.metric} >= ${gate.threshold}: ${gate.passed ? 'PASS' : 'FAIL'}`);
}
for (const item of report.cases.filter((c) => c.error)) console.log(`  error in ${item.id}: ${item.error}`);
console.log(report.passed ? 'RESULT: PASS' : 'RESULT: FAIL');
if (process.env.NJUMENI_EVAL_RECORD_AS) {
  const id = await recordRetrievalEvaluation(client, {
    jurisdictionCode: dataset.jurisdictionCode,
    report,
    contentLicence: dataset.contentLicence,
    recordedBy: process.env.NJUMENI_EVAL_RECORD_AS,
    codeRevision: process.env.NJUMENI_EVAL_CODE_REVISION ?? null,
  });
  console.log(`Recorded evaluation ${id}`);
}
process.exit(report.passed ? 0 : 1);
