import Link from 'next/link';
import './marketing.css';

const NAV = [
  { href: '/#research', label: 'Research' },
  { href: '/#workspace', label: 'Workspace' },
  { href: '/#change-intelligence', label: 'Change intelligence' },
  { href: '/#international', label: 'Jurisdictions' },
  { href: '/#audiences', label: 'Who it serves' },
  { href: '/#plans', label: 'Plans' },
];

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="nj">
      <a className="nj-skip" href="#main">
        Skip to content
      </a>
      <p className="nj-notice">
        Njumeni is opening to early-access organisations, starting with Norway.{' '}
        <Link href="/early-access">Request access</Link>
      </p>
      <header className="nj-header">
        <div className="nj-wrap nj-header-inner">
          <Link href="/" className="nj-brand" aria-label="Njumeni home">
            <span className="nj-brand-mark" aria-hidden="true">
              N
            </span>
            NJUMENI
          </Link>
          <nav className="nj-nav" aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="nj-header-actions">
            <Link href="/sign-in" className="nj-btn nj-btn-ghost nj-btn-sm nj-hide-md">
              Sign in
            </Link>
            <Link href="/early-access" className="nj-btn nj-btn-gold nj-btn-sm">
              Request early access
            </Link>
          </div>
          <details className="nj-menu">
            <summary>Menu</summary>
            <nav className="nj-menu-panel" aria-label="Main (mobile)">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              <Link href="/early-access">Request early access</Link>
              <Link href="/sign-in">Sign in</Link>
            </nav>
          </details>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="nj-footer">
        <div className="nj-wrap">
          <div className="nj-footer-grid">
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
                <li>
                  <Link href="/#research">Legal research</Link>
                </li>
                <li>
                  <Link href="/#change-intelligence">Global Legal Change Intelligence</Link>
                </li>
                <li>
                  <Link href="/#workspace">Professional workspace</Link>
                </li>
                <li>
                  <Link href="/#evidence">Evidence and custody</Link>
                </li>
                <li>
                  <Link href="/#international">Jurisdictions</Link>
                </li>
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
                  <Link href="/#plans">Plans</Link>
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
