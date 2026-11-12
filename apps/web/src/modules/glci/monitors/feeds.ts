// GLCI-10: generic monitors for official publishers' listings (Atom, RSS, JSON APIs).
//
// Each target configures its own feed (config.feedUrl or config.listUrl) and, for JSON, the field
// mapping (itemsPath, idField, dateField). A monitor fingerprints the newest items, so a new
// publication or an update changes the fingerprint; the ingestion side then fetches the texts.
// Guards:
// - the feed URL must be https and on the target's official host (as the database also enforces);
// - anything that does not parse as the configured format is an integration failure, not "no change";
// - an empty feed is an integration failure too: an official listing never legitimately empties.
import { createHash } from 'node:crypto';
import { httpFailure, MonitorError, type MonitorAdapter, type MonitorFetch, type MonitorTarget } from '../monitor.ts';

const USER_AGENT = 'njumeni-glci-monitor/1.0 (+https://github.com/ICOFCUCAM/njumeni)';
const MAX_ITEMS = 100;
const MAX_BODY = 5 * 1024 * 1024;

interface FeedItem { id: string; date: string | null; title: string | null; link: string | null }

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** The configured listing URL, refused unless it is https on the target's official host. */
export function listingUrl(target: MonitorTarget, key: 'feedUrl' | 'listUrl'): string {
  const url = typeof target.config[key] === 'string' ? (target.config[key] as string) : '';
  const host = hostOf(url);
  if (!host || !target.officialUri || host !== hostOf(target.officialUri)) {
    throw new MonitorError('GLCI_FEED_URL_NOT_ON_OFFICIAL_HOST', 'failed');
  }
  return url;
}

function maxItems(target: MonitorTarget): number {
  const n = Number(target.config.maxItems ?? 50);
  return Number.isInteger(n) && n >= 1 && n <= MAX_ITEMS ? n : 50;
}

export function fingerprintItems(items: readonly FeedItem[]): string {
  const canonical = items.map(item => `${item.id}\u001f${item.date ?? ''}`).sort().join('\u001e');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function decodeEntities(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
}
function element(block: string, name: string): string | null {
  const match = new RegExp(`<(?:[a-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${name}>`, 'i').exec(block);
  return match ? decodeEntities(match[1]!) : null;
}
function linkHref(block: string): string | null {
  const alternate = /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block) ?? /<link\b[^>]*href=["']([^"']+)["']/i.exec(block);
  return alternate ? decodeEntities(alternate[1]!) : null;
}

export function parseAtom(xml: string): FeedItem[] {
  if (!/<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml)) throw new MonitorError('GLCI_FEED_NOT_ATOM', 'integration_failure');
  return [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(([block]) => {
    const id = element(block, 'id');
    if (!id) throw new MonitorError('GLCI_FEED_ENTRY_WITHOUT_ID', 'integration_failure');
    return { id, date: element(block, 'updated') ?? element(block, 'published'), title: element(block, 'title'), link: linkHref(block) };
  });
}

export function parseRss(xml: string): FeedItem[] {
  if (!/<rss\b[^>]*version=["']2\.0["']/i.test(xml) && !/<rdf:RDF\b/i.test(xml)) throw new MonitorError('GLCI_FEED_NOT_RSS', 'integration_failure');
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([block]) => {
    const id = element(block, 'guid') ?? element(block, 'link');
    if (!id) throw new MonitorError('GLCI_FEED_ITEM_WITHOUT_ID', 'integration_failure');
    return { id, date: element(block, 'pubDate') ?? element(block, 'date'), title: element(block, 'title'), link: element(block, 'link') };
  });
}

function pathValue(value: unknown, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((current, key) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined), value);
}
export function parseJsonListing(body: unknown, config: Record<string, unknown>): FeedItem[] {
  const itemsPath = typeof config.itemsPath === 'string' ? config.itemsPath : '';
  const idField = typeof config.idField === 'string' ? config.idField : '';
  if (!idField) throw new MonitorError('GLCI_FEED_MAPPING_MISSING', 'failed');
  const items = itemsPath ? pathValue(body, itemsPath) : body;
  if (!Array.isArray(items)) throw new MonitorError('GLCI_FEED_ITEMS_NOT_FOUND', 'integration_failure');
  const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);
  return items.map(item => {
    const id = text(pathValue(item, idField));
    if (!id) throw new MonitorError('GLCI_FEED_ITEM_WITHOUT_ID', 'integration_failure');
    return {
      id,
      date: typeof config.dateField === 'string' ? text(pathValue(item, config.dateField)) : null,
      title: typeof config.titleField === 'string' ? text(pathValue(item, config.titleField)) : null,
      link: typeof config.linkField === 'string' ? text(pathValue(item, config.linkField)) : null,
    };
  });
}

async function fetchListing(fetch: MonitorFetch, url: string, accept: string, timeoutMs: number) {
  const response = await fetch(url, { headers: { accept, 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw httpFailure(response.status);
  return response;
}

function observed(items: FeedItem[], total: number) {
  return {
    items: total,
    newest: items.slice(0, 5).map(item => ({ id: item.id.slice(0, 300), date: item.date, title: item.title?.slice(0, 300) ?? null, link: item.link?.slice(0, 500) ?? null })),
  };
}

function textAdapter(key: 'atom-feed' | 'rss-feed', parse: (xml: string) => FeedItem[], timeoutMs: number): MonitorAdapter {
  return {
    key,
    async check(target, fetch) {
      const url = listingUrl(target, 'feedUrl');
      const response = await fetchListing(fetch, url, 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.1', timeoutMs);
      if (typeof response.text !== 'function') throw new MonitorError('GLCI_FEED_NOT_TEXT', 'failed');
      const xml = await response.text();
      if (xml.length > MAX_BODY) throw new MonitorError('GLCI_FEED_TOO_LARGE', 'integration_failure');
      const items = parse(xml);
      if (items.length === 0) throw new MonitorError('GLCI_FEED_EMPTY', 'integration_failure');
      const newest = items.slice(0, maxItems(target));
      return { fingerprint: fingerprintItems(newest), observed: observed(newest, items.length) };
    },
  };
}

export function createAtomFeedMonitor(options: { timeoutMs?: number } = {}): MonitorAdapter {
  return textAdapter('atom-feed', parseAtom, options.timeoutMs ?? 60_000);
}
export function createRssFeedMonitor(options: { timeoutMs?: number } = {}): MonitorAdapter {
  return textAdapter('rss-feed', parseRss, options.timeoutMs ?? 60_000);
}
export function createJsonListingMonitor(options: { timeoutMs?: number } = {}): MonitorAdapter {
  return {
    key: 'json-listing',
    async check(target, fetch) {
      const url = listingUrl(target, 'listUrl');
      const response = await fetchListing(fetch, url, 'application/json', options.timeoutMs ?? 60_000);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new MonitorError('GLCI_FEED_NOT_JSON', 'integration_failure');
      }
      const items = parseJsonListing(body, target.config);
      if (items.length === 0) throw new MonitorError('GLCI_FEED_EMPTY', 'integration_failure');
      const newest = items.slice(0, maxItems(target));
      return { fingerprint: fingerprintItems(newest), observed: observed(newest, items.length) };
    },
  };
}
