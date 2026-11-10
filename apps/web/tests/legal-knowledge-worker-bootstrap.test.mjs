import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTrustedWorkerSourceConfig } from '../src/modules/legal-knowledge/worker-source-config.ts';

const config = {
  source_id: 'source-1', source_key: 'test-source',
  rights: { rightsStatus: 'approved', sourceStatus: 'active', ingestionEnabled: true,
    licenceIdentifier: 'LIC-1', attributionText: 'Attribute this source' },
  evidence: { sourceKey: 'test-source', licenceIdentifier: 'LIC-1', licenceVersion: '1',
    termsUri: 'https://example.test/terms', attributionText: 'Attribute this source',
    reviewedBy: 'reviewer', reviewedAt: '2026-01-01T00:00:00.000Z', reviewExpiresAt: null,
    restrictions: [], permissions: { retrieve: true, store: true, normalise: true,
      index: true, quote: true, display: true, redistribute: false } },
};

test('trusted source config is bound to the claimed source and adapter source key', async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'legal_worker_source_config');
    assert.deepEqual(args, { p_source_id: 'source-1' });
    return { data: config, error: null };
  } };
  const result = await loadTrustedWorkerSourceConfig(client, 'source-1', 'test-source');
  assert.equal(result.sourceKey, 'test-source');
});

test('source-key mismatch fails closed', async () => {
  const client = { rpc: async () => ({ data: config, error: null }) };
  await assert.rejects(loadTrustedWorkerSourceConfig(client, 'source-1', 'different-source'),
    /LEGAL_WORKER_SOURCE_REGISTRY_MISMATCH/);
});

test('unapproved rights fail closed', async () => {
  const blocked = { ...config, rights: { ...config.rights, ingestionEnabled: false } };
  const client = { rpc: async () => ({ data: blocked, error: null }) };
  await assert.rejects(loadTrustedWorkerSourceConfig(client, 'source-1', 'test-source'),
    /LEGAL_SOURCE_INGESTION_PERMISSION_DENIED/);
});

test('RPC errors are not exposed to worker callers', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'sensitive database detail' } }) };
  await assert.rejects(loadTrustedWorkerSourceConfig(client, 'source-1', 'test-source'),
    /LEGAL_WORKER_SOURCE_CONFIG_LOAD_FAILED/);
});
