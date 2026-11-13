'use client';

import { useState } from 'react';

// Global Legal Change Intelligence as one instrument: a single (invented) amendment travels along
// the official-law lane, and — only through a human approval gate — into one organisation's legal
// knowledge. The panel shows what Njumeni records at each stage. Illustrative throughout: the
// wording is invented and the organisation is fictional.
const STAGES = [
  {
    key: 'source',
    label: 'Source',
    title: 'An official source is checked',
    body: 'The monitor reads the official listing on its schedule and records what it found — or that the check failed, so the source reads unverified, never current.',
    record: [
      ['Source', 'Official gazette · Norway'],
      ['Check', 'Succeeded · listing changed'],
    ],
  },
  {
    key: 'amendment',
    label: 'Amendment',
    title: 'A new version is found',
    body: 'The listing shows an amendment. The new consolidated text is fetched and kept beside the version already held — nothing is overwritten.',
    record: [
      ['Detected', 'Amendment to section 28'],
      ['Published', '2 March'],
    ],
  },
  {
    key: 'compare',
    label: 'Compare',
    title: 'Previous and new versions are compared',
    body: 'Provision by provision, the new text is compared with the version held, so the change is known exactly.',
    diff: true,
  },
  {
    key: 'commence',
    label: 'Commencement',
    title: 'Publication is not commencement',
    body: 'The amendment takes effect on 1 July. Until then, research on the law in force still uses the previous wording; after it, the new one.',
    record: [
      ['Published', '2 March'],
      ['In force', '1 July'],
      ['Until 1 July', 'Previous wording governs'],
    ],
  },
  {
    key: 'impact',
    label: 'Impact',
    title: 'What relied on the old text',
    body: 'Every answer, document and matter in the organisation that quoted or cited section 28 is found — across workspaces, without crossing their barriers.',
    record: [
      ['Research answers', '4 quote the previous wording'],
      ['Documents', '2 need re-verification'],
      ['Matters', '1 deadline calculated from it'],
    ],
  },
  {
    key: 'approve',
    label: 'Approval',
    title: 'People decide',
    body: 'A knowledge administrator reviews the change and the proposed remediation. Nothing is changed or sent until an authorised person approves, and every decision is recorded.',
    record: [
      ['Proposal', 'Re-ingest the act; notify workspaces'],
      ['Decision', 'Approved · recorded with reason'],
    ],
  },
  {
    key: 'notify',
    label: 'Notification',
    title: 'Customers are told',
    body: 'Each affected research answer now opens with a notice: the law has changed since this answer, and when the change takes effect.',
    notice: true,
  },
  {
    key: 'current',
    label: 'Verified current',
    title: 'Legal currency is restored',
    body: 'Once the new version is ingested and the affected work re-verified, the jurisdiction reads current again — and every answer shows the version it relies on.',
    record: [
      ['Re-verified', '4 answers · 2 documents · 1 matter'],
      ['Norway', 'Current in this example'],
    ],
  },
] as const;

const LAW = [
  { n: 1, x: 110, kicker: 'Official source', title: 'Official gazette' },
  { n: 2, x: 300, kicker: 'Amendment', title: 'Published 2 March' },
  { n: 3, x: 490, kicker: 'Comparison', title: '§ 28: three → six' },
  { n: 4, x: 680, kicker: 'Commencement', title: 'In force 1 July' },
];
// Knowledge affected in the fictional organisation, by workspace.
const ITEMS = [
  { ws: 0, y: 330, label: '3 research answers' },
  { ws: 0, y: 380, label: 'Matter · 1 deadline' },
  { ws: 1, y: 330, label: '2 documents' },
  { ws: 2, y: 330, label: '1 research answer' },
];
const WS = [
  { x: 60, name: 'Employment' },
  { x: 370, name: 'Corporate' },
  { x: 680, name: 'Compliance' },
];
const itemX = (ws: number) => WS[ws]!.x + 130;

// What the change means, and who must decide. Status by stage: impact, approval, notification,
// verified current.
const CONSEQUENCES = [
  {
    what: '4 research answers',
    why: 'Quote the previous wording of § 28',
    where: 'Employment (3) · Compliance (1)',
    action: 'Notice on each answer; re-run on the new version',
    who: 'Knowledge administrator',
    status: ['Found', 'Approved', 'Notice shown', 'Re-verified'],
  },
  {
    what: '2 documents',
    why: 'Cite § 28 in a draft reply',
    where: 'Corporate',
    action: 'Re-verify citations before anything is sent',
    who: 'Responsible lawyer',
    status: ['Found', 'Assigned for review', 'In review', 'Re-verified'],
  },
  {
    what: '1 matter deadline',
    why: 'Calculated from the § 28 time limit',
    where: 'Employment',
    action: 'Recalculate the deadline',
    who: 'Lawyer on the matter',
    status: ['Found', 'Awaiting the lawyer', 'Lawyer notified', 'Confirmed by the lawyer'],
  },
  {
    what: 'Workspace members',
    why: 'Rely on the affected work',
    where: 'Employment · Corporate · Compliance',
    action: 'Tell the people who use it',
    who: 'Knowledge administrator',
    status: ['Identified', 'Approved', 'Notified', 'Notified'],
  },
  {
    what: 'Norway’s legal currency',
    why: 'Reads “behind” until the new version is held',
    where: 'Jurisdiction',
    action: 'Ingest the new version',
    who: 'Two people (four eyes)',
    status: ['Behind', 'Approved', 'Ingesting', 'Current'],
  },
] as const;

function itemState(stage: number) {
  if (stage >= 7) return 'is-current';
  if (stage >= 6) return 'is-notified';
  if (stage >= 4) return 'is-affected';
  return '';
}

export function Observatory() {
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<'changes' | 'previous' | 'new'>('changes');
  const stage = STAGES[index]!;
  const state = itemState(index);
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

      <svg
        viewBox="0 0 1000 452"
        className="nj-obs-map"
        role="img"
        aria-label={`Stage ${index + 1} of 8, ${stage.label}: one amendment moving from the official source, through human approval, into an organisation's research answers, documents and matters.`}
      >
        <text x={40} y={26} className="nj-obs-lane">
          Official law
        </text>
        <line x1={185} x2={605} y1={80} y2={80} className="nj-obs-track" />
        <line
          x1={185}
          x2={185 + 190 * Math.min(index, 3)}
          y1={80}
          y2={80}
          className="nj-obs-track is-done"
        />
        <line
          x1={755}
          x2={815}
          y1={80}
          y2={80}
          className={index >= 7 ? 'nj-obs-track is-done' : 'nj-obs-track is-dashed'}
        />
        {LAW.map((n) => {
          const i = n.n - 1;
          const cls = i < index ? 'is-done' : i === index ? 'is-on' : '';
          return (
            <g key={n.n} className={`nj-obs-card ${cls}`}>
              <rect x={n.x - 75} y={46} width={150} height={68} rx={8} />
              <text x={n.x - 63} y={70} className="nj-obs-card-k">
                {String(n.n).padStart(2, '0')} · {n.kicker}
              </text>
              <text x={n.x - 63} y={97} className="nj-obs-card-t">
                {n.title}
              </text>
            </g>
          );
        })}
        <g className={`nj-obs-seal ${index >= 7 ? 'is-on' : ''}`}>
          <rect x={815} y={46} width={150} height={68} rx={34} />
          <text x={890} y={70} className="nj-obs-card-k" textAnchor="middle">
            08 · Verified
          </text>
          <text x={890} y={97} className="nj-obs-card-t" textAnchor="middle">
            Current again
          </text>
        </g>

        <line
          x1={680}
          x2={680}
          y1={114}
          y2={176}
          className={`nj-obs-flow ${index >= 4 ? 'is-on' : ''}`}
        />
        {WS.map((w) => (
          <line
            key={w.name}
            x1={w.x + 130}
            x2={w.x + 130}
            y1={216}
            y2={262}
            className={`nj-obs-flow ${index >= 5 ? 'is-on' : index === 4 ? 'is-found' : ''}`}
          />
        ))}
        <g className={`nj-obs-gate ${index >= 5 ? 'is-open' : index === 4 ? 'is-wait' : ''}`}>
          <rect x={40} y={176} width={920} height={40} rx={6} />
          <text x={60} y={201} className="nj-obs-gate-t">
            06 · Human approval
          </text>
          <text x={940} y={201} className="nj-obs-gate-s" textAnchor="end">
            {index >= 5
              ? 'Approved · recorded with reason'
              : 'Nothing changes until a person decides'}
          </text>
        </g>

        {WS.map((w) => (
          <g key={w.name} className="nj-obs-ws">
            <rect x={w.x - 20} y={262} width={300} height={160} rx={8} />
            <text x={w.x} y={292} className="nj-obs-ws-t">
              {w.name}
            </text>
          </g>
        ))}
        {ITEMS.map((it) => (
          <g key={it.label} className={`nj-obs-item ${state}`}>
            <rect x={itemX(it.ws) - 120} y={it.y - 17} width={240} height={34} rx={17} />
            <circle cx={itemX(it.ws) - 101} cy={it.y} r={5} />
            <text x={itemX(it.ws) - 87} y={it.y + 5}>
              {it.label}
            </text>
            {index >= 6 ? (
              <text x={itemX(it.ws) + 106} y={it.y + 5} className="nj-obs-item-n" textAnchor="end">
                {index >= 7 ? '✓' : 'notice'}
              </text>
            ) : null}
          </g>
        ))}
        <text x={40} y={446} className="nj-obs-lane">
          Example Advokatfirma AS · its legal knowledge
        </text>
      </svg>

      <div key={stage.key} className="nj-obs-panel nj-fade" aria-live="polite">
        <div>
          <p className="nj-obs-kicker">
            Stage {index + 1} of 8 · {stage.label}
          </p>
          <h3>{stage.title}</h3>
          <p>{stage.body}</p>
        </div>
        <div>
          {'diff' in stage ? (
            <div className="nj-diff">
              <span className="nj-obs-sec">Section 28 · Time limit for applications</span>
              <div className="nj-diff-modes" role="group" aria-label="Compare versions">
                {(['changes', 'previous', 'new'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={view === m}
                    onClick={() => setView(m)}
                  >
                    {m === 'changes'
                      ? 'Changes'
                      : m === 'previous'
                        ? 'Previous version'
                        : 'New version'}
                  </button>
                ))}
              </div>
              {view === 'changes' ? (
                <p className="nj-diff-text">
                  An application must be made within <del>three</del> <ins>six</ins> months of
                  arrival.
                </p>
              ) : (
                <p className="nj-diff-text">
                  An application must be made within {view === 'previous' ? 'three' : 'six'} months
                  of arrival.
                  <small>
                    {view === 'previous'
                      ? 'Version held · in force until 30 June'
                      : 'New version · in force from 1 July'}
                  </small>
                </p>
              )}
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
      <div className="nj-cons">
        <div className="nj-cons-head">
          <h3>What this one change means for the organisation</h3>
          <p>
            {index < 4
              ? 'Consequences are assessed once the change and its commencement are known.'
              : '4 research answers · 2 documents · 1 matter · 3 workspaces · every action decided by a person'}
          </p>
        </div>
        <table className="nj-cons-table">
          <caption className="nj-sr">Consequences of the amendment, at stage {index + 1}</caption>
          <thead>
            <tr>
              <th scope="col">Affected</th>
              <th scope="col">Where</th>
              <th scope="col">Required action</th>
              <th scope="col">Decided by</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {CONSEQUENCES.map((c) => {
              const status = index < 4 ? 'Not yet assessed' : c.status[index - 4]!;
              const tone =
                index < 4
                  ? 'is-idle'
                  : index === 7
                    ? 'is-done'
                    : index === 4
                      ? 'is-found'
                      : 'is-active';
              return (
                <tr key={c.what} className={tone}>
                  <th scope="row">
                    <b>{c.what}</b>
                    <span>{c.why}</span>
                  </th>
                  <td data-label="Where">{c.where}</td>
                  <td data-label="Action">{c.action}</td>
                  <td data-label="Decided by">{c.who}</td>
                  <td data-label="Status">
                    <span className="nj-cons-status">{status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nj-obs-foot">
        An illustrative walk through the workflow: invented wording (Immigration Act, section 28 —
        not the text of Norwegian law) and a fictional organisation. It does not show live
        monitoring; the actual status is below.
      </p>
    </div>
  );
}
