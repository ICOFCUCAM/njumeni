'use client';

import { useState } from 'react';

// Hero research instrument. Everything shown is what Njumeni holds: the Working Environment Act
// (LOV-2005-06-17-62) from Lovdata's current-law dataset, consolidated version in force from
// 1 July 2026, quoted exactly. For dates before that version no text is held, so the answer is
// the engine's temporal refusal (legal-abstain-1.0.0), never a guess.
const AXIS = { start: Date.UTC(2024, 0, 1), end: Date.UTC(2028, 0, 1) };
const VERSION_FROM = Date.UTC(2026, 6, 1);
const DATES = [
  { key: '2025-01-15', label: '15 Jan 2025', t: Date.UTC(2025, 0, 15), align: 'mid' },
  { key: '2026-08-01', label: '1 Aug 2026', t: Date.UTC(2026, 7, 1), align: 'end' },
  { key: '2026-11-12', label: '12 Nov 2026', t: Date.UTC(2026, 10, 12), align: 'start' },
] as const;
const pct = (t: number) => ((t - AXIS.start) / (AXIS.end - AXIS.start)) * 100;

export function ResearchView() {
  const [index, setIndex] = useState(2);
  const date = DATES[index]!;
  const held = date.t >= VERSION_FROM;
  return (
    <figure className="nj-app" aria-label="Example of the Njumeni research view">
      <div className="nj-app-top">
        <span className="nj-app-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="nj-app-crumb">
          Personal workspace <span aria-hidden="true">/</span> Research
        </span>
        <span className="nj-app-env">Example view</span>
      </div>
      <div className="nj-app-body">
        <nav className="nj-app-rail" aria-label="Example navigation" aria-hidden="true">
          <span className="is-on">Research</span>
          <span>Matters</span>
          <span>Evidence</span>
          <span>Changes</span>
        </nav>
        <div className="nj-app-main">
          <p className="nj-app-q">Can an employer dismiss an employee without a reason?</p>
          <div className="nj-app-params">
            <span>
              <small>Jurisdiction</small>Norway
            </span>
            <span>
              <small>Law as at</small>
              {date.label}
            </span>
            <span>
              <small>Sources</small>Official · rights-reviewed
            </span>
          </div>
          <div className="nj-app-result" aria-live="polite">
            {held ? (
              <div key="held" className="nj-fade">
                <p className="nj-app-verdict">
                  <span aria-hidden="true">✓</span> Verified authority
                </p>
                <p className="nj-app-prov">
                  Working Environment Act <span lang="nb">(arbeidsmiljøloven)</span> § 15-7 (1)
                </p>
                <blockquote className="nj-app-quote" lang="nb">
                  “Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens,
                  arbeidsgiverens eller arbeidstakerens forhold.”
                </blockquote>
                <dl className="nj-app-meta">
                  <div>
                    <dt>Citation</dt>
                    <dd className="nj-mono">LOV-2005-06-17-62</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>In force from 1 July 2026</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>Lovdata · NLOD 2.0</dd>
                  </div>
                </dl>
                <ul className="nj-app-checks" aria-label="Verification">
                  <li>Citation exists</li>
                  <li>Quotation matches</li>
                  <li>In force on date</li>
                  <li>Source permitted</li>
                </ul>
              </div>
            ) : (
              <div key="declined" className="nj-fade">
                <p className="nj-app-verdict nj-app-verdict--no">No answer for this date</p>
                <p className="nj-app-decline">
                  Njumeni holds the current text of the law that answers this question, but not the
                  version in force on 15 January 2025. No answer is given rather than one from other
                  texts.
                </p>
              </div>
            )}
          </div>
          <div className="nj-scrub" role="group" aria-label="Date of the law">
            <div className="nj-scrub-axis" aria-hidden="true">
              <span className="nj-scrub-none" style={{ width: `${pct(VERSION_FROM)}%` }} />
              <span className="nj-scrub-held" style={{ left: `${pct(VERSION_FROM)}%` }} />
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <i key={y} className="nj-scrub-year" style={{ left: `${pct(Date.UTC(y, 0, 1))}%` }}>
                  {y}
                </i>
              ))}
            </div>
            {DATES.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className={`nj-scrub-pin nj-scrub-pin--${d.align}`}
                style={{ left: `${pct(d.t)}%` }}
                aria-pressed={i === index}
                aria-label={`Law as at ${d.label}`}
                onClick={() => setIndex(i)}
              >
                <span>{d.label}</span>
              </button>
            ))}
            <p className="nj-scrub-key" aria-hidden="true">
              <span className="nj-scrub-key-none">No version held</span>
              <span className="nj-scrub-key-held">Version in force from 1 Jul 2026</span>
            </p>
          </div>
        </div>
      </div>
      <figcaption className="nj-app-foot">
        Example interface. The quotation is the text of the Act as held by Njumeni (contains data
        under NLOD 2.0 from Lovdata). Choose a date to see how the answer depends on it.
      </figcaption>
    </figure>
  );
}
