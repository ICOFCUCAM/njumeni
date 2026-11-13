import type { Metadata } from 'next';
import { FACTS, SITE_DETAILS, show } from '../site-details';
import { DraftNotice, LegalDoc, PageIntro } from '../site';

const draft = !SITE_DETAILS.legalApprovedOn;

export const metadata: Metadata = {
  title: { absolute: 'Privacy notice — Njumeni' },
  description: 'How Njumeni collects, uses, keeps and protects personal data, and your rights.',
  alternates: { canonical: '/privacy' },
  robots: draft ? { index: false, follow: true } : { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Privacy notice"
        title={
          <>
            Your data, <em>and your rights.</em>
          </>
        }
        lead="What Njumeni collects, why, how long it is kept, who processes it and how to exercise your rights under the GDPR."
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
            id: 'controller',
            title: 'Who is responsible',
            body: (
              <dl className="nj-doc-dl">
                <dt>Operator</dt>
                <dd>{show(SITE_DETAILS.legalName)}</dd>
                <dt>Organisation number</dt>
                <dd>{show(SITE_DETAILS.organisationNumber)}</dd>
                <dt>Address</dt>
                <dd>{show(SITE_DETAILS.registeredAddress)}</dd>
                <dt>Privacy contact</dt>
                <dd>{show(SITE_DETAILS.privacyEmail)}</dd>
              </dl>
            ),
          },
          {
            id: 'scope',
            title: 'What this notice covers',
            body: (
              <p>
                This website, early-access and demonstration requests, questions left on “Ask
                Njumeni”, and accounts in the Njumeni application. For the legal work an
                organisation keeps in its workspaces — matters, documents and evidence — the
                organisation decides how its data is used; Njumeni processes it on the
                organisation’s behalf under a data processing agreement.
              </p>
            ),
          },
          {
            id: 'collect',
            title: 'What we collect',
            body: (
              <ul>
                <li>
                  <b>Early-access and demonstration requests:</b> your name, email, organisation,
                  the kind of user you are, your interest, the jurisdictions you choose, any
                  message, and when you gave consent. No IP address or browser details are stored
                  with a request.
                </li>
                <li>
                  <b>Questions left on “Ask Njumeni”:</b> the question, the jurisdiction, date and
                  answer language you chose, your email if you gave one, and when you gave consent.
                  No IP address or browser details are stored with a question, and no answer is
                  generated from it.
                </li>
                <li>
                  <b>Accounts:</b> email, name, profile details, organisation memberships and roles.
                </li>
                <li>
                  <b>Activity records:</b> who did what and when, written to tamper-evident audit
                  records for security and accountability.
                </li>
                <li>
                  <b>Billing:</b> plan, usage against allowances and invoices.
                </li>
              </ul>
            ),
          },
          {
            id: 'purposes',
            title: 'Why, and on what legal basis',
            body: (
              <ul>
                <li>
                  <b>Answering your request</b> — your consent (GDPR art. 6(1)(a)), which you can
                  withdraw at any time.
                </li>
                <li>
                  <b>
                    Learning what people need from legal research, and preparing and testing
                    research before it opens
                  </b>{' '}
                  — your consent when you leave a question (art. 6(1)(a)).
                </li>
                <li>
                  <b>Providing the service and your account</b> — performance of a contract (art.
                  6(1)(b)).
                </li>
                <li>
                  <b>Security, audit and preventing misuse</b> — our legitimate interest in a
                  secure, accountable service (art. 6(1)(f)).
                </li>
                <li>
                  <b>Accounting and invoices</b> — legal obligations (art. 6(1)(c)).
                </li>
              </ul>
            ),
          },
          {
            id: 'retention',
            title: 'How long we keep it',
            body: (
              <ul>
                <li>
                  Early-access and demonstration requests: deleted {FACTS.earlyAccessRetention}{' '}
                  after they are made, or earlier on request.
                </li>
                <li>
                  Questions left on “Ask Njumeni”: deleted automatically {FACTS.questionRetention}{' '}
                  after they are left, or earlier on request.
                </li>
                <li>Accounts: for as long as the account exists.</li>
                <li>
                  Workspace content: according to the organisation’s retention policy; a legal hold
                  stops deletion until it is released.
                </li>
                <li>Accounting records: as long as bookkeeping law requires.</li>
              </ul>
            ),
          },
          {
            id: 'recipients',
            title: 'Who processes it, and where',
            body: (
              <>
                <ul>
                  <li>
                    Supabase — database, authentication and storage, in the {FACTS.databaseRegion}.
                  </li>
                  <li>
                    Vercel — web application hosting. Its server region is to be fixed in the EU
                    before launch.
                  </li>
                  <li>No AI provider receives personal data; none is connected.</li>
                </ul>
                <p>
                  If any processing takes place outside the EU/EEA, it will rely on appropriate
                  safeguards, such as the EU Standard Contractual Clauses, and be listed here.
                  Njumeni does not sell personal data.
                </p>
              </>
            ),
          },
          {
            id: 'cookies',
            title: 'Cookies',
            body: (
              <p>
                The public website sets no analytics or advertising cookies. The application uses
                essential, HTTP-only session cookies to keep you signed in; they are not used for
                tracking.
              </p>
            ),
          },
          {
            id: 'rights',
            title: 'Your rights',
            body: (
              <p>
                You can ask for access to your data, correction, deletion, restriction, a portable
                copy, or object to processing, and withdraw consent at any time. Contact{' '}
                {show(SITE_DETAILS.privacyEmail)}. You may also complain to a data protection
                authority — in Norway, Datatilsynet.
              </p>
            ),
          },
          {
            id: 'changes',
            title: 'Changes to this notice',
            body: (
              <p>Material changes are announced on this page with the date they take effect.</p>
            ),
          },
        ]}
      />
    </>
  );
}
