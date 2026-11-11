// Retrieval evaluation harness (Phase 2 Task 2.10; Master Plan v2.0 §18.2, U-15).
// Datasets name expected authorities by stable (sourceKey, citation) pairs, never by database IDs,
// so the same dataset runs against any environment.
import type { RankedLegalPassage, RetrievalMode, RetrievalQuery } from './retrieval.ts';

export interface EvaluationAuthorityRef {
  sourceKey: string;
  citation: string;
}

export interface RetrievalEvaluationCase {
  id: string;
  question: string;
  asOfDate: string;
  languageCodes: readonly string[];
  mode?: RetrievalMode;
  /** Authorities that a correct answer must retrieve. Empty means the system must abstain. */
  relevant: readonly EvaluationAuthorityRef[];
  /** When set, the top relevant hit must be the version in force from this date (currency check). */
  expectedValidFrom?: string | null;
}

export interface RetrievalEvaluationDataset {
  datasetKey: string;
  version: number;
  jurisdictionCode: string;
  description: string;
  /** Provenance of the questions and answers: synthetic or a licence identifier. */
  contentLicence: string;
  cases: readonly RetrievalEvaluationCase[];
}

export interface RetrievalEvaluationGate {
  metric: keyof RetrievalEvaluationMetrics;
  threshold: number;
}

export interface RetrievalEvaluationMetrics {
  recallAt10: number | null;
  precisionAt5: number | null;
  meanReciprocalRank: number | null;
  currencyAccuracy: number | null;
  abstentionAccuracy: number | null;
}

export interface RetrievalEvaluationCaseResult {
  id: string;
  abstentionCase: boolean;
  retrievedAuthorities: string[];
  recallAt10: number | null;
  precisionAt5: number | null;
  reciprocalRank: number | null;
  currencyCorrect: boolean | null;
  abstainedCorrectly: boolean | null;
  error: string | null;
}

export interface RetrievalEvaluationReport {
  datasetKey: string;
  datasetVersion: number;
  caseCount: number;
  metrics: RetrievalEvaluationMetrics;
  gates: { metric: string; threshold: number; value: number | null; passed: boolean }[];
  passed: boolean;
  cases: RetrievalEvaluationCaseResult[];
}

/** Initial release gates from Master Plan v2.0 §18.2 (to be recalibrated with real data). */
export const DEFAULT_RETRIEVAL_GATES: readonly RetrievalEvaluationGate[] = Object.freeze([
  { metric: 'recallAt10', threshold: 0.8 },
  { metric: 'precisionAt5', threshold: 0.6 },
  { metric: 'currencyAccuracy', threshold: 0.95 },
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z0-9][a-z0-9._-]{1,79}$/;

function refKey(ref: { sourceKey: string; citation: string | null }): string {
  return ref.sourceKey + '|' + (ref.citation ?? '').trim();
}

function fail(message: string): never {
  throw new Error('LEGAL_EVALUATION_DATASET_INVALID: ' + message);
}

export function validateRetrievalDataset(value: unknown): RetrievalEvaluationDataset {
  const dataset = value as RetrievalEvaluationDataset;
  if (!dataset || typeof dataset !== 'object') fail('not an object');
  if (!KEY.test(dataset.datasetKey ?? '')) fail('datasetKey');
  if (!Number.isInteger(dataset.version) || dataset.version < 1) fail('version');
  if (!/^[A-Z][A-Z0-9_-]{1,15}$/.test(dataset.jurisdictionCode ?? '')) fail('jurisdictionCode');
  if (typeof dataset.contentLicence !== 'string' || !dataset.contentLicence.trim()) {
    fail('contentLicence');
  }
  if (!Array.isArray(dataset.cases) || dataset.cases.length === 0) fail('cases');
  const ids = new Set<string>();
  for (const item of dataset.cases) {
    if (!KEY.test(item?.id ?? '') || ids.has(item.id)) fail('case id ' + String(item?.id));
    ids.add(item.id);
    if (typeof item.question !== 'string' || !item.question.trim()) fail(item.id + ' question');
    if (!ISO_DATE.test(item.asOfDate ?? '')) fail(item.id + ' asOfDate');
    if (!Array.isArray(item.languageCodes) || item.languageCodes.length === 0) {
      fail(item.id + ' languageCodes');
    }
    if (item.mode !== undefined && !['lexical', 'semantic', 'hybrid'].includes(item.mode)) {
      fail(item.id + ' mode');
    }
    if (!Array.isArray(item.relevant)) fail(item.id + ' relevant');
    for (const ref of item.relevant) {
      if (
        !KEY.test(ref?.sourceKey ?? '') ||
        typeof ref.citation !== 'string' ||
        !ref.citation.trim()
      ) {
        fail(item.id + ' relevant reference');
      }
    }
    if (
      item.expectedValidFrom !== undefined &&
      item.expectedValidFrom !== null &&
      !ISO_DATE.test(item.expectedValidFrom)
    ) {
      fail(item.id + ' expectedValidFrom');
    }
    if (item.expectedValidFrom !== undefined && item.relevant.length === 0) {
      fail(item.id + ' currency check requires a relevant authority');
    }
  }
  return dataset;
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0
    ? null
    : present.reduce((sum, value) => sum + value, 0) / present.length;
}

function rate(values: (boolean | null)[]): number | null {
  const present = values.filter((value): value is boolean => value !== null);
  return present.length === 0 ? null : present.filter(Boolean).length / present.length;
}

/** Unique authorities in rank order (a statute may contribute several passages). */
function rankedAuthorities(results: readonly RankedLegalPassage[]): RankedLegalPassage[] {
  const seen = new Set<string>();
  const unique: RankedLegalPassage[] = [];
  for (const result of results) {
    const key = refKey(result);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }
  return unique;
}

export async function evaluateRetrieval(options: {
  dataset: unknown;
  search: (query: RetrievalQuery) => Promise<readonly RankedLegalPassage[]>;
  defaultMode?: RetrievalMode;
  gates?: readonly RetrievalEvaluationGate[];
}): Promise<RetrievalEvaluationReport> {
  const dataset = validateRetrievalDataset(options.dataset);
  const gates = options.gates ?? DEFAULT_RETRIEVAL_GATES;
  const cases: RetrievalEvaluationCaseResult[] = [];

  for (const item of dataset.cases) {
    const abstentionCase = item.relevant.length === 0;
    let results: readonly RankedLegalPassage[];
    try {
      results = await options.search({
        query: item.question,
        jurisdictionCode: dataset.jurisdictionCode,
        asOfDate: item.asOfDate,
        languageCodes: item.languageCodes,
        mode: item.mode ?? options.defaultMode ?? 'hybrid',
        limit: 10,
      });
    } catch (error) {
      cases.push({
        id: item.id,
        abstentionCase,
        retrievedAuthorities: [],
        recallAt10: abstentionCase ? null : 0,
        precisionAt5: abstentionCase ? null : 0,
        reciprocalRank: abstentionCase ? null : 0,
        currencyCorrect: item.expectedValidFrom === undefined ? null : false,
        abstainedCorrectly: abstentionCase ? false : null,
        error: error instanceof Error ? error.message : 'UNKNOWN',
      });
      continue;
    }
    const authorities = rankedAuthorities(results);
    const relevant = new Set(item.relevant.map(refKey));
    const top10 = authorities.slice(0, 10);
    const top5 = authorities.slice(0, 5);
    const firstHit = authorities.findIndex((result) => relevant.has(refKey(result)));

    cases.push({
      id: item.id,
      abstentionCase,
      retrievedAuthorities: authorities.map(refKey),
      recallAt10: abstentionCase
        ? null
        : top10.filter((result) => relevant.has(refKey(result))).length / relevant.size,
      // Precision over what was actually returned (at most 5), so that a correct single result
      // scores 1.0 and every irrelevant result returned lowers the score.
      precisionAt5: abstentionCase
        ? null
        : top5.length === 0
          ? 0
          : top5.filter((result) => relevant.has(refKey(result))).length / top5.length,
      reciprocalRank: abstentionCase ? null : firstHit < 0 ? 0 : 1 / (firstHit + 1),
      currencyCorrect:
        item.expectedValidFrom === undefined
          ? null
          : firstHit >= 0 && (authorities[firstHit]!.validFrom ?? null) === item.expectedValidFrom,
      abstainedCorrectly: abstentionCase ? authorities.length === 0 : null,
      error: null,
    });
  }

  const metrics: RetrievalEvaluationMetrics = {
    recallAt10: mean(cases.map((result) => result.recallAt10)),
    precisionAt5: mean(cases.map((result) => result.precisionAt5)),
    meanReciprocalRank: mean(cases.map((result) => result.reciprocalRank)),
    currencyAccuracy: rate(cases.map((result) => result.currencyCorrect)),
    abstentionAccuracy: rate(cases.map((result) => result.abstainedCorrectly)),
  };
  const gateResults = gates.map((gate) => {
    const value = metrics[gate.metric];
    // A gate with no measurable cases does not pass silently: it is reported as failed.
    return {
      metric: gate.metric,
      threshold: gate.threshold,
      value,
      passed: value !== null && value >= gate.threshold,
    };
  });
  return {
    datasetKey: dataset.datasetKey,
    datasetVersion: dataset.version,
    caseCount: cases.length,
    metrics,
    gates: gateResults,
    passed:
      gateResults.every((gate) => gate.passed) && cases.every((result) => result.error === null),
    cases,
  };
}
