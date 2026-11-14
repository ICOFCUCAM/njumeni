import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, Related } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Documentation — Njumeni' },
  description:
    'Entry point for Njumeni product guides, technical notes and API resources, with the status of each.',
  alternates: { canonical: '/documentation' },
};

const GROUPS = [
  {
    title: 'Product guides',
    note: 'How each part of Njumeni works, written for the people who use it.',
    items: [
      {
        t: 'Legal research',
        d: 'Questions, jurisdictions, dates, citations and refusals.',
        href: '/platform/research',
        status: 'Available',
      },
      {
        t: 'Professional workspace',
        d: 'Matters, evidence, arguments, documents and review.',
        href: '/platform/workspace',
        status: 'Available',
      },
      {
        t: 'Change intelligence',
        d: 'Monitoring, comparison, impact, remediation and currency.',
        href: '/platform/change-intelligence',
        status: 'Available',
      },
      {
        t: 'Jurisdictions',
        d: 'The framework, its sources and their status.',
        href: '/platform/jurisdictions',
        status: 'Available',
      },
    ],
  },
  {
    title: 'Security and governance',
    note: 'For security, compliance and procurement teams.',
    items: [
      {
        t: 'Security overview',
        d: 'Isolation, permissions, barriers, custody and audit.',
        href: '/security',
        status: 'Available',
      },
      {
        t: 'Plans and allowances',
        d: 'What each plan includes.',
        href: '/plans',
        status: 'Available',
      },
      {
        t: 'Data processing and privacy',
        d: 'Processing terms and the privacy notice.',
        status: 'In preparation',
      },
    ],
  },
  {
    title: 'Technical and API',
    note: 'For engineers integrating Njumeni with other systems.',
    items: [
      {
        t: 'API reference',
        d: 'Endpoints, scoped keys and allowances.',
        status: 'For early-access organisations, on request',
      },
      {
        t: 'Single sign-on setup',
        d: 'SAML and OIDC configuration per organisation.',
        status: 'In preparation',
      },
      {
        t: 'Evidence export format',
        d: 'Bundle manifests and verifying their digests.',
        status: 'In preparation',
      },
    ],
  },
] as const;

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Documentation"
        title={
          <>
            Guides, technical notes <em>and API resources.</em>
          </>
        }
        lead="Start here to understand how Njumeni works and how to integrate with it. Each entry states whether it is available now or still in preparation."
        tone="ivory"
      />
      <section className="nj-s nj-s--paper" aria-label="Documentation library">
        <div className="nj-wrap nj-docs">
          {GROUPS.map((g) => (
            <section key={g.title} className="nj-docs-group" aria-labelledby={`docs-${g.title}`}>
              <div>
                <h2 id={`docs-${g.title}`} className="nj-docs-title">
                  {g.title}
                </h2>
                <p>{g.note}</p>
              </div>
              <ul>
                {g.items.map((it) => (
                  <li key={it.t}>
                    {'href' in it ? (
                      <Link href={it.href}>
                        <b>{it.t}</b>
                        <span>{it.d}</span>
                      </Link>
                    ) : (
                      <div>
                        <b>{it.t}</b>
                        <span>{it.d}</span>
                      </div>
                    )}
                    <small className={it.status === 'Available' ? 'is-ok' : undefined}>
                      {it.status}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="nj-docs-contact">
            Need something not listed here?{' '}
            <Link href="/early-access?interest=demonstration">Ask the Njumeni team</Link>.
          </p>
        </div>
      </section>
      <Related keys={['research', 'security', 'plans']} />
    </>
  );
}
