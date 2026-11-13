'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export interface NavLink {
  href: string;
  label: string;
  blurb?: string;
}
export type NavItem = NavLink | { label: string; group: NavLink[] };

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

// Desktop navigation: direct links and disclosure menus. A menu opens on click or keyboard,
// closes on Escape, on an outside click and on navigation; the current page is marked.
export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <nav className="nj-nav" aria-label="Main" ref={ref}>
      {items.map((item) => {
        if (!('group' in item)) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        }
        const id = `menu-${item.label.toLowerCase()}`;
        const active = item.group.some((g) => isCurrent(pathname, g.href));
        const expanded = open === item.label;
        return (
          <div key={item.label} className="nj-nav-group">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={id}
              className={active ? 'is-active' : undefined}
              onClick={() => setOpen(expanded ? null : item.label)}
            >
              {item.label}
              <span aria-hidden="true" className="nj-nav-caret" />
            </button>
            <div id={id} className="nj-nav-panel" hidden={!expanded}>
              <ul>
                {item.group.map((g) => (
                  <li key={g.href}>
                    <Link
                      href={g.href}
                      aria-current={isCurrent(pathname, g.href) ? 'page' : undefined}
                    >
                      <b>{g.label}</b>
                      {g.blurb ? <span>{g.blurb}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// Mobile menu content: the same structure, grouped under headings.
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="nj-menu-nav" aria-label="Main (mobile)">
      {items.map((item) =>
        'group' in item ? (
          <div key={item.label} className="nj-menu-group">
            <p>{item.label}</p>
            {item.group.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                aria-current={isCurrent(pathname, g.href) ? 'page' : undefined}
              >
                {g.label}
              </Link>
            ))}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
