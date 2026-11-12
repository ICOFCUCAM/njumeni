import Link from 'next/link';
import { notFound } from 'next/navigation';
import { recheckResearch, requestResearchReview } from '../actions';
import { createClient } from '@/lib/supabase/server';
import {
  CHECK_LABELS,
  GATE_LABELS,
  MANUAL_GATES,
  qualityStatus,
  sortFindings,
  type RunQuality,
} from '@/modules/verification/quality';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Claim {
  ordinal: number;
  category: string;
  statement: string;
  verificationStatus: 'verified' | 'failed' | 'not_applicable';
  failureCodes: string[];
  sourceUri: string | null;
}
interface Run {
  question: string;
  jurisdictionCode: string;
  asOfDate: string;
  status: 'answered' | 'abstained';
  coverageLevel: string;
  limitations: string[];
  engineVersion: string;
  claims: Claim[];
}

const SECTIONS: { category: string; title: string }[] = [
  { category: 'verified_authority', title: 'Verified legal authority' },
  { category: 'interpretation', title: 'Interpretation' },
  { category: 'conflicting_authority', title: 'Potentially conflicting authorities' },
  { category: 'factual_assumption', title: 'Factual assumptions' },
  { category: 'inference', title: 'Inferences' },
  { category: 'unresolved_question', title: 'Unresolved questions' },
];

const FAILURE_TEXT: Record<string, string> = {
  CITATION_NOT_FOUND: 'the cited source does not exist',
  CITATION_MISMATCH: 'the citation does not match the source',
  AUTHORITY_NOT_IN_FORCE_ON_DATE: 'the version was not in force on the research date',
  SOURCE_NOT_PERMITTED: 'the source is not approved for use',
  QUOTATION_MISMATCH: 'the quotation does not match the source text',
  QUOTATION_NOT_PERMITTED: 'the source does not permit quotation',
};

const PAGE_ERRORS: Record<string, string> = {
  'not-authorized': 'You do not have permission to re-verify research in this workspace.',
  'check-failed': 'The verification could not be completed. Try again.',
  'invalid-review': 'Choose a review type and give a reason of at least three characters.',
  'review-pending': 'A review of that type is already pending.',
  'review-failed': 'The review could not be requested.',
};

export default async function ResearchRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { runId } = await params;
  const { error: pageError } = await searchParams;
  if (!UUID.test(runId)) notFound();
  const supabase = await createClient();
  const [{ data, error }, qualityResult] = await Promise.all([
    supabase.rpc('research_get_run', { p_run_id: runId }),
    supabase.rpc('verification_get_run_quality', { p_run_id: runId }),
  ]);
  if (error || !data) notFound();
  const run = data as unknown as Run;
  const quality = (qualityResult.data ?? null) as unknown as RunQuality | null;
  const status = quality ? qualityStatus(quality) : null;
  const failed = run.claims.filter((claim) => claim.verificationStatus === 'failed');

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href="/research">Legal research</Link>
        </p>
        <h1 className="page-title">{run.question}</h1>
        <p className="page-description">
          {run.jurisdictionCode} · law as it stood on {run.asOfDate} · coverage: {run.coverageLevel}{' '}
          ·{' '}
          <strong>
            {run.status === 'answered'
              ? 'Answered from verified sources'
              : 'No verified authority found'}
          </strong>
        </p>
      </header>

      {pageError && PAGE_ERRORS[pageError] ? (
        <p role="alert" className="module-panel">
          {PAGE_ERRORS[pageError]}
        </p>
      ) : null}

      {SECTIONS.map(({ category, title }) => {
        const claims = run.claims.filter(
          (claim) => claim.category === category && claim.verificationStatus !== 'failed',
        );
        if (claims.length === 0) return null;
        return (
          <section key={category} className="module-panel" aria-label={title}>
            <h2 className="section-heading">{title}</h2>
            <ul className="membership-list">
              {claims.map((claim) => (
                <li key={claim.ordinal} className="membership-row">
                  {claim.verificationStatus === 'verified' ? (
                    <span
                      className="workspace-status"
                      title="Citation, currency, source rights and quotation verified"
                    >
                      ✓ verified
                    </span>
                  ) : null}{' '}
                  {claim.statement}{' '}
                  {claim.sourceUri ? (
                    <a href={claim.sourceUri} rel="noopener noreferrer">
                      official source
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {failed.length > 0 ? (
        <section className="module-panel" aria-label="Withheld claims">
          <h2 className="section-heading">Withheld: failed verification</h2>
          <p>These statements were not shown as law because they could not be verified.</p>
          <ul className="membership-list">
            {failed.map((claim) => (
              <li key={claim.ordinal} className="membership-row">
                ✗ {claim.failureCodes.map((code) => FAILURE_TEXT[code] ?? code).join('; ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {quality && status ? (
        <section id="verification" className="module-panel" aria-labelledby="verification-heading">
          <h2 id="verification-heading" className="section-heading">
            Verification and review
          </h2>
          <p>
            <strong>{status.label}</strong>
            {quality.latestReport ? (
              <small>
                {' '}
                · checked against the law on {quality.latestReport.checkedAsOf} (
                {quality.latestReport.checkerVersion})
              </small>
            ) : null}
          </p>
          {quality.latestReport && quality.latestReport.findings.length > 0 ? (
            <ul className="membership-list">
              {sortFindings(quality.latestReport.findings).map((finding, index) => (
                <li key={`${finding.code}-${index}`} className="membership-row">
                  <span className="workspace-status">
                    {finding.severity === 'blocking'
                      ? '✗ blocking'
                      : finding.severity === 'warning'
                        ? '! needs review'
                        : 'i note'}{' '}
                    · {CHECK_LABELS[finding.checkType] ?? finding.checkType}
                  </span>{' '}
                  {finding.detail}
                </li>
              ))}
            </ul>
          ) : null}
          {quality.reviews.length > 0 ? (
            <ul className="membership-list" aria-label="Review gates">
              {quality.reviews.map((review) => (
                <li key={review.id} className="membership-row">
                  {GATE_LABELS[review.gate] ?? review.gate}: {review.status.replace('_', ' ')}
                  {review.decisionNote ? <small> · “{review.decisionNote}”</small> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <form action={recheckResearch} className="profile-actions">
            <input type="hidden" name="runId" value={runId} />
            <button type="submit" className="auth-submit">
              Re-verify against today’s law
            </button>{' '}
            <Link href={`/reviews?org=${quality.organizationId}&ws=${quality.workspaceId}`}>
              Open human review
            </Link>
          </form>
          <form action={requestResearchReview} className="profile-field-grid">
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="organizationId" value={quality.organizationId} />
            <input type="hidden" name="workspaceId" value={quality.workspaceId} />
            <label className="profile-field">
              Ask for a review
              <select name="gate" defaultValue="high_impact">
                {MANUAL_GATES.map((gate) => (
                  <option key={gate} value={gate}>
                    {GATE_LABELS[gate]}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              Reason
              <input name="reason" required minLength={3} maxLength={1000} />
            </label>
            <div className="profile-actions">
              <button type="submit">Request review</button>
            </div>
          </form>
          <p>
            <small>
              No numeric confidence is shown: scores are only displayed once they are calibrated
              against evaluation data (master plan §8.4).
            </small>
          </p>
        </section>
      ) : null}

      <section className="module-panel" aria-label="Limitations">
        <h2 className="section-heading">Limitations</h2>
        <ul className="membership-list">
          {run.limitations.map((limitation) => (
            <li key={limitation} className="membership-row">
              {limitation}
            </li>
          ))}
        </ul>
        <p>
          <small>Engine {run.engineVersion}</small>
        </p>
      </section>
    </article>
  );
}
