'use client';

import { useState } from 'react';

// An illustrative matter in the professional workspace. Names are fictional ("Example …").
const TABS = [
  {
    key: 'overview',
    label: 'Overview',
    count: '',
    body: (
      <>
        <h4>Matter</h4>
        <dl className="nj-kv">
          <dt>Client</dt>
          <dd>Example Logistikk AS (respondent)</dd>
          <dt>Conflict check</dt>
          <dd>
            <span className="nj-pill">Cleared</span> 3 parties searched across all matters
          </dd>
          <dt>Team</dt>
          <dd>Employment workspace · partner, associate, paralegal</dd>
          <dt>Next deadline</dt>
          <dd>18 Nov · reply to the claim</dd>
        </dl>
      </>
    ),
  },
  {
    key: 'evidence',
    label: 'Evidence',
    count: '4',
    body: (
      <>
        <h4>Evidence · custody recorded</h4>
        <ul className="nj-rows">
          <li>
            <span>employment-contract.pdf</span>
            <span className="nj-mono">sha256 9f2c…41ab</span>
            <span className="nj-pill nj-pill--gold">Legal hold</span>
          </li>
          <li>
            <span>warning-letter-2026-03.pdf</span>
            <span className="nj-mono">sha256 51d0…a7e2</span>
            <span className="nj-pill">Version 2</span>
          </li>
          <li>
            <span>email-thread-hr.eml</span>
            <span className="nj-mono">sha256 c33e…09f1</span>
            <span className="nj-pill">Custody ✓</span>
          </li>
          <li>
            <span>meeting-notes-2026-04-02.docx</span>
            <span className="nj-mono">sha256 7ab4…d215</span>
            <span className="nj-pill">Custody ✓</span>
          </li>
        </ul>
      </>
    ),
  },
  {
    key: 'chronology',
    label: 'Chronology',
    count: '4',
    body: (
      <>
        <h4>Chronology · built from the evidence</h4>
        <ul className="nj-rows">
          <li>
            <span>
              <b>12 Jan 2022</b> · Employment begins
            </span>
            <span />
            <span className="nj-pill">contract</span>
          </li>
          <li>
            <span>
              <b>14 Mar 2026</b> · Written warning
            </span>
            <span />
            <span className="nj-pill">warning letter</span>
          </li>
          <li>
            <span>
              <b>2 Apr 2026</b> · Meeting on performance
            </span>
            <span />
            <span className="nj-pill">meeting notes</span>
          </li>
          <li>
            <span>
              <b>30 Apr 2026</b> · Notice of dismissal
            </span>
            <span />
            <span className="nj-pill">email thread</span>
          </li>
        </ul>
      </>
    ),
  },
  {
    key: 'arguments',
    label: 'Arguments',
    count: '2',
    body: (
      <>
        <h4>Argument</h4>
        <p className="nj-cf-claim">
          The dismissal was objectively justified by the employee’s conduct.
        </p>
        <dl className="nj-kv">
          <dt>Authority</dt>
          <dd>
            Working Environment Act § 15-7 (1) · <span className="nj-mono">LOV-2005-06-17-62</span>
          </dd>
          <dt>Evidence</dt>
          <dd>Written warning (14 Mar) · meeting notes (2 Apr)</dd>
          <dt>Counter-argument</dt>
          <dd>No meeting before the warning — addressed in the reply</dd>
        </dl>
      </>
    ),
  },
  {
    key: 'draft',
    label: 'Draft',
    count: 'v3',
    body: (
      <>
        <h4>Reply to the claim · draft 3</h4>
        <p className="nj-draft">
          The respondent maintains that the dismissal is objectively justified under the Working
          Environment Act § 15-7 (1)<sup>1</sup>, having regard to the written warning of 14 March
          2026<sup>2</sup> and the meeting of 2 April 2026<sup>3</sup>…
        </p>
        <p className="nj-cf-note">
          ✓ 3 citations re-verified against the law in force today · none changed
        </p>
      </>
    ),
  },
  {
    key: 'review',
    label: 'Review',
    count: '',
    body: (
      <>
        <h4>Review and sign-off</h4>
        <ul className="nj-rows">
          <li>
            <span>Citation accuracy</span>
            <span />
            <span className="nj-pill">Passed</span>
          </li>
          <li>
            <span>Law in force on the relevant date</span>
            <span />
            <span className="nj-pill">Passed</span>
          </li>
          <li>
            <span>Partner sign-off</span>
            <span className="nj-mono">I. Berg</span>
            <span className="nj-pill">Approved</span>
          </li>
          <li>
            <span>Sent to client</span>
            <span className="nj-mono">18 Nov 09:42</span>
            <span className="nj-pill nj-pill--gold">Recorded</span>
          </li>
        </ul>
      </>
    ),
  },
];

export function CaseFile() {
  const [active, setActive] = useState(0);
  const tab = TABS[active]!;
  return (
    <div className="nj-cfx">
      <div className="nj-app-top">
        <span className="nj-app-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="nj-app-crumb">
          Example Advokatfirma <span aria-hidden="true">/</span> Employment{' '}
          <span aria-hidden="true">/</span> Matters
        </span>
        <span className="nj-app-env">Example view</span>
      </div>
      <div className="nj-cfx-head">
        <div>
          <p className="nj-cfx-id nj-mono">M-2026-014</p>
          <p className="nj-cfx-title">Unfair dismissal claim</p>
        </div>
        <div className="nj-cfx-chips">
          <span className="nj-pill">Open</span>
          <span className="nj-pill nj-pill--gold">Reply due 18 Nov</span>
          <span className="nj-cfx-team">
            <span className="nj-sr">Team: </span>
            <i>IB</i>
            <i>KD</i>
            <i>AL</i>
          </span>
        </div>
      </div>
      <div className="nj-cf">
        <div className="nj-cf-side">
          <div className="nj-cf-tabs" role="tablist" aria-label="Case file">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                id={`cf-tab-${t.key}`}
                role="tab"
                aria-selected={i === active}
                aria-controls="cf-panel"
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  const keys: Record<string, number> = {
                    ArrowDown: 1,
                    ArrowRight: 1,
                    ArrowUp: -1,
                    ArrowLeft: -1,
                  };
                  if (!(e.key in keys)) return;
                  e.preventDefault();
                  const next = (i + keys[e.key]! + TABS.length) % TABS.length;
                  setActive(next);
                  document.getElementById(`cf-tab-${TABS[next]!.key}`)?.focus();
                }}
              >
                {t.label}
                {t.count ? <span>{t.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div
          key={tab.key}
          id="cf-panel"
          className="nj-cf-panel nj-fade"
          role="tabpanel"
          aria-labelledby={`cf-tab-${tab.key}`}
        >
          {tab.body}
        </div>
        <div className="nj-cf-foot">
          <span>Illustrative matter · fictional parties</span>
          <span>Employment workspace · Example Advokatfirma AS</span>
        </div>
      </div>
    </div>
  );
}
