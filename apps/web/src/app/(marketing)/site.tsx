import Link from 'next/link';

// Shared building blocks for the public site: status labels, kickers, the page introduction,
// related-page links and the closing call to action. Server components; no client JavaScript.

export type Status = 'built' | 'awaiting' | 'developing' | 'planned';
const STATUS: Record<Status, string> = {
  built: 'Built',
  awaiting: 'Awaiting activation',
  developing: 'In development',
  planned: 'Planned',
};

export function Tag({ status }: { status: Status }) {
  return <span className={`nj-tag nj-tag--${status}`}>{STATUS[status]}</span>;
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="nj-kicker">{children}</p>;
}

// The public pages, in navigation order. One source for the header, footer and related links.
export const PAGES = {
  research: {
    href: '/platform/research',
    label: 'Research',
    blurb: 'Answers from the law in force on your date, quoted and cited.',
  },
  workspace: {
    href: '/platform/workspace',
    label: 'Workspace',
    blurb: 'Matters, evidence, arguments, documents and review.',
  },
  change: {
    href: '/platform/change-intelligence',
    label: 'Change intelligence',
    blurb: 'How a change in the law reaches the work that relied on it.',
  },
  jurisdictions: {
    href: '/platform/jurisdictions',
    label: 'Jurisdictions',
    blurb: 'The legal systems in the framework, and what each one has.',
  },
  solutions: {
    href: '/solutions',
    label: 'Who it serves',
    blurb: 'Individuals, legal professionals, firms, enterprises and institutions.',
  },
  plans: { href: '/plans', label: 'Plans', blurb: 'Allowances by plan, from free to contracted.' },
  security: {
    href: '/security',
    label: 'Security',
    blurb: 'Isolation, permissions, barriers, custody and audit.',
  },
  about: { href: '/about', label: 'About', blurb: 'Mission, principles and responsibility.' },
  documentation: {
    href: '/documentation',
    label: 'Documentation',
    blurb: 'Guides, technical notes and API resources.',
  },
} as const;
export type PageKey = keyof typeof PAGES;

export function PageIntro({
  kicker,
  title,
  lead,
  tone = 'navy',
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  lead: string;
  tone?: 'navy' | 'ivory';
  children?: React.ReactNode;
}) {
  return (
    <section className={`nj-intro nj-intro--${tone}`} aria-labelledby="page-title">
      <div className="nj-wrap nj-intro-grid">
        <div>
          <Kicker>{kicker}</Kicker>
          <h1 id="page-title">{title}</h1>
        </div>
        <div className="nj-intro-side">
          <p className="nj-intro-lead">{lead}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function Related({
  keys,
  title = 'Continue exploring',
}: {
  keys: PageKey[];
  title?: string;
}) {
  return (
    <section className="nj-related" aria-labelledby="related-title">
      <div className="nj-wrap">
        <h2 id="related-title" className="nj-related-title">
          {title}
        </h2>
        <ul className="nj-related-list">
          {keys.map((k) => (
            <li key={k}>
              <Link href={PAGES[k].href}>
                <b>{PAGES[k].label}</b>
                <span>{PAGES[k].blurb}</span>
                <i aria-hidden="true">→</i>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CtaBand({
  title = 'Bring Njumeni to your organisation.',
  text = 'Njumeni is opening to early-access organisations, jurisdiction by jurisdiction, starting with Norway.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="nj-s nj-final nj-cta-band" aria-labelledby="cta-title">
      <div className="nj-wrap">
        <h2 id="cta-title" className="nj-final-statement">
          {title}
        </h2>
        <p className="nj-lead">{text}</p>
        <div className="nj-ctas">
          <Link href="/early-access" className="nj-btn nj-btn--gold">
            Request early access
          </Link>
          <Link href="/early-access?interest=demonstration" className="nj-btn nj-btn--ghost">
            Request a demonstration
          </Link>
        </div>
      </div>
    </section>
  );
}
