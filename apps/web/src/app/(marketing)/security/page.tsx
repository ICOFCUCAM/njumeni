import type { Metadata } from 'next';
import { GovernanceFlow } from '../governance-flow';
import { AccessCheck } from '../org-explorer';
import { CtaBand, Kicker, PageIntro, Related, Tag } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Security and governance — Njumeni' },
  description:
    'Organisation isolation, role-based access, information barriers, tamper-evident audit, evidence custody, retention and legal holds, human approval — and what is not yet certified.',
  alternates: { canonical: '/security' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Security and governance"
        title={
          <>
            Protect information. <em>Preserve accountability.</em>
          </>
        }
        lead="Controls are part of the data layer, so they hold no matter which screen, API or integration asks. These are the layers every request passes through."
      />
      {/* 10 — Security and governance */}
      <section id="trust" className="nj-s nj-s--paper" aria-labelledby="trust-title">
        <div className="nj-wrap">
          <h2 id="trust-title" className="nj-sr">
            The layers every request passes through
          </h2>
          <p className="nj-layers-in">Every request · screen, API or integration</p>
          <div className="nj-layers">
            <div className="nj-layer">
              <b>Organisation isolation</b>
              <p>Every table enforces row-level security by organisation and workspace.</p>
              <code>RLS · every table</code>
            </div>
            <div className="nj-layer">
              <b>Role-based access</b>
              <p>Permissions are checked by the database on every call, for every member.</p>
              <code>has_permission()</code>
            </div>
            <div className="nj-layer">
              <b>Information barriers</b>
              <p>Matters and teams can be walled off from each other inside one organisation.</p>
              <code>barriers · conflicts</code>
            </div>
            <div className="nj-layer">
              <b>Evidence custody</b>
              <p>Fingerprints, immutable versions and a custody record for every action.</p>
              <code>sha-256 · append-only</code>
            </div>
            <div className="nj-layer">
              <b>Human approvals</b>
              <p>Consequential changes require an authorised decision, recorded with its reason.</p>
              <code>four eyes by default</code>
            </div>
            <div className="nj-layer">
              <b>Audit</b>
              <p>Hash-chained audit records with checkpoints and verifiable exports.</p>
              <code>chain · checkpoints</code>
            </div>
            <div className="nj-layer">
              <b>Retention and holds</b>
              <p>Retention policies, with legal holds that override deletion.</p>
              <code>holds &gt; retention</code>
            </div>
          </div>
          <p className="nj-layers-core">Your organisation’s legal data</p>
          <p className="nj-honest">
            Njumeni has not yet completed an independent penetration test or a security
            certification; both are planned before launch. We will publish them when they exist.
          </p>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="identity-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <h2 id="identity-title">
                Identity, access <em>and infrastructure.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Who can sign in, how their access is decided, and where the data lives — with the
              status of each.
            </p>
          </div>
          <ul className="nj-capgrid">
            <li>
              <b>Sign-in and sessions</b>
              <span>
                Accounts and sessions through Supabase Auth; access re-checked on every request.
              </span>
              <Tag status="built" />
            </li>
            <li>
              <b>Single sign-on</b>
              <span>SAML and OIDC configuration per organisation, with verified domains.</span>
              <Tag status="awaiting" />
            </li>
            <li>
              <b>Scoped API keys</b>
              <span>
                Enterprise keys act as scoped, delegated credentials — never as a superuser.
              </span>
              <Tag status="built" />
            </li>
            <li>
              <b>Row-level security</b>
              <span>
                Every table enforces isolation by organisation and workspace in the database.
              </span>
              <Tag status="built" />
            </li>
            <li>
              <b>Hosted service</b>
              <span>A managed Postgres database and web hosting during early access.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Private deployment</b>
              <span>For enterprises and institutions, by contract.</span>
              <Tag status="planned" />
            </li>
          </ul>
          <AccessCheck />
        </div>
      </section>
      {/* 09 — AI and human responsibility */}
      <section id="ai" className="nj-s nj-s--navy" aria-labelledby="ai-title">
        <div className="nj-wrap">
          <Kicker>AI and human responsibility</Kicker>
          <h2 id="ai-title" className="nj-roles-title">
            <span>AI assists.</span> <span>The law provides the authority.</span>{' '}
            <span>Professionals retain responsibility.</span>
          </h2>
          <div className="nj-roles" aria-hidden="false">
            <p>
              It finds, ranks and compares. Drafting and legal reasoning arrive only when a provider
              is connected — and are labelled when they do.
            </p>
            <p>
              Answers quote the official text in force on your date. Nothing is generated and
              presented as law.
            </p>
            <p>Reviews, sign-off and approvals come before any work is relied on.</p>
          </div>
          <GovernanceFlow />
          <div className="nj-ai-grid">
            <div>
              <h3 className="nj-ai-title">Where intelligence is used today</h3>
              <table className="nj-ai-table">
                <caption className="nj-sr">Where intelligence is used today</caption>
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">How it works</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Research answers</td>
                    <td>Extractive: quoted from verified sources, never generated</td>
                    <td>
                      <Tag status="built" />
                    </td>
                  </tr>
                  <tr>
                    <td>Meaning search</td>
                    <td>A multilingual language model ranks passages by meaning</td>
                    <td>
                      <Tag status="built" />
                    </td>
                  </tr>
                  <tr>
                    <td>Change analysis</td>
                    <td>Version comparison and impact tracing</td>
                    <td>
                      <Tag status="built" />
                    </td>
                  </tr>
                  <tr>
                    <td>Operator command centre</td>
                    <td>Claude for the platform team, with human approval</td>
                    <td>
                      <Tag status="awaiting" />
                    </td>
                  </tr>
                  <tr>
                    <td>Drafting and legal reasoning</td>
                    <td>For customers, once a provider is connected</td>
                    <td>
                      <Tag status="planned" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="nj-human">
              <li>
                <b>People approve consequential actions.</b>
                <span>
                  Source activation, remediation and deployments need an authorised decision — two
                  people by default.
                </span>
              </li>
              <li>
                <b>Limits are stated, not hidden.</b>
                <span>Every answer shows its jurisdiction, date, sources and limitations.</span>
              </li>
              <li>
                <b>Not legal advice.</b>
                <span>
                  Njumeni provides legal information and research tools; it does not replace a
                  qualified lawyer.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
      <Related keys={['solutions', 'workspace', 'about']} />
      <CtaBand
        title="Review Njumeni’s controls with us."
        text="We walk security and governance teams through the data model, the controls and their limits."
      />
    </>
  );
}
