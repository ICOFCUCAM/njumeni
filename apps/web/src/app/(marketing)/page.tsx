import type { Metadata } from 'next';
import Link from 'next/link';
import { CaseFile } from './case-file';
import { Atlas } from './atlas';
import { AuthorityChart } from './authority-chart';
import { Custody } from './custody';
import { EvidencePipeline } from './evidence-pipeline';
import { GovernanceFlow } from './governance-flow';
import { Observatory } from './observatory';
import { AccessCheck, OrgExplorer } from './org-explorer';
import { PlanChooser, Plans } from './plans';
import { Journeys } from './journeys';
import { ResearchDemo } from './research-demo';
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
            <div className="nj-ctas">
              <Link href="/early-access" className="nj-btn nj-btn--gold">
                Request early access
              </Link>
              <Link href="/sign-in" className="nj-btn nj-btn--ghost">
                Sign in
              </Link>
            </div>
          </ResearchView>
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
          <ResearchDemo />
          <div className="nj-research2">
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
          <ol
            className="nj-thread"
            aria-label="How one citation travels from research into a document"
          >
            <li>
              <p className="nj-thread-where">
                <span>01</span> Research · personal workspace
              </p>
              <span className="nj-thread-cite">§ 15-7 (1)</span>
              <h3>A cited finding</h3>
              <p className="nj-thread-snip" lang="nb">
                “…uten at det er saklig begrunnet i virksomhetens, arbeidsgiverens eller
                arbeidstakerens forhold.”
              </p>
              <p className="nj-thread-meta">Version in force from 1 July 2026 · saved to matter</p>
            </li>
            <li>
              <p className="nj-thread-where">
                <span>02</span> Matter M-2026-014 · Arguments
              </p>
              <span className="nj-thread-cite">§ 15-7 (1)</span>
              <h3>Attached to argument 1</h3>
              <p className="nj-thread-snip">
                The dismissal was objectively justified by the employee’s conduct.
              </p>
              <p className="nj-thread-meta">Evidence: written warning (14 Mar) · meeting notes</p>
            </li>
            <li>
              <p className="nj-thread-where">
                <span>03</span> Reply to the claim · draft 3
              </p>
              <span className="nj-thread-cite">§ 15-7 (1)</span>
              <h3>Cited as footnote 1</h3>
              <p className="nj-thread-snip">
                …objectively justified under the Working Environment Act § 15-7 (1)
                <sup>1</sup>…
              </p>
              <p className="nj-thread-meta">Re-verified against the law in force before sending</p>
            </li>
          </ol>
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
            <Custody />
          </div>
        </div>
        <div className="nj-wrap">
          <EvidencePipeline />
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
          <Observatory />
          <div className="nj-currency-grid">
            <div className="nj-currency">
              <h3>Four honest answers to “is this law current?”</h3>
              <dl>
                <div style={{ ['--c' as string]: '#6fb8a3' }}>
                  <dt>Current</dt>
                  <dd>Sources checked successfully; nothing newer than what is held.</dd>
                </div>
                <div style={{ ['--c' as string]: '#d9a441' }}>
                  <dt>Behind</dt>
                  <dd>A change was detected and is not yet ingested.</dd>
                </div>
                <div style={{ ['--c' as string]: '#d17f63' }}>
                  <dt>Unverified</dt>
                  <dd>A source could not be checked — shown as unverified, never as current.</dd>
                </div>
                <div className="is-today" style={{ ['--c' as string]: 'rgba(245,241,232,0.5)' }}>
                  <dt>Not monitored</dt>
                  <dd>
                    No authorised source is being watched yet.
                    <span className="nj-today">Every jurisdiction today</span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="nj-board">
              <p className="nj-board-actual">Actual status — not illustrative</p>
              <div className="nj-board-head">
                <h3>Observatory status today</h3>
                <span>Hosted service · 22 official sources registered</span>
              </div>
              <table>
                <caption className="nj-sr">Monitoring status by jurisdiction</caption>
                <thead>
                  <tr>
                    <th scope="col">Jurisdiction</th>
                    <th scope="col">Sources</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Norway', 5],
                    ['United States', 3],
                    ['European Union', 2],
                    ['United Kingdom', 2],
                    ['Sweden', 2],
                    ['Denmark', 2],
                    ['Finland', 2],
                    ['Cameroon', 2],
                    ['Uganda', 2],
                  ].map(([name, count]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td className="nj-mono">{count}</td>
                      <td>
                        <span className="nj-dot nj-dot--off" aria-hidden="true" /> Not monitored
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Sources are switched on one by one after their rights review, starting with Norway.
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
          <Atlas />
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
              Five environments, one architecture. Isolation is enforced by the database itself, not
              by the interface: every organisation, workspace, role and decision has its place.
            </p>
          </div>
          <OrgExplorer />
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
          <p className="nj-figcap">
            Illustrative organisation; the structure is the one Njumeni enforces.
          </p>
          <AccessCheck />
        </div>
      </section>

      {/* 09 — AI and human responsibility */}
      <section id="ai" className="nj-s nj-s--navy" aria-labelledby="ai-title">
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
          <GovernanceFlow />
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
          <p className="nj-layers-in">Every request · screen, API or integration</p>
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
          <p className="nj-layers-core">Your organisation’s legal data</p>
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
          <PlanChooser />
          <details className="nj-pl-compare">
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
