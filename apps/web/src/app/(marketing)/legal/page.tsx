import type { Metadata } from 'next';
import { FACTS, SITE_DETAILS, show } from '../site-details';
import { DraftNotice, PageIntro } from '../site';

const draft = !SITE_DETAILS.legalApprovedOn;

export const metadata: Metadata = {
  title: { absolute: 'Legal notice — Njumeni' },
  description: 'Who operates Njumeni, how to reach them, hosting, and source attribution.',
  alternates: { canonical: '/legal' },
  robots: draft ? { index: false, follow: true } : { index: true, follow: true },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Legal notice"
        title={
          <>
            Who operates <em>Njumeni.</em>
          </>
        }
        lead="The operator, how to reach them, where the service is hosted, and the attribution the legal sources require."
        tone="ivory"
      >
        {draft ? <DraftNotice /> : null}
      </PageIntro>
      <section className="nj-s nj-s--paper" aria-label="Legal notice">
        <div className="nj-wrap nj-split">
          <dl className="nj-deflist">
            <div>
              <dt>Operator</dt>
              <dd>{show(SITE_DETAILS.legalName)}</dd>
            </div>
            <div>
              <dt>Organisation number</dt>
              <dd>{show(SITE_DETAILS.organisationNumber)}</dd>
            </div>
            <div>
              <dt>Registered address</dt>
              <dd>{show(SITE_DETAILS.registeredAddress)}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{show(SITE_DETAILS.contactEmail)}</dd>
            </div>
          </dl>
          <dl className="nj-deflist">
            <div>
              <dt>Hosting</dt>
              <dd>
                Database, authentication and storage: Supabase, {FACTS.databaseRegion}. Web
                application: Vercel.
              </dd>
            </div>
            <div>
              <dt>Source attribution</dt>
              <dd>
                Contains data under the Norwegian licence for Open Government data (NLOD) 2.0 made
                available by Lovdata.{' '}
                <span lang="nb">
                  Inneholder data under norsk lisens for offentlige data (NLOD) 2.0
                  tilgjengeliggjort av Lovdata.
                </span>
              </dd>
            </div>
            <div>
              <dt>Not legal advice</dt>
              <dd>
                Njumeni provides legal information and research tools. It is not a law firm and does
                not replace advice from a qualified lawyer.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}
