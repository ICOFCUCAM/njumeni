import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMonitorFailure } from '../src/modules/glci/monitor.ts';
import { createAtomFeedMonitor, createJsonListingMonitor, createRssFeedMonitor, fingerprintItems, parseAtom, parseJsonListing, parseRss } from '../src/modules/glci/monitors/feeds.ts';
import { glciMonitorAdapters } from '../src/modules/glci/monitors/registry.ts';

// Synthetic samples in the standard formats (the live formats are confirmed per target before activation).
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>New legislation</title>
<entry><id>http://www.legislation.gov.uk/uksi/2026/1201</id><title>The Example Regulations 2026</title><updated>2026-11-12T10:00:00Z</updated>
<link rel="alternate" href="https://www.legislation.gov.uk/uksi/2026/1201"/></entry>
<entry><id>http://www.legislation.gov.uk/ukpga/2026/30</id><title>Example Act 2026 &amp; Co</title><updated>2026-11-11T09:00:00Z</updated></entry></feed>`;
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>OJ L</title>
<item><guid>CELEX:32026R1234</guid><title><![CDATA[Regulation (EU) 2026/1234]]></title><link>https://eur-lex.europa.eu/eli/reg/2026/1234/oj</link><pubDate>Thu, 12 Nov 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;
const JSON_BODY = { count: 2, results: [
  { document_number: '2026-24811', title: 'Example Rule', html_url: 'https://www.federalregister.gov/d/2026-24811', publication_date: '2026-11-12' },
  { document_number: '2026-24790', title: 'Another Rule', publication_date: '2026-11-12' }] };
const target = (extra = {}) => ({ targetKey: 't', jurisdictionCode: 'GB', monitorAdapterKey: 'atom-feed', officialUri: 'https://www.legislation.gov.uk/',
  config: { feedUrl: 'https://www.legislation.gov.uk/new/data.feed' }, sourceKey: null, previousFingerprint: null, leaseToken: 'x', ...extra });
const textResponse = (body, status = 200) => async () => ({ ok: status < 300, status, json: async () => JSON.parse(body), text: async () => body });
const failure = async (promise) => { try { await promise; } catch (error) { return classifyMonitorFailure(error); } assert.fail('expected a failure'); };

test('Atom, RSS and JSON listings are parsed into items', () => {
  const atom = parseAtom(ATOM);
  assert.deepEqual(atom.map(i => [i.id, i.date]), [['http://www.legislation.gov.uk/uksi/2026/1201', '2026-11-12T10:00:00Z'], ['http://www.legislation.gov.uk/ukpga/2026/30', '2026-11-11T09:00:00Z']]);
  assert.equal(atom[1].title, 'Example Act 2026 & Co');
  assert.equal(atom[0].link, 'https://www.legislation.gov.uk/uksi/2026/1201');
  assert.deepEqual(parseRss(RSS).map(i => [i.id, i.title]), [['CELEX:32026R1234', 'Regulation (EU) 2026/1234']]);
  assert.deepEqual(parseJsonListing(JSON_BODY, { itemsPath: 'results', idField: 'document_number', dateField: 'publication_date' }).map(i => i.id), ['2026-24811', '2026-24790']);
  assert.equal(fingerprintItems(atom), fingerprintItems([...atom].reverse()), 'the fingerprint does not depend on order');
});

test('a new publication changes the fingerprint; the same listing does not', async () => {
  const monitor = createAtomFeedMonitor();
  const first = await monitor.check(target(), textResponse(ATOM));
  assert.equal((await monitor.check(target(), textResponse(ATOM))).fingerprint, first.fingerprint);
  const more = ATOM.replace('<entry>', '<entry><id>http://www.legislation.gov.uk/uksi/2026/1202</id><updated>2026-11-12T11:00:00Z</updated></entry><entry>');
  assert.notEqual((await monitor.check(target(), textResponse(more))).fingerprint, first.fingerprint);
  assert.equal(first.observed.items, 2);
  const json = await createJsonListingMonitor().check(target({ monitorAdapterKey: 'json-listing', officialUri: 'https://www.federalregister.gov/',
    config: { listUrl: 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest', itemsPath: 'results', idField: 'document_number', dateField: 'publication_date' } }),
    async () => ({ ok: true, status: 200, json: async () => JSON_BODY }));
  assert.equal(json.observed.newest[0].id, '2026-24811');
});

test('format changes are integration failures; off-host URLs are refused', async () => {
  const atom = createAtomFeedMonitor();
  assert.deepEqual(await failure(atom.check(target(), textResponse('<html>Maintenance</html>'))), { code: 'GLCI_FEED_NOT_ATOM', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(atom.check(target(), textResponse('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'))), { code: 'GLCI_FEED_EMPTY', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(atom.check(target({ config: { feedUrl: 'https://evil.example/feed' } }), textResponse(ATOM))), { code: 'GLCI_FEED_URL_NOT_ON_OFFICIAL_HOST', failureClass: 'failed' });
  assert.deepEqual(await failure(atom.check(target(), textResponse('', 503))), { code: 'UPSTREAM_5XX', failureClass: 'unreachable' });
  assert.deepEqual(await failure(createRssFeedMonitor().check(target({ config: { feedUrl: 'https://www.legislation.gov.uk/rss' } }), textResponse(ATOM))), { code: 'GLCI_FEED_NOT_RSS', failureClass: 'integration_failure' });
  const json = createJsonListingMonitor();
  const jsonTarget = target({ officialUri: 'https://www.federalregister.gov/', config: { listUrl: 'https://www.federalregister.gov/api', itemsPath: 'results', idField: 'document_number' } });
  assert.deepEqual(await failure(json.check(jsonTarget, async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }))), { code: 'GLCI_FEED_ITEMS_NOT_FOUND', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(json.check(jsonTarget, async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }))), { code: 'GLCI_FEED_NOT_JSON', failureClass: 'integration_failure' });
  assert.deepEqual(glciMonitorAdapters.map(a => a.key), ['lovdata-public-data-listing', 'atom-feed', 'rss-feed', 'json-listing']);
});
