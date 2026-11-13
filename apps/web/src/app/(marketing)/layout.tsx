import Link from 'next/link';
import './marketing.css';
import { SiteNav } from './section-nav';
import { PAGES } from './site';

const NAV = [
  PAGES.research,
  PAGES.workspace,
  PAGES.change,
  PAGES.jurisdictions,
  PAGES.solutions,
  PAGES.plans,
  PAGES.security,
];
const MORE = [PAGES.about, PAGES.documentation];

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="nj">
      <a className="nj-skip" href="#main">
        Skip to content
      </a>
      <aside aria-label="Announcement">
        <p className="nj-notice">
          Njumeni is opening to early-access organisations, starting with Norway.{' '}
          <Link href="/early-access">Request access</Link>
        </p>
      </aside>
      <header className="nj-header">
        <div className="nj-wrap nj-header-inner">
          <Link href="/" className="nj-brand" aria-label="Njumeni home">
            <span className="nj-brand-mark" aria-hidden="true">
              N
            </span>
            NJUMENI
          </Link>
          <SiteNav items={NAV} label="Main" className="nj-nav" />
          <div className="nj-header-actions">
            <Link href="/sign-in" className="nj-btn nj-btn--ghost nj-btn--sm nj-hide-md">
              Sign in
            </Link>
            <Link href="/early-access" className="nj-btn nj-btn--gold nj-btn--sm">
              Request early access
            </Link>
          </div>
          <details className="nj-menu">
            <summary>Menu</summary>
            <div className="nj-menu-panel">
              <SiteNav items={[...NAV, ...MORE]} label="Main (mobile)" className="nj-menu-nav" />
              <Link href="/early-access">Request early access</Link>
              <Link href="/sign-in">Sign in</Link>
            </div>
          </details>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="nj-footer">
        <div className="nj-wrap">
          <div className="nj-footer-grid nj-footer-grid--4">
            <div>
              <p className="nj-brand" style={{ marginBottom: 14 }}>
                <span className="nj-brand-mark" aria-hidden="true">
                  N
                </span>
                NJUMENI
              </p>
              <p style={{ maxWidth: 420, margin: 0 }}>
                AI assists. The law provides the authority. Qualified professionals retain
                responsibility for legal judgement.
              </p>
            </div>
            <div>
              <h2>Platform</h2>
              <ul>
                {[PAGES.research, PAGES.workspace, PAGES.change, PAGES.jurisdictions].map((p) => (
                  <li key={p.href}>
                    <Link href={p.href}>{p.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Njumeni</h2>
              <ul>
                {[PAGES.solutions, PAGES.security, PAGES.about, PAGES.documentation].map((p) => (
                  <li key={p.href}>
                    <Link href={p.href}>{p.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Access</h2>
              <ul>
                <li>
                  <Link href="/early-access">Request early access</Link>
                </li>
                <li>
                  <Link href="/early-access?interest=demonstration">Request a demonstration</Link>
                </li>
                <li>
                  <Link href="/plans">Plans</Link>
                </li>
                <li>
                  <Link href="/sign-in">Sign in</Link>
                </li>
              </ul>
            </div>
          </div>
          <p className="nj-footer-base">
            © 2026 Njumeni. Njumeni provides legal information and research tools. It is not a law
            firm and does not replace advice from a qualified lawyer.
          </p>
        </div>
      </footer>
    </div>
  );
}
