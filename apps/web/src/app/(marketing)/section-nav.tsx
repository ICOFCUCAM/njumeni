'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Main navigation that marks the section being read. Only on the homepage; elsewhere the links
// behave as ordinary links.
export function SectionNav({ items }: { items: { href: string; label: string }[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const ids = items.map((i) => i.href.split('#')[1]).filter(Boolean) as string[];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);
  return (
    <nav className="nj-nav" aria-label="Main">
      {items.map((item) => {
        const id = item.href.split('#')[1];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={id && id === current ? 'location' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
