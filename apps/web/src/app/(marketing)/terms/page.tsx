import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_DETAILS, show } from '../site-details';
import { DraftNotice, LegalDoc, PageIntro } from '../site';

const draft = !SITE_DETAILS.legalApprovedOn;

export const metadata: Metadata = {
  title: { absolute: 'Terms of service — Njumeni' },
  description: 'The terms on which Njumeni is provided during early access.',
  alternates: { canonical: '/terms' },
  robots: draft ? { index: false, follow: true } : { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Terms of service"
        title={
          <>
            The terms <em>of using Njumeni.</em>
          </>
        }
        lead="The agreement between you and the operator of Njumeni while the platform is in early access. Organisations on contracted plans are also bound by their own agreement."
        tone="ivory"
      >
        {draft ? (
          <DraftNotice />
        ) : (
          <p className="nj-muted">Approved {SITE_DETAILS.legalApprovedOn}</p>
        )}
      </PageIntro>
      <LegalDoc
        sections={[
          {
            id: 'parties',
            title: 'Who you are contracting with',
            body: (
              <p>
                Njumeni is operated by {show(SITE_DETAILS.legalName)} (organisation number{' '}
                {show(SITE_DETAILS.organisationNumber)}), {show(SITE_DETAILS.registeredAddress)}.
              </p>
            ),
          },
          {
            id: 'service',
            title: 'The service, during early access',
            body: (
              <p>
                Njumeni is in early access. Features are labelled as built, awaiting activation, in
                development or planned, and only what is built is provided. Features may change, and
                a jurisdiction is covered only once its sources are activated and evaluated.
              </p>
            ),
          },
          {
            id: 'advice',
            title: 'Not legal advice',
            body: (
              <p>
                Njumeni provides legal information and research tools. It is not a law firm, does
                not create a lawyer–client relationship and does not replace advice from a qualified
                lawyer. You remain responsible for how you use what it shows you.
              </p>
            ),
          },
          {
            id: 'accounts',
            title: 'Accounts and security',
            body: (
              <p>
                Keep your sign-in details secret and tell us promptly about any unauthorised use. An
                organisation is responsible for the members it invites and the roles it gives them.
              </p>
            ),
          },
          {
            id: 'use',
            title: 'Acceptable use',
            body: (
              <p>
                Do not try to reach other customers’ data, bypass access controls or allowances,
                disrupt the service, upload malicious files, or use the service unlawfully.
                Automated access is permitted only through the API, within its allowances.
              </p>
            ),
          },
          {
            id: 'content',
            title: 'Your content',
            body: (
              <p>
                You keep all rights in the content you or your organisation put into Njumeni. You
                allow the operator to process it only to provide the service to you. It is not used
                to train AI models.
              </p>
            ),
          },
          {
            id: 'sources',
            title: 'Legal sources and their licences',
            body: (
              <p>
                Legal texts come from official and licensed sources and remain subject to their
                licences and attribution requirements, which Njumeni shows with each quotation. Do
                not redistribute licensed material beyond what its licence allows.
              </p>
            ),
          },
          {
            id: 'plans',
            title: 'Plans, allowances and fees',
            body: (
              <p>
                Each plan’s allowances are listed on the <Link href="/plans">plans page</Link>. Free
                plans stop at their allowance. Prices are stated when access is offered, and you
                agree to them before any charge.
              </p>
            ),
          },
          {
            id: 'availability',
            title: 'Availability and changes',
            body: (
              <p>
                During early access the service is provided without a service-level commitment
                unless one is agreed in writing. Material changes to these terms are announced in
                advance.
              </p>
            ),
          },
          {
            id: 'liability',
            title: 'Liability',
            body: (
              <p>
                Limitations of liability are being finalised with legal counsel and will be set out
                here before these terms come into force.
              </p>
            ),
          },
          {
            id: 'ending',
            title: 'Ending the agreement',
            body: (
              <p>
                You can close your account at any time. Before an organisation’s account is closed,
                it can export its content; data is then deleted according to its retention settings,
                except where a legal hold or the law requires it to be kept.
              </p>
            ),
          },
          {
            id: 'law',
            title: 'Governing law',
            body: <p>{show(SITE_DETAILS.governingLaw)}.</p>,
          },
        ]}
      />
    </>
  );
}
