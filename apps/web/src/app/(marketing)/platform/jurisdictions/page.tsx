import type { Metadata } from 'next';
import { Atlas } from '../../atlas';
import { CtaBand, PageIntro, Related, Tag } from '../../site';

// The seventeen legal systems in the framework (private.jurisdictions), with the official sources
// registered for each. No jurisdiction has content available to customers yet.
const DIRECTORY = [
  { name: 'Norway', kind: 'Country · reference', sources: 5, stage: 'Pending' },
  { name: 'Sweden', kind: 'Country', sources: 2, stage: 'Registered' },
  { name: 'Denmark', kind: 'Country', sources: 2, stage: 'Registered' },
  { name: 'Finland', kind: 'Country', sources: 2, stage: 'Registered' },
  { name: 'United Kingdom', kind: 'Country', sources: 2, stage: 'Registered' },
  { name: 'United States', kind: 'Country', sources: 3, stage: 'Registered' },
  { name: 'Cameroon', kind: 'Country', sources: 2, stage: 'Registered' },
  { name: 'Uganda', kind: 'Country', sources: 2, stage: 'Registered' },
  { name: 'European Union', kind: 'Supranational', sources: 2, stage: 'Registered' },
  { name: 'Ghana', kind: 'Country', sources: 0, stage: 'Planned' },
  { name: 'Nigeria', kind: 'Country', sources: 0, stage: 'Planned' },
  { name: 'Senegal', kind: 'Country', sources: 0, stage: 'Planned' },
  { name: 'Kenya', kind: 'Country', sources: 0, stage: 'Planned' },
  { name: 'South Africa', kind: 'Country', sources: 0, stage: 'Planned' },
  { name: 'European Economic Area', kind: 'Supranational', sources: 0, stage: 'Planned' },
  { name: 'OHADA', kind: 'Regional (business law)', sources: 0, stage: 'Planned' },
  { name: 'Public international law', kind: 'International', sources: 0, stage: 'Planned' },
];

export const metadata: Metadata = {
  title: { absolute: 'Jurisdictions — Njumeni' },
  description:
    'The global jurisdiction framework: legal systems, official sources, languages, licensing, onboarding and monitoring status — stated as it is.',
  alternates: { canonical: '/platform/jurisdictions' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="The global jurisdiction framework"
        title={
          <>
            One framework. <em>Many legal systems.</em>
          </>
        }
        lead="Legal systems are not interchangeable. Each is described on its own terms and kept apart in search — inside one platform, with one standard of evidence. The framework spans 17 legal systems: 13 countries, the EU, the EEA, OHADA and international law."
        tone="ivory"
      />
      {/* 07 — Jurisdictions */}
      <section id="international" className="nj-s nj-s--paper" aria-labelledby="intl-title">
        <div className="nj-wrap">
          <h2 id="intl-title" className="nj-sr">
            Jurisdiction explorer
          </h2>
          <Atlas />
          <div className="nj-needs" aria-label="What each jurisdiction requires">
            <div>
              <b>Sources</b>
              <span>Its own official publications</span>
            </div>
            <div>
              <b>Hierarchy</b>
              <span>Constitution, acts, regulations, cases</span>
            </div>
            <div>
              <b>Languages</b>
              <span>Searched in the languages of the law</span>
            </div>
            <div>
              <b>Versions</b>
              <span>Every version, with its dates</span>
            </div>
            <div>
              <b>Rights</b>
              <span>A licence or rights review per source</span>
            </div>
            <div>
              <b>Monitoring</b>
              <span>A monitor fitted to the source’s format</span>
            </div>
            <div>
              <b>Verification</b>
              <span>Evaluated before coverage is claimed</span>
            </div>
          </div>
          <div className="nj-status-line">
            <Tag status="built" /> The framework: profiles, hierarchies, date rules and 22
            registered official sources.
            <Tag status="awaiting" /> Legal content and monitoring: no jurisdiction is yet covered
            or monitored live.
          </div>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="dir-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <h2 id="dir-title">
                The directory, <em>as it stands.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Seventeen legal systems are in the framework. None is active for customers yet; Norway
              is first, pending activation of its sources.
            </p>
          </div>
          <ul className="nj-dir-legend" aria-label="Coverage stages">
            <li className="is-active">
              <b>Active</b> Legal content available to customers · none yet
            </li>
            <li className="is-pending">
              <b>Pending</b> Content prepared; sources await activation
            </li>
            <li className="is-registered">
              <b>Registered</b> Official sources registered; rights review pending
            </li>
            <li className="is-planned">
              <b>Planned</b> Catalogued in the framework
            </li>
          </ul>
          <div
            className="nj-dir-scroll"
            role="region"
            aria-label="Jurisdiction directory"
            tabIndex={0}
          >
            <table className="nj-dir">
              <caption className="nj-sr">Jurisdiction directory</caption>
              <thead>
                <tr>
                  <th scope="col">Jurisdiction</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Official sources</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Monitoring</th>
                </tr>
              </thead>
              <tbody>
                {DIRECTORY.map((d) => (
                  <tr key={d.name}>
                    <th scope="row">{d.name}</th>
                    <td>{d.kind}</td>
                    <td className="nj-mono">{d.sources || '—'}</td>
                    <td>
                      <span className={`nj-dir-stage is-${d.stage.toLowerCase()}`}>{d.stage}</span>
                    </td>
                    <td>Not monitored</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="nj-onboard">
            <h3>How a jurisdiction is onboarded</h3>
            <ol>
              <li>Profile the legal system, its hierarchy, languages and date rules.</li>
              <li>Register its official sources.</li>
              <li>Review the rights and licence of each source.</li>
              <li>Fit a monitor to each source’s format.</li>
              <li>Ingest and evaluate retrieval before any coverage is claimed.</li>
              <li>Activate, with a recorded approval.</li>
            </ol>
          </div>
        </div>
      </section>
      <Related keys={['change', 'research', 'documentation']} />
      <CtaBand title="Bring your jurisdiction into the framework." />
    </>
  );
}
