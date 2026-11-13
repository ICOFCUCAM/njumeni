'use client';

import { useState } from 'react';

// Customer categories and workspaces: Master Plan v2.0 §2.4, Product Specification §3 (UJ-01…).
const JOURNEYS = [
  {
    key: 'individuals',
    who: 'Individuals',
    hint: 'People with a legal problem',
    workspace: 'Personal workspace',
    question: '“Can my landlord keep my deposit?”',
    problem:
      'Legal information is scattered, written for specialists, and rarely says which version of the law applies.',
    provides:
      'Plain explanations grounded in the exact section of law, a place to keep their documents, and a clear signal when a lawyer is needed.',
    steps: [
      'Choose the country and describe the question',
      'Read the answer with the section it rests on',
      'Save it with their own letters and contracts',
      'See when the question needs a qualified lawyer',
    ],
  },
  {
    key: 'professionals',
    who: 'Legal professionals',
    hint: 'Lawyers, advisers, paralegals',
    workspace: 'Professional workspace',
    question: '“What was the notice period on the day the contract ended?”',
    problem:
      'Research must be exact, dated and verifiable — and then carried into matters, arguments and documents without retyping.',
    provides:
      'Dated research with quotations and citations, evidence analysis, arguments and drafting in one record.',
    steps: [
      'Research the law in force on the relevant date',
      'Attach the finding to a matter',
      'Build the argument from authority and evidence',
      'Draft — and re-verify every citation before it goes out',
    ],
  },
  {
    key: 'organisations',
    who: 'Law firms and enterprises',
    hint: 'Firms and in-house legal teams',
    workspace: 'Enterprise and Law Firm workspace',
    question: '“Can we act for this client — and which policies does the new regulation touch?”',
    problem:
      'Teams share matters, clients and knowledge, and must prove conflicts, barriers and reviews were handled.',
    provides:
      'Shared workspaces with conflict checks, information barriers, roles, firm knowledge, compliance registers and oversight.',
    steps: [
      'Run the conflict check before opening the matter',
      'Staff it with roles and the right barriers',
      'Reuse firm knowledge and approved templates',
      'Report on reviews, deadlines and obligations',
    ],
  },
  {
    key: 'institutions',
    who: 'Public institutions',
    hint: 'Public bodies and regulators',
    workspace: 'Institutional workspace',
    question: '“Is our guidance still correct after the amendment?”',
    problem:
      'Institutional decisions must rest on the current law, be consistent, and leave a record that can be audited.',
    provides:
      'Controlled institutional knowledge, change notices on what relied on amended law, and verifiable audit records.',
    steps: [
      'Hold policy and guidance against their legal sources',
      'Receive notice when a source provision changes',
      'Review and approve the updates that follow',
      'Export an audit record anyone can verify',
    ],
  },
];

export function Journeys() {
  const [active, setActive] = useState(0);
  const j = JOURNEYS[active]!;
  return (
    <div>
      <div className="nj-jtabs" role="tablist" aria-label="Customer journeys">
        {JOURNEYS.map((item, i) => (
          <button
            key={item.key}
            id={`jt-${item.key}`}
            role="tab"
            aria-selected={i === active}
            aria-controls="journey-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (i + step + JOURNEYS.length) % JOURNEYS.length;
              setActive(next);
              document.getElementById(`jt-${JOURNEYS[next]!.key}`)?.focus();
            }}
          >
            <b>{item.who}</b>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>
      <div
        key={j.key}
        id="journey-panel"
        className="nj-journey nj-fade"
        role="tabpanel"
        aria-labelledby={`jt-${j.key}`}
      >
        <div>
          <span className="nj-journey-ws">{j.workspace}</span>
          <p className="nj-journey-q">{j.question}</p>
          <dl>
            <div>
              <dt>The problem</dt>
              <dd>{j.problem}</dd>
            </div>
            <div>
              <dt>What Njumeni provides</dt>
              <dd>{j.provides}</dd>
            </div>
          </dl>
        </div>
        <ol aria-label={`${j.who}: what they can do`}>
          {j.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
