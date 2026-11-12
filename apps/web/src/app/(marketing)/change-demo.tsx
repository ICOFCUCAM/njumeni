'use client';

import { useState } from 'react';

// Illustrative walkthrough of the Global Legal Change Intelligence workflow. The wording is
// invented for the demonstration and is not the text of any Norwegian act.
const STAGES = [
  {
    key: 'previous',
    label: 'Previous version',
    render: () => (
      <>
        <h4>Previous version · in force</h4>
        <h5>Section 28 — Time limit for applications</h5>
        <p>“An application must be submitted within three months of arrival.”</p>
        <p className="nj-demo-foot">Valid from 1 January 2024. Source: official legal database.</p>
      </>
    ),
  },
  {
    key: 'detected',
    label: 'Change detected',
    render: () => (
      <>
        <h4>New version detected · official source check</h4>
        <h5>Amendment published</h5>
        <div className="nj-diff">
          <span className="nj-del">within three months of arrival</span>
          <span className="nj-ins">within six months of arrival</span>
        </div>
        <p style={{ marginTop: 12 }}>
          Published 2 March. <strong>Takes effect 1 July</strong>: publication is not commencement,
          so the previous wording still governs until then.
        </p>
      </>
    ),
  },
  {
    key: 'impact',
    label: 'Impact analysis',
    render: () => (
      <>
        <h4>Njumeni impact analysis</h4>
        <h5>What relied on Section 28</h5>
        <ul>
          <li>4 research answers cite the previous wording.</li>
          <li>2 documents quote it and need re-verification.</li>
          <li>1 matter has a deadline calculated from it.</li>
          <li>Norway reads “update pending”, not “current”, until the new text is ingested.</li>
        </ul>
      </>
    ),
  },
  {
    key: 'approval',
    label: 'Human approval',
    render: () => (
      <>
        <h4>Proposed update · awaiting approval</h4>
        <h5>Re-ingest the act and notify affected workspaces</h5>
        <p>
          A knowledge administrator reviews the change and the proposed actions. Nothing is changed
          or sent until an authorised person approves, and every decision is recorded in an audit
          trail.
        </p>
      </>
    ),
  },
  {
    key: 'notice',
    label: 'Customer notice',
    render: () => (
      <>
        <h4>Shown on the affected research answer</h4>
        <h5>The law has changed since this answer</h5>
        <p>
          Section 28 was amended: the time limit becomes six months from 1 July. Ask the question
          again to research the law as it now stands.
        </p>
      </>
    ),
  },
] as const;

export function ChangeDemo() {
  const [index, setIndex] = useState(0);
  const stage = STAGES[index]!;
  return (
    <div className="nj-demo">
      <div className="nj-demo-head">
        <h3>Illustrative legal change</h3>
        <span className="nj-demo-tag">Demonstration</span>
      </div>
      <p className="nj-demo-sub">Norway · immigration legislation · invented wording</p>
      <ol className="nj-steps" aria-label="Demonstration steps">
        {STAGES.map((s, i) => (
          <li key={s.key}>
            <button type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>
      <div className="nj-stage" aria-live="polite">
        {stage.render()}
      </div>
      <div className="nj-demo-nav">
        <button
          type="button"
          className="nj-btn nj-btn-outline nj-btn-sm"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Previous
        </button>
        <button
          type="button"
          className="nj-btn nj-btn-navy nj-btn-sm"
          onClick={() => setIndex((i) => Math.min(STAGES.length - 1, i + 1))}
          disabled={index === STAGES.length - 1}
        >
          Next step
        </button>
      </div>
      <p className="nj-demo-foot">
        A walk through the workflow with invented wording; it is not the text of Norwegian law.
      </p>
    </div>
  );
}
