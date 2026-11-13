'use client';

import { useState } from 'react';

// A legislative change moving through Global Legal Change Intelligence. The wording is invented
// for the demonstration and is not the text of any act.
const STAGES = [
  {
    label: 'Detected',
    render: () => (
      <>
        <h4>Official source check · Norway</h4>
        <h5>Amendment published to the Immigration Act, section 28</h5>
        <p>
          The monitor finds a new consolidated version in the official listing and records the
          publication date.
        </p>
      </>
    ),
  },
  {
    label: 'Compared',
    render: () => (
      <>
        <h4>Provision-level comparison</h4>
        <h5>Section 28 — Time limit for applications</h5>
        <div className="nj-diff">
          <span className="nj-del">within three months of arrival</span>
          <span className="nj-ins">within six months of arrival</span>
        </div>
      </>
    ),
  },
  {
    label: 'Dated',
    render: () => (
      <>
        <h4>Publication and commencement</h4>
        <h5>Published 2 March · in force 1 July</h5>
        <p>
          Publication is not commencement. Until 1 July, research on the law in force still uses the
          previous wording; afterwards, the new one.
        </p>
      </>
    ),
  },
  {
    label: 'Impact',
    render: () => (
      <>
        <h4>Impact analysis</h4>
        <h5>What relied on section 28</h5>
        <ul>
          <li>4 research answers quote the previous wording</li>
          <li>2 documents cite it and need re-verification</li>
          <li>1 matter has a deadline calculated from it</li>
          <li>Norway reads “behind” until the new text is ingested</li>
        </ul>
      </>
    ),
  },
  {
    label: 'Approval',
    render: () => (
      <>
        <h4>Proposed remediation · awaiting approval</h4>
        <h5>Re-ingest the act; notify affected workspaces</h5>
        <p>
          A knowledge administrator reviews the change and the proposal. Nothing is changed or sent
          until an authorised person approves; every decision is recorded.
        </p>
      </>
    ),
  },
  {
    label: 'Notice',
    render: () => (
      <>
        <h4>Shown on each affected research answer</h4>
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
        <h3>A legal change, end to end</h3>
        <span className="nj-tag nj-tag--illustrative">Illustrative</span>
      </div>
      <p className="nj-demo-sub">Norway · immigration legislation · invented wording</p>
      <ol className="nj-demo-steps" aria-label="Stages of the change">
        {STAGES.map((s, i) => (
          <li key={s.label}>
            <button type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>
      <div key={stage.label} className="nj-stage nj-fade" aria-live="polite">
        {stage.render()}
      </div>
      <div className="nj-demo-nav">
        <button
          type="button"
          className="nj-btn nj-btn--outline nj-btn--sm"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Previous
        </button>
        <button
          type="button"
          className="nj-btn nj-btn--navy nj-btn--sm"
          onClick={() => setIndex((i) => Math.min(STAGES.length - 1, i + 1))}
          disabled={index === STAGES.length - 1}
        >
          Next stage
        </button>
      </div>
      <p className="nj-demo-foot">
        A walk through the workflow with invented wording; it is not the text of Norwegian law.
      </p>
    </div>
  );
}
