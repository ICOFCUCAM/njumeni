import type { MetadataRoute } from 'next';

const BASE = (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/early-access`, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
