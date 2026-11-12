// Runs a retrieval evaluation dataset against a Supabase database through the real search pipeline.
// Usage (from apps/web; trusted environment only):
//   NJUMENI_EVAL_SUPABASE_URL=... NJUMENI_EVAL_SERVICE_KEY=... \
//   npm run eval:retrieval -- ../../legal-data/evaluation-datasets/synthetic-no-v1.json [lexical|semantic|hybrid]
// Set NJUMENI_EVAL_RECORD_AS=<reviewer> to record the run as coverage evidence (Task 2.7).
// The production pipeline is evaluated by default: first-stage search plus the legal reranker, as
// the research engine runs it. NJUMENI_EVAL_FIRST_STAGE_ONLY=1 measures the first stage alone.
// Exit code 0 when every gate passes, 1 otherwise. Never run against data you may not process.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import {
  abstentionOptions, CALIBRATED_ABSTENTION, createRetrievalPlan, executeLegalRetrieval, LEGAL_ABSTENTION_VERSION,
} from '../src/modules/legal-knowledge/retrieval.ts';
import { createSupabaseLegalPassageSearchProvider } from '../src/modules/legal-knowledge/supabase-retrieval-provider.ts';
import { evaluateRetrieval } from '../src/modules/legal-knowledge/retrieval-evaluation.ts';
import { recordRetrievalEvaluation } from '../src/modules/legal-knowledge/coverage-admin-core.ts';
import { createLocalLegalEmbedder } from '../src/modules/legal-knowledge/local-embedder.ts';
import { CALIBRATED_RERANK_OPTIONS, createLegalReranker, LEGAL_RERANKER_VERSION } from '../src/modules/legal-knowledge/reranker.ts';

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
const firstStageOnly = process.env.NJUMENI_EVAL_FIRST_STAGE_ONLY === '1';
// Reranker settings for calibration sweeps, e.g. NJUMENI_EVAL_RERANK_OPTIONS='{"authorityMargin":0.85,"maxAuthorities":2}'.
// Default: the calibrated production profile.
const rerankOptions = process.env.NJUMENI_EVAL_RERANK_OPTIONS ? JSON.parse(process.env.NJUMENI_EVAL_RERANK_OPTIONS) : { ...CALIBRATED_RERANK_OPTIONS };
// Abstention policy for sweeps, e.g. NJUMENI_EVAL_ABSTENTION='{"temporalCoverage":true,"minSemanticScore":0.82}'.
// Default: the calibrated production policy. NJUMENI_EVAL_CURRENT_DATE is "today" for the temporal
// check (default: the real date). NJUMENI_EVAL_DIAGNOSTICS=1 prints what retrieval saw per case.
const abstentionPolicy = process.env.NJUMENI_EVAL_ABSTENTION
  ? { temporalCoverage: false, minSemanticScore: null, ...JSON.parse(process.env.NJUMENI_EVAL_ABSTENTION) }
  : { ...CALIBRATED_ABSTENTION };
const abstention = abstentionOptions(abstentionPolicy, process.env.NJUMENI_EVAL_CURRENT_DATE || undefined);
const observations = new Map();
const report = await evaluateRetrieval({
  dataset,
  defaultMode: defaultMode ?? 'hybrid',
  search: (query) =>
    firstStageOnly
      ? executeLegalRetrieval(createRetrievalPlan(query), provider)
      : executeLegalRetrieval(createRetrievalPlan(query), provider, {
          reranker: createLegalReranker({ ...rerankOptions, preferredLanguage: query.languageCodes[0] ?? null }),
          question: query.query,
          ...abstention,
          observe: (observation) => observations.set(query.query + '|' + query.asOfDate, observation),
        }),
});

console.log(`Dataset ${report.datasetKey} v${report.datasetVersion}: ${report.caseCount} cases`);
console.log(`  pipeline: ${firstStageOnly ? 'first stage only' : 'first stage + ' + LEGAL_RERANKER_VERSION + ' ' + JSON.stringify(rerankOptions) + ' + ' + LEGAL_ABSTENTION_VERSION + ' ' + JSON.stringify(abstentionPolicy)}`);
for (const [metric, value] of Object.entries(report.metrics)) {
  console.log(`  ${metric.padEnd(20)} ${value === null ? 'n/a' : value.toFixed(3)}`);
}
for (const gate of report.gates) {
  console.log(`  gate ${gate.metric} >= ${gate.threshold}: ${gate.passed ? 'PASS' : 'FAIL'}`);
}
for (const item of report.cases.filter((c) => c.error)) console.log(`  error in ${item.id}: ${item.error}`);
if (process.env.NJUMENI_EVAL_DIAGNOSTICS === '1') {
  const byId = new Map(dataset.cases.map((c) => [c.id, c]));
  for (const item of report.cases) {
    const source = byId.get(item.id);
    const seen = observations.get(source.question + '|' + source.asOfDate) ?? {};
    console.log(JSON.stringify({
      id: item.id, abstentionCase: item.abstentionCase, returned: item.retrievedAuthorities.length,
      abstainedCorrectly: item.abstainedCorrectly, recallAt10: item.recallAt10, precisionAt5: item.precisionAt5,
      bestSemantic: seen.bestSemanticScore ?? null, bestLexical: seen.bestLexicalScore ?? null, abstention: seen.abstention ?? null,
    }));
  }
}
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
