'use client';

import Link from 'next/link';
import { useState } from 'react';

// Plan allowances: the commercial configuration (migration 20261112600000, Master Plan §17.1).
// Prices are hypotheses still to be decided and are not published.
type Allowance = number | null;
interface Plan {
  name: string;
  forWhom: string;
  research: Allowance;
  documents: Allowance;
  ai: Allowance;
  api: Allowance;
  seats: Allowance;
  storage: Allowance;
  access: string;
}
const GROUPS: { key: string; title: string; workspace: string; promise: string; plans: Plan[] }[] =
  [
    {
      key: 'individuals',
      title: 'Individuals',
      workspace: 'Personal workspace',
      promise:
        'Your own legal questions, answered from the law, with your documents kept in one place.',
      plans: [
        {
          name: 'Free',
          forWhom: 'The general public',
          research: 30,
          documents: 5,
          ai: 50,
          api: 100,
          seats: 1,
          storage: 1,
          access: 'Free',
        },
        {
          name: 'Personal',
          forWhom: 'Individuals',
          research: 200,
          documents: 50,
          ai: 500,
          api: 0,
          seats: 1,
          storage: 5,
          access: 'Price at early access',
        },
        {
          name: 'Personal Plus',
          forWhom: 'Ongoing legal matters',
          research: 600,
          documents: 150,
          ai: 1500,
          api: 0,
          seats: 1,
          storage: 20,
          access: 'Price at early access',
        },
      ],
    },
    {
      key: 'professionals',
      title: 'Legal professionals',
      workspace: 'Professional workspace',
      promise: 'Research, matters and drafting for a lawyer or adviser’s own practice.',
      plans: [
        {
          name: 'Professional',
          forWhom: 'Lawyers and advisers',
          research: 2000,
          documents: 500,
          ai: 4000,
          api: 1000,
          seats: 1,
          storage: 50,
          access: 'Price at early access',
        },
        {
          name: 'Professional Plus',
          forWhom: 'High-volume practitioners',
          research: 6000,
          documents: 1500,
          ai: 10000,
          api: 10000,
          seats: 1,
          storage: 200,
          access: 'Price at early access',
        },
      ],
    },
    {
      key: 'organisations',
      title: 'Organisations',
      workspace: 'Law Firm, Enterprise and Institutional workspaces',
      promise:
        'Shared workspaces with members, roles, barriers and governance — on configured or contracted terms.',
      plans: [
        {
          name: 'Law Firm',
          forWhom: 'Legal practices',
          research: 20000,
          documents: 5000,
          ai: 25000,
          api: 50000,
          seats: 10,
          storage: 1000,
          access: 'Price at early access',
        },
        {
          name: 'Enterprise',
          forWhom: 'Large organisations',
          research: null,
          documents: null,
          ai: null,
          api: null,
          seats: null,
          storage: null,
          access: 'By contract',
        },
        {
          name: 'Institutional',
          forWhom: 'Public institutions',
          research: null,
          documents: null,
          ai: null,
          api: null,
          seats: null,
          storage: null,
          access: 'By contract',
        },
      ],
    },
  ];
const ROWS: { key: keyof Plan; label: string; unit?: string }[] = [
  { key: 'research', label: 'Research runs / month' },
  { key: 'documents', label: 'Generated documents / month' },
  { key: 'ai', label: 'AI credits / month' },
  { key: 'api', label: 'API requests / month' },
  { key: 'seats', label: 'Seats included' },
  { key: 'storage', label: 'Storage', unit: ' GB' },
];
const fmt = (value: Allowance, unit = '') =>
  value === null ? 'Contracted' : value === 0 ? '—' : value.toLocaleString('en-GB') + unit;

const HIGHLIGHTS: { key: keyof Plan; label: string }[] = [
  { key: 'research', label: 'research runs' },
  { key: 'documents', label: 'generated documents' },
  { key: 'ai', label: 'AI credits' },
];

export function PlanTiers({ picked }: { picked?: string | undefined }) {
  return (
    <div className="nj-tiers">
      {GROUPS.map((g) => (
        <section
          key={g.key}
          className={`nj-tier nj-tier--${g.key}`}
          aria-labelledby={`tier-${g.key}`}
        >
          <header className="nj-tier-head">
            <p>{g.workspace}</p>
            <h3 id={`tier-${g.key}`}>{g.title}</h3>
            <span>{g.promise}</span>
          </header>
          <ul className="nj-tier-plans">
            {g.plans.map((p) => (
              <li
                key={p.name}
                className={
                  [p.research === null ? 'is-contract' : '', picked === p.name ? 'is-picked' : '']
                    .join(' ')
                    .trim() || undefined
                }
              >
                {picked === p.name ? (
                  <span className="nj-tier-badge">Suggested for you</span>
                ) : null}
                <h4>{p.name}</h4>
                <p className="nj-tier-for">{p.forWhom}</p>
                {p.research === null ? null : (
                  <p className="nj-tier-month" aria-hidden="true">
                    Each month
                  </p>
                )}
                {p.research === null ? (
                  <p className="nj-tier-contract">Allowances, seats and storage set by contract</p>
                ) : (
                  <dl aria-label="Each month">
                    {HIGHLIGHTS.map((h) => (
                      <div key={h.key}>
                        <dt>{h.label}</dt>
                        <dd>{fmt(p[h.key] as Allowance)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {p.research === null ? null : (
                  <p className="nj-tier-small">
                    {p.seats === 1 ? '1 seat' : `${p.seats} seats included`} ·{' '}
                    {fmt(p.storage, ' GB')} storage
                    {p.api ? ` · ${fmt(p.api)} API requests` : ''}
                  </p>
                )}
                <p className="nj-tier-access">{p.access}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// A guided choice: who will use Njumeni, then how. Suggests one configured plan; it decides
// nothing and changes no terms.
const FINDER = [
  {
    who: 'Myself, for my own legal matters',
    ask: 'How will you use it?',
    options: [
      ['A few questions a month', 'Free'],
      ['Regularly', 'Personal'],
      ['For an ongoing legal matter', 'Personal Plus'],
    ],
  },
  {
    who: 'Me, as a lawyer or adviser',
    ask: 'How much legal work?',
    options: [
      ['A typical practice', 'Professional'],
      ['High volume', 'Professional Plus'],
    ],
  },
  {
    who: 'A firm or organisation',
    ask: 'What kind of organisation?',
    options: [
      ['A law firm', 'Law Firm'],
      ['A company or large organisation', 'Enterprise'],
      ['A public institution', 'Institutional'],
    ],
  },
] as const;
const ALL_PLANS = GROUPS.flatMap((g) => g.plans);

export function PlanChooser() {
  const [who, setWho] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | undefined>(undefined);
  const found = ALL_PLANS.find((p) => p.name === plan);
  return (
    <>
      <div className="nj-finder" role="group" aria-labelledby="finder-title">
        <div className="nj-finder-step">
          <p id="finder-title" className="nj-finder-q">
            <span>1</span> Who will use Njumeni?
          </p>
          <div className="nj-finder-opts">
            {FINDER.map((f, i) => (
              <button
                key={f.who}
                type="button"
                aria-pressed={who === i}
                onClick={() => {
                  setWho(i);
                  setPlan(undefined);
                }}
              >
                {f.who}
              </button>
            ))}
          </div>
        </div>
        <div className={`nj-finder-step ${who === null ? 'is-wait' : ''}`}>
          <p className="nj-finder-q">
            <span>2</span> {who === null ? 'Then, how you will use it' : FINDER[who]!.ask}
          </p>
          {who === null ? null : (
            <div className="nj-finder-opts">
              {FINDER[who]!.options.map(([label, name]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={plan === name}
                  onClick={() => setPlan(name)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="nj-finder-result" aria-live="polite">
          {found ? (
            <>
              <p className="nj-finder-k">Suggested plan</p>
              <p className="nj-finder-name">{found.name}</p>
              <p className="nj-finder-sum">
                {found.research === null
                  ? 'Allowances, seats and storage are agreed by contract.'
                  : `${fmt(found.research)} research runs, ${fmt(found.documents)} generated documents and ${fmt(found.ai)} AI credits a month.`}
              </p>
              <p className="nj-finder-access">{found.access}</p>
              <Link
                href={
                  found.research === null ? '/early-access?interest=demonstration' : '/early-access'
                }
                className="nj-btn nj-btn--gold nj-btn--sm nj-finder-cta"
              >
                {found.research === null ? 'Talk to us' : 'Request early access'}
              </Link>
            </>
          ) : (
            <p className="nj-finder-hint">
              Answer two questions to see which plan fits. Every plan is listed below.
            </p>
          )}
        </div>
      </div>
      <PlanTiers picked={plan} />
    </>
  );
}

export function Plans() {
  const [active, setActive] = useState(0);
  const group = GROUPS[active]!;
  return (
    <div className="nj-pl">
      <div className="nj-pl-switch" role="tablist" aria-label="Plan groups">
        {GROUPS.map((g, i) => (
          <button
            key={g.key}
            id={`pl-${g.key}`}
            role="tab"
            aria-selected={i === active}
            aria-controls="pl-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (i + step + GROUPS.length) % GROUPS.length;
              setActive(next);
              document.getElementById(`pl-${GROUPS[next]!.key}`)?.focus();
            }}
          >
            {g.title}
          </button>
        ))}
      </div>
      <div
        key={group.key}
        id="pl-panel"
        role="tabpanel"
        aria-labelledby={`pl-${group.key}`}
        className="nj-pl-panel nj-fade"
      >
        <p className="nj-pl-ws">{group.workspace}</p>
        <div className="nj-pl-scroll">
          <table className="nj-pl-table" style={{ ['--cols' as string]: group.plans.length }}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="nj-sr">Allowance</span>
                </th>
                {group.plans.map((p) => (
                  <th key={p.name} scope="col">
                    <b>{p.name}</b>
                    <span>{p.forWhom}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {group.plans.map((p) => (
                    <td key={p.name}>{fmt(p[row.key] as Allowance, row.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Access</th>
                {group.plans.map((p) => (
                  <td key={p.name}>{p.access}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <ul className="nj-pl-cards">
          {group.plans.map((p) => (
            <li key={p.name}>
              <h3>{p.name}</h3>
              <p>{p.forWhom}</p>
              <dl>
                {ROWS.map((row) => (
                  <div key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>{fmt(p[row.key] as Allowance, row.unit)}</dd>
                  </div>
                ))}
              </dl>
              <p className="nj-pl-access">{p.access}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
