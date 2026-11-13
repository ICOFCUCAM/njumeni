import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBand, Kicker, PageIntro, Related } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Early-access programme — Njumeni' },
  description:
    'Who Njumeni’s early-access programme is for, what participants receive, what is asked of them, and how it unfolds — starting with Norway.',
  alternates: { canonical: '/early-access-programme' },
};

const PHASES = [
  {
    t: 'Norway activation',
    d: 'Norwegian official sources are activated after their rights review, and retrieval quality is evaluated before any coverage is claimed.',
  },
  {
    t: 'Founding participants',
    d: 'A small group of organisations works on live Norwegian research, the workspace and change intelligence, with a direct line to the team.',
  },
  {
    t: 'Wider early access',
    d: 'More organisations and professionals join as capacity and evaluation allow; further jurisdictions follow one by one.',
  },
];

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Early-access programme"
        title={
          <>
            Shape Njumeni <em>from the first jurisdiction.</em>
          </>
        }
        lead="Njumeni is opening jurisdiction by jurisdiction, starting with Norway. The early-access programme brings in organisations and professionals who want authoritative, current legal intelligence — and want a say in how it develops."
      >
        <div className="nj-ctas">
          <Link href="/early-access" className="nj-btn nj-btn--gold">
            Apply for early access
          </Link>
        </div>
      </PageIntro>
      <section className="nj-s nj-s--paper" aria-labelledby="who-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Who it is for</Kicker>
            <h2 id="who-title">
              Organisations first, <em>professionals alongside.</em>
            </h2>
          </div>
          <dl className="nj-deflist">
            <div>
              <dt>Law firms</dt>
              <dd>
                Practices working in Norwegian law that want research, matters and change
                intelligence in one place.
              </dd>
            </div>
            <div>
              <dt>Legal departments</dt>
              <dd>
                In-house legal, compliance and governance teams responsible for keeping obligations
                current.
              </dd>
            </div>
            <div>
              <dt>Public institutions</dt>
              <dd>Bodies that need legal knowledge kept current with formal accountability.</dd>
            </div>
            <div>
              <dt>Legal professionals</dt>
              <dd>Lawyers and advisers working on their own.</dd>
            </div>
            <div>
              <dt>Individuals</dt>
              <dd>Join the waiting list; personal plans open after the founding phase.</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="give-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>The exchange</Kicker>
              <h2 id="give-title">
                What participants receive, <em>and what we ask.</em>
              </h2>
            </div>
          </div>
          <div className="nj-exchange">
            <div>
              <h3>Participants receive</h3>
              <ul>
                <li>Access to research on Norwegian sources as they are activated</li>
                <li>The professional workspace, evidence and review tools</li>
                <li>Change intelligence for the sources being monitored</li>
                <li>A direct line to the team, and influence on what is built next</li>
                <li>Early-access terms, with prices stated before any charge</li>
              </ul>
            </div>
            <div>
              <h3>We ask</h3>
              <ul>
                <li>A named contact and regular, candid feedback</li>
                <li>Use on real (or realistic) legal work, within the early-access terms</li>
                <li>Reporting anything that looks wrong — especially a citation or a date</li>
                <li>Patience with features labelled as not yet built</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section className="nj-s nj-s--paper" aria-labelledby="phase-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>How it unfolds</Kicker>
              <h2 id="phase-title">
                Three phases, <em>paced by evidence.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Each phase begins when the previous one has shown the quality it needs — not on a
              fixed date.
            </p>
          </div>
          <ol className="nj-pillars nj-pillars--3">
            {PHASES.map((p, i) => (
              <li key={p.t}>
                <small>Phase {i + 1}</small>
                <b>{p.t}</b>
                <span>{p.d}</span>
              </li>
            ))}
          </ol>
          <p className="nj-trace-note">
            <b>How participants are chosen.</b> We review each request for fit with the current
            phase — jurisdiction, kind of work and team — and reply to every one. Requests are kept
            for 12 months and then deleted.
          </p>
        </div>
      </section>
      <Related keys={['plans', 'solutions', 'contact']} />
      <CtaBand title="Apply for the early-access programme." />
    </>
  );
}
