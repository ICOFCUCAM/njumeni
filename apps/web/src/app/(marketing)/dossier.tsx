'use client';

import { useState } from 'react';

const TABS = [
  {
    key: 'matter',
    label: 'Matter',
    body: (
      <div className="nj-dz-grid">
        <div>
          <p className="nj-dz-k">Matter</p>
          <p className="nj-dz-v">M-2026-014 · Unfair dismissal claim</p>
          <p className="nj-dz-k">Client</p>
          <p className="nj-dz-v">Example Logistikk AS (respondent)</p>
          <p className="nj-dz-k">Conflict check</p>
          <p className="nj-dz-v nj-ok">Cleared · 3 parties searched</p>
        </div>
        <div>
          <p className="nj-dz-k">Deadlines</p>
          <ul className="nj-dz-list">
            <li>
              <b>18 Nov</b> Reply to the claim
            </li>
            <li>
              <b>02 Dec</b> Mediation meeting
            </li>
            <li>
              <b>15 Jan</b> Exchange of evidence
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    key: 'evidence',
    label: 'Evidence',
    body: (
      <ul className="nj-dz-rows">
        <li>
          <span>employment-contract.pdf</span>
          <span className="nj-mono">9f2c…41ab</span>
          <span className="nj-dz-tag">Legal hold</span>
        </li>
        <li>
          <span>warning-letter-2026-03.pdf</span>
          <span className="nj-mono">51d0…a7e2</span>
          <span className="nj-dz-tag">v2</span>
        </li>
        <li>
          <span>email-thread-hr.eml</span>
          <span className="nj-mono">c33e…09f1</span>
          <span className="nj-dz-tag">Custody ✓</span>
        </li>
        <li>
          <span>meeting-notes-2026-04-02.docx</span>
          <span className="nj-mono">7ab4…d215</span>
          <span className="nj-dz-tag">Custody ✓</span>
        </li>
      </ul>
    ),
  },
  {
    key: 'chronology',
    label: 'Chronology',
    body: (
      <ol className="nj-dz-chrono">
        <li>
          <b>12 Jan 2022</b> Employment begins <em>contract, § 3</em>
        </li>
        <li>
          <b>14 Mar 2026</b> Written warning <em>warning letter</em>
        </li>
        <li>
          <b>02 Apr 2026</b> Meeting on performance <em>meeting notes</em>
        </li>
        <li>
          <b>30 Apr 2026</b> Notice of dismissal <em>email thread</em>
        </li>
      </ol>
    ),
  },
  {
    key: 'arguments',
    label: 'Arguments',
    body: (
      <div className="nj-dz-arg">
        <p className="nj-dz-claim">
          The dismissal was objectively justified by the employee’s conduct.
        </p>
        <p className="nj-dz-k">Authority</p>
        <p className="nj-dz-v">Working Environment Act § 15-7 (1) · exact text attached</p>
        <p className="nj-dz-k">Evidence</p>
        <p className="nj-dz-v">Written warning (14 Mar) · meeting notes (2 Apr)</p>
        <p className="nj-dz-k">Counter-argument</p>
        <p className="nj-dz-v">No prior meeting before the warning — addressed in the reply</p>
      </div>
    ),
  },
  {
    key: 'draft',
    label: 'Draft',
    body: (
      <div className="nj-dz-draft">
        <p className="nj-dz-k">Reply to the claim · draft 3</p>
        <p>
          The respondent maintains that the dismissal is objectively justified under the Working
          Environment Act § 15-7 (1)<sup>1</sup>, having regard to the warning of 14 March 2026
          <sup>2</sup>…
        </p>
        <p className="nj-dz-foot">
          2 citations re-verified against the law in force today · 0 changed
        </p>
      </div>
    ),
  },
  {
    key: 'review',
    label: 'Review',
    body: (
      <ul className="nj-dz-rows">
        <li>
          <span>Citation accuracy</span>
          <span />
          <span className="nj-dz-tag nj-ok">Passed</span>
        </li>
        <li>
          <span>Law in force on the relevant date</span>
          <span />
          <span className="nj-dz-tag nj-ok">Passed</span>
        </li>
        <li>
          <span>Partner sign-off</span>
          <span>I. Berg</span>
          <span className="nj-dz-tag nj-ok">Approved</span>
        </li>
        <li>
          <span>Sent to client</span>
          <span>18 Nov 09:42</span>
          <span className="nj-dz-tag">Recorded</span>
        </li>
      </ul>
    ),
  },
];

export function Dossier() {
  const [active, setActive] = useState(0);
  return (
    <div className="nj-dz">
      <div className="nj-dz-tabs" role="tablist" aria-label="Case file">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            role="tab"
            id={`dz-tab-${tab.key}`}
            aria-selected={i === active}
            aria-controls={`dz-panel-${tab.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const next = (active + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
              setActive(next);
              document.getElementById(`dz-tab-${TABS[next]!.key}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="nj-dz-panel"
        role="tabpanel"
        id={`dz-panel-${TABS[active]!.key}`}
        aria-labelledby={`dz-tab-${TABS[active]!.key}`}
      >
        {TABS[active]!.body}
      </div>
      <p className="nj-dz-caption">Illustrative case file</p>
    </div>
  );
}
