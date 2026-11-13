'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Site navigation: every item is its own page; the current page is marked.
export function SiteNav({
  items,
  label,
  className,
}: {
  items: readonly { href: string; label: string }[];
  label: string;
  className: string;
}) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label={label}>
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={current ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
