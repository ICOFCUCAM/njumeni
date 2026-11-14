import type { Metadata } from 'next';
import { CtaBand, Kicker, PageIntro, Related } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'About Njumeni' },
  description:
    'Njumeni’s mission, founding principles and responsibility: legal intelligence grounded in authority, accurate in time, and accountable to people.',
  alternates: { canonical: '/about' },
};

const PRINCIPLES = [
  {
    t: 'Authority before fluency',
    d: 'An answer is only as good as the text it rests on. Njumeni quotes the official law and names it — or says it cannot answer.',
  },
  {
    t: 'The law on the date that matters',
    d: 'The same question has different answers on different dates. Every finding carries the version in force when it applied.',
  },
  {
    t: 'Change is part of the law',
    d: 'Legal knowledge decays as the law moves. Njumeni is built to notice change, trace its consequences and keep work current.',
  },
  {
    t: 'People keep responsibility',
    d: 'Technology assists. Qualified people review, approve and decide — and their decisions are recorded.',
  },
  {
    t: 'Honest about limits',
    d: 'What is built, what awaits activation and what is planned are labelled as such. Coverage is claimed only when it has been evaluated.',
  },
  {
    t: 'Each legal system on its own terms',
    d: 'Jurisdictions are not interchangeable. Each is described, searched and verified within its own sources, languages and hierarchy.',
  },
];

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="About Njumeni"
        title={
          <>
            Legal intelligence <em>that answers to the law.</em>
          </>
        }
        lead="Njumeni is a global legal intelligence platform. It connects authoritative legal research, professional legal work and continuous awareness of changing legislation — for individuals, legal professionals, organisations and public institutions."
      />
      <section className="nj-s nj-s--paper" aria-labelledby="mission-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Mission</Kicker>
            <h2 id="mission-title">
              Make the law knowable, <em>wherever and whenever it applies.</em>
            </h2>
          </div>
          <div className="nj-prose">
            <p>
              Legal information is scattered across official gazettes, databases and archives,
              written for specialists and rarely clear about which version applied when. Legal work
              built on it carries that uncertainty into matters, contracts and decisions.
            </p>
            <p>
              Njumeni exists to close that gap: to answer from the authoritative text, on the right
              date, with the evidence shown — and to keep that knowledge current as the law changes,
              jurisdiction by jurisdiction.
            </p>
          </div>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="principles-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Founding principles</Kicker>
              <h2 id="principles-title">
                Six commitments, <em>built into the platform.</em>
              </h2>
            </div>
            <p className="nj-lead">
              They are not aspirations on a page; each one is enforced somewhere in how Njumeni
              stores, retrieves, verifies and governs legal knowledge.
            </p>
          </div>
          <ol className="nj-principle-grid">
            {PRINCIPLES.map((p) => (
              <li key={p.t}>
                <b>{p.t}</b>
                <span>{p.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="nj-s nj-s--paper" aria-labelledby="vision-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Vision and responsibility</Kicker>
            <h2 id="vision-title">
              Global in ambition, <em>careful in practice.</em>
            </h2>
          </div>
          <div className="nj-prose">
            <p>
              Njumeni’s framework spans seventeen legal systems, from Nordic civil law to common
              law, EU law, OHADA and international law. It begins with Norway, and each further
              jurisdiction is added only when its sources, rights and retrieval quality have been
              reviewed.
            </p>
            <p>
              Njumeni provides legal information and research tools. It is not a law firm and does
              not replace advice from a qualified lawyer. It has not yet completed an independent
              penetration test or a security certification; both are planned before launch.
            </p>
          </div>
        </div>
      </section>
      <Related keys={['research', 'change', 'security']} />
      <CtaBand />
    </>
  );
}
