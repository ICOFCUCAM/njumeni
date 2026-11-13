import type { Metadata } from 'next';
import { ResearchDemo } from '../../research-demo';
import { CtaBand, Kicker, PageIntro, Related, Tag } from '../../site';

export const metadata: Metadata = {
  title: { absolute: 'Legal research — Njumeni' },
  description:
    'Question-based legal research that answers from the official text in force on your date, quotes it exactly, cites it — and declines when the evidence is not there.',
  alternates: { canonical: '/platform/research' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Legal research"
        title={
          <>
            Ask a question. <em>Receive the authority.</em>
          </>
        }
        lead="Every answer is assembled from the official text, checked against the date you chose, and verified before you see it. When the evidence is not there, Njumeni declines."
      />
      {/* 03 — Legal research */}
      <section id="research" className="nj-s nj-s--paper" aria-labelledby="research-title">
        <div className="nj-wrap">
          <h2 id="research-title" className="nj-sr">
            The research engine
          </h2>
          <ResearchDemo />
          <div className="nj-research2">
            <ol className="nj-steps8">
              <li>
                <b>Ask a legal question</b>
                <span>In your own words, in Norwegian or English.</span>
              </li>
              <li>
                <b>Select the jurisdiction</b>
                <span>Each legal system is searched on its own terms.</span>
              </li>
              <li>
                <b>Select the legal date</b>
                <span>Today, or the day the contract ended.</span>
              </li>
              <li>
                <b>Identify the applicable authority</b>
                <span>
                  Acts and regulations in force on that date, ranked by their place in the
                  hierarchy.
                </span>
              </li>
              <li>
                <b>Retrieve the supporting provisions</b>
                <span>Keyword and meaning search, then legal reranking.</span>
              </li>
              <li>
                <b>Produce a cited finding</b>
                <span>Exact quotations with citation, version and source.</span>
              </li>
              <li>
                <b>Verify the result</b>
                <span>
                  Citations, quotations, currency and permissions are checked; reviews can be
                  requested.
                </span>
              </li>
              <li className="nj-steps8-stop">
                <b>Refuse unsupported conclusions</b>
                <span>No authority on that date means no answer — not a guess.</span>
              </li>
            </ol>
            <div className="nj-datepanel" role="group" aria-labelledby="date-title">
              <h3 id="date-title">Why the date matters</h3>
              <p>
                A law can be published months before it takes effect, and stay in force long after
                it is amended. The right answer depends on the version in force on your date.
              </p>
              <div className="nj-timeline" aria-hidden="true">
                <span className="nj-timeline-mark" style={{ left: '40%' }}>
                  published
                </span>
                <span className="nj-timeline-mark" style={{ left: '75%' }}>
                  in force
                </span>
                <div className="nj-timeline-axis">
                  <span>Previous version applies</span>
                  <span>Still the previous version</span>
                  <span>New version</span>
                </div>
              </div>
              <ul className="nj-datepanel-list">
                <li>
                  <b>Publication is not commencement.</b> Between the two, the old law still
                  governs.
                </li>
                <li>
                  <b>Every finding carries its version</b> and the dates it was in force.
                </li>
                <li>
                  <b>If the version for your date is not held,</b> Njumeni says so instead of
                  answering from another text.
                </li>
              </ul>
            </div>
          </div>
          <div className="nj-status-line">
            <Tag status="built" /> Research engine, verification and refusals.
            <Tag status="awaiting" /> Norwegian sources (Lovdata) await rights activation; retrieval
            quality is being evaluated independently before coverage is claimed.
          </div>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="built-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>How an answer is built</Kicker>
              <h2 id="built-title">
                Four disciplines, <em>in every answer.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Retrieval finds the candidate provisions; the date selects the version; verification
              checks what will be shown; and when any of them fails, the answer is withheld.
            </p>
          </div>
          <ol className="nj-pillars">
            <li>
              <small>Retrieval</small>
              <b>Keyword and meaning, together</b>
              <span>
                Lexical search finds the words; a multilingual model ranks passages by meaning;
                legal reranking puts the governing provision first.
              </span>
            </li>
            <li>
              <small>Time</small>
              <b>The version in force on your date</b>
              <span>
                Every provision is held with its versions and dates. Publication is not
                commencement: the old text governs until the new one takes effect.
              </span>
            </li>
            <li>
              <small>Verification</small>
              <b>Checked before it is shown</b>
              <span>
                The citation must exist, the quotation must match the held text, the version must be
                in force and the source must permit quotation.
              </span>
            </li>
            <li>
              <small>Responsibility</small>
              <b>Declines rather than guesses</b>
              <span>
                No authority on that date means no answer. The finding says why — and a review can
                be requested from a qualified person.
              </span>
            </li>
          </ol>
          <div className="nj-trace-note">
            <b>Traceable by design.</b> Every finding keeps its citation, version, source and
            licence, so it can be saved to a matter and cited in a document without losing where it
            came from.
          </div>
        </div>
      </section>
      <Related keys={['workspace', 'change', 'jurisdictions']} />
      <CtaBand title="See legal research grounded in the law." />
    </>
  );
}
