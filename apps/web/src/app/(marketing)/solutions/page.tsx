import type { Metadata } from 'next';
import { Journeys } from '../journeys';
import { OrgExplorer } from '../org-explorer';
import { CtaBand, Kicker, PageIntro, Related } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Who Njumeni serves — Njumeni' },
  description:
    'Individuals, legal professionals, law firms and enterprises, and public institutions: their needs, workflows, permissions and workspaces.',
  alternates: { canonical: '/solutions' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Who Njumeni serves"
        title={
          <>
            Four kinds of user. <em>Four different journeys.</em>
          </>
        }
        lead="Each works on the same legal intelligence, in the workspace made for how they work. One person can belong to more than one; access follows their organisation, role and permissions."
      />
      {/* 11 — Who uses Njumeni */}
      <section id="audiences" className="nj-s nj-s--ivory" aria-labelledby="audiences-title">
        <div className="nj-wrap">
          <h2 id="audiences-title" className="nj-sr">
            Four customer journeys
          </h2>
          <Journeys />
          <p className="nj-fineprint">
            Njumeni provides legal information and research tools. It is not a law firm and does not
            replace advice from a qualified lawyer.
          </p>
        </div>
      </section>
      <section className="nj-s nj-s--paper" aria-labelledby="compare-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Side by side</Kicker>
              <h2 id="compare-title">
                The same intelligence, <em>governed differently.</em>
              </h2>
            </div>
            <p className="nj-lead">
              What changes between audiences is who works in the workspace, who decides, and which
              plans fit.
            </p>
          </div>
          <div className="nj-dir-scroll" role="region" aria-label="Audiences compared" tabIndex={0}>
            <table className="nj-dir nj-aud">
              <caption className="nj-sr">Audiences compared</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="nj-sr">Aspect</span>
                  </th>
                  <th scope="col">Individuals</th>
                  <th scope="col">Legal professionals</th>
                  <th scope="col">Law firms and enterprises</th>
                  <th scope="col">Public institutions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Workspace</th>
                  <td>Personal</td>
                  <td>Professional</td>
                  <td>Law Firm · Enterprise</td>
                  <td>Institutional</td>
                </tr>
                <tr>
                  <th scope="row">Needs</th>
                  <td>A clear answer from the law, and when to see a lawyer</td>
                  <td>Reliable authority, matters and drafts in one place</td>
                  <td>Shared work with conflicts, barriers and governance</td>
                  <td>Legal knowledge kept current, with public accountability</td>
                </tr>
                <tr>
                  <th scope="row">Who decides</th>
                  <td>The owner</td>
                  <td>The professional, through review gates</td>
                  <td>Members by role; partners and owners sign off</td>
                  <td>Authorised officials; approvals are recorded</td>
                </tr>
                <tr>
                  <th scope="row">Permissions</th>
                  <td>Private to the owner</td>
                  <td>Private to the professional</td>
                  <td>Per member and workspace, with barriers</td>
                  <td>Per department, with exportable audit</td>
                </tr>
                <tr>
                  <th scope="row">Plans</th>
                  <td>Free · Personal · Personal Plus</td>
                  <td>Professional · Professional Plus</td>
                  <td>Law Firm · Enterprise</td>
                  <td>Institutional</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {/* 08 — Organisations */}
      <section id="organisations" className="nj-s nj-s--ivory" aria-labelledby="org-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Institutional architecture</Kicker>
              <h2 id="org-title">
                Built for organisations, <em>from the foundation up.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Five environments, one architecture. Isolation is enforced by the database itself, not
              by the interface: every organisation, workspace, role and decision has its place.
            </p>
          </div>
          <OrgExplorer />
          <div className="nj-arch" aria-label="Example organisation structure">
            <div className="nj-arch-org">
              <small>Organisation</small>
              <b>Example Advokatfirma AS</b>
              <span>Members · roles · single sign-on · billing · retention policy</span>
            </div>
            <div className="nj-arch-links" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="nj-arch-row">
              <div className="nj-arch-ws">
                <small>Workspace</small>
                <b>Employment</b>
                <ul>
                  <li>Partner · associates · paralegal</li>
                  <li>14 matters</li>
                </ul>
              </div>
              <div className="nj-arch-ws">
                <small>Workspace</small>
                <b>Corporate</b>
                <ul>
                  <li>Separate team and matters</li>
                  <li>No access to Employment</li>
                </ul>
              </div>
              <div className="nj-arch-ws">
                <small>Workspace</small>
                <b>Compliance</b>
                <ul>
                  <li>Registers and obligations</li>
                  <li>Named owners</li>
                </ul>
              </div>
              <div className="nj-arch-barrier" aria-hidden="true">
                <span>Barrier</span>
              </div>
            </div>
            <div className="nj-arch-base">
              <div>
                <b>Isolation</b>
                <span>Row-level security per organisation</span>
              </div>
              <div>
                <b>Roles</b>
                <span>Permissions per member and workspace</span>
              </div>
              <div>
                <b>Barriers</b>
                <span>Between matters and teams</span>
              </div>
              <div>
                <b>Audit</b>
                <span>Hash-chained, exportable</span>
              </div>
              <div>
                <b>Retention</b>
                <span>Policies and legal holds</span>
              </div>
            </div>
          </div>
          <p className="nj-figcap">
            Illustrative organisation; the structure is the one Njumeni enforces.
          </p>
        </div>
      </section>
      <Related keys={['plans', 'workspace', 'security']} />
      <CtaBand title="Find the workspace that fits your work." />
    </>
  );
}
