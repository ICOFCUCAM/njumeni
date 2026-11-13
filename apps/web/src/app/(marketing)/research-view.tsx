'use client';

import { useState } from 'react';

// Hero research stage. Everything shown is what Njumeni holds: the Working Environment Act
// (LOV-2005-06-17-62) from Lovdata's current-law dataset, consolidated version in force from
// 1 July 2026, quoted exactly. For dates before that version no text is held, so the answer is
// the engine's temporal refusal (legal-abstain-1.0.0), never a guess.
//
// Composition: the headline (children) and the answer share one stage; the "law as at" line runs
// under both, so the date visibly governs the answer.
const AXIS = { start: Date.UTC(2024, 0, 1), end: Date.UTC(2028, 0, 1) };
const VERSION_FROM = Date.UTC(2026, 6, 1);
const DATES = [
  {
    key: '2025-01-15',
    label: '15 Jan 2025',
    long: '15 January 2025',
    t: Date.UTC(2025, 0, 15),
    align: 'mid',
  },
  {
    key: '2026-08-01',
    label: '1 Aug 2026',
    long: '1 August 2026',
    t: Date.UTC(2026, 7, 1),
    align: 'end',
  },
  {
    key: '2026-11-12',
    label: '12 Nov 2026',
    long: '12 November 2026',
    t: Date.UTC(2026, 10, 12),
    align: 'start',
  },
] as const;
const pct = (t: number) => ((t - AXIS.start) / (AXIS.end - AXIS.start)) * 100;

export function ResearchView({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState(2);
  const date = DATES[index]!;
  const held = date.t >= VERSION_FROM;
  return (
    <div className="nj-stage">
      <div className="nj-stage-grid">
        <div className="nj-stage-copy">{children}</div>
        <figure className="nj-answer" aria-label="Example of a Njumeni research answer">
          <div className="nj-answer-bar">
            <span>Research · Norway</span>
            <span className="nj-answer-ex">Example view</span>
          </div>
          <p className="nj-answer-q">Can an employer dismiss an employee without a reason?</p>
          <div className="nj-answer-body" aria-live="polite">
            {held ? (
              <div key="held" className="nj-fade">
                <p className="nj-answer-kind">
                  <span className="nj-answer-dot" aria-hidden="true" />
                  Cited finding · law as at {date.label}
                </p>
                <h3 className="nj-answer-prov">
                  Working Environment Act § 15-7 (1)
                  <span lang="nb">arbeidsmiljøloven</span>
                </h3>
                <blockquote className="nj-answer-quote" lang="nb">
                  <p>
                    Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens,
                    arbeidsgiverens eller arbeidstakerens forhold.
                  </p>
                </blockquote>
                <dl className="nj-facets">
                  <div className="nj-facet nj-facet--source">
                    <dt>Source</dt>
                    <dd>Lovdata</dd>
                    <dd className="nj-facet-sub">Official · NLOD 2.0</dd>
                  </div>
                  <div className="nj-facet nj-facet--date">
                    <dt>Effective</dt>
                    <dd>In force from 1 July 2026</dd>
                    <dd className="nj-facet-sub">Covers your date</dd>
                  </div>
                  <div className="nj-facet nj-facet--cite">
                    <dt>Citation</dt>
                    <dd className="nj-mono">LOV-2005-06-17-62</dd>
                    <dd className="nj-facet-sub">§ 15-7, first paragraph</dd>
                  </div>
                  <div className="nj-facet nj-facet--check">
                    <dt>Verification</dt>
                    <dd>Checked before display</dd>
                    <dd className="nj-facet-sub">Citation · quotation · date · permission</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div key="declined" className="nj-fade nj-answer-no">
                <p className="nj-answer-kind nj-answer-kind--no">
                  <span className="nj-answer-dot" aria-hidden="true" />
                  No answer · law as at {date.label}
                </p>
                <h3 className="nj-answer-prov">Njumeni declines to answer</h3>
                <p className="nj-answer-decline">
                  Njumeni holds the current text of the law that answers this question, but not the
                  version in force on {date.long}. No answer is given rather than one from other
                  texts.
                </p>
              </div>
            )}
          </div>
          <figcaption className="nj-answer-foot">
            Example. The quotation is the text of the Act as held by Njumeni (contains data under
            NLOD 2.0 from Lovdata).
          </figcaption>
        </figure>
      </div>

      <div className="nj-lawline" role="group" aria-label="Date of the law">
        <div className="nj-lawline-read" aria-live="polite">
          <span>The law as at</span>
          <b>{date.label}</b>
          <small>{held ? 'Version held · answer given' : 'No version held · declined'}</small>
        </div>
        <div className="nj-lawline-track">
          <div className="nj-lawline-axis" aria-hidden="true">
            <span className="nj-lawline-none" style={{ width: `${pct(VERSION_FROM)}%` }}>
              No version held
            </span>
            <span className="nj-lawline-held" style={{ left: `${pct(VERSION_FROM)}%` }}>
              Version in force from 1 Jul 2026
            </span>
          </div>
          {[2024, 2025, 2026, 2027, 2028].map((y) => (
            <i
              key={y}
              className="nj-lawline-year"
              style={{ left: `${pct(Date.UTC(y, 0, 1))}%` }}
              aria-hidden="true"
            >
              {y}
            </i>
          ))}
          {DATES.map((d, i) => (
            <button
              key={d.key}
              type="button"
              className={`nj-lawline-pin nj-lawline-pin--${d.align}`}
              style={{ left: `${pct(d.t)}%` }}
              aria-pressed={i === index}
              aria-label={`Law as at ${d.label}`}
              onClick={() => setIndex(i)}
            >
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
