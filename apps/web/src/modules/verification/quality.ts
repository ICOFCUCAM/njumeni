// Verification and legal quality (Phase 6; Master Plan v2.0 §8.3–§8.5). The database re-verifies
// research and opens human review gates; this module presents the results. Following §8.4, no
// numeric confidence is shown: scores are uncalibrated until real evaluation data exists, so the
// outcome is reported as a verdict with its findings and disclosed limitations.
import type { SupabaseClient } from '@supabase/supabase-js';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

export type VerificationOutcome = 'clear' | 'review_required' | 'blocked';
export type FindingSeverity = 'info' | 'warning' | 'blocking';
export interface VerificationFinding {
  claimOrdinal: number | null;
  checkType: string;
  severity: FindingSeverity;
  code: string;
  detail: string;
}
export interface ReviewSummary {
  id: string;
  gate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  decidedAt: string | null;
  decisionNote: string | null;
  selfReview: boolean;
}
export interface RunQuality {
  organizationId: string;
  workspaceId: string;
  latestReport: {
    id: string;
    checkedAsOf: string;
    outcome: VerificationOutcome;
    checkerVersion: string;
    createdAt: string;
    findings: VerificationFinding[];
  } | null;
  reviews: ReviewSummary[];
}

export const GATE_LABELS: Record<string, string> = {
  conflicting_authority: 'Conflicting authorities',
  low_coverage: 'Limited coverage',
  changed_law: 'Law changed since the research',
  verification_failure: 'Verification failure',
  high_impact: 'High-impact conclusion',
  sensitive_evidence: 'Sensitive evidence interpretation',
  institutional_output: 'Institutional output',
};
export const MANUAL_GATES = ['high_impact', 'sensitive_evidence', 'institutional_output'] as const;

export const CHECK_LABELS: Record<string, string> = {
  currency: 'Currency',
  treatment: 'Treatment',
  conflict: 'Conflict',
  jurisdiction_fit: 'Jurisdiction fit',
  source_rights: 'Source rights',
  limitation: 'Limitations',
};

/**
 * The status shown to the user. A run may be relied on only when its latest check is clear and
 * every review gate has been approved; anything else says what is outstanding.
 */
export function qualityStatus(quality: RunQuality): {
  state:
    | 'unchecked'
    | 'blocked'
    | 'awaiting_review'
    | 'changes_requested'
    | 'rejected'
    | 'verified';
  label: string;
  pendingReviews: number;
} {
  const pendingReviews = quality.reviews.filter((review) => review.status === 'pending').length;
  const report = quality.latestReport;
  if (!report) return { state: 'unchecked', label: 'Not yet re-verified', pendingReviews };
  if (quality.reviews.some((r) => r.status === 'rejected'))
    return { state: 'rejected', label: 'Rejected by a reviewer', pendingReviews };
  if (quality.reviews.some((r) => r.status === 'changes_requested'))
    return { state: 'changes_requested', label: 'A reviewer requested changes', pendingReviews };
  if (report.outcome === 'blocked' && pendingReviews > 0)
    return { state: 'blocked', label: 'Blocked: verification failed', pendingReviews };
  if (pendingReviews > 0)
    return {
      state: 'awaiting_review',
      label: `Awaiting human review (${pendingReviews})`,
      pendingReviews,
    };
  if (report.outcome === 'blocked')
    return { state: 'blocked', label: 'Blocked: verification failed', pendingReviews };
  return {
    state: 'verified',
    label:
      report.outcome === 'clear'
        ? `Verified against the law on ${report.checkedAsOf}`
        : 'Reviewed and approved',
    pendingReviews,
  };
}

export function sortFindings(findings: readonly VerificationFinding[]): VerificationFinding[] {
  const rank: Record<FindingSeverity, number> = { blocking: 0, warning: 1, info: 2 };
  return [...findings].sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      (a.claimOrdinal ?? 99) - (b.claimOrdinal ?? 99) ||
      a.code.localeCompare(b.code),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyResearchRun(
  client: RpcClient,
  runId: string,
  checkDate?: string,
): Promise<{ reportId: string; outcome: VerificationOutcome; findings: number }> {
  if (!UUID.test(runId)) throw new Error('VERIFICATION_INPUT_INVALID');
  if (checkDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(checkDate))
    throw new Error('VERIFICATION_INPUT_INVALID');
  const { data, error } = await client.rpc('verification_check_research_run', {
    p_run_id: runId,
    ...(checkDate ? { p_check_date: checkDate } : {}),
  });
  if (error) {
    const code = error.message.match(/[A-Z][A-Z_]{5,}/)?.[0];
    throw new Error(
      code === 'QUALITY_NOT_AUTHORISED' || code === 'VERIFICATION_DATE_BEFORE_RESEARCH_DATE'
        ? code
        : 'VERIFICATION_FAILED',
    );
  }
  return data as { reportId: string; outcome: VerificationOutcome; findings: number };
}

export async function decideReview(
  client: RpcClient,
  requestId: string,
  decision: 'approved' | 'rejected' | 'changes_requested',
  note: string,
): Promise<void> {
  if (!UUID.test(requestId)) throw new Error('REVIEW_INPUT_INVALID');
  const trimmed = note.trim();
  if (decision !== 'approved' && trimmed.length < 3) throw new Error('REVIEW_NOTE_REQUIRED');
  const { error } = await client.rpc('review_decide', {
    p_request_id: requestId,
    p_decision: decision,
    ...(trimmed ? { p_note: trimmed } : {}),
  });
  if (error) {
    const code = error.message.match(/[A-Z][A-Z_]{5,}/)?.[0];
    throw new Error(
      code &&
        ['REVIEW_FOUR_EYES_REQUIRED', 'REVIEW_ALREADY_DECIDED', 'QUALITY_NOT_AUTHORISED'].includes(
          code,
        )
        ? code
        : 'REVIEW_FAILED',
    );
  }
}
