'use client';

import { useState } from 'react';

// The law as it stood on a date: one provision, three versions. Illustrative wording.
const VERSIONS = [
  {
    from: 2019.0,
    to: 2024.0,
    label: 'Version 1',
    since: '1 January 2019',
    text: 'An application must be submitted within one month of arrival.',
  },
  {
    from: 2024.0,
    to: 2027.5,
    label: 'Version 2',
    since: '1 January 2024',
    text: 'An application must be submitted within three months of arrival.',
  },
  {
    from: 2027.5,
    to: 2030,
    label: 'Version 3',
    since: '1 July 2027',
    text: 'An application must be submitted within six months of arrival.',
  },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PUBLISHED = 2026.75; // version 3 published October 2026, in force July 2027

function label(value: number) {
  const year = Math.floor(value);
  const month = Math.min(11, Math.round((value - year) * 12));
  return `${MONTHS[month]} ${year}`;
}

export function TimeMachine() {
  const [value, setValue] = useState(2026.85);
  const version =
    VERSIONS.find((v) => value >= v.from && value < v.to) ?? VERSIONS[VERSIONS.length - 1]!;
  const pending = value >= PUBLISHED && value < 2027.5;
  return (
    <div className="nj-tm" aria-label="The law as it stood on a chosen date">
      <div className="nj-tm-head">
        <span>Immigration Act · § 28</span>
        <span className="nj-tm-date">Law as it stood on {label(value)}</span>
      </div>
      <div className="nj-tm-body">
        <p className="nj-tm-version">
          {version.label} · in force from {version.since}
        </p>
        <blockquote key={version.label} className="nj-tm-text">
          “{version.text}”
        </blockquote>
        {pending ? (
          <p className="nj-tm-pending">
            An amendment is published but not yet in force (from 1 July 2027). Njumeni applies the
            version above — publication is not commencement.
          </p>
        ) : (
          <p className="nj-tm-pending nj-tm-quiet">
            Citation, version and source are attached to every answer.
          </p>
        )}
      </div>
      <div className="nj-tm-scale">
        <input
          type="range"
          min={2019}
          max={2029.9}
          step={1 / 12}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label="Date of the law"
          aria-valuetext={label(value)}
        />
        <div className="nj-tm-ticks" aria-hidden="true">
          {[2019, 2021, 2023, 2025, 2027, 2029].map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>
      <p className="nj-tm-hint">Drag through time. Illustrative provision.</p>
    </div>
  );
}
