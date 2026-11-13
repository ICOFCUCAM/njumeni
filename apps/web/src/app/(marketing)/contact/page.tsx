import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_DETAILS, show } from '../site-details';
import { PageIntro, Related } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Contact — Njumeni' },
  description:
    'How to reach Njumeni: early access, demonstrations, privacy requests and security reports.',
  alternates: { canonical: '/contact' },
};

function Mail({ value }: { value: string | null }) {
  return value ? <a href={`mailto:${value}`}>{value}</a> : <>{show(null)}</>;
}

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Contact"
        title={
          <>
            Speak with <em>the Njumeni team.</em>
          </>
        }
        lead="Choose the route that fits your question, so it reaches the right people."
        tone="ivory"
      />
      <section className="nj-s nj-s--paper" aria-label="Ways to reach us">
        <div className="nj-wrap">
          <ul className="nj-contact">
            <li>
              <small>Organisations and professionals</small>
              <b>Early access</b>
              <span>Join the early-access programme, starting with Norway.</span>
              <Link href="/early-access" className="nj-btn nj-btn--navy nj-btn--sm">
                Request early access
              </Link>
            </li>
            <li>
              <small>Law firms, enterprises and institutions</small>
              <b>A demonstration</b>
              <span>A walk-through for your legal, risk and procurement teams.</span>
              <Link
                href="/early-access?interest=demonstration"
                className="nj-btn nj-btn--navy nj-btn--sm"
              >
                Request a demonstration
              </Link>
            </li>
            <li>
              <small>Your personal data</small>
              <b>Privacy requests</b>
              <span>Access, correction, deletion or questions about your data.</span>
              <p>
                <Mail value={SITE_DETAILS.privacyEmail} />
              </p>
            </li>
            <li>
              <small>Responsible disclosure</small>
              <b>Security reports</b>
              <span>Report a vulnerability. Please do not test against other customers’ data.</span>
              <p>
                <Mail value={SITE_DETAILS.securityEmail} />
              </p>
            </li>
            <li>
              <small>Everything else</small>
              <b>General enquiries</b>
              <span>Press, partnerships and other questions.</span>
              <p>
                <Mail value={SITE_DETAILS.contactEmail} />
              </p>
            </li>
            <li>
              <small>Registered office</small>
              <b>{show(SITE_DETAILS.legalName)}</b>
              <span>{show(SITE_DETAILS.registeredAddress)}</span>
            </li>
          </ul>
        </div>
      </section>
      <Related keys={['programme', 'trust', 'about']} />
    </>
  );
}
