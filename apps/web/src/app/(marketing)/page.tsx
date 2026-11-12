import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangeDemo } from './change-demo';
import { Dossier } from './dossier';
import { TimeMachine } from './time-machine';

export const metadata: Metadata = {
  title: { absolute: 'Njumeni — Global Legal Intelligence and Professional Legal Research' },
  description:
    'Legal intelligence built on authoritative sources, precise citations and the law as it stood on the date that matters. Research, matters, evidence, documents and legislative change in one platform.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Njumeni',
    title: 'Njumeni — Know the law. Understand the evidence. Stay ahead of change.',
    description:
      'Legal intelligence built on authoritative sources, precise citations and the law as it stood on the date that matters.',
  },
};

function Chapter({ n, title }: { n: string; title: string }) {
  return (
    <p className="nj-chapter">
      <span>{n}</span>
      {title}
    </p>
  );
}

const TRAIL = [
  { k: 'Question', v: 'Can an employer dismiss an employee without a reason?' },
  { k: 'Jurisdiction', v: 'Norway' },
  { k: 'Law as at', v: '12 November 2026' },
  { k: 'Authority', v: 'Working Environment Act (arbeidsmiljøloven) § 15-7 (1)' },
  { k: 'Version', v: 'In force on the research date · content hash recorded' },
];

const LEDGER = [
  { event: 'Uploaded', detail: 'employment-contract.pdf', hash: '9f2c41ab', prev: '00000000' },
  { event: 'Legal hold', detail: 'Deletion blocked', hash: 'b81e07c3', prev: '9f2c41ab' },
  { event: 'Version 2', detail: 'v1 kept unchanged', hash: '3d5a9e10', prev: 'b81e07c3' },
  { event: 'Bundled', detail: 'Case bundle manifest', hash: 'e47f2c65', prev: '3d5a9e10' },
];

const BOARD = [
  {
    code: 'NO',
    name: 'Norway',
    source: 'Lovdata · Lovtidend · Stortinget',
    lang: 'nb · nn',
    state: 'Reference jurisdiction',
  },
  {
    code: 'EU',
    name: 'European Union',
    source: 'EUR-Lex · Official Journal',
    lang: '24 languages',
    state: 'EEA law for Norway',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    source: 'legislation.gov.uk',
    lang: 'en',
    state: 'Atom feed',
  },
  {
    code: 'US',
    name: 'United States',
    source: 'Federal Register · Congress',
    lang: 'en',
    state: 'Federal API',
  },
  {
    code: 'DK',
    name: 'Denmark',
    source: 'Retsinformation',
    lang: 'da',
    state: 'Daily change list',
  },
  {
    code: 'SE',
    name: 'Sweden',
    source: 'Riksdagen · Svensk författningssamling',
    lang: 'sv',
    state: 'Official gazette',
  },
  {
    code: 'CM',
    name: 'Cameroon',
    source: 'Journal officiel · OHADA',
    lang: 'fr · en',
    state: 'Bijural system',
  },
  { code: 'UG', name: 'Uganda', source: 'ULII · Uganda Gazette', lang: 'en', state: 'Common law' },
];

const PERSONAS = [
  {
    who: 'An individual',
    q: '“Can my landlord keep my deposit?”',
    a: 'A clear answer from the Tenancy Act, with the exact section — and a reminder of when to see a lawyer.',
  },
  {
    who: 'A legal professional',
    q: '“What was the notice period on the day the contract ended?”',
    a: 'The version in force on that date, quoted and cited, ready for the brief.',
  },
  {
    who: 'A law firm',
    q: '“Can we act for this client?”',
    a: 'A conflict search across matters and parties, with barriers recorded before work begins.',
  },
  {
    who: 'An enterprise',
    q: '“Which of our policies does the new regulation touch?”',
    a: 'Change intelligence mapped to your compliance register and the people who own it.',
  },
  {
    who: 'A public institution',
    q: '“Is our guidance still correct after the amendment?”',
    a: 'Every document that quotes the changed provision, flagged for review.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero: the law as it stood */}
      <section className="nj-hero" aria-labelledby="hero-title">
        <div className="nj-wrap">
          <div className="nj-hero-grid">
            <div>
              <p className="nj-eyebrow">Global legal intelligence · Professional legal research</p>
              <h1 id="hero-title">
                Know the law. <em>Understand the evidence.</em> Stay ahead of change.
              </h1>
              <p className="nj-hero-lead">
                Legal intelligence built on authoritative sources, precise citations and the law as
                it stood on the date that matters.
              </p>
              <p className="nj-hero-sub">
                Research legal questions, manage matters, examine evidence, prepare documents and
                follow legislative change — in one connected legal intelligence platform.
              </p>
              <div className="nj-cta-row">
                <Link href="/early-access" className="nj-btn nj-btn-gold">
                  Request early access
                </Link>
                <Link href="#story" className="nj-btn nj-btn-ghost">
                  Follow a question through Njumeni ↓
                </Link>
              </div>
            </div>
            <TimeMachine />
          </div>
          <div className="nj-hero-strip">
            <span>Official sources</span>
            <span>Exact citations</span>
            <span>Temporal accuracy</span>
            <span>Human oversight</span>
          </div>
        </div>
      </section>

      {/* Prologue */}
      <section id="story" className="nj-prologue" aria-label="The Njumeni story">
        <div className="nj-wrap">
          <p className="nj-prologue-text">
            Every legal question has three coordinates: <b>where</b>, <b>when</b> and{' '}
            <b>on what authority</b>. Most tools answer only the first. Njumeni follows a question
            through all three — and keeps following it after the law changes.
          </p>
          <ol className="nj-toc">
            <li>
              <a href="#research">I · The question</a>
            </li>
            <li>
              <a href="#workspace">II · The matter</a>
            </li>
            <li>
              <a href="#evidence">III · The evidence</a>
            </li>
            <li>
              <a href="#change-intelligence">IV · The change</a>
            </li>
            <li>
              <a href="#enterprise">V · The institution</a>
            </li>
            <li>
              <a href="#international">VI · The world</a>
            </li>
          </ol>
        </div>
      </section>

      {/* I. The question */}
      <section id="research" className="nj-section" aria-labelledby="research-title">
        <div className="nj-wrap nj-two">
          <div>
            <Chapter n="I" title="The question" />
            <h2 id="research-title">
              Answers grounded in law, <em>not guesses.</em>
            </h2>
            <p className="nj-lead">
              A question becomes a chain of evidence: the jurisdiction, the date, the authority, the
              version in force and the exact words of the law. Each link is checked before an answer
              is given — and each link stays visible to you.
            </p>
            <div className="nj-silence">
              <p className="nj-silence-k">When the law is silent</p>
              <p>
                If no verified authority answers the question on that date, Njumeni says so. No
                invented answer. No citation that does not exist.
              </p>
            </div>
          </div>
          <ol className="nj-trail" aria-label="Evidence trail of a research answer">
            {TRAIL.map((step, i) => (
              <li key={step.k}>
                <span className="nj-trail-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="nj-trail-k">{step.k}</span>
                <span className="nj-trail-v">{step.v}</span>
              </li>
            ))}
            <li className="nj-trail-answer">
              <span className="nj-trail-n">✓</span>
              <span className="nj-trail-k">Verified answer</span>
              <blockquote>
                “Arbeidstaker kan ikke sies opp uten at det er saklig begrunnet i virksomhetens,
                arbeidsgiverens eller arbeidstakerens forhold.”
              </blockquote>
              <span className="nj-trail-src">Lovdata · NLOD 2.0 · exact quotation</span>
            </li>
          </ol>
        </div>
      </section>

      {/* II. The matter */}
      <section
        id="workspace"
        className="nj-section nj-section-alt"
        aria-labelledby="workspace-title"
      >
        <div className="nj-wrap">
          <div className="nj-split-head">
            <div>
              <Chapter n="II" title="The matter" />
              <h2 id="workspace-title">
                Everything your legal team needs, <em>connected.</em>
              </h2>
            </div>
            <p className="nj-lead">
              The research does not end in a chat window. It lands in a case file — with the client,
              the deadlines, the evidence, the arguments, the draft and the sign-off — so every
              citation in the final document can be traced back to the law.
            </p>
          </div>
          <Dossier />
          <ul className="nj-inline-list" aria-label="Workspace capabilities">
            <li>Matters &amp; deadlines</li>
            <li>Conflict checks &amp; barriers</li>
            <li>Evidence</li>
            <li>Chronologies</li>
            <li>Arguments</li>
            <li>Documents</li>
            <li>Reviews &amp; sign-off</li>
            <li>Firm knowledge</li>
            <li>Compliance</li>
            <li>Billing</li>
          </ul>
        </div>
      </section>

      {/* III. The evidence */}
      <section id="evidence" className="nj-section" aria-labelledby="evidence-title">
        <div className="nj-wrap nj-two">
          <div>
            <Chapter n="III" title="The evidence" />
            <h2 id="evidence-title">
              Every document. Every action. <em>Accounted for.</em>
            </h2>
            <p className="nj-lead">
              Each piece of evidence carries a fingerprint, and each action on it is written into a
              chain where every record seals the one before. Versions are never overwritten. Legal
              holds stop deletion. Bundles list every file and hash — so the record can be checked
              by anyone, independently.
            </p>
            <ul className="nj-checks">
              <li>Custody records for every upload, view, change and export</li>
              <li>Versions, legal holds and retention that respects them</li>
              <li>Text recognition and malware scanning on intake</li>
              <li>Chronologies and case bundles built from the record</li>
            </ul>
          </div>
          <ol className="nj-ledger" aria-label="Hash-chained custody record">
            {LEDGER.map((block) => (
              <li key={block.hash}>
                <span className="nj-ledger-event">{block.event}</span>
                <span className="nj-ledger-detail">{block.detail}</span>
                <span className="nj-ledger-hash">
                  <span className="nj-mono">prev {block.prev}</span>
                  <span className="nj-mono nj-ledger-own">hash {block.hash}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* IV. The change */}
      <section id="change-intelligence" className="nj-section nj-glci" aria-labelledby="glci-title">
        <div className="nj-wrap">
          <div className="nj-two">
            <div>
              <Chapter n="IV" title="The change" />
              <h2 id="glci-title">
                The law never stands still. <em>Neither should your legal knowledge.</em>
              </h2>
              <p className="nj-lead">
                Global Legal Change Intelligence watches official legal publications, compares every
                new version with the last, and traces the change to the research, documents and
                matters that relied on the old law. Nothing is updated without an authorised human
                decision.
              </p>
              <dl className="nj-glci-facts">
                <div>
                  <dt>Detect</dt>
                  <dd>New laws, amendments, repeals and commencement dates</dd>
                </div>
                <div>
                  <dt>Compare</dt>
                  <dd>Provision-level differences between versions</dd>
                </div>
                <div>
                  <dt>Trace</dt>
                  <dd>Every answer, document and matter that relied on it</dd>
                </div>
                <div>
                  <dt>Decide</dt>
                  <dd>Proposed updates approved by people, fully audited</dd>
                </div>
              </dl>
              <p className="nj-glci-rule">
                A source that could not be checked reads <b>unverified</b> — never <b>current</b>.
              </p>
            </div>
            <ChangeDemo />
          </div>
        </div>
      </section>

      {/* V. The institution */}
      <section id="enterprise" className="nj-section" aria-labelledby="enterprise-title">
        <div className="nj-wrap">
          <div className="nj-split-head">
            <div>
              <Chapter n="V" title="The institution" />
              <h2 id="enterprise-title">
                Built for organisations <em>from the foundation up.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Isolation is enforced by the database itself, not by the interface. Every
              organisation, workspace, role and decision has its place — and every consequential
              action leaves a record your governance team can verify.
            </p>
          </div>
          <div className="nj-arch" aria-label="How an organisation is structured in Njumeni">
            <div className="nj-arch-org">
              <span className="nj-arch-k">Organisation</span>
              <b>Example Advokatfirma AS</b>
              <span className="nj-arch-sub">SSO · API keys · billing · retention policy</span>
            </div>
            <div className="nj-arch-row">
              {[
                ['Workspace', 'Employment', 'Partners · associates · paralegals'],
                ['Workspace', 'Corporate', 'Information barrier with Employment'],
                ['Workspace', 'Compliance', 'Registers · obligations · owners'],
              ].map(([k, name, sub]) => (
                <div key={name} className="nj-arch-ws">
                  <span className="nj-arch-k">{k}</span>
                  <b>{name}</b>
                  <span className="nj-arch-sub">{sub}</span>
                </div>
              ))}
            </div>
            <div className="nj-arch-base">
              <span>Row-level isolation</span>
              <span>Role-based access</span>
              <span>Hash-chained audit</span>
              <span>Retention &amp; legal holds</span>
              <span>Organisation API</span>
            </div>
          </div>
        </div>
      </section>

      {/* VI. The world */}
      <section
        id="international"
        className="nj-section nj-section-navy"
        aria-labelledby="intl-title"
      >
        <div className="nj-wrap">
          <div className="nj-split-head">
            <div>
              <Chapter n="VI" title="The world" />
              <h2 id="intl-title">
                One method. <em>Many legal systems.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Every jurisdiction is described on its own terms: its hierarchy of authority, its
              languages, its official publications and its rules on when law takes effect. Norway
              leads; the framework spans 17 legal systems across Europe, Africa, the Americas and
              international law.
            </p>
          </div>
          <div className="nj-board" role="table" aria-label="Jurisdiction framework">
            <div className="nj-board-row nj-board-head" role="row">
              <span role="columnheader">Code</span>
              <span role="columnheader">Jurisdiction</span>
              <span role="columnheader">Official sources</span>
              <span role="columnheader">Languages</span>
              <span role="columnheader">Note</span>
            </div>
            {BOARD.map((row) => (
              <div key={row.code} className="nj-board-row" role="row">
                <span role="cell" className="nj-board-code">
                  {row.code}
                </span>
                <span role="cell">{row.name}</span>
                <span role="cell">{row.source}</span>
                <span role="cell">{row.lang}</span>
                <span role="cell" className="nj-board-state">
                  {row.state}
                </span>
              </div>
            ))}
          </div>
          <p className="nj-board-more">
            Also in the framework: Finland, Ghana, Kenya, Nigeria, Senegal, South Africa, the EEA,
            OHADA and international law.
          </p>
        </div>
      </section>

      {/* VII. The principle */}
      <section id="trust" className="nj-section nj-manifesto" aria-labelledby="trust-title">
        <div className="nj-wrap">
          <Chapter n="VII" title="The principle" />
          <h2 id="trust-title" className="nj-manifesto-title">
            AI assists. The law provides the authority.{' '}
            <em>Qualified professionals retain responsibility for legal judgement.</em>
          </h2>
          <ol className="nj-commitments">
            <li>
              <b>Source.</b> Every finding names its official source, licence and version.
            </li>
            <li>
              <b>Time.</b> The law is applied as it stood on your date. Publication is not
              commencement.
            </li>
            <li>
              <b>Silence.</b> Where the evidence is insufficient, we say so.
            </li>
            <li>
              <b>Isolation.</b> Your organisation’s data is separated at the database level.
            </li>
            <li>
              <b>Record.</b> Decisions are audited in a chain that can be verified independently.
            </li>
            <li>
              <b>People.</b> Review and sign-off keep responsibility with qualified professionals.
            </li>
          </ol>
        </div>
      </section>

      {/* VIII. Who asks */}
      <section
        id="audiences"
        className="nj-section nj-section-alt"
        aria-labelledby="audiences-title"
      >
        <div className="nj-wrap">
          <Chapter n="VIII" title="Who asks" />
          <h2 id="audiences-title">
            Five people. Five questions. <em>One standard of evidence.</em>
          </h2>
          <div className="nj-personas">
            {PERSONAS.map((p) => (
              <figure key={p.who} className="nj-persona">
                <figcaption>{p.who}</figcaption>
                <blockquote>{p.q}</blockquote>
                <p>{p.a}</p>
              </figure>
            ))}
          </div>
          <p className="nj-fineprint">
            Njumeni provides legal information and research tools. It is not a law firm and does not
            replace advice from a qualified lawyer.
          </p>
        </div>
      </section>

      {/* Final */}
      <section className="nj-section nj-final" aria-labelledby="final-title">
        <div className="nj-wrap">
          <p className="nj-eyebrow">Njumeni · early access</p>
          <h2 id="final-title">Legal intelligence that keeps pace with the law.</h2>
          <p className="nj-lead">
            Njumeni is opening to organisations jurisdiction by jurisdiction. Request access or a
            personal demonstration.
          </p>
          <div className="nj-cta-row">
            <Link href="/early-access" className="nj-btn nj-btn-gold">
              Request early access
            </Link>
            <Link href="/early-access?interest=demonstration" className="nj-btn nj-btn-ghost">
              Book a demonstration
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
