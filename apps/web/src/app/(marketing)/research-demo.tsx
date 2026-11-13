'use client';

import { useState } from 'react';

// Interactive research demonstration. The only legal text shown is what Njumeni actually holds:
// Working Environment Act § 15-7 (1) (LOV-2005-06-17-62), version in force from 1 July 2026,
// from Lovdata's current-law dataset. Other jurisdictions have registered sources but no
// activated legal text, so the engine declines — exactly as it would.
type Jur = 'NO' | 'SE' | 'GB';
const JURS: { code: Jur; name: string; note: string }[] = [
  { code: 'NO', name: 'Norway', note: 'Reference jurisdiction' },
  { code: 'SE', name: 'Sweden', note: 'Sources registered' },
  { code: 'GB', name: 'United Kingdom', note: 'Sources registered' },
];
const DATES = [
  { key: 'a', label: '15 Jan 2025', long: '15 January 2025', held: false },
  { key: 'b', label: '1 Aug 2026', long: '1 August 2026', held: true },
  { key: 'c', label: '12 Nov 2026', long: '12 November 2026', held: true },
] as const;

type Step = {
  n: string;
  label: string;
  value: React.ReactNode;
  state: 'ok' | 'stop' | 'skip' | 'warn';
};

function steps(jur: Jur, date: (typeof DATES)[number]): Step[] {
  const name = JURS.find((j) => j.code === jur)!.name;
  const base: Step[] = [
    {
      n: '01',
      label: 'Question',
      value: 'Can an employer dismiss an employee without a reason?',
      state: 'ok',
    },
    { n: '02', label: 'Jurisdiction', value: `${name} — searched on its own terms`, state: 'ok' },
    { n: '03', label: 'Legal date', value: `The law as it stood on ${date.long}`, state: 'ok' },
  ];
  if (jur !== 'NO') {
    return [
      ...base,
      {
        n: '04',
        label: 'Applicable authority',
        value: `No legal text is held for ${name} yet: its official sources are registered, but not activated. Njumeni declines rather than answer from another country’s law.`,
        state: 'stop',
      },
      ...['Provision', 'Quotation', 'Citation and source', 'Verification'].map((label, i) => ({
        n: `0${i + 5}`,
        label,
        value: 'Not reached',
        state: 'skip' as const,
      })),
    ];
  }
  if (!date.held) {
    return [
      ...base,
      {
        n: '04',
        label: 'Applicable authority',
        value: 'Working Environment Act (arbeidsmiljøloven) — identified',
        state: 'ok',
      },
      {
        n: '05',
        label: 'Provision',
        value: `The version in force on ${date.long} is not held. Njumeni declines rather than quote a later text.`,
        state: 'stop',
      },
      ...['Quotation', 'Citation and source', 'Verification'].map((label, i) => ({
        n: `0${i + 6}`,
        label,
        value: 'Not reached',
        state: 'skip' as const,
      })),
    ];
  }
  return [
    ...base,
    {
      n: '04',
      label: 'Applicable authority',
      value: 'Working Environment Act (arbeidsmiljøloven) · act',
      state: 'ok',
    },
    {
      n: '05',
      label: 'Provision',
      value: '§ 15-7, first paragraph · version in force from 1 July 2026',
      state: 'ok',
    },
    {
      n: '06',
      label: 'Quotation',
      value: (
        <q lang="nb">
          Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens,
          arbeidsgiverens eller arbeidstakerens forhold.
        </q>
      ),
      state: 'ok',
    },
    {
      n: '07',
      label: 'Citation and source',
      value: (
        <>
          <span className="nj-mono">LOV-2005-06-17-62 § 15-7 (1)</span> · Lovdata, NLOD 2.0
        </>
      ),
      state: 'ok',
    },
    {
      n: '08',
      label: 'Verification',
      value:
        'Citation exists · quotation matches the held text · in force on the date. Source permission awaits rights activation, so this answer is not yet shown to customers.',
      state: 'warn',
    },
  ];
}

export function ResearchDemo() {
  const [jur, setJur] = useState<Jur>('NO');
  const [dateKey, setDateKey] = useState<(typeof DATES)[number]['key']>('c');
  const date = DATES.find((d) => d.key === dateKey)!;
  const list = steps(jur, date);
  const outcome =
    jur !== 'NO'
      ? 'Declined · no legal text held'
      : !date.held
        ? 'Declined · version not held'
        : 'Cited finding';
  return (
    <section className="nj-demo2" aria-labelledby="demo2-title">
      <div className="nj-demo2-controls">
        <div className="nj-demo2-head">
          <h3 id="demo2-title">Run the research</h3>
          <span className="nj-tag nj-tag--illustrative nj-tag--ondark">
            Demonstration · real text where held
          </span>
        </div>
        <p className="nj-demo2-q">“Can an employer dismiss an employee without a reason?”</p>
        <fieldset>
          <legend>Jurisdiction</legend>
          <div className="nj-demo2-opts">
            {JURS.map((j) => (
              <button
                key={j.code}
                type="button"
                aria-pressed={jur === j.code}
                onClick={() => setJur(j.code)}
              >
                <b>{j.name}</b>
                <small>{j.note}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Legal date</legend>
          <div className="nj-demo2-opts nj-demo2-opts--dates">
            {DATES.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={dateKey === d.key}
                onClick={() => setDateKey(d.key)}
              >
                <b>{d.label}</b>
              </button>
            ))}
          </div>
        </fieldset>
        <p
          className={`nj-demo2-outcome ${outcome === 'Cited finding' ? 'is-ok' : 'is-stop'}`}
          aria-live="polite"
        >
          <small>Outcome</small>
          {outcome}
        </p>
      </div>
      <ol key={`${jur}-${dateKey}`} className="nj-demo2-steps" aria-label="Research steps">
        {list.map((s, i) => (
          <li key={s.n} className={`is-${s.state}`} style={{ ['--i' as string]: i }}>
            <span className="nj-demo2-n" aria-hidden="true">
              {s.n}
            </span>
            <div>
              <p className="nj-demo2-label">
                {s.label}
                <span className="nj-sr">
                  {s.state === 'stop' ? ' — stopped' : s.state === 'skip' ? ' — not reached' : ''}
                </span>
              </p>
              <div className="nj-demo2-value">{s.value}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="nj-demo2-foot">
        The quotation is the text of the Act as held by Njumeni (contains data under NLOD 2.0 from
        Lovdata). Sweden and the United Kingdom have registered official sources but no activated
        legal text. This is a demonstration of the engine’s rules, not a live query.
      </p>
    </section>
  );
}
