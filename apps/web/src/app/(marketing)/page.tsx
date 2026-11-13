import type { Metadata } from 'next';
import Link from 'next/link';
import { CaseFile } from './case-file';
import { ChangeDemo } from './change-demo';
import { Journeys } from './journeys';
import { ResearchView } from './research-view';

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

type Status = 'built' | 'awaiting' | 'developing' | 'planned';
const STATUS: Record<Status, string> = {
  built: 'Built',
  awaiting: 'Awaiting activation',
  developing: 'In development',
  planned: 'Planned',
};
function Tag({ status }: { status: Status }) {
  return <span className={`nj-tag nj-tag--${status}`}>{STATUS[status]}</span>;
}
function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="nj-kicker">{children}</p>;
}

// Plan allowances: the commercial configuration (migration 20261112600000, Master Plan §17.1).
// Prices are hypotheses still to be decided and are not published.
type Allowance = number | null;
interface Plan {
  name: string;
  forWhom: string;
  research: Allowance;
  documents: Allowance;
  ai: Allowance;
  api: Allowance;
  seats: Allowance;
  storage: Allowance;
  access: string;
}
const PLAN_GROUPS: { title: string; note: string; plans: Plan[] }[] = [
  {
    title: 'For individuals',
    note: 'Personal workspace',
    plans: [
      {
        name: 'Free',
        forWhom: 'The general public',
        research: 30,
        documents: 5,
        ai: 50,
        api: 100,
        seats: 1,
        storage: 1,
        access: 'Free',
      },
      {
        name: 'Personal',
        forWhom: 'Individuals',
        research: 200,
        documents: 50,
        ai: 500,
        api: 0,
        seats: 1,
        storage: 5,
        access: 'At early access',
      },
      {
        name: 'Personal Plus',
        forWhom: 'Ongoing legal matters',
        research: 600,
        documents: 150,
        ai: 1500,
        api: 0,
        seats: 1,
        storage: 20,
        access: 'At early access',
      },
    ],
  },
  {
    title: 'For legal professionals',
    note: 'Professional workspace',
    plans: [
      {
        name: 'Professional',
        forWhom: 'Lawyers and advisers',
        research: 2000,
        documents: 500,
        ai: 4000,
        api: 1000,
        seats: 1,
        storage: 50,
        access: 'At early access',
      },
      {
        name: 'Professional Plus',
        forWhom: 'High-volume practitioners',
        research: 6000,
        documents: 1500,
        ai: 10000,
        api: 10000,
        seats: 1,
        storage: 200,
        access: 'At early access',
      },
    ],
  },
  {
    title: 'For organisations',
    note: 'Law Firm, Enterprise and Institutional workspaces',
    plans: [
      {
        name: 'Law Firm',
        forWhom: 'Legal practices',
        research: 20000,
        documents: 5000,
        ai: 25000,
        api: 50000,
        seats: 10,
        storage: 1000,
        access: 'At early access',
      },
      {
        name: 'Enterprise',
        forWhom: 'Large organisations',
        research: null,
        documents: null,
        ai: null,
        api: null,
        seats: null,
        storage: null,
        access: 'By contract',
      },
      {
        name: 'Institutional',
        forWhom: 'Public institutions',
        research: null,
        documents: null,
        ai: null,
        api: null,
        seats: null,
        storage: null,
        access: 'By contract',
      },
    ],
  },
];
const PLAN_ROWS: { key: keyof Plan; label: string; unit?: string }[] = [
  { key: 'research', label: 'Research runs a month' },
  { key: 'documents', label: 'Generated documents a month' },
  { key: 'ai', label: 'AI credits a month' },
  { key: 'api', label: 'API requests a month' },
  { key: 'seats', label: 'Seats included' },
  { key: 'storage', label: 'Storage', unit: ' GB' },
];
const fmt = (value: Allowance, unit = '') =>
  value === null ? 'Contracted' : value === 0 ? '—' : value.toLocaleString('en-GB') + unit;

export default function HomePage() {
  return (
    <>
      {/* 01 — Hero */}
      <section className="nj-hero" aria-labelledby="hero-title">
        <div className="nj-wrap">
          <div className="nj-hero-grid">
            <div>
              <Kicker>Global legal intelligence</Kicker>
              <h1 id="hero-title">
                <span>Know the law.</span>
                <span>Understand its authority.</span>
                <span>Stay ahead of change.</span>
              </h1>
              <p className="nj-hero-lead">
                Global legal intelligence connecting authoritative legal research, professional
                legal work and continuous awareness of changing legislation.
              </p>
              <div className="nj-ctas">
                <Link href="/early-access" className="nj-btn nj-btn--gold">
                  Request early access
                </Link>
                <Link href="/sign-in" className="nj-btn nj-btn--ghost">
                  Sign in
                </Link>
              </div>
            </div>
            <ResearchView />
          </div>
          <ul className="nj-principles" aria-label="Principles">
            <li>
              <b>Official sources</b>
              <span>Rights-reviewed publications, named in every answer</span>
            </li>
            <li>
              <b>Exact citations</b>
              <span>The words of the law, quoted and cited to the provision</span>
            </li>
            <li>
              <b>Temporal accuracy</b>
              <span>The version in force on the date that matters</span>
            </li>
            <li>
              <b>Human oversight</b>
              <span>Qualified people review, approve and decide</span>
            </li>
          </ul>
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
            <div
              className="nj-coords"
              role="list"
              aria-label="The four coordinates of a legal question"
            >
              <div className="nj-coord" role="listitem">
                <small>Authority</small>
                <b>On what law?</b>
                <span>Official sources, the hierarchy of authority, the exact provision.</span>
              </div>
              <div className="nj-coord" role="listitem">
                <small>Time</small>
                <b>As of when?</b>
                <span>
                  The version in force on the date — never confusing publication with commencement.
                </span>
              </div>
              <div className="nj-coord" role="listitem">
                <small>Evidence</small>
                <b>On what facts?</b>
                <span>Documents with their custody, versions and chronology.</span>
              </div>
              <div className="nj-coord" role="listitem">
                <small>Responsibility</small>
                <b>Who decides?</b>
                <span>Review, sign-off and an audit record of every decision.</span>
              </div>
              <div className="nj-coord-center" aria-hidden="true">
                A legal
                <br />
                question
              </div>
            </div>
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

      {/* 03 — Legal research */}
      <section id="research" className="nj-s nj-s--paper" aria-labelledby="research-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Legal research</Kicker>
              <h2 id="research-title">
                Ask a question. <em>Receive the authority.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Every answer is assembled from the official text, checked against the date you chose,
              and verified before you see it. When the evidence is not there, Njumeni declines.
            </p>
          </div>
          <div className="nj-research">
            <ol className="nj-steps8">
              <li>
                <b>Ask a legal question</b>
                <span>In your own words, in Norwegian or English.</span>
              </li>
              <li>
                <b>Select the jurisdiction</b>
                <span>Each legal system is searched on its own terms.</span>
              </li>
              <li>
                <b>Select the legal date</b>
                <span>Today, or the day the contract ended.</span>
              </li>
              <li>
                <b>Identify the applicable authority</b>
                <span>
                  Acts and regulations in force on that date, ranked by their place in the
                  hierarchy.
                </span>
              </li>
              <li>
                <b>Retrieve the supporting provisions</b>
                <span>Keyword and meaning search, then legal reranking.</span>
              </li>
              <li>
                <b>Produce a cited finding</b>
                <span>Exact quotations with citation, version and source.</span>
              </li>
              <li>
                <b>Verify the result</b>
                <span>
                  Citations, quotations, currency and permissions are checked; reviews can be
                  requested.
                </span>
              </li>
              <li className="nj-steps8-stop">
                <b>Refuse unsupported conclusions</b>
                <span>No authority on that date means no answer — not a guess.</span>
              </li>
            </ol>
            <div className="nj-datepanel" role="group" aria-labelledby="date-title">
              <h3 id="date-title">Why the date matters</h3>
              <p>
                A law can be published months before it takes effect, and stay in force long after
                it is amended. The right answer depends on the version in force on your date.
              </p>
              <div className="nj-timeline" aria-hidden="true">
                <span className="nj-timeline-mark" style={{ left: '40%' }}>
                  published
                </span>
                <span className="nj-timeline-mark" style={{ left: '75%' }}>
                  in force
                </span>
                <div className="nj-timeline-axis">
                  <span>Previous version applies</span>
                  <span>Still the previous version</span>
                  <span>New version</span>
                </div>
              </div>
              <ul className="nj-datepanel-list">
                <li>
                  <b>Publication is not commencement.</b> Between the two, the old law still
                  governs.
                </li>
                <li>
                  <b>Every finding carries its version</b> and the dates it was in force.
                </li>
                <li>
                  <b>If the version for your date is not held,</b> Njumeni says so instead of
                  answering from another text.
                </li>
              </ul>
            </div>
          </div>
          <div className="nj-status-line">
            <Tag status="built" /> Research engine, verification and refusals.
            <Tag status="awaiting" /> Norwegian sources (Lovdata) await rights activation; retrieval
            quality is being evaluated independently before coverage is claimed.
          </div>
        </div>
      </section>

      {/* 04 — Professional workspace */}
      <section id="workspace" className="nj-s nj-s--ivory" aria-labelledby="workspace-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Professional workspace</Kicker>
              <h2 id="workspace-title">
                From research <em>to legal work.</em>
              </h2>
            </div>
            <p className="nj-lead">
              A finding does not end in a chat window. It moves into a matter, beside the parties,
              deadlines and evidence — and into the document, where every citation can still be
              traced to the law.
            </p>
          </div>
          <div className="nj-trace" aria-label="How a finding travels">
            <div className="nj-trace-step">
              <small>Research</small>
              <h3>A cited finding</h3>
              <p>The provision, its version and the exact words.</p>
              <span className="nj-cite-chip">§ 15-7 (1) · LOV-2005-06-17-62</span>
            </div>
            <div className="nj-trace-step">
              <small>Matter</small>
              <h3>Attached to the case</h3>
              <p>Linked to the argument and the evidence it supports.</p>
              <span className="nj-cite-chip">M-2026-014 · argument 1</span>
            </div>
            <div className="nj-trace-step">
              <small>Document</small>
              <h3>Cited in the draft</h3>
              <p>Re-verified against the law in force before it goes out.</p>
              <span className="nj-cite-chip">reply · footnote 1 ✓</span>
            </div>
          </div>
          <CaseFile />
          <div className="nj-status-line">
            <Tag status="built" /> Matters, parties, deadlines, conflict checks, information
            barriers, arguments, documents, reviews, compliance registers and firm knowledge.
          </div>
        </div>
      </section>

      {/* 05 — Evidence */}
      <section id="evidence" className="nj-s nj-s--paper" aria-labelledby="evidence-title">
        <div className="nj-wrap nj-evidence">
          <div>
            <Kicker>Evidence and document integrity</Kicker>
            <h2 id="evidence-title">
              Every record, <em>accounted for.</em>
            </h2>
            <p className="nj-lead">
              Evidence carries its fingerprint from the moment it arrives. Each action writes a
              record that seals the one before it, versions are never overwritten, and legal holds
              stop deletion — so the record can be checked by anyone, independently.
            </p>
            <ul className="nj-caps">
              <li>
                Private upload <Tag status="built" />
              </li>
              <li>
                File fingerprinting <Tag status="built" />
              </li>
              <li>
                Custody history <Tag status="built" />
              </li>
              <li>
                Legal holds <Tag status="built" />
              </li>
              <li>
                Version management <Tag status="built" />
              </li>
              <li>
                Chronologies <Tag status="built" />
              </li>
              <li>
                Evidence bundles <Tag status="built" />
              </li>
              <li>
                Audit records <Tag status="built" />
              </li>
              <li>
                Text from digital files <Tag status="built" />
              </li>
              <li>
                OCR for scans <Tag status="developing" />
              </li>
              <li>
                File screening <Tag status="built" />
              </li>
              <li>
                Antivirus engine <Tag status="developing" />
              </li>
            </ul>
          </div>
          <div>
            <ol className="nj-chain" aria-label="Chain of custody">
              <li>
                <span className="nj-chain-n">01</span>
                <span>
                  <b>Received</b>
                  <span>employment-contract.pdf, stored privately</span>
                </span>
                <span className="nj-chain-hash">
                  prev 00000000<em>hash 9f2c41ab</em>
                </span>
              </li>
              <li>
                <span className="nj-chain-n">02</span>
                <span>
                  <b>Placed on legal hold</b>
                  <span>Deletion blocked until released</span>
                </span>
                <span className="nj-chain-hash">
                  prev 9f2c41ab<em>hash b81e07c3</em>
                </span>
              </li>
              <li>
                <span className="nj-chain-n">03</span>
                <span>
                  <b>New version added</b>
                  <span>Version 1 kept, unchanged</span>
                </span>
                <span className="nj-chain-hash">
                  prev b81e07c3<em>hash 3d5a9e10</em>
                </span>
              </li>
              <li>
                <span className="nj-chain-n">04</span>
                <span>
                  <b>Exported in a bundle</b>
                  <span>Manifest lists every file and hash</span>
                </span>
                <span className="nj-chain-hash">
                  prev 3d5a9e10<em>hash e47f2c65</em>
                </span>
              </li>
            </ol>
            <p className="nj-chain-caption">
              Illustrative custody record. Each record’s hash includes the one before it.
            </p>
          </div>
        </div>
      </section>

      {/* 06 — Global Legal Change Intelligence */}
      <section id="change-intelligence" className="nj-s nj-glci" aria-labelledby="glci-title">
        <div className="nj-wrap">
          <Kicker>Global Legal Change Intelligence</Kicker>
          <h2 id="glci-title" className="nj-glci-statement">
            The law changes. <em>Legal knowledge must keep up.</em>
          </h2>
          <p className="nj-lead">
            Njumeni watches authorised official sources, compares every new version with the last,
            and traces each change to the research, documents and matters that relied on the old law
            — then routes the response through people who are accountable for it.
          </p>
          <ol className="nj-pipeline">
            <li>
              <b>Monitor</b>
              <span>Authorised official publications, checked on a schedule.</span>
            </li>
            <li>
              <b>Detect and compare</b>
              <span>New and amended legislation, provision by provision.</span>
            </li>
            <li>
              <b>Date</b>
              <span>Publication, commencement and repeal kept apart.</span>
            </li>
            <li>
              <b>Assess</b>
              <span>Affected research and documents; the currency of what is held.</span>
            </li>
            <li>
              <b>Decide and notify</b>
              <span>Proposals, governed approval, customer notices — all recorded.</span>
            </li>
          </ol>
          <div className="nj-glci-stage">
            <ChangeDemo />
            <div className="nj-currency">
              <h3>Is the law you hold current?</h3>
              <p>
                For each jurisdiction, Njumeni states one of four positions — never “current”
                without evidence.
              </p>
              <dl>
                <div style={{ ['--c' as string]: '#5fae99' }}>
                  <dt>Current</dt>
                  <dd>Sources checked successfully; nothing newer than what is held.</dd>
                </div>
                <div style={{ ['--c' as string]: '#d9a441' }}>
                  <dt>Behind</dt>
                  <dd>A change was detected and is not yet ingested.</dd>
                </div>
                <div style={{ ['--c' as string]: '#c9785c' }}>
                  <dt>Unverified</dt>
                  <dd>A source could not be checked. Shown as unverified, never as current.</dd>
                </div>
                <div style={{ ['--c' as string]: 'rgba(245,241,232,0.45)' }}>
                  <dt>Not monitored</dt>
                  <dd>No authorised source is being watched yet.</dd>
                </div>
              </dl>
              <p className="nj-currency-now">
                Today: every jurisdiction reads <b>not monitored</b>. Monitoring is built and
                tested; official sources are switched on one by one after their rights review,
                starting with Norway.
              </p>
            </div>
          </div>
          <div className="nj-status-line">
            <Tag status="built" /> Monitoring, comparison, impact analysis, currency, remediation,
            approvals, notices and the operators’ Global Legal Observatory.
            <Tag status="awaiting" /> Official sources.
          </div>
        </div>
      </section>

      {/* 07 — Jurisdictions */}
      <section id="international" className="nj-s nj-s--paper" aria-labelledby="intl-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>The global jurisdiction framework</Kicker>
              <h2 id="intl-title">
                One framework. <em>Many legal systems.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Legal systems are not interchangeable. Each is described on its own terms and kept
              apart in search — inside one platform, with one standard of evidence. The framework
              spans 17 legal systems: 13 countries, the EU, the EEA, OHADA and international law.
            </p>
          </div>
          <figure className="nj-map">
            <img
              src="/home/jurisdiction-map.svg"
              alt="World map of the Njumeni jurisdiction framework. Norway is the reference jurisdiction; Sweden, Denmark, Finland, the United Kingdom, the United States, Cameroon, Ghana, Kenya, Nigeria, Senegal, Uganda and South Africa are in the framework; EU member states are shaded for EU law."
              width={1000}
              height={472}
              loading="lazy"
              decoding="async"
            />
            <ul className="nj-map-legend">
              <li style={{ ['--c' as string]: '#C6A66B' }}>
                <i aria-hidden="true" />
                Norway — reference jurisdiction
              </li>
              <li style={{ ['--c' as string]: '#142638' }}>
                <i aria-hidden="true" />
                In the framework
              </li>
              <li style={{ ['--c' as string]: '#B9C3CC' }}>
                <i aria-hidden="true" />
                EU member states (EU law)
              </li>
            </ul>
          </figure>
          <div className="nj-needs" aria-label="What each jurisdiction requires">
            <div>
              <b>Sources</b>
              <span>Its own official publications</span>
            </div>
            <div>
              <b>Hierarchy</b>
              <span>Constitution, acts, regulations, cases</span>
            </div>
            <div>
              <b>Languages</b>
              <span>Searched in the languages of the law</span>
            </div>
            <div>
              <b>Versions</b>
              <span>Every version, with its dates</span>
            </div>
            <div>
              <b>Rights</b>
              <span>A licence or rights review per source</span>
            </div>
            <div>
              <b>Monitoring</b>
              <span>A monitor fitted to the source’s format</span>
            </div>
            <div>
              <b>Verification</b>
              <span>Evaluated before coverage is claimed</span>
            </div>
          </div>
          <div className="nj-regions">
            <div className="nj-region">
              <h3>Europe</h3>
              <ul>
                <li>
                  Norway <small>— reference</small>
                </li>
                <li>Sweden · Denmark · Finland</li>
                <li>United Kingdom</li>
                <li>European Union · EEA</li>
              </ul>
            </div>
            <div className="nj-region">
              <h3>Africa</h3>
              <ul>
                <li>
                  Cameroon <small>— bijural</small>
                </li>
                <li>Ghana · Kenya · Nigeria</li>
                <li>Senegal · Uganda · South Africa</li>
                <li>OHADA</li>
              </ul>
            </div>
            <div className="nj-region">
              <h3>Americas</h3>
              <ul>
                <li>
                  United States <small>— federal</small>
                </li>
              </ul>
            </div>
            <div className="nj-region">
              <h3>International</h3>
              <ul>
                <li>International law and treaties</li>
              </ul>
            </div>
          </div>
          <div className="nj-status-line">
            <Tag status="built" /> The framework: profiles, hierarchies, date rules and 22
            registered official sources.
            <Tag status="awaiting" /> Legal content and monitoring: no jurisdiction is yet covered
            or monitored live.
          </div>
        </div>
      </section>

      {/* 08 — Organisations */}
      <section id="organisations" className="nj-s nj-s--ivory" aria-labelledby="org-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Institutional architecture</Kicker>
              <h2 id="org-title">
                Built for organisations, <em>from the foundation up.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Four kinds of organisation, one architecture. Isolation is enforced by the database
              itself, not by the interface: every organisation, workspace, role and decision has its
              place.
            </p>
          </div>
          <div className="nj-orgtypes">
            <div>
              <small>01</small>
              <h3>Personal</h3>
              <p>One person, their questions and their documents.</p>
            </div>
            <div>
              <small>02</small>
              <h3>Law firm</h3>
              <p>Practices with clients, matters, conflicts and barriers.</p>
            </div>
            <div>
              <small>03</small>
              <h3>Enterprise</h3>
              <p>In-house legal, compliance and governance teams.</p>
            </div>
            <div>
              <small>04</small>
              <h3>Institution</h3>
              <p>Public bodies with formal accountability.</p>
            </div>
          </div>
          <div className="nj-arch" aria-label="Example organisation structure">
            <div className="nj-arch-org">
              <small>Organisation</small>
              <b>Example Advokatfirma AS</b>
              <span>Members · roles · single sign-on · billing · retention policy</span>
            </div>
            <div className="nj-arch-links" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="nj-arch-row">
              <div className="nj-arch-ws">
                <small>Workspace</small>
                <b>Employment</b>
                <ul>
                  <li>Partner · associates · paralegal</li>
                  <li>14 matters</li>
                </ul>
              </div>
              <div className="nj-arch-ws">
                <small>Workspace</small>
                <b>Corporate</b>
                <ul>
                  <li>Separate team and matters</li>
                  <li>No access to Employment</li>
                </ul>
              </div>
              <div className="nj-arch-ws">
                <small>Workspace</small>
                <b>Compliance</b>
                <ul>
                  <li>Registers and obligations</li>
                  <li>Named owners</li>
                </ul>
              </div>
              <div className="nj-arch-barrier" aria-hidden="true">
                <span>Barrier</span>
              </div>
            </div>
            <div className="nj-arch-base">
              <div>
                <b>Isolation</b>
                <span>Row-level security per organisation</span>
              </div>
              <div>
                <b>Roles</b>
                <span>Permissions per member and workspace</span>
              </div>
              <div>
                <b>Barriers</b>
                <span>Between matters and teams</span>
              </div>
              <div>
                <b>Audit</b>
                <span>Hash-chained, exportable</span>
              </div>
              <div>
                <b>Retention</b>
                <span>Policies and legal holds</span>
              </div>
            </div>
          </div>
          <p className="nj-chain-caption">
            Illustrative organisation; the structure is the one Njumeni enforces.
          </p>
        </div>
      </section>

      {/* 09 — AI and human responsibility */}
      <section id="ai" className="nj-s nj-s--navy" aria-labelledby="ai-title">
        <div className="nj-wrap">
          <Kicker>AI and human responsibility</Kicker>
          <h2 id="ai-title" className="nj-ai-statement">
            <span>AI assists.</span>
            <span>The law provides the authority.</span>
            <span>Professionals retain responsibility.</span>
          </h2>
          <div className="nj-ai-grid">
            <div>
              <h3 className="nj-ai-title">Where intelligence is used today</h3>
              <table className="nj-ai-table">
                <caption className="nj-sr">Where intelligence is used today</caption>
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">How it works</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Research answers</td>
                    <td>Extractive: quoted from verified sources, never generated</td>
                    <td>
                      <Tag status="built" />
                    </td>
                  </tr>
                  <tr>
                    <td>Meaning search</td>
                    <td>A multilingual language model ranks passages by meaning</td>
                    <td>
                      <Tag status="built" />
                    </td>
                  </tr>
                  <tr>
                    <td>Change analysis</td>
                    <td>Version comparison and impact tracing</td>
                    <td>
                      <Tag status="built" />
                    </td>
                  </tr>
                  <tr>
                    <td>Operator command centre</td>
                    <td>Claude for the platform team, with human approval</td>
                    <td>
                      <Tag status="awaiting" />
                    </td>
                  </tr>
                  <tr>
                    <td>Drafting and legal reasoning</td>
                    <td>For customers, once a provider is connected</td>
                    <td>
                      <Tag status="planned" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="nj-human">
              <li>
                <b>People approve consequential actions.</b>
                <span>
                  Source activation, remediation and deployments need an authorised decision — two
                  people by default.
                </span>
              </li>
              <li>
                <b>Professionals sign off.</b>
                <span>Reviews and sign-off gates come before work is relied on.</span>
              </li>
              <li>
                <b>Limits are stated, not hidden.</b>
                <span>Every answer shows its jurisdiction, date, sources and limitations.</span>
              </li>
              <li>
                <b>Not legal advice.</b>
                <span>
                  Njumeni provides legal information and research tools; it does not replace a
                  qualified lawyer.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 10 — Security and governance */}
      <section id="trust" className="nj-s nj-s--paper" aria-labelledby="trust-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Security and governance</Kicker>
              <h2 id="trust-title">
                Protect information. <em>Preserve accountability.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Controls are part of the data layer, so they hold no matter which screen, API or
              integration asks. These are the layers every request passes through.
            </p>
          </div>
          <div className="nj-layers">
            <div className="nj-layer">
              <b>Organisation isolation</b>
              <p>Every table enforces row-level security by organisation and workspace.</p>
              <code>RLS · every table</code>
            </div>
            <div className="nj-layer">
              <b>Role-based access</b>
              <p>Permissions are checked by the database on every call, for every member.</p>
              <code>has_permission()</code>
            </div>
            <div className="nj-layer">
              <b>Information barriers</b>
              <p>Matters and teams can be walled off from each other inside one organisation.</p>
              <code>barriers · conflicts</code>
            </div>
            <div className="nj-layer">
              <b>Evidence custody</b>
              <p>Fingerprints, immutable versions and a custody record for every action.</p>
              <code>sha-256 · append-only</code>
            </div>
            <div className="nj-layer">
              <b>Human approvals</b>
              <p>Consequential changes require an authorised decision, recorded with its reason.</p>
              <code>four eyes by default</code>
            </div>
            <div className="nj-layer">
              <b>Audit</b>
              <p>Hash-chained audit records with checkpoints and verifiable exports.</p>
              <code>chain · checkpoints</code>
            </div>
            <div className="nj-layer">
              <b>Retention and holds</b>
              <p>Retention policies, with legal holds that override deletion.</p>
              <code>holds &gt; retention</code>
            </div>
          </div>
          <p className="nj-honest">
            Njumeni has not yet completed an independent penetration test or a security
            certification; both are planned before launch. We will publish them when they exist.
          </p>
        </div>
      </section>

      {/* 11 — Who uses Njumeni */}
      <section id="audiences" className="nj-s nj-s--ivory" aria-labelledby="audiences-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Who uses Njumeni</Kicker>
              <h2 id="audiences-title">
                Four kinds of user. <em>Four different journeys.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Each works on the same legal intelligence, in the workspace made for how they work.
              One person can belong to more than one; access follows their organisation, role and
              permissions.
            </p>
          </div>
          <Journeys />
          <p className="nj-fineprint">
            Njumeni provides legal information and research tools. It is not a law firm and does not
            replace advice from a qualified lawyer.
          </p>
        </div>
      </section>

      {/* 12 — Plans */}
      <section id="plans" className="nj-s nj-s--paper" aria-labelledby="plans-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Plans and access</Kicker>
              <h2 id="plans-title">
                Clear allowances. <em>Room to grow.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Every plan states what it includes. Free plans stop at their allowance; paid plans
              continue with metered usage, and there is no unlimited high-cost AI on low-priced
              plans. Prices are announced at early access.
            </p>
          </div>
          <div className="nj-plangroups">
            {PLAN_GROUPS.map((group) => (
              <section key={group.title} className="nj-plangroup" aria-label={group.title}>
                <div className="nj-plangroup-head">
                  <h3>{group.title}</h3>
                  <span>{group.note}</span>
                </div>
                <p className="nj-scroll-hint" aria-hidden="true">
                  Swipe sideways to compare plans →
                </p>
                <div className="nj-plantable-wrap">
                  <table className="nj-plantable">
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="nj-sr">Allowance</span>
                        </th>
                        {group.plans.map((p) => (
                          <th key={p.name} scope="col">
                            {p.name}
                            <small>{p.forWhom}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PLAN_ROWS.map((row) => (
                        <tr key={row.key}>
                          <th scope="row">{row.label}</th>
                          {group.plans.map((p) => (
                            <td key={p.name}>{fmt(p[row.key] as Allowance, row.unit)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Price</th>
                        {group.plans.map((p) => (
                          <td key={p.name}>{p.access}</td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            ))}
          </div>
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
            <Link href="#research">Explore the platform</Link>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
