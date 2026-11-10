'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ModuleIcon, type ModuleIconName } from '@/components/module-icon';
import { moduleRegistry } from '@/modules/registry';
import { signOut } from '@/app/(auth)/actions';

type NavigationItem = { label: string; href: string; icon: ModuleIconName };
const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  { label: 'Workspace', items: [{ label: 'Overview', href: '/dashboard', icon: 'grid' }] },
  {
    label: 'Intelligence',
    items: [
      { label: 'Legal intelligence', href: '/intelligence', icon: 'sparkles' },
      { label: 'Legal research', href: '/research', icon: 'search' },
      { label: 'Jurisdictions', href: '/jurisdictions', icon: 'globe' },
    ],
  },
  {
    label: 'Casework',
    items: [
      { label: 'Matters and cases', href: '/matters', icon: 'folder' },
      { label: 'Evidence', href: '/evidence', icon: 'file' },
      { label: 'Documents', href: '/documents', icon: 'file' },
      { label: 'Arguments', href: '/arguments', icon: 'scale' },
    ],
  },
  {
    label: 'Workspaces',
    items: [
      { label: 'Personal assistant', href: '/assistant', icon: 'user' },
      { label: 'Professional workspace', href: '/professional', icon: 'briefcase' },
      { label: 'Law firm and enterprise', href: '/organisation', icon: 'building' },
      { label: 'Institutional workspace', href: '/institutional', icon: 'landmark' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile settings', href: '/settings/profile', icon: 'user' },
      { label: 'Organisations and workspaces', href: '/settings/workspaces', icon: 'building' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Compliance and risk', href: '/compliance', icon: 'shield' },
      { label: 'Knowledge management', href: '/knowledge', icon: 'book' },
    ],
  },
];
function activeLabel(pathname: string) {
  if (pathname === '/dashboard') return 'Overview';
  if (pathname.startsWith('/settings/profile')) return 'Profile settings';
  if (pathname.startsWith('/settings/workspaces')) return 'Organisations and workspaces';
  return (
    moduleRegistry.find(
      (module) => pathname === module.href || pathname.startsWith(module.href + '/'),
    )?.shortLabel ?? 'Workspace'
  );
}
export function WorkspaceShell({
  children,
  userEmail,
  organizationName,
  workspaceName,
}: {
  children: ReactNode;
  userEmail: string;
  organizationName: string;
  workspaceName: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = activeLabel(pathname);
  return (
    <div className="app-shell">
      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={'sidebar' + (mobileOpen ? ' sidebar-open' : '')}
        aria-label="Main navigation"
      >
        <Link className="brand" href="/dashboard" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>
            <span className="brand-name">NJUMENI</span>
            <span className="brand-descriptor">Global Legal Intelligence</span>
          </span>
        </Link>
        <Link
          className="workspace-switcher"
          href="/settings/workspaces"
          aria-label={`Manage organisation ${organizationName} and workspace ${workspaceName}`}
          onClick={() => setMobileOpen(false)}
        >
          <span>
            <small>{organizationName}</small>
            <strong>{workspaceName}</strong>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--gold)' }}>
            ⌄
          </span>
        </Link>
        <nav className="nav-scroll">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
                return (
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={'nav-link' + (active ? ' nav-link-active' : '')}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="nav-icon">
                      <ModuleIcon name={item.icon} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            <strong>Law. Evidence. Intelligence.</strong>
          </p>
          <p>Structured legal work, with provenance at every step.</p>
        </div>
      </aside>
      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-expanded={mobileOpen}
              aria-label="Open navigation"
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <ModuleIcon name="menu" />
            </button>
            <span className="breadcrumb-label">Njumeni / {title}</span>
          </div>
          <div className="topbar-right">
            <span className="account-email" title={userEmail}>
              {userEmail}
            </span>
            <form action={signOut}>
              <button className="sign-out-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="content-wrap">{children}</main>
      </div>
    </div>
  );
}
