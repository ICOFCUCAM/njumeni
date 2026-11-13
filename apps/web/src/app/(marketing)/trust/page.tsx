import type { Metadata } from 'next';
import Link from 'next/link';
import { FACTS, SITE_DETAILS, show } from '../site-details';
import { CtaBand, Kicker, PageIntro, Related, Tag, type Status } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Trust centre — Njumeni' },
  description:
    'Where Njumeni’s data lives, which services process it, the status of each control, certifications and how to report a security issue — stated as it is.',
  alternates: { canonical: '/trust' },
};

const CONTROLS: { area: string; control: string; status: Status }[] = [
  {
    area: 'Isolation',
    control: 'Row-level security on every table, by organisation and workspace',
    status: 'built',
  },
  {
    area: 'Access',
    control: 'Role-based permissions checked by the database on every request',
    status: 'built',
  },
  { area: 'Access', control: 'Information barriers between matters and teams', status: 'built' },
  {
    area: 'Identity',
    control: 'Sign-in and sessions; session cookies are HTTP-only',
    status: 'built',
  },
  { area: 'Identity', control: 'Single sign-on (SAML, OIDC) per organisation', status: 'awaiting' },
  {
    area: 'Audit',
    control: 'Hash-chained audit records with checkpoints and exports',
    status: 'built',
  },
  {
    area: 'Evidence',
    control: 'Fingerprints, quarantine, custody records, versions and legal holds',
    status: 'built',
  },
  {
    area: 'Evidence',
    control: 'Full anti-malware engine for uploaded files',
    status: 'developing',
  },
  {
    area: 'Governance',
    control: 'Two-person approval for source activation, remediation and deployment',
    status: 'built',
  },
  {
    area: 'Retention',
    control: 'Retention policies, with legal holds overriding deletion',
    status: 'built',
  },
  { area: 'Assurance', control: 'Independent penetration test', status: 'planned' },
  { area: 'Assurance', control: 'Security certification', status: 'planned' },
];

const PROCESSORS = [
  {
    name: 'Supabase',
    role: 'Database, authentication and file storage',
    location: FACTS.databaseRegion,
  },
  {
    name: 'Vercel',
    role: 'Web application hosting',
    location: 'Server region to be fixed in the EU before launch',
  },
  {
    name: 'AI provider',
    role: 'None connected. A provider is connected only under terms that forbid training on customer data',
    location: '—',
  },
];

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Trust centre"
        title={
          <>
            What we have done, <em>and what we have not yet.</em>
          </>
        }
        lead="Security and procurement teams should not have to infer anything. This page states where data lives, who processes it, the status of each control and the assurance still to come."
      />
      <section className="nj-s nj-s--paper" aria-labelledby="status-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Control status</Kicker>
              <h2 id="status-title">
                Every control, <em>with its status.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Built means it is part of the application today. Anything else is labelled for what it
              is.
            </p>
          </div>
          <div className="nj-dir-scroll" role="region" aria-label="Control status" tabIndex={0}>
            <table className="nj-dir">
              <caption className="nj-sr">Control status</caption>
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Control</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {CONTROLS.map((c) => (
                  <tr key={c.control}>
                    <th scope="row">{c.area}</th>
                    <td>{c.control}</td>
                    <td>
                      <Tag status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="data-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Data location and processors</Kicker>
            <h2 id="data-title">
              Where the data lives, <em>and who handles it.</em>
            </h2>
            <p className="nj-lead">
              Legal sources such as Lovdata supply legal text; they are not processors of customer
              data.
            </p>
          </div>
          <dl className="nj-deflist">
            {PROCESSORS.map((p) => (
              <div key={p.name}>
                <dt>{p.name}</dt>
                <dd>
                  {p.role}.<br />
                  <span className="nj-muted">Location: {p.location}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="nj-s nj-s--paper" aria-labelledby="assure-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Assurance and disclosure</Kicker>
            <h2 id="assure-title">
              Independent checks, <em>and how to reach us.</em>
            </h2>
          </div>
          <dl className="nj-deflist">
            <div>
              <dt>Certifications</dt>
              <dd>
                None yet. Njumeni has not completed an independent penetration test or a security
                certification; both are planned before launch and will be published here.
              </dd>
            </div>
            <div>
              <dt>Report a vulnerability</dt>
              <dd>
                {SITE_DETAILS.securityEmail ? (
                  <a href={`mailto:${SITE_DETAILS.securityEmail}`}>{SITE_DETAILS.securityEmail}</a>
                ) : (
                  show(null)
                )}
                . Please do not test against other customers’ data.
              </dd>
            </div>
            <div>
              <dt>Documents</dt>
              <dd>
                <Link href="/privacy">Privacy notice</Link> ·{' '}
                <Link href="/terms">Terms of service</Link> ·{' '}
                <Link href="/legal">Legal notice</Link>. A data processing agreement is available to
                organisations on request once the terms are approved.
              </dd>
            </div>
            <div>
              <dt>Tracking</dt>
              <dd>
                The public site uses no analytics or advertising cookies. The application uses
                essential session cookies only.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <Related keys={['security', 'responsibleAi', 'privacy']} />
      <CtaBand
        title="Review our controls with us."
        text="We walk security, procurement and data protection teams through the data model, the controls and their limits."
      />
    </>
  );
}
