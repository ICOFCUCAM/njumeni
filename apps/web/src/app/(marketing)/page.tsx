import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthorityChart } from './authority-chart';
import { ResearchView } from './research-view';
import { Kicker } from './site';

export const metadata: Metadata = {
  title: { absolute: 'Njumeni — Global legal intelligence' },
  description:
    'Global legal intelligence connecting authoritative legal research, professional legal work and continuous awareness of changing legislation.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Njumeni',
    title: 'Njumeni — Know the law. Understand its authority. Stay ahead of change.',
    description:
      'Global legal intelligence connecting authoritative legal research, professional legal work and continuous awareness of changing legislation.',
  },
};

export default function HomePage() {
  return (
    <>
      {/* 01 — Hero */}
      <section className="nj-hero" aria-labelledby="hero-title">
        <div className="nj-wrap">
          <ResearchView>
            <Kicker>Global legal intelligence</Kicker>
            <h1 id="hero-title">
              <span>Know the law.</span>
              <span>Understand its authority.</span>
              <span>Stay ahead of change.</span>
            </h1>
            <p className="nj-hero-lead">
              Global legal intelligence connecting authoritative legal research, professional legal
              work and continuous awareness of changing legislation.
            </p>
            <form action="/ask" method="get" className="nj-askbox" aria-label="Ask Njumeni">
              <label htmlFor="hero-q" className="nj-askbox-label">
                Ask Njumeni a legal question
              </label>
              <div className="nj-askbox-row">
                <input
                  id="hero-q"
                  name="q"
                  type="text"
                  maxLength={1000}
                  required
                  minLength={5}
                  placeholder="Can my employer dismiss me without a reason?"
                  autoComplete="off"
                />
                <button type="submit" className="nj-btn nj-btn--gold">
                  Ask Njumeni
                </button>
              </div>
              <p className="nj-askbox-note">
                Live research opens in Norway first. Until then we keep your question — we do not
                guess at an answer.
              </p>
            </form>
            <p className="nj-hero-links">
              <Link href="/platform/research#research">See an answer in the demonstration</Link>
              <Link href="/early-access">Request early access for your organisation</Link>
              <Link href="/sign-in">Sign in</Link>
            </p>
          </ResearchView>
          <ol className="nj-promises" aria-label="What Njumeni promises">
            <li>
              <small>Know the law</small>
              <b>Research grounded in authoritative sources</b>
              <span>Answers quote official, rights-reviewed text and name it — or decline.</span>
            </li>
            <li>
              <small>Understand its authority</small>
              <b>Answers tied to the law on a date</b>
              <span>Every finding carries the version in force on the date that matters.</span>
            </li>
            <li>
              <small>Stay ahead of change</small>
              <b>Continuous awareness of legislative change</b>
              <span>
                Once a source is activated, its changes are dated and traced to the work that relied
                on the old law.
              </span>
            </li>
          </ol>
        </div>
      </section>

      {/* 02 — Proposition */}
      <section className="nj-s nj-s--ivory" aria-labelledby="prop-title">
        <div className="nj-wrap">
          <div className="nj-prop">
            <div>
              <Kicker>Why legal intelligence</Kicker>
              <h2 id="prop-title" className="nj-prop-statement">
                Law is not just a question and an answer.{' '}
                <em>It is authority, time, evidence and responsibility.</em>
              </h2>
              <p className="nj-lead">
                The same question has different answers in different countries and on different
                dates. An answer is only as good as the authority it rests on, the facts it is
                applied to, and the person who takes responsibility for it. Njumeni is built around
                all four.
              </p>
            </div>
            <AuthorityChart />
          </div>
          <div className="nj-contrast">
            <div>
              <h3>A search engine</h3>
              <p>
                Finds documents that mention your words. It does not know which version applied, or
                whether the text is authoritative.
              </p>
            </div>
            <div>
              <h3>A chatbot</h3>
              <p>
                Writes a fluent answer. It may paraphrase, blend jurisdictions or cite authority
                that does not exist.
              </p>
            </div>
            <div>
              <h3>Njumeni</h3>
              <p>
                Answers from the official text in force on your date, quotes it, cites it — and says
                so when the law is silent.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 04 — The platform: four doorways */}
      <section className="nj-s nj-s--paper" aria-labelledby="platform-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>The platform</Kicker>
              <h2 id="platform-title">
                Four capabilities, <em>one standard of evidence.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Research grounded in the law, legal work that keeps its citations, change intelligence
              that keeps knowledge current, and a framework built for many legal systems.
            </p>
          </div>
          <ul className="nj-doors">
            <li>
              <Link href="/platform/research">
                <small>01 · Legal research</small>
                <b>Ask a question. Receive the authority.</b>
                <span>
                  The official text in force on your date, quoted exactly and cited — or a refusal
                  that says why.
                </span>
                <i>Run the research</i>
              </Link>
            </li>
            <li>
              <Link href="/platform/workspace">
                <small>02 · Professional workspace</small>
                <b>From research to legal work.</b>
                <span>
                  Matters, evidence, chronologies, arguments and documents — with every citation
                  still traceable to the law.
                </span>
                <i>Open the case file</i>
              </Link>
            </li>
            <li className="is-signature">
              <Link href="/platform/change-intelligence">
                <small>03 · Global Legal Change Intelligence</small>
                <b>The law changes. Legal knowledge keeps up.</b>
                <span>
                  One amendment, followed from the official source to the answers, documents and
                  deadlines that relied on it.
                </span>
                <i>Follow a change</i>
              </Link>
            </li>
            <li>
              <Link href="/platform/jurisdictions">
                <small>04 · Jurisdictions</small>
                <b>One framework. Many legal systems.</b>
                <span>
                  Seventeen legal systems, each with its own sources, languages, hierarchy and
                  status — stated as it is.
                </span>
                <i>Explore the atlas</i>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* 05 — Evidence */}
      <section className="nj-s nj-s--ivory" aria-labelledby="evidence-title">
        <div className="nj-wrap nj-evidence">
          <div>
            <Kicker>Evidence and document integrity</Kicker>
            <h2 id="evidence-title">
              Every record, <em>accounted for.</em>
            </h2>
            <p className="nj-lead">
              Evidence carries its fingerprint from the moment it arrives. Each action writes a
              record that seals the one before it — so the record can be checked by anyone,
              independently.
            </p>
            <p className="nj-more">
              <Link href="/platform/workspace#evidence">Verify a custody chain</Link>
            </p>
          </div>
          <ol className="nj-facts">
            <li>
              <b>Fingerprinted on arrival</b>
              <span>A SHA-256 fingerprint of the exact file, before anyone can open it.</span>
            </li>
            <li>
              <b>Sealed, record by record</b>
              <span>Each custody record includes the one before it, so any change shows.</span>
            </li>
            <li>
              <b>Never overwritten, never lost to a hold</b>
              <span>Versions sit beside each other; a legal hold stops deletion.</span>
            </li>
          </ol>
        </div>
      </section>

      {/* 06 — Global Legal Change Intelligence */}
      <section className="nj-s nj-glci" aria-labelledby="glci-title">
        <div className="nj-wrap">
          <Kicker>Global Legal Change Intelligence</Kicker>
          <h2 id="glci-title" className="nj-glci-statement">
            The law changes. <em>Legal knowledge must keep up.</em>
          </h2>
          <p className="nj-lead">
            Njumeni compares every new version of the law with the last, separates publication from
            commencement, and traces each change to the research, documents and matters that relied
            on the old text — then routes the response through accountable people.
          </p>
          <ol className="nj-glance" aria-label="The change lifecycle">
            <li>Official source</li>
            <li>Change detected</li>
            <li>Versions compared</li>
            <li>Commencement assessed</li>
            <li>Impact traced</li>
            <li>Remediation proposed</li>
            <li>Human approval</li>
            <li>Customers notified</li>
            <li>Verified current</li>
          </ol>
          <div className="nj-glance-foot">
            <p>
              <b>Today:</b> official sources await activation, so every jurisdiction reads “not
              monitored”.
            </p>
            <Link href="/platform/change-intelligence" className="nj-btn nj-btn--gold">
              Follow one change through the system
            </Link>
          </div>
        </div>
      </section>

      {/* Interlude — the position Njumeni holds */}
      <section className="nj-interlude" aria-label="What Njumeni is for">
        <div className="nj-wrap">
          <p className="nj-interlude-s">
            Not only answers to legal questions. <em>Legal knowledge that stays current.</em>
          </p>
          <div className="nj-interlude-cols">
            <p>
              <b>For a lawyer,</b> one place to research the law, manage legal work, preserve
              evidence — and know when the law changes.
            </p>
            <p>
              <b>For an institution,</b> one way to maintain legal intelligence across its
              organisation and the jurisdictions it works in.
            </p>
          </div>
        </div>
      </section>

      {/* 07 — Organisations */}
      <section className="nj-s nj-s--paper" aria-labelledby="org-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Secure, governed workspaces</Kicker>
              <h2 id="org-title">
                Built for organisations, <em>from the foundation up.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Five environments, one architecture. Isolation is enforced by the database itself, not
              by the interface.
            </p>
          </div>
          <ol className="nj-envlist">
            <li>
              <b>Personal</b>
              <span>One person and their own legal questions</span>
            </li>
            <li>
              <b>Professional</b>
              <span>A lawyer or adviser working on their own</span>
            </li>
            <li>
              <b>Law firm</b>
              <span>Partners, associates and staff, with barriers</span>
            </li>
            <li>
              <b>Enterprise</b>
              <span>In-house legal, compliance and governance</span>
            </li>
            <li>
              <b>Institutional</b>
              <span>Public bodies with formal accountability</span>
            </li>
          </ol>
          <p className="nj-more">
            <Link href="/security">Security and governance</Link>
            <Link href="/solutions">Who Njumeni serves</Link>
          </p>
        </div>
      </section>

      {/* 08 — AI and responsibility */}
      <section className="nj-s nj-s--navy" aria-labelledby="ai-title">
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
          <p className="nj-more nj-more--dark">
            <Link href="/security#ai">How AI is governed</Link>
          </p>
        </div>
      </section>

      {/* 09 — Who it serves */}
      <section className="nj-s nj-s--ivory" aria-labelledby="audiences-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Who Njumeni serves</Kicker>
              <h2 id="audiences-title">
                Four kinds of user. <em>One standard of evidence.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Each works on the same legal intelligence, in the workspace made for how they work.
            </p>
          </div>
          <ul className="nj-audcards">
            <li>
              <small>Personal workspace</small>
              <b>Individuals</b>
              <span>A clear answer from the law, and a signal when a lawyer is needed.</span>
            </li>
            <li>
              <small>Professional workspace</small>
              <b>Legal professionals</b>
              <span>Reliable authority, matters and drafts in one place.</span>
            </li>
            <li>
              <small>Law Firm and Enterprise workspaces</small>
              <b>Law firms and enterprises</b>
              <span>Shared work with conflicts, barriers, review and governance.</span>
            </li>
            <li>
              <small>Institutional workspace</small>
              <b>Public institutions</b>
              <span>Legal knowledge kept current, with formal accountability.</span>
            </li>
          </ul>
          <p className="nj-more">
            <Link href="/solutions">Explore each journey</Link>
            <Link href="/plans">See plans and allowances</Link>
          </p>
        </div>
      </section>

      {/* 13 — Final invitation */}
      <section className="nj-s nj-final" aria-labelledby="final-title">
        <div className="nj-wrap">
          <Kicker>Njumeni</Kicker>
          <h2 id="final-title" className="nj-final-statement">
            Legal intelligence for a world where <em>the law never stands still.</em>
          </h2>
          <p className="nj-lead">
            Njumeni is opening to early-access organisations, jurisdiction by jurisdiction, starting
            with Norway.
          </p>
          <div className="nj-ctas">
            <Link href="/early-access" className="nj-btn nj-btn--gold">
              Request early access
            </Link>
            <Link href="/early-access?interest=demonstration" className="nj-btn nj-btn--ghost">
              Request a demonstration
            </Link>
          </div>
          <div className="nj-final-links">
            <Link href="/platform/research">Explore the platform</Link>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
