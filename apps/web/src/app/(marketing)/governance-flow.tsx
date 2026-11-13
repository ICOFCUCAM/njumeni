'use client';

import { useState } from 'react';

// AI governance as a workflow. The AI step shown is meaning search, which is built; customer-facing
// drafting and legal reasoning are planned and are not shown here as live. Fictional people.
const STEPS = [
  {
    key: 'suggest',
    actor: 'AI',
    label: 'AI suggestion',
    does: 'Meaning search ranks § 15-7 (1) as relevant to the question.',
    cannot: 'A ranking is a suggestion. It is never shown as an answer or as authority.',
  },
  {
    key: 'ground',
    actor: 'The law',
    label: 'Source-grounded finding',
    does: 'The finding quotes the held text of the provision, in force on the date asked.',
    cannot: 'If the text or the version is not held, there is no finding — the engine declines.',
  },
  {
    key: 'review',
    actor: 'Professional',
    label: 'Professional review',
    does: 'The associate checks the finding against the facts of matter M-2026-014.',
    cannot: 'Work is not relied on until the review gate is passed.',
  },
  {
    key: 'approve',
    actor: 'Professional',
    label: 'Human approval',
    does: 'The partner signs off the reply before it goes to the client.',
    cannot: 'Sign-off needs a member whose role permits it, and it is recorded.',
  },
  {
    key: 'record',
    actor: 'Record',
    label: 'Recorded decision',
    does: 'Who decided, when and why is written to the hash-chained audit record.',
    cannot: 'Records are append-only; a later change does not rewrite an earlier decision.',
  },
] as const;

export function GovernanceFlow() {
  const [index, setIndex] = useState(0);
  const s = STEPS[index]!;
  return (
    <div className="nj-gov">
      <ol className="nj-gov-steps" aria-label="How a finding becomes relied-on work">
        {STEPS.map((step, i) => (
          <li key={step.key}>
            <button
              type="button"
              aria-pressed={i === index}
              className={`nj-gov-${step.key}${i < index ? ' is-done' : ''}`}
              onClick={() => setIndex(i)}
            >
              <small>{step.actor}</small>
              {step.label}
            </button>
          </li>
        ))}
      </ol>
      <div key={s.key} className="nj-gov-detail nj-fade" aria-live="polite">
        <div>
          <p className="nj-gov-k">What happens</p>
          <p className="nj-gov-does">{s.does}</p>
        </div>
        <div>
          <p className="nj-gov-k">The safeguard</p>
          <p className="nj-gov-cannot">{s.cannot}</p>
        </div>
      </div>
    </div>
  );
}
