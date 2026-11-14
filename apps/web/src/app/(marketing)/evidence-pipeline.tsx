'use client';

import { useState } from 'react';

// The evidence pipeline as built (supabase/migrations/20261111200000_evidence_intelligence_foundation
// and apps/web/src/modules/evidence): new files are quarantined until a scan clears them; the
// built-in screening is live, a full anti-malware engine is not yet connected.
const STEPS = [
  {
    key: 'upload',
    label: 'Upload',
    status: 'built',
    does: 'The file goes to private storage in the matter’s workspace. Nobody outside the workspace can reach it.',
    records: 'Who uploaded it, when, to which matter.',
  },
  {
    key: 'fingerprint',
    label: 'Fingerprint',
    status: 'built',
    does: 'A SHA-256 fingerprint of the exact bytes is taken on arrival.',
    records: 'The fingerprint, size and file type — any later change to the file shows.',
  },
  {
    key: 'quarantine',
    label: 'Quarantine',
    status: 'built',
    does: 'New evidence starts quarantined. It cannot be opened, extracted or shared until it is cleared.',
    records: 'Status: quarantined.',
  },
  {
    key: 'scan',
    label: 'Scan',
    status: 'partial',
    does: 'Built-in screening checks the file before release. A full anti-malware engine plugs in before real client files are accepted; it is not yet connected.',
    records: 'Scan result — pending, clean, infected or rejected — and when it ran.',
  },
  {
    key: 'custody',
    label: 'Custody record',
    status: 'built',
    does: 'Every action writes a record whose hash includes the record before it, so the chain can be checked independently.',
    records: 'Action, person, time, object and the linked hash.',
  },
  {
    key: 'hold',
    label: 'Legal hold',
    status: 'built',
    does: 'A hold stops deletion, whatever the retention policy says, until it is released by an authorised person.',
    records: 'Who placed and released the hold, and why.',
  },
  {
    key: 'versions',
    label: 'Versioning',
    status: 'built',
    does: 'A new version is added beside the old one. Earlier versions are never overwritten.',
    records: 'Version number, fingerprint and the person who added it.',
  },
  {
    key: 'bundle',
    label: 'Evidence bundle',
    status: 'built',
    does: 'Selected evidence is exported with a manifest listing every file and its fingerprint.',
    records: 'The export, its manifest and a digest anyone can recompute.',
  },
] as const;

export function EvidencePipeline() {
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  return (
    <div className="nj-pipe">
      <ol className="nj-pipe-steps" aria-label="The evidence pipeline">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={i === index}
              className={i < index ? 'is-done' : undefined}
              onClick={() => setIndex(i)}
            >
              <span className="nj-pipe-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="nj-pipe-l">{s.label}</span>
              {s.status === 'partial' ? <span className="nj-pipe-flag">Partly built</span> : null}
            </button>
          </li>
        ))}
      </ol>
      <div key={step.key} className="nj-pipe-detail nj-fade" aria-live="polite">
        <div>
          <p className="nj-pipe-k">
            Step {index + 1} of 8 · {step.label}
          </p>
          <p className="nj-pipe-does">{step.does}</p>
        </div>
        <div>
          <p className="nj-pipe-k">What the record keeps</p>
          <p className="nj-pipe-rec">{step.records}</p>
          <p className="nj-pipe-status">
            {step.status === 'partial' ? (
              <>
                <span className="nj-tag nj-tag--built">Built</span> screening ·{' '}
                <span className="nj-tag nj-tag--developing">In development</span> anti-malware
                engine
              </>
            ) : (
              <span className="nj-tag nj-tag--built">Built</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
