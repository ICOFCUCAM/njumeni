import type { Metadata } from 'next';
import Link from 'next/link';
import { PlanChooser, Plans } from '../plans';
import { PageIntro, Related } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Plans and access — Njumeni' },
  description:
    'Plan allowances for individuals, legal professionals and organisations — research runs, documents, AI credits, API requests, seats and storage. Prices are announced at early access.',
  alternates: { canonical: '/plans' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Plans and access"
        title={
          <>
            Clear allowances. <em>Room to grow.</em>
          </>
        }
        lead="Every plan states what it includes. Free plans stop at their allowance; paid plans continue with metered usage, and there is no unlimited high-cost AI on low-priced plans. Prices are announced at early access."
        tone="ivory"
      />
      {/* 12 — Plans */}
      <section id="plans" className="nj-s nj-s--paper" aria-labelledby="plans-title">
        <div className="nj-wrap">
          <h2 id="plans-title" className="nj-sr">
            Plans by audience
          </h2>
          <PlanChooser />
          <details className="nj-pl-compare" open>
            <summary>Compare every allowance</summary>
            <Plans />
          </details>
          <div className="nj-plan-notes">
            <p>
              <b>AI credits</b>Allowance for AI-assisted features as they become available. One
              credit equals one US cent of provider cost.
            </p>
            <p>
              <b>Growing teams</b>Additional seats, AI credits, API access and storage can be added;
              monthly and annual terms.
            </p>
            <p>
              <b>Enterprise and institutions</b>Contracted allowances, private deployments,
              integrations and licensed institutional use.
            </p>
          </div>
          <div className="nj-ctas" style={{ marginTop: 36 }}>
            <Link href="/early-access" className="nj-btn nj-btn--navy">
              Request early access
            </Link>
            <Link href="/early-access?interest=demonstration" className="nj-btn nj-btn--outline">
              Talk to us about Enterprise or Institutional
            </Link>
          </div>
        </div>
      </section>
      <Related keys={['solutions', 'security', 'about']} />
    </>
  );
}
