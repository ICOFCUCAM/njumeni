'use client';

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
const GROUPS: { key: string; title: string; workspace: string; plans: Plan[] }[] = [
  {
    key: 'individuals',
    title: 'Individuals',
    workspace: 'Personal workspace',
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
              const next = (active + step + GROUPS.length) % GROUPS.length;
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
