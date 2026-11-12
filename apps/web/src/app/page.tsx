import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './marketing-home.module.css';

export const metadata: Metadata = {
  title: 'Njumeni — Know the law. Understand the evidence. Stay ahead of change.',
  description: 'A global legal intelligence and professional research platform built around authoritative legal sources, precise citations, evidence and accountable legal workflows.',
  robots: { index: true, follow: true },
  openGraph: { title: 'Njumeni — Global Legal Intelligence', description: 'Legal research, professional workflows and legislative change intelligence grounded in authoritative sources.', type: 'website' },
};

const capabilities = [
  { number: '01', title: 'Research grounded in authority', description: 'Frame a legal question by jurisdiction and date. Work from legal texts, exact quotations and traceable citations—not unsupported generated answers.', tag: 'Research & citations' },
  { number: '02', title: 'Understand the law over time', description: 'Distinguish publication from commencement, follow amendments and repeals, and examine the legal position that applied on the date that matters.', tag: 'Temporal legal intelligence' },
  { number: '03', title: 'Manage the work around the law', description: 'Bring matters, deadlines, evidence, documents, arguments, reviews and team responsibilities into connected professional workflows.', tag: 'Professional workspace' },
  { number: '04', title: 'Keep evidence accountable', description: 'Organise evidence with version history, custody records, chronology, legal holds and auditable handling.', tag: 'Evidence & integrity' },
];
const audiences = [
  { title: 'Legal professionals', description: 'Source-grounded research, matter preparation, drafting and review.', mark: 'LP' },
  { title: 'Law firms', description: 'Client matters, conflict checks, information barriers and shared firm knowledge.', mark: 'LF' },
  { title: 'Businesses & enterprises', description: 'Legal research, compliance workflows, governance and connected organisational workspaces.', mark: 'BE' },
  { title: 'Public institutions', description: 'Institutional legal knowledge, regulatory awareness and accountable records.', mark: 'PI' },
  { title: 'Individuals', description: 'A clearer way to explore legal information and understand its supporting sources.', mark: 'IN' },
];

function NjumeniMark() {
  return <span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 44 44" fill="none"><path d="M22 4.5 37.5 13.25v17.5L22 39.5 6.5 30.75v-17.5L22 4.5Z" /><path d="M14 29V15l16 14V15" /><path d="M11 33h22" /></svg></span>;
}
function ResearchPreview() {
  return <div className={styles.researchWindow} aria-label="Illustrative legal research interface">
    <div className={styles.windowTop}><div className={styles.windowDots}><i /><i /><i /></div><span>LEGAL RESEARCH WORKSPACE</span><span className={styles.windowSecure}>SOURCE-GROUNDED</span></div>
    <div className={styles.researchBody}>
      <div className={styles.researchPrompt}><span className={styles.microLabel}>RESEARCH QUESTION</span><p>Which legal provisions govern this issue, and what version applied on the relevant date?</p><div className={styles.promptMeta}><span>Jurisdiction · Norway</span><span>Legal date · Selectable</span></div></div>
      <div className={styles.answerHead}><span className={styles.answerIcon}>§</span><div><span className={styles.microLabel}>RESEARCH OUTPUT</span><strong>Evidence before conclusion</strong></div><span className={styles.reviewPill}>Illustrative</span></div>
      <div className={styles.answerLine}><b>01</b><span className={styles.lineLong} /></div><div className={styles.answerLine}><b>02</b><span className={styles.lineMedium} /></div><div className={styles.answerLine}><b>03</b><span className={styles.lineShort} /></div>
      <div className={styles.citationCard}><div className={styles.citationTop}><span>SUPPORTING AUTHORITY</span><span>OPEN SOURCE ↗</span></div><strong>Official legal text · Provision and version</strong><p>Exact quotation, source reference and applicable period are shown with the research finding.</p></div>
      <div className={styles.researchFoot}><span><i /> Source traceability</span><span><i /> Date-aware analysis</span><span><i /> Human judgement</span></div>
    </div>
  </div>;
}
function LegalChangeVisual() {
  return <div className={styles.changeVisual} aria-label="Illustration of legal change monitoring">
    <div className={styles.changeVisualHead}><span className={styles.microLabel}>GLOBAL LEGAL CHANGE INTELLIGENCE</span><span className={styles.demoTag}>CONCEPTUAL WORKFLOW</span></div>
    <div className={styles.globeArea}>
      <svg className={styles.globe} viewBox="0 0 420 300" fill="none" aria-hidden="true">
        <circle cx="210" cy="150" r="116" /><ellipse cx="210" cy="150" rx="53" ry="116" /><ellipse cx="210" cy="150" rx="92" ry="116" />
        <path d="M94 150h232M112 103h196M112 197h196M210 34v232" />
        <path d="m139 76 33 17 18 30-19 22-37-6-20-26M236 72l34 13 20 28-12 31-29 6-17 33-29-6-17-32 14-24-12-31M163 204l23 18 6 25M245 205l-10 24-2 28" />
        <path className={styles.globeArc} d="M55 192c48-83 113-116 183-91 47 17 81 56 126 51" />
        <circle className={styles.globePoint} cx="139" cy="103" r="5" /><circle className={styles.globePoint} cx="270" cy="113" r="5" /><circle className={styles.globePoint} cx="244" cy="207" r="5" /><circle className={styles.globePoint} cx="364" cy="152" r="5" />
      </svg>
      <div className={styles.sourceNode}><span>NO</span><b>Norway</b><small>Reference jurisdiction</small></div>
      <div className={styles.sourceNodeAlt}><span>GLOBAL</span><b>Jurisdiction framework</b><small>Coverage configured by source</small></div>
    </div>
    <div className={styles.changeFlow}><div><span>01</span><b>Monitor</b><small>Official publications</small></div><div><span>02</span><b>Compare</b><small>Versions & provisions</small></div><div><span>03</span><b>Assess</b><small>Legal impact</small></div><div><span>04</span><b>Review</b><small>Human approval</small></div></div>
    <p className={styles.changeFoot}>A designed workflow. Jurisdiction monitoring becomes available only after its sources, rights and workers are activated and verified.</p>
  </div>;
}

export default function HomePage() {
  return <main className={styles.site}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Njumeni home"><NjumeniMark /><span><strong>NJUMENI</strong><small>GLOBAL LEGAL INTELLIGENCE</small></span></Link>
      <nav className={styles.nav} aria-label="Main navigation"><a href="#research">Research</a><a href="#platform">Platform</a><a href="#change-intelligence">Global intelligence</a><a href="#professionals">Who it serves</a><a href="#trust">Trust</a></nav>
      <div className={styles.headerActions}><Link className={styles.signIn} href="/sign-in">Sign in</Link><Link className={styles.headerCta} href="/sign-in">Access workspace <span>↗</span></Link></div>
    </header>
    <section className={styles.hero}>
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span /> LEGAL RESEARCH · EVIDENCE · INTELLIGENCE</p>
        <h1>Know the law.<br /><em>Understand the evidence.</em><br />Stay ahead of change.</h1>
        <p className={styles.heroLead}>Legal intelligence built on authoritative sources, precise citations and the law as it stood on the date that matters.</p>
        <p className={styles.heroBody}>Research legal questions, manage matters, examine evidence and prepare legal work through one connected professional platform—designed to keep legal knowledge aligned with changing law.</p>
        <div className={styles.heroActions}><Link href="/sign-in" className={styles.primaryButton}>Access the workspace <span>↗</span></Link><a href="#platform" className={styles.secondaryButton}>Discover Njumeni <span>↓</span></a></div>
        <div className={styles.heroPrinciples}><span>Official sources</span><i /><span>Traceable citations</span><i /><span>Human oversight</span></div>
      </div>
      <div className={styles.heroVisual}><ResearchPreview /></div>
      <div className={styles.heroBottom}><span>BUILT FOR PROFESSIONAL LEGAL WORK</span><span>RESEARCH <b>·</b> EVIDENCE <b>·</b> MATTERS <b>·</b> CHANGE INTELLIGENCE</span></div>
    </section>
    <section className={styles.intro} id="research">
      <div className={styles.sectionKicker}>01 / THE RESEARCH STANDARD</div>
      <div className={styles.introGrid}><h2>Answers grounded<br />in law, <em>not guesses.</em></h2><div><p className={styles.sectionLead}>Legal research should show its work.</p><p>Njumeni is designed to build research findings from verified legal sources, with exact quotations, provision-level citations and the relevant legal version for a chosen date. When the available evidence cannot support an answer, the system should say so.</p><div className={styles.principleStrip}><div><b>01</b><span>Identify the authority</span></div><div><b>02</b><span>Verify the applicable version</span></div><div><b>03</b><span>Show the supporting text</span></div></div></div></div>
    </section>
    <section className={styles.platform} id="platform">
      <div className={styles.sectionHeader}><div><div className={styles.sectionKicker}>02 / THE PROFESSIONAL PLATFORM</div><h2>Everything around the law.<br /><em>Connected in one workspace.</em></h2></div><p>From the first legal question to the matter file, evidence, document, review and record of decision.</p></div>
      <div className={styles.capabilityGrid}>{capabilities.map((item) => <article className={styles.capability} key={item.number}><div className={styles.capabilityTop}><span>{item.number}</span><span>↗</span></div><p className={styles.capabilityTag}>{item.tag}</p><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
      <div className={styles.platformRibbon}><span>MATTERS & DEADLINES</span><i /><span>SECURE EVIDENCE</span><i /><span>DOCUMENTS & ARGUMENTS</span><i /><span>REVIEWS & SIGN-OFF</span><i /><span>COMPLIANCE</span></div>
    </section>
    <section className={styles.changeSection} id="change-intelligence">
      <div className={styles.changeCopy}><div className={styles.sectionKicker}>03 / GLOBAL LEGAL CHANGE INTELLIGENCE</div><h2>The law never stands still.<br /><em>Neither should legal knowledge.</em></h2><p>Legislation is amended. Regulations are replaced. Commencement dates alter the legal position. Njumeni's Global Legal Change Intelligence is designed to watch official legal sources, compare changes and identify the research and work that may need attention.</p><ul className={styles.changeList}><li><span>01</span> Monitor authorised official legal sources</li><li><span>02</span> Detect and compare new or amended provisions</li><li><span>03</span> Track publication, commencement and repeal dates</li><li><span>04</span> Identify potentially affected research and documents</li><li><span>05</span> Route proposed updates through governed review</li></ul><p className={styles.qualification}>Jurisdiction coverage depends on source rights, activation, monitoring infrastructure and verification. No country is represented as current unless its sources have been successfully checked.</p></div>
      <LegalChangeVisual />
    </section>
    <section className={styles.audience} id="professionals">
      <div className={styles.sectionKicker}>04 / BUILT FOR LEGAL AND INSTITUTIONAL WORK</div>
      <div className={styles.sectionHeader}><h2>One legal intelligence platform.<br /><em>Different ways to work.</em></h2><p>Structured for individual research, professional teams and organisations with legal responsibilities.</p></div>
      <div className={styles.audienceGrid}>{audiences.map((item) => <article className={styles.audienceCard} key={item.title}><span>{item.mark}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
    </section>
    <section className={styles.trust} id="trust">
      <div className={styles.trustSeal}><svg viewBox="0 0 180 180" fill="none" aria-hidden="true"><circle cx="90" cy="90" r="77" /><circle cx="90" cy="90" r="65" /><path d="M90 45 121 58v27c0 24-13 40-31 51-18-11-31-27-31-51V58l31-13Z" /><path d="m75 88 10 10 21-24" /></svg><span>AUTHORITY<br />EVIDENCE<br />ACCOUNTABILITY</span></div>
      <div className={styles.trustCopy}><div className={styles.sectionKicker}>05 / TRUST & RESPONSIBILITY</div><h2>AI assists.<br /><em>Human judgement remains essential.</em></h2><p>Njumeni is designed to make legal research more transparent—not to replace the responsibility of qualified legal professionals. Sources, citations, limitations, review decisions and material changes should remain visible and accountable.</p><div className={styles.trustPoints}><span>Source provenance</span><span>Temporal accuracy</span><span>Human review</span><span>Organisational controls</span><span>Auditability</span></div></div>
    </section>
    <section className={styles.closing}><p className={styles.eyebrow}><span /> NJUMENI · GLOBAL LEGAL INTELLIGENCE</p><h2>The law changes.<br /><em>Knowledge must keep up.</em></h2><p>Bring legal research, professional work and changing legislation into one accountable environment.</p><Link href="/sign-in" className={styles.primaryButton}>Access the workspace <span>↗</span></Link><small>Access is provisioned through the approved account and membership process.</small></section>
    <footer className={styles.footer}><Link href="/" className={styles.brand}><NjumeniMark /><span><strong>NJUMENI</strong><small>GLOBAL LEGAL INTELLIGENCE</small></span></Link><p>Legal intelligence grounded in authority, evidence and accountable professional work.</p><div><a href="#research">Research</a><a href="#platform">Platform</a><a href="#change-intelligence">Global intelligence</a><Link href="/sign-in">Sign in</Link></div><small>© {new Date().getFullYear()} Njumeni. All rights reserved.</small></footer>
  </main>;
}
