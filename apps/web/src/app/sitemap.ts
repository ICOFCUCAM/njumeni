import type { MetadataRoute } from 'next';
import { PAGES } from './(marketing)/site';

const BASE = (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    ...Object.values(PAGES)
      .filter((p) => p.href !== '/privacy')
      .map((p) => ({
        url: `${BASE}${p.href}`,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
    { url: `${BASE}/early-access`, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
