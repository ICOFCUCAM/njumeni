import type { ReactNode } from 'react';
export type ModuleIconName =
  | 'grid'
  | 'sparkles'
  | 'search'
  | 'file'
  | 'folder'
  | 'scale'
  | 'globe'
  | 'user'
  | 'briefcase'
  | 'building'
  | 'landmark'
  | 'shield'
  | 'book'
  | 'menu';
const paths: Record<ModuleIconName, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h8l4.5 4.5v12.5H6z" />
      <path d="M14 3.5V8h4.5M9 12h6M9 16h6" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 6.5h7l2 2h8v10.5h-17z" />
      <path d="M3.5 9h17" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="m5 7-3 6h6L5 7Zm14 0-3 6h6l-3-6Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c.6-3.2 3.1-5 7-5s6.4 1.8 7 5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" />
    </>
  ),
  building: (
    <>
      <path d="M4 20V5l8-2 8 2v15M2.5 20h19" />
      <path d="M8 8h1M15 8h1M8 12h1M15 12h1M11 20v-4h2v4" />
    </>
  ),
  landmark: (
    <>
      <path d="m3 8 9-5 9 5M4 9h16M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 19 6v5c0 4.5-2.6 7.7-7 10-4.4-2.3-7-5.5-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5c3.2-1.4 5.9-.9 8 1.2v14c-2.1-2.1-4.8-2.6-8-1.2z" />
      <path d="M20 5.5c-3.2-1.4-5.9-.9-8 1.2v14c2.1-2.1 4.8-2.6 8-1.2z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};
export function ModuleIcon({ name }: { name: ModuleIconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}
