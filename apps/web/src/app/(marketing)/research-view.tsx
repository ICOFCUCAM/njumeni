'use client';

import { useState } from 'react';

// The research view in the hero. It shows what Njumeni actually holds: the Working Environment Act
// (LOV-2005-06-17-62) from Lovdata's current-law dataset, version in force from 1 July 2026. The
// quotation is the Act's text. For a date before that version, Njumeni holds no version, so the
// answer is the temporal refusal the engine gives (legal-abstain-1.0.0), not a guess.
const DATES = [
  { key: '2026-11-12', label: '12 Nov 2026', held: true },
  { key: '2026-08-01', label: '1 Aug 2026', held: true },
  { key: '2025-01-15', label: '15 Jan 2025', held: false },
] as const;

export function ResearchView() {
  const [index, setIndex] = useState(0);
  const date = DATES[index]!;
  return (
    <figure className="nj-rv" aria-label="Example of the Njumeni research view">
      <div className="nj-rv-bar">
        <span>
          <b>Legal research</b> · example view
        </span>
        <span>Sources: official · rights-reviewed</span>
      </div>
      <div className="nj-rv-query">
        <p className="nj-rv-q">Can an employer dismiss an employee without a reason?</p>
        <div className="nj-rv-params">
          <span className="nj-rv-param">
            <small>Jurisdiction</small> Norway
          </span>
          <span className="nj-rv-param">
            <small>Law as at</small>
            <span className="nj-rv-dates" role="group" aria-label="Date of the law">
              {DATES.map((d, i) => (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                >
                  {d.label}
                </button>
              ))}
            </span>
          </span>
        </div>
      </div>
      <div className="nj-rv-result" aria-live="polite">
        {date.held ? (
          <div key={date.key} className="nj-fade">
            <p className="nj-rv-verdict nj-rv-verdict--ok">
              ✓ Verified authority · exact quotation
            </p>
            <p className="nj-rv-provision">
              Working Environment Act (arbeidsmiljøloven) § 15-7 (1)
            </p>
            <blockquote className="nj-rv-quote" lang="nb">
              “Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens,
              arbeidsgiverens eller arbeidstakerens forhold.”
            </blockquote>
            <dl className="nj-rv-meta">
              <dt>Citation</dt>
              <dd>
                <span className="nj-mono">LOV-2005-06-17-62</span>
              </dd>
              <dt>Version</dt>
              <dd className="nj-rv-validity">
                In force from 1 July 2026{' '}
                <span className="nj-rv-track" aria-hidden="true">
                  <i />
                </span>
              </dd>
              <dt>Source</dt>
              <dd>Lovdata · NLOD 2.0 · content hash recorded</dd>
            </dl>
          </div>
        ) : (
          <div key={date.key} className="nj-fade">
            <p className="nj-rv-verdict nj-rv-verdict--decline">No answer for this date</p>
            <p className="nj-rv-decline">
              Njumeni holds the current text of the law that answers this question, but not the
              version in force on 15 January 2025. No answer is given rather than one from other
              texts.
            </p>
          </div>
        )}
      </div>
      <figcaption className="nj-rv-foot">
        Example interface. The quotation is the text of the Act as held by Njumeni (contains data
        under NLOD 2.0 from Lovdata); it is not legal advice.
      </figcaption>
    </figure>
  );
}
