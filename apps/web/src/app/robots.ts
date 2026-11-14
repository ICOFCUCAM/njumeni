import type { MetadataRoute } from 'next';
import { PAGES } from './(marketing)/site';

const BASE = (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// Only the public pages are indexable; the application itself stays out of search engines.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/early-access', ...Object.values(PAGES).map((p) => p.href)],
        disallow: ['/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
