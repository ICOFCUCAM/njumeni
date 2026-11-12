import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMonitorFailure, fingerprintOf, httpFailure, MonitorError, runMonitorCycle } from '../src/modules/glci/monitor.ts';
import { createLovdataListingMonitor, LOVDATA_LISTING_URL } from '../src/modules/glci/monitors/lovdata-listing.ts';
import { glciMonitorAdapters } from '../src/modules/glci/monitors/registry.ts';

// Shape of https://api.lovdata.no/v1/publicData/list as read on 2026-11-12 (sizeBytes are strings).
const LISTING = [
  { filename: 'lovtidend-avd1-2026.tar.bz2', description: 'Norsk Lovtidend avd. I - lover og sentrale forskrifter', sizeBytes: '1668325', lastModified: '2026-11-12T02:30:00Z' },
  { filename: 'gjeldende-sentrale-forskrifter.tar.bz2', description: 'Gjeldende sentrale forskrifter, ajourført med endringer', sizeBytes: '21528305', lastModified: '2026-11-12T02:32:00Z' },
  { filename: 'gjeldende-lover.tar.bz2', description: 'Gjeldende lover, ajourført med endringer', sizeBytes: '5809848', lastModified: '2026-11-11T02:32:00Z' },
];
const target = (extra = {}) => ({ targetKey: 'no-lovdata-current-laws', jurisdictionCode: 'NO', monitorAdapterKey: 'lovdata-public-data-listing',
  officialUri: LOVDATA_LISTING_URL, config: { dataset: 'gjeldende-lover.tar.bz2' }, sourceKey: 'lovdata-official', previousFingerprint: null,
  leaseToken: '00000000-0000-4000-8000-000000000001', ...extra });
const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'function' ? body() : body) });

test('the Lovdata listing monitor fingerprints the dataset and only calls the API', async () => {
  const calls = [];
  const monitor = createLovdataListingMonitor();
  const fetch = async (url, init) => { calls.push([url, init.headers.accept]); return respond(200, LISTING)(); };
  const first = await monitor.check(target(), fetch);
  assert.equal(first.fingerprint, fingerprintOf(['gjeldende-lover.tar.bz2', 5809848, '2026-11-11T02:32:00.000Z']));
  assert.deepEqual(first.observed, { dataset: 'gjeldende-lover.tar.bz2', sizeBytes: 5809848, lastModified: '2026-11-11T02:32:00.000Z',
    description: 'Gjeldende lover, ajourført med endringer', listedDatasets: 3 });
  assert.deepEqual(calls, [[LOVDATA_LISTING_URL, 'application/json']]);
  const republished = LISTING.map(item => item.filename === 'gjeldende-lover.tar.bz2' ? { ...item, lastModified: '2026-11-13T02:32:00Z' } : item);
  assert.notEqual((await monitor.check(target(), respond(200, republished))).fingerprint, first.fingerprint, 'a republished dataset changes the fingerprint');
  const other = LISTING.map(item => item.filename === 'lovtidend-avd1-2026.tar.bz2' ? { ...item, sizeBytes: '9' } : item);
  assert.equal((await monitor.check(target(), respond(200, other))).fingerprint, first.fingerprint, 'other datasets do not affect it');
});

test('format changes are integration failures; outages are unreachable; licence limits hold', async () => {
  const monitor = createLovdataListingMonitor();
  const failure = async (promise) => { try { await promise; } catch (error) { return classifyMonitorFailure(error); } assert.fail('no error'); };
  assert.deepEqual(await failure(monitor.check(target(), respond(200, { files: LISTING }))), { code: 'LOVDATA_LISTING_SCHEMA_CHANGED', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(monitor.check(target(), respond(200, LISTING.filter(i => i.filename !== 'gjeldende-lover.tar.bz2')))),
    { code: 'LOVDATA_DATASET_NOT_LISTED', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(monitor.check(target(), respond(200, [{ filename: 'gjeldende-lover.tar.bz2', sizeBytes: 'big', lastModified: 'x' }]))),
    { code: 'LOVDATA_LISTING_SCHEMA_CHANGED', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(monitor.check(target(), respond(200, () => { throw new SyntaxError('bad json'); }))),
    { code: 'LOVDATA_LISTING_NOT_JSON', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(monitor.check(target(), respond(503, null))), { code: 'UPSTREAM_5XX', failureClass: 'unreachable' });
  assert.deepEqual(await failure(monitor.check(target(), respond(404, null))), { code: 'MONITOR_ENDPOINT_GONE', failureClass: 'integration_failure' });
  assert.deepEqual(await failure(monitor.check(target(), async () => { throw new TypeError('fetch failed'); })), { code: 'NETWORK_UNREACHABLE', failureClass: 'unreachable' });
  assert.deepEqual(await failure(monitor.check(target({ config: { dataset: 'lovtidend-avd1-2026.tar.bz2' } }), respond(200, LISTING))),
    { code: 'LEGAL_SOURCE_LICENCE_DATASET_NOT_PERMITTED', failureClass: 'failed' }, 'a dataset outside the licence policy is not monitored');
  assert.deepEqual(await failure(monitor.check(target({ officialUri: 'https://lovdata.no/' }), respond(200, LISTING))),
    { code: 'LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED', failureClass: 'failed' }, 'the website is never monitored');
  assert.equal(httpFailure(429).failureClass, 'unreachable');
  assert.equal(new MonitorError('X', 'failed').failureClass, 'failed');
});

test('a monitoring cycle records every result, including targets without an adapter', async () => {
  const recorded = [];
  const persistence = {
    claim: async () => [target(), target({ targetKey: 'no-other', monitorAdapterKey: 'unknown-adapter' })],
    record: async input => { recorded.push(input); return input.fingerprint ? 'first_seen' : input.failureClass; },
  };
  let clock = 1000;
  const result = await runMonitorCycle({ workerId: 'w1', persistence, adapters: glciMonitorAdapters, fetch: respond(200, LISTING), now: () => (clock += 25) });
  assert.equal(result.claimed, 2);
  assert.deepEqual(result.outcomes, [{ targetKey: 'no-lovdata-current-laws', outcome: 'first_seen' }, { targetKey: 'no-other', outcome: 'integration_failure' }]);
  assert.equal(recorded[0].failureCode, null);
  assert.equal(recorded[0].durationMs, 25);
  assert.deepEqual([recorded[1].failureCode, recorded[1].failureClass, recorded[1].fingerprint], ['MONITOR_ADAPTER_NOT_REGISTERED', 'integration_failure', null]);
});
