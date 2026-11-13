import type { Metadata } from 'next';
import { CaseFile } from '../../case-file';
import { Custody } from '../../custody';
import { EvidencePipeline } from '../../evidence-pipeline';
import { CtaBand, Kicker, PageIntro, Related, Tag } from '../../site';

export const metadata: Metadata = {
  title: { absolute: 'Professional workspace — Njumeni' },
  description:
    'Matters, evidence, chronologies, arguments, documents, review and sign-off — with every citation traceable to the law it rests on.',
  alternates: { canonical: '/platform/workspace' },
};

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Professional workspace"
        title={
          <>
            From research <em>to legal work.</em>
          </>
        }
        lead="A finding does not end in a chat window. It moves into a matter, beside the parties, deadlines and evidence — and into the document, where every citation can still be traced to the law."
        tone="ivory"
      />
      {/* 04 — Professional workspace */}
      <section id="workspace" className="nj-s nj-s--ivory" aria-labelledby="workspace-title">
        <div className="nj-wrap">
          <h2 id="workspace-title" className="nj-sr">
            How a finding travels
          </h2>
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
      <section className="nj-s nj-s--paper" aria-labelledby="caps-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Inside the workspace</Kicker>
              <h2 id="caps-title">
                Everything a matter needs, <em>in one governed place.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Each capability below is part of the application today, unless its label says
              otherwise.
            </p>
          </div>
          <ul className="nj-capgrid">
            <li>
              <b>Matters and deadlines</b>
              <span>Parties, clients, status and the dates that cannot be missed.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Conflict checks</b>
              <span>Every party searched across all matters before a matter opens.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Information barriers</b>
              <span>Matters and teams walled off from each other inside one organisation.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Evidence and custody</b>
              <span>Fingerprints, quarantine, versions, holds and a sealed custody record.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Chronologies</b>
              <span>Events in order, each linked to the evidence that shows it.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Arguments</b>
              <span>
                Issues, arguments and counter-arguments, each tied to authority and evidence.
              </span>
              <Tag status="built" />
            </li>
            <li>
              <b>Documents</b>
              <span>Templates, versions and comparison between drafts.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Citation validation</b>
              <span>
                Citations re-verified against the law in force before a document goes out.
              </span>
              <Tag status="built" />
            </li>
            <li>
              <b>Review and sign-off</b>
              <span>Review gates and sign-off by a member whose role permits it, recorded.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Firm knowledge</b>
              <span>Precedents and know-how, published and retired by authorised people.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Compliance registers</b>
              <span>Obligations with named owners, linked to the law they come from.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Billing and usage</b>
              <span>
                Allowances, metering and invoices. The payment provider awaits connection.
              </span>
              <Tag status="awaiting" />
            </li>
            <li>
              <b>AI drafting and reasoning</b>
              <span>
                For customers once an AI provider is connected — and labelled as AI when it is.
              </span>
              <Tag status="planned" />
            </li>
          </ul>
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
      <Related keys={['research', 'security', 'solutions']} />
      <CtaBand title="Run your matters on the law as it stands." />
    </>
  );
}
