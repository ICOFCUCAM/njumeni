'use client';

import { useState } from 'react';

// Global Legal Change Intelligence, as one instrument: a change moves through the system (the
// schematic) while the panel shows what Njumeni records at each stage. Invented wording; not
// the text of any act.
const STAGES = [
  {
    key: 'monitor',
    label: 'Monitor',
    title: 'An official source is checked',
    body: 'The monitor reads the official listing on its schedule and records what it found — or that the check failed, so the source reads unverified, never current.',
    record: [
      ['Source', 'Official gazette · Norway'],
      ['Check', 'Succeeded · listing changed'],
    ],
  },
  {
    key: 'compare',
    label: 'Compare',
    title: 'The new version is compared',
    body: 'Provision by provision, the new consolidated text is compared with the version held.',
    diff: true,
  },
  {
    key: 'date',
    label: 'Date',
    title: 'Publication is not commencement',
    body: 'The amendment was published on 2 March and takes effect on 1 July. Until then, research on the law in force still uses the previous wording.',
    record: [
      ['Published', '2 March'],
      ['In force', '1 July'],
    ],
  },
  {
    key: 'impact',
    label: 'Impact',
    title: 'What relied on the old text',
    body: 'Every answer, document and matter that quoted or cited section 28 is found.',
    record: [
      ['Research answers', '4 quote the previous wording'],
      ['Documents', '2 need re-verification'],
      ['Matters', '1 deadline calculated from it'],
      ['Norway', 'Reads “behind” until ingested'],
    ],
  },
  {
    key: 'approve',
    label: 'Approve',
    title: 'People decide',
    body: 'A knowledge administrator reviews the change and the proposed remediation. Nothing is changed or sent until an authorised person approves, and every decision is recorded.',
    record: [
      ['Proposal', 'Re-ingest the act; notify workspaces'],
      ['Decision', 'Approved · recorded with reason'],
    ],
  },
  {
    key: 'notify',
    label: 'Notify',
    title: 'Customers are told',
    body: 'Each affected research answer now opens with a notice: the law has changed since this answer, and when the change takes effect.',
    notice: true,
  },
] as const;

// Schematic node positions (viewBox 640 × 300).
const NODES = [
  { key: 'monitor', x: 70, y: 150, label: 'Official source' },
  { key: 'compare', x: 190, y: 150, label: 'Compare' },
  { key: 'date', x: 300, y: 150, label: 'Dates' },
  { key: 'impact', x: 410, y: 150, label: 'Impact' },
  { key: 'approve', x: 520, y: 150, label: 'Approval' },
  { key: 'notify', x: 600, y: 150, label: 'Notice' },
];
const AFFECTED = [
  { x: 430, y: 62, label: 'Answers' },
  { x: 488, y: 238, label: 'Documents' },
  { x: 344, y: 238, label: 'Matters' },
];

export function Observatory() {
  const [index, setIndex] = useState(0);
  const stage = STAGES[index]!;
  return (
    <div className="nj-obs">
      <div className="nj-obs-head">
        <ol className="nj-obs-steps" aria-label="Stages of a legal change">
          {STAGES.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={i === index}
                className={i < index ? 'is-done' : undefined}
                onClick={() => setIndex(i)}
              >
                <span className="nj-mono">{String(i + 1).padStart(2, '0')}</span> {s.label}
              </button>
            </li>
          ))}
        </ol>
        <span className="nj-tag nj-tag--illustrative nj-tag--ondark">Illustrative change</span>
      </div>
      <div className="nj-obs-body">
        <svg
          viewBox="0 0 640 300"
          className="nj-obs-map"
          role="img"
          aria-label={`Stage ${index + 1} of 6: ${stage.label}`}
        >
          <line x1={70} x2={600} y1={150} y2={150} className="nj-obs-track" />
          <line x1={70} x2={NODES[index]!.x} y1={150} y2={150} className="nj-obs-track is-done" />
          {AFFECTED.map((a) => (
            <g key={a.label} className={index >= 3 ? 'nj-obs-aff is-on' : 'nj-obs-aff'}>
              <line x1={410} y1={150} x2={a.x} y2={a.y} />
              <circle cx={a.x} cy={a.y} r={7} />
              <text x={a.x} y={a.y < 150 ? a.y - 16 : a.y + 26}>
                {a.label}
              </text>
            </g>
          ))}
          {NODES.map((n, i) => (
            <g
              key={n.key}
              className={
                i < index
                  ? 'nj-obs-node is-done'
                  : i === index
                    ? 'nj-obs-node is-on'
                    : 'nj-obs-node'
              }
            >
              {i === index ? <circle cx={n.x} cy={n.y} r={22} className="nj-obs-halo" /> : null}
              <circle cx={n.x} cy={n.y} r={i === index ? 12 : 9} />
              <text x={n.x} y={n.y + (i % 2 ? -32 : 40)}>
                {n.label}
              </text>
            </g>
          ))}
        </svg>
        <div key={stage.key} className="nj-obs-panel nj-fade" aria-live="polite">
          <p className="nj-obs-kicker">
            Stage {index + 1} · {stage.label}
          </p>
          <h3>{stage.title}</h3>
          <p>{stage.body}</p>
          {'diff' in stage ? (
            <div className="nj-diff">
              <span className="nj-obs-sec">Section 28 · Time limit for applications</span>
              <span className="nj-del">within three months of arrival</span>
              <span className="nj-ins">within six months of arrival</span>
            </div>
          ) : null}
          {'record' in stage ? (
            <dl className="nj-obs-record">
              {stage.record.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {'notice' in stage ? (
            <div className="nj-obs-notice">
              <b>The law has changed since this answer</b>
              <span>
                Section 28 was amended: the time limit becomes six months from 1 July. Ask the
                question again to research the law as it now stands.
              </span>
            </div>
          ) : null}
          <div className="nj-obs-nav">
            <button
              type="button"
              className="nj-btn nj-btn--line nj-btn--sm"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="nj-btn nj-btn--gold nj-btn--sm"
              onClick={() => setIndex((i) => Math.min(STAGES.length - 1, i + 1))}
              disabled={index === STAGES.length - 1}
            >
              Next stage
            </button>
          </div>
        </div>
      </div>
      <p className="nj-obs-foot">
        A walk through the workflow with invented wording (Immigration Act, section 28); it is not
        the text of Norwegian law.
      </p>
    </div>
  );
}
