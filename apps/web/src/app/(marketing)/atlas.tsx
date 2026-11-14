'use client';

import { useState } from 'react';

// The jurisdiction framework as held in the registry (private.jurisdictions and
// private.glci_monitoring_targets). Monitoring status is the hosted service's state: no official
// source is active yet, so every jurisdiction is "not monitored".
interface Jurisdiction {
  code: string;
  name: string;
  x?: number;
  y?: number;
  system: string;
  languages: string;
  sources: string[];
  stage: 'reference' | 'profiled' | 'catalogued';
}
const JURISDICTIONS: Jurisdiction[] = [
  {
    code: 'NO',
    name: 'Norway',
    x: 52.23,
    y: 9.41,
    stage: 'reference',
    system: 'Nordic civil law',
    languages: 'Bokmål, Nynorsk',
    sources: [
      'Lovdata — current laws',
      'Lovdata — central regulations',
      'Norsk Lovtidend',
      'Stortinget',
      'regjeringen.no',
    ],
  },
  {
    code: 'SE',
    name: 'Sweden',
    x: 53.78,
    y: 9.7,
    stage: 'profiled',
    system: 'Nordic civil law',
    languages: 'Swedish',
    sources: ['Svensk författningssamling', 'Sveriges riksdag'],
  },
  {
    code: 'DK',
    name: 'Denmark',
    x: 52.72,
    y: 11.62,
    stage: 'profiled',
    system: 'Nordic civil law',
    languages: 'Danish',
    sources: ['Retsinformation', 'Folketinget'],
  },
  {
    code: 'FI',
    name: 'Finland',
    x: 55.17,
    y: 9.28,
    stage: 'profiled',
    system: 'Nordic civil law',
    languages: 'Finnish, Swedish',
    sources: ['Finlex', 'Eduskunta'],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    x: 49.97,
    y: 13.96,
    stage: 'profiled',
    system: 'Common law',
    languages: 'English',
    sources: ['legislation.gov.uk', 'UK Parliament'],
  },
  {
    code: 'EU',
    name: 'European Union',
    x: 50.98,
    y: 14.34,
    stage: 'profiled',
    system: 'EU law (EEA law for Norway)',
    languages: '24 official languages',
    sources: ['EUR-Lex', 'Official Journal of the EU'],
  },
  {
    code: 'US',
    name: 'United States',
    x: 31.06,
    y: 21.79,
    stage: 'profiled',
    system: 'Federal common law',
    languages: 'English',
    sources: ['Federal Register', 'Congress.gov', 'GovInfo'],
  },
  {
    code: 'CM',
    name: 'Cameroon',
    x: 53.17,
    y: 47.06,
    stage: 'profiled',
    system: 'Bijural, with OHADA law',
    languages: 'French, English',
    sources: ['Journal officiel', 'Assemblée nationale'],
  },
  {
    code: 'UG',
    name: 'Uganda',
    x: 58.98,
    y: 49.72,
    stage: 'profiled',
    system: 'Common law',
    languages: 'English',
    sources: ['Uganda Gazette', 'Parliament of Uganda'],
  },
  {
    code: 'GH',
    name: 'Ghana',
    x: 49.95,
    y: 45.75,
    stage: 'catalogued',
    system: 'Common law',
    languages: 'English',
    sources: [],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    x: 52.05,
    y: 43.15,
    stage: 'catalogued',
    system: 'Common law',
    languages: 'English',
    sources: [],
  },
  {
    code: 'SN',
    name: 'Senegal',
    x: 45.26,
    y: 38.92,
    stage: 'catalogued',
    system: 'Civil law, with OHADA law',
    languages: 'French',
    sources: [],
  },
  {
    code: 'KE',
    name: 'Kenya',
    x: 60.14,
    y: 50.96,
    stage: 'catalogued',
    system: 'Common law',
    languages: 'English, Kiswahili',
    sources: [],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    x: 57.4,
    y: 69.1,
    stage: 'catalogued',
    system: 'Mixed legal system',
    languages: 'Multiple official languages',
    sources: [],
  },
];
// Authority structure: the broad hierarchy each profile describes (general, not exhaustive).
const STRUCTURE: Record<string, string> = {
  NO: 'Constitution · acts · regulations · court decisions',
  SE: 'Fundamental laws · acts · ordinances · court decisions',
  DK: 'Constitution · acts · executive orders · court decisions',
  FI: 'Constitution · acts · decrees · court decisions',
  GB: 'Acts of Parliament · statutory instruments · case law',
  EU: 'Treaties · regulations and directives · case law of the Court of Justice',
  US: 'Constitution · federal statutes · regulations · case law',
  CM: 'Constitution · laws · ordinances and decrees · OHADA uniform acts',
  UG: 'Constitution · acts · statutory instruments · case law',
};
const RIGHTS: Record<string, string> = {
  NO: 'Lovdata datasets under NLOD 2.0 · activation awaits the rights review',
};

const STAGE_LABEL = {
  reference: 'Reference jurisdiction',
  profiled: 'Profiled · sources registered',
  catalogued: 'Catalogued',
};

export function Atlas() {
  const [code, setCode] = useState('NO');
  const [filter, setFilter] = useState<'all' | Jurisdiction['stage']>('all');
  const j = JURISDICTIONS.find((item) => item.code === code)!;
  const count = (stage: Jurisdiction['stage']) =>
    JURISDICTIONS.filter((x) => x.stage === stage).length;
  const dim = (item: Jurisdiction) => filter !== 'all' && item.stage !== filter;
  return (
    <div className="nj-atlas-wrap">
      <div className="nj-atlas-filter" role="group" aria-label="Show jurisdictions by stage">
        {(
          [
            ['all', `All · ${JURISDICTIONS.length}`],
            ['reference', `Reference · ${count('reference')}`],
            ['profiled', `Profiled · ${count('profiled')}`],
            ['catalogued', `Catalogued · ${count('catalogued')}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <span className="nj-atlas-monitored">Monitored live · 0</span>
      </div>
      <div className="nj-atlas">
        <div className="nj-atlas-map">
          <div className="nj-atlas-canvas">
            <img
              src="/home/jurisdiction-atlas.svg"
              alt=""
              width={1000}
              height={491}
              loading="lazy"
              decoding="async"
            />
            {JURISDICTIONS.map((item) => (
              <button
                key={item.code}
                type="button"
                className={`nj-atlas-pin nj-atlas-pin--${item.stage}${dim(item) ? ' is-dim' : ''}`}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                aria-pressed={item.code === code}
                aria-label={`${item.name}: ${STAGE_LABEL[item.stage]}`}
                onClick={() => setCode(item.code)}
              />
            ))}
            {j.x !== undefined ? (
              <span
                className="nj-atlas-label"
                style={{ left: `${j.x}%`, top: `${j.y}%` }}
                aria-hidden="true"
              >
                {j.name}
              </span>
            ) : null}
          </div>
          <ul className="nj-atlas-legend">
            <li style={{ ['--c' as string]: '#C6A66B' }}>
              <i aria-hidden="true" />
              Reference jurisdiction
            </li>
            <li style={{ ['--c' as string]: '#142638' }}>
              <i aria-hidden="true" />
              Profiled · official sources registered
            </li>
            <li style={{ ['--c' as string]: '#FCFAF5', ['--b' as string]: '#142638' }}>
              <i aria-hidden="true" />
              Catalogued
            </li>
            <li style={{ ['--c' as string]: '#C3CBD2' }}>
              <i aria-hidden="true" />
              EU member states
            </li>
          </ul>
        </div>
        <div className="nj-atlas-side">
          <div className="nj-atlas-pick" role="group" aria-label="Choose a jurisdiction">
            {JURISDICTIONS.map((item) => (
              <button
                key={item.code}
                type="button"
                aria-pressed={item.code === code}
                aria-label={item.name}
                className={dim(item) ? 'is-dim' : undefined}
                onClick={() => setCode(item.code)}
              >
                {item.code}
              </button>
            ))}
          </div>
          <div key={j.code} className="nj-atlas-card nj-fade" aria-live="polite">
            <p className="nj-atlas-stage">{STAGE_LABEL[j.stage]}</p>
            <h3>{j.name}</h3>
            <dl>
              <div>
                <dt>Legal system</dt>
                <dd>{j.system}</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>{j.languages}</dd>
              </div>
              <div>
                <dt>Official sources</dt>
                <dd>
                  {j.sources.length ? (
                    <ul>
                      {j.sources.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    'To be registered with the jurisdiction profile'
                  )}
                </dd>
              </div>
              <div>
                <dt>Authority structure</dt>
                <dd>{STRUCTURE[j.code] ?? 'Described when the jurisdiction is profiled'}</dd>
              </div>
              <div>
                <dt>Source rights</dt>
                <dd>
                  {RIGHTS[j.code] ??
                    (j.sources.length
                      ? 'Rights review pending for each source'
                      : 'No sources registered yet')}
                </dd>
              </div>
              <div>
                <dt>Content</dt>
                <dd>
                  {j.code === 'NO'
                    ? 'Legal text prepared for activation · not available to customers yet'
                    : 'No legal content available'}
                </dd>
              </div>
              <div>
                <dt>Monitoring</dt>
                <dd>
                  <span className="nj-dot nj-dot--off" aria-hidden="true" /> Not monitored yet
                </dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>Not evaluated · no legal coverage is claimed</dd>
              </div>
            </dl>
            <p className="nj-atlas-note">
              A profile describes a legal system. It is not legal coverage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
