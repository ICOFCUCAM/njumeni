import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOVDATA_LICENCE_POLICY,
  assertAcquisitionPermitted,
  assertTrainingExportPermitted,
  assertUsePermitted,
  licencePermitsUse,
  parseLicencePolicy,
} from '../src/modules/legal-knowledge/licence-policy.ts';
import {
  LOVDATA_LICENSED_DATASETS,
  assertLovdataDatasetLicensed,
  createLovdataHttpArchiveSource,
  decodeLovdataArchive,
} from '../src/modules/legal-knowledge/lovdata-archive.ts';
import { lovdataArchiveSourceFromEnv, LOVDATA_ADAPTER_VERSION } from '../src/modules/legal-knowledge/lovdata-adapter.ts';
import { executeLegalIngestionBatch } from '../src/modules/legal-knowledge/worker.ts';

// ------------------------------------------------------------------ licence policy
test('the Lovdata policy is NLOD 2.0 for the API datasets: RAG and commercial use yes, training no', () => {
  assert.equal(LOVDATA_LICENCE_POLICY.licenceIdentifier, 'NLOD-2.0');
  assert.deepEqual([...LOVDATA_LICENCE_POLICY.acquisitionHosts], ['api.lovdata.no']);
  assert.deepEqual([...LOVDATA_LICENSED_DATASETS], ['gjeldende-lover.tar.bz2', 'gjeldende-sentrale-forskrifter.tar.bz2']);
  for (const use of ['retrieval_augmented_generation', 'commercial_use', 'display', 'quotation', 'redistribution']) {
    assert.equal(licencePermitsUse(LOVDATA_LICENCE_POLICY, use), true, use);
  }
  for (const use of ['model_training', 'model_fine_tuning', 'website_scraping']) {
    assert.equal(licencePermitsUse(LOVDATA_LICENCE_POLICY, use), false, use);
    assert.throws(() => assertUsePermitted(LOVDATA_LICENCE_POLICY, use), /LEGAL_SOURCE_USE_NOT_PERMITTED/);
  }
  assert.match(LOVDATA_LICENCE_POLICY.attributionText, /NLOD\) 2\.0 tilgjengeliggjort av Lovdata/);
});

test('a source without a policy keeps its own rules and is never permitted for training or scraping', () => {
  assert.equal(licencePermitsUse(null, 'retrieval_augmented_generation'), true);
  assert.equal(licencePermitsUse(null, 'model_training'), false);
  assert.equal(licencePermitsUse(null, 'model_fine_tuning'), false);
  assert.equal(licencePermitsUse(null, 'website_scraping'), false);
  assert.throws(() => licencePermitsUse(null, 'resale'), /USE_UNKNOWN/);
  assert.throws(() => assertTrainingExportPermitted([
    { sourceKey: 'eur-lex', policy: null },
    { sourceKey: 'lovdata-official', policy: LOVDATA_LICENCE_POLICY },
  ], 'model_fine_tuning'), /USE_NOT_PERMITTED/);
});

test('acquisition is limited to the API host and the licensed datasets', () => {
  const api = 'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2';
  assert.doesNotThrow(() => assertAcquisitionPermitted(LOVDATA_LICENCE_POLICY, { uri: api, dataset: 'gjeldende-lover.tar.bz2' }));
  assert.throws(() => assertAcquisitionPermitted(LOVDATA_LICENCE_POLICY,
    { uri: 'https://lovdata.no/dokument/NL/lov/2005-06-17-62', dataset: 'gjeldende-lover.tar.bz2' }), /HOST_NOT_PERMITTED/);
  assert.throws(() => assertAcquisitionPermitted(LOVDATA_LICENCE_POLICY,
    { uri: 'http://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2', dataset: 'gjeldende-lover.tar.bz2' }), /HOST_NOT_PERMITTED/);
  assert.throws(() => assertAcquisitionPermitted(LOVDATA_LICENCE_POLICY,
    { uri: 'https://api.lovdata.no/v1/publicData/get/lovtidend.tar.bz2', dataset: 'lovtidend.tar.bz2' }), /DATASET_NOT_PERMITTED/);
  assert.throws(() => assertAcquisitionPermitted(LOVDATA_LICENCE_POLICY, { uri: api, dataset: null }), /DATASET_NOT_PERMITTED/);
});

test('the database policy JSON parses and malformed policies are rejected', () => {
  const json = {
    sourceKey: 'lovdata-official', policyVersion: 1, licenceIdentifier: 'NLOD-2.0', licenceUri: LOVDATA_LICENCE_POLICY.licenceUri,
    attributionText: LOVDATA_LICENCE_POLICY.attributionText, acquisitionHosts: ['api.lovdata.no'],
    permittedDatasets: [...LOVDATA_LICENSED_DATASETS], permittedUses: { ...LOVDATA_LICENCE_POLICY.permittedUses },
    conditions: [...LOVDATA_LICENCE_POLICY.conditions], evidenceUris: [...LOVDATA_LICENCE_POLICY.evidenceUris],
  };
  assert.deepEqual(parseLicencePolicy(json).permittedUses, LOVDATA_LICENCE_POLICY.permittedUses);
  assert.equal(parseLicencePolicy(null), null);
  assert.throws(() => parseLicencePolicy({ ...json, permittedUses: { model_training: 'yes' } }), /POLICY_INVALID/);
});

test('the adapter reads only licensed datasets from the API', async () => {
  assert.equal(LOVDATA_ADAPTER_VERSION, '1.1.0');
  assert.doesNotThrow(() => assertLovdataDatasetLicensed('gjeldende-sentrale-forskrifter.tar.bz2'));
  assert.throws(() => assertLovdataDatasetLicensed('lovtidend-avd1-2001-2025.tar.bz2'), /DATASET_NOT_PERMITTED/);
  assert.throws(() => createLovdataHttpArchiveSource({ filename: 'lovtidend-avd1-2001-2025.tar.bz2' }), /DATASET_NOT_PERMITTED/);
  assert.throws(() => lovdataArchiveSourceFromEnv({ LOVDATA_DATASET: 'lovtidend-avd1-2001-2025.tar.bz2' }), /DATASET_NOT_PERMITTED/);
  assert.ok(lovdataArchiveSourceFromEnv({ LOVDATA_DATASET: 'gjeldende-sentrale-forskrifter.tar.bz2' }));
  await assert.rejects(decodeLovdataArchive({
    filename: 'other-data.tar.bz2', compressed: new Uint8Array([0x42, 0x5a, 0x68]), expectedSizeBytes: null,
    lastModified: null, retrievedAt: '2026-11-12T00:00:00.000Z', loadDecoder: async () => x => x,
  }), /DATASET_NOT_PERMITTED/);
  const calls = [];
  const fetch = async url => { calls.push(url); return { ok: false, status: 503, json: async () => [], arrayBuffer: async () => new ArrayBuffer(0) }; };
  await assert.rejects(createLovdataHttpArchiveSource({ filename: 'gjeldende-lover.tar.bz2', fetch }).load(), /UPSTREAM_5XX/);
  assert.ok(calls.every(url => url.startsWith('https://api.lovdata.no/v1/publicData/')), 'only the API is contacted');
});

// ------------------------------------------------------------------ incremental sync and retries
const manifest = { sourceKey: 'lovdata-official', name: 'Lovdata', issuingAuthority: 'Lovdata', jurisdictionCode: 'NO', sourceType: 'legislation',
  baseUri: 'https://lovdata.no/', allowedHosts: ['lovdata.no'], accessMethod: 'bulk_download', adapterKey: 'lovdata-public-data', adapterVersion: '1.1.0' };
const rights = { rightsStatus: 'approved', sourceStatus: 'active', ingestionEnabled: true, licenceIdentifier: 'NLOD-2.0', attributionText: 'Attribution' };
const rightsEvidence = { sourceKey: 'lovdata-official', licenceIdentifier: 'NLOD-2.0', licenceVersion: '2.0', termsUri: 'https://api.lovdata.no/',
  attributionText: 'Attribution', reviewedBy: 'reviewer', reviewedAt: '2026-11-01T10:00:00.000Z',
  permissions: { retrieve: true, store: true, normalise: true, index: true, quote: true, display: true, redistribute: true },
  restrictions: [], reviewExpiresAt: '2027-11-01T10:00:00.000Z' };
const API = 'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2';

function harness({ ids = ['NL/lov/1', 'NL/lov/2'], sha = 'a'.repeat(64), lastSha = null, retries = [], failIds = [] } = {}) {
  const log = { appended: [], outcomes: [], syncs: [], listed: 0 };
  const adapter = {
    manifest,
    listChangedAuthorities: async () => { log.listed++; return { externalIds: ids, nextCursor: null, complete: true }; },
    fetchAuthority: async id => {
      if (failIds.includes(id)) throw new Error('NETWORK_TIMEOUT');
      return { authority: { externalId: id, title: 'Act ' + id, authorityType: 'act', metadata: { dataset: 'gjeldende-lover.tar.bz2' } },
        sourceText: 'Text of ' + id, retrievedAt: '2026-11-12T08:00:00.000Z', sourceUri: API + '#' + id };
    },
    datasetSnapshot: async () => ({ dataset: 'gjeldende-lover.tar.bz2', sha256: sha, sizeBytes: 100, lastModified: '2026-11-11T02:32:00.000Z',
      retrievedAt: '2026-11-12T08:00:00.000Z', sourceUri: API, externalIds: ids }),
  };
  const persistence = {
    beginRun: async () => ({ runId: 'run-1' }),
    appendAuthority: async value => { log.appended.push(value.authority.externalId); return 'created'; },
    persistRunResult: async () => {},
    dueItemRetries: async () => retries,
    recordItemOutcome: async value => { log.outcomes.push(value); return value.succeeded ? 'resolved' : 'pending'; },
    lastDatasetSync: async () => (lastSha ? { datasetSha256: lastSha } : null),
    completeDatasetSync: async value => { log.syncs.push(value.snapshot); return { authoritiesAbsent: 0 }; },
  };
  const run = (cursor = null) => executeLegalIngestionBatch({ adapter, persistence, cursor, normalisationProfile: 'lovdata-nl-html-v1',
    loadRights: async () => ({ rights, rightsEvidence }) });
  return { run, log };
}

test('a changed dataset is ingested and its complete listing is recorded', async () => {
  const h = harness({ lastSha: 'b'.repeat(64) });
  const result = await h.run();
  assert.equal(result.status, 'succeeded');
  assert.equal(result.datasetUnchanged, false);
  assert.deepEqual(h.log.appended.sort(), ['NL/lov/1', 'NL/lov/2']);
  assert.equal(h.log.syncs.length, 1);
  assert.deepEqual([...h.log.syncs[0].externalIds], ['NL/lov/1', 'NL/lov/2']);
  assert.equal(result.authoritiesAbsent, 0);
});

test('an unchanged archive is skipped (incremental synchronisation) while due retries still run', async () => {
  const h = harness({ lastSha: 'a'.repeat(64), retries: ['NL/lov/7'] });
  const result = await h.run();
  assert.equal(result.datasetUnchanged, true);
  assert.equal(h.log.listed, 0, 'the archive listing is not processed again');
  assert.deepEqual(h.log.appended, ['NL/lov/7']);
  assert.equal(result.retried, 1);
  assert.deepEqual(h.log.outcomes.map(o => [o.externalId, o.succeeded]), [['NL/lov/7', true]]);
  assert.equal(h.log.syncs.length, 0, 'no new synchronisation record for an unchanged archive');
});

test('failed items are recorded with their failure class for later retry', async () => {
  const h = harness({ failIds: ['NL/lov/2'] });
  const result = await h.run();
  assert.equal(result.status, 'partial');
  assert.deepEqual(h.log.outcomes.map(o => [o.externalId, o.succeeded, o.failureCode, o.failureClass]),
    [['NL/lov/2', false, 'NETWORK_TIMEOUT', 'retryable']]);
  assert.equal(h.log.syncs.length, 1, 'the listing is still recorded: the failed item is retried on its own');
});

test('a batch that fails entirely records no synchronisation', async () => {
  const h = harness({ failIds: ['NL/lov/1', 'NL/lov/2'] });
  const result = await h.run();
  assert.equal(result.status, 'failed');
  assert.equal(h.log.syncs.length, 0);
});
