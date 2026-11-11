import type { SupabaseClient } from '@supabase/supabase-js';
import { assessJurisdictionCoverage, type JurisdictionCoverageAssessment, type JurisdictionCoverageProfile } from './coverage.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;
export interface JurisdictionCoverageSnapshot {
  profile: JurisdictionCoverageProfile;
  assessment: JurisdictionCoverageAssessment;
}
function parseProfile(value: unknown): JurisdictionCoverageProfile {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') throw new Error('LEGAL_COVERAGE_RESPONSE_INVALID');
  const data = row as Record<string, unknown>;
  if (typeof data.jurisdictionCode !== 'string' ||
      !Array.isArray(data.requestedAuthorityTypes) ||
      !Array.isArray(data.requestedLanguages) || !Array.isArray(data.sources) ||
      typeof data.reviewIntervalDays !== 'number') {
    throw new Error('LEGAL_COVERAGE_RESPONSE_INVALID');
  }
  return data as unknown as JurisdictionCoverageProfile;
}
export async function getJurisdictionCoverageSnapshot(
  client: RpcClient, jurisdictionCode: string, now = new Date(),
): Promise<JurisdictionCoverageSnapshot> {
  if (!/^[A-Z][A-Z0-9_-]{1,15}$/.test(jurisdictionCode)) {
    throw new Error('LEGAL_COVERAGE_JURISDICTION_INVALID');
  }
  const { data, error } = await client.rpc('legal_jurisdiction_coverage_snapshot', {
    p_jurisdiction_code: jurisdictionCode,
  });
  if (error) throw new Error('LEGAL_COVERAGE_SNAPSHOT_LOAD_FAILED');
  const profile = parseProfile(data);
  if (profile.jurisdictionCode !== jurisdictionCode) throw new Error('LEGAL_COVERAGE_SCOPE_MISMATCH');
  return { profile, assessment: assessJurisdictionCoverage(profile, now) };
}

export interface SourceCoverageReviewInput {
  sourceId: string;
  reviewer: string;
  reason: string;
  authorityTypes: readonly string[];
  languages: readonly string[];
  coverageFrom: string | null;
  coverageUntil: string | null;
  lastVerifiedAt: string;
  knownGaps: readonly string[];
}
export async function recordSourceCoverageReview(
  client: RpcClient, input: SourceCoverageReviewInput,
): Promise<{sourceId:string;sourceKey:string;coverage:Record<string,unknown>}> {
  if (!input.sourceId.trim() || !input.reviewer.trim() || !input.reason.trim() ||
      input.reason.trim().length < 10 || input.reason.length > 1000 ||
      input.authorityTypes.length < 1 || input.authorityTypes.length > 20 ||
      input.languages.length < 1 || input.languages.length > 30 ||
      input.knownGaps.length > 100) throw new Error('LEGAL_SOURCE_COVERAGE_REVIEW_INVALID');
  const timestamp = Date.parse(input.lastVerifiedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== input.lastVerifiedAt ||
      timestamp > Date.now()) throw new Error('LEGAL_SOURCE_COVERAGE_REVIEW_TIMESTAMP_INVALID');
  const validDate = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value+'T00:00:00.000Z')) &&
    new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
  if ((input.coverageFrom && !validDate(input.coverageFrom)) ||
      (input.coverageUntil && !validDate(input.coverageUntil)) ||
      (input.coverageFrom && input.coverageUntil && input.coverageUntil <= input.coverageFrom)) {
    throw new Error('LEGAL_SOURCE_COVERAGE_REVIEW_DATES_INVALID');
  }
  const {data,error}=await client.rpc('legal_source_record_coverage_review',{
    p_source_id:input.sourceId,p_reviewer:input.reviewer.trim(),p_reason:input.reason.trim(),
    p_authority_types:[...input.authorityTypes],p_languages:[...input.languages],
    p_coverage_from:input.coverageFrom,p_coverage_until:input.coverageUntil,
    p_last_verified_at:input.lastVerifiedAt,p_known_gaps:[...input.knownGaps],
  });
  if(error)throw new Error('LEGAL_SOURCE_COVERAGE_REVIEW_SAVE_FAILED');
  if(!data||typeof data!=='object')throw new Error('LEGAL_SOURCE_COVERAGE_REVIEW_RESPONSE_INVALID');
  const result=data as Record<string,unknown>;
  if(typeof result.sourceId!=='string'||typeof result.sourceKey!=='string'||
      !result.coverage||typeof result.coverage!=='object') {
    throw new Error('LEGAL_SOURCE_COVERAGE_REVIEW_RESPONSE_INVALID');
  }
  return {sourceId:result.sourceId,sourceKey:result.sourceKey,coverage:result.coverage as Record<string,unknown>};
}

export interface JurisdictionCoverageScopeInput {
  jurisdictionCode:string;
  reviewer:string;
  reason:string;
  authorityTypes:readonly string[];
  reviewIntervalDays:number;
}
export async function recordJurisdictionCoverageScope(
  client:RpcClient,input:JurisdictionCoverageScopeInput,
):Promise<Record<string,unknown>> {
  if(!/^[A-Z][A-Z0-9_-]{1,15}$/.test(input.jurisdictionCode)||
    !input.reviewer.trim()||input.reviewer.length>200||
    input.reason.trim().length<10||input.reason.length>1000||
    input.authorityTypes.length<1||input.authorityTypes.length>20||
    !Number.isInteger(input.reviewIntervalDays)||input.reviewIntervalDays<1||input.reviewIntervalDays>365) {
    throw new Error('LEGAL_JURISDICTION_COVERAGE_SCOPE_INVALID');
  }
  const {data,error}=await client.rpc('legal_jurisdiction_record_coverage_scope',{
    p_jurisdiction_code:input.jurisdictionCode,p_reviewer:input.reviewer.trim(),
    p_reason:input.reason.trim(),p_authority_types:[...input.authorityTypes],
    p_review_interval_days:input.reviewIntervalDays,
  });
  if(error)throw new Error('LEGAL_JURISDICTION_COVERAGE_SCOPE_SAVE_FAILED');
  if(!data||typeof data!=='object')throw new Error('LEGAL_JURISDICTION_COVERAGE_SCOPE_RESPONSE_INVALID');
  return data as Record<string,unknown>;
}

export interface RecordableEvaluationReport {
  datasetKey: string;
  datasetVersion: number;
  caseCount: number;
  passed: boolean;
  metrics: object;
  gates: readonly { metric: string; threshold: number; value: number | null; passed: boolean }[];
}

/**
 * Records a retrieval evaluation run as append-only coverage evidence (Task 2.7). A run can only
 * be recorded as passed when every reported gate passed; the database re-checks this.
 */
export async function recordRetrievalEvaluation(
  client: RpcClient,
  input: {
    jurisdictionCode: string;
    report: RecordableEvaluationReport;
    contentLicence: string;
    recordedBy: string;
    codeRevision?: string | null;
  },
): Promise<string> {
  if (!/^[A-Z][A-Z0-9_-]{1,15}$/.test(input.jurisdictionCode)) {
    throw new Error('LEGAL_COVERAGE_JURISDICTION_INVALID');
  }
  if (!input.recordedBy.trim() || !input.contentLicence.trim()) {
    throw new Error('LEGAL_EVALUATION_RECORD_INVALID');
  }
  if (input.report.passed && !input.report.gates.every((gate) => gate.passed)) {
    throw new Error('LEGAL_EVALUATION_PASS_INCONSISTENT');
  }
  const { data, error } = await client.rpc('legal_record_retrieval_evaluation', {
    p_jurisdiction_code: input.jurisdictionCode,
    p_dataset_key: input.report.datasetKey,
    p_dataset_version: input.report.datasetVersion,
    p_content_licence: input.contentLicence,
    p_case_count: input.report.caseCount,
    p_passed: input.report.passed,
    p_metrics: input.report.metrics,
    p_gates: input.report.gates,
    p_code_revision: input.codeRevision ?? null,
    p_recorded_by: input.recordedBy,
  });
  if (error || typeof data !== 'string') throw new Error('LEGAL_EVALUATION_RECORD_FAILED');
  return data;
}
