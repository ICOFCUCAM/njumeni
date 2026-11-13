import type { Metadata } from 'next';
import { Observatory } from '../../observatory';
import { CtaBand, Kicker, PageIntro, Related, Tag } from '../../site';

export const metadata: Metadata = {
  title: { absolute: 'Global Legal Change Intelligence — Njumeni' },
  description:
    'How Njumeni watches official sources, compares versions, separates publication from commencement, traces impact and routes remediation through accountable people.',
  alternates: { canonical: '/platform/change-intelligence' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Global Legal Change Intelligence"
        title={
          <>
            The law changes. <em>Legal knowledge must keep up.</em>
          </>
        }
        lead="Njumeni watches authorised official sources, compares every new version with the last, and traces each change to the research, documents and matters that relied on the old law — then routes the response through people who are accountable for it."
      />
      <section className="nj-s nj-s--ivory" aria-labelledby="ideas-title">
        <div className="nj-wrap">
          <h2 id="ideas-title" className="nj-sr">
            Three principles
          </h2>
          <ol className="nj-pillars nj-pillars--3">
            <li>
              <small>Time</small>
              <b>Publication is not commencement</b>
              <span>
                A change is dated twice: when it was published and when it takes effect. Until then,
                the previous text still governs — and research says so.
              </span>
            </li>
            <li>
              <small>Consequence</small>
              <b>A change reaches the work that relied on it</b>
              <span>
                Answers, documents and deadlines that cited the old text are found, across
                workspaces, without crossing their barriers.
              </span>
            </li>
            <li>
              <small>Accountability</small>
              <b>People decide what happens next</b>
              <span>
                Remediation is proposed, not applied. An authorised person approves it, and every
                decision is recorded with its reason.
              </span>
            </li>
          </ol>
        </div>
      </section>
      {/* 06 — Global Legal Change Intelligence */}
      <section id="change-intelligence" className="nj-s nj-glci" aria-labelledby="glci-title">
        <div className="nj-wrap">
          <h2 id="glci-title" className="nj-sr">
            Follow one change through the system
          </h2>
          <Observatory />
          <div className="nj-currency-grid">
            <div className="nj-currency">
              <h3>Four honest answers to “is this law current?”</h3>
              <dl>
                <div style={{ ['--c' as string]: '#6fb8a3' }}>
                  <dt>Current</dt>
                  <dd>Sources checked successfully; nothing newer than what is held.</dd>
                </div>
                <div style={{ ['--c' as string]: '#d9a441' }}>
                  <dt>Behind</dt>
                  <dd>A change was detected and is not yet ingested.</dd>
                </div>
                <div style={{ ['--c' as string]: '#d17f63' }}>
                  <dt>Unverified</dt>
                  <dd>A source could not be checked — shown as unverified, never as current.</dd>
                </div>
                <div className="is-today" style={{ ['--c' as string]: 'rgba(245,241,232,0.5)' }}>
                  <dt>Not monitored</dt>
                  <dd>
                    No authorised source is being watched yet.
                    <span className="nj-today">Every jurisdiction today</span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="nj-board">
              <p className="nj-board-actual">Actual status — not illustrative</p>
              <div className="nj-board-head">
                <h3>Observatory status today</h3>
                <span>Hosted service · 22 official sources registered</span>
              </div>
              <table>
                <caption className="nj-sr">Monitoring status by jurisdiction</caption>
                <thead>
                  <tr>
                    <th scope="col">Jurisdiction</th>
                    <th scope="col">Sources</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Norway', 5],
                    ['United States', 3],
                    ['European Union', 2],
                    ['United Kingdom', 2],
                    ['Sweden', 2],
                    ['Denmark', 2],
                    ['Finland', 2],
                    ['Cameroon', 2],
                    ['Uganda', 2],
                  ].map(([name, count]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td className="nj-mono">{count}</td>
                      <td>
                        <span className="nj-dot nj-dot--off" aria-hidden="true" /> Not monitored
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Sources are switched on one by one after their rights review, starting with Norway.
              </p>
            </div>
          </div>
          <div className="nj-status-line">
            <Tag status="built" /> Monitoring, comparison, impact analysis, currency, remediation,
            approvals, notices and the operators’ Global Legal Observatory.
            <Tag status="awaiting" /> Official sources.
          </div>
        </div>
      </section>
      <section className="nj-s nj-s--paper" aria-labelledby="gov-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Governance and auditability</Kicker>
            <h2 id="gov-title">
              Every change, <em>on the record.</em>
            </h2>
          </div>
          <dl className="nj-deflist">
            <div>
              <dt>Two people by default</dt>
              <dd>
                Source activation, remediation and deployments need an authorised decision, and a
                second person by default.
              </dd>
            </div>
            <div>
              <dt>Recorded decisions</dt>
              <dd>
                Who decided, when and why is written to the hash-chained audit record, with
                checkpoints and verifiable exports.
              </dd>
            </div>
            <div>
              <dt>The Global Legal Observatory</dt>
              <dd>
                Njumeni’s operators see every source, check, change, impact and decision in one
                command centre. It is internal to the platform team.
              </dd>
            </div>
            <div>
              <dt>Honest currency</dt>
              <dd>
                A source that could not be checked reads unverified, never current. A jurisdiction
                with no activated source reads not monitored.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <Related keys={['jurisdictions', 'research', 'security']} />
      <CtaBand title="Keep your legal knowledge current." />
    </>
  );
}
