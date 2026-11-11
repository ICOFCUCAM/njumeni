import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

export default async function ResearchRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!UUID.test(runId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('research_get_run', { p_run_id: runId });
  if (error || !data) notFound();
  const run = data as unknown as Run;
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
