import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTILINGUAL_E5_SMALL_V1,
  ACTIVE_LEGAL_EMBEDDING_PROFILE,
} from '../src/modules/legal-knowledge/embedding-profile.ts';
import { createLocalLegalEmbedder } from '../src/modules/legal-knowledge/local-embedder.ts';
import { runEmbeddingBackfill } from '../src/modules/legal-knowledge/embedding-backfill.ts';

const DIMS = 384;
function fakeLoader(calls) {
  return async (modelId) => {
    calls.loads.push(modelId);
    return async (texts, options) => {
      calls.inputs.push(...texts);
      assert.deepEqual(options, { pooling: 'mean', normalize: true });
      return { tolist: () => texts.map(() => Array(DIMS).fill(0.05)) };
    };
  };
}

test('active profile is the owner-selected multilingual e5 model (D-3)', () => {
  assert.equal(ACTIVE_LEGAL_EMBEDDING_PROFILE, MULTILINGUAL_E5_SMALL_V1);
  assert.equal(MULTILINGUAL_E5_SMALL_V1.dimensions, 384);
  assert.equal(MULTILINGUAL_E5_SMALL_V1.modelId, 'intfloat/multilingual-e5-small');
  assert.equal(MULTILINGUAL_E5_SMALL_V1.licence, 'MIT');
  for (const code of ['nb', 'nn', 'en', 'fr']) {
    assert.ok(MULTILINGUAL_E5_SMALL_V1.languageCodes.includes(code));
  }
});

test('local embedder applies e5 query and passage prefixes and loads the model once', async () => {
  const calls = { loads: [], inputs: [] };
  const embedder = createLocalLegalEmbedder({ loadExtractor: fakeLoader(calls) });
  const query = await embedder.embedQuery('  varslingsplikt  ');
  assert.equal(query.modelKey, 'multilingual-e5-small-v1');
  assert.equal(query.values.length, DIMS);
  await embedder.embedPassages(['Arbeidsgiveren skal varsle.', 'The employer must report.']);
  assert.deepEqual(calls.loads, ['Xenova/multilingual-e5-small']);
  assert.deepEqual(calls.inputs, [
    'query: varslingsplikt',
    'passage: Arbeidsgiveren skal varsle.',
    'passage: The employer must report.',
  ]);
});

test('local embedder rejects empty input and wrong-dimension model output', async () => {
  const calls = { loads: [], inputs: [] };
  const embedder = createLocalLegalEmbedder({ loadExtractor: fakeLoader(calls) });
  await assert.rejects(embedder.embedQuery('   '), /LEGAL_EMBEDDING_INPUT_INVALID/);
  const broken = createLocalLegalEmbedder({
    loadExtractor: async () => async (texts) => ({ tolist: () => texts.map(() => Array(1536).fill(0)) }),
  });
  await assert.rejects(broken.embedPassages(['text']), /LEGAL_EMBEDDING_PROFILE_INVALID/);
});

test('missing runtime fails with a clear error and can be retried', async () => {
  let attempts = 0;
  const embedder = createLocalLegalEmbedder({
    loadExtractor: async () => {
      attempts += 1;
      throw new Error('LEGAL_EMBEDDING_RUNTIME_NOT_INSTALLED');
    },
  });
  await assert.rejects(embedder.embedQuery('x'), /LEGAL_EMBEDDING_RUNTIME_NOT_INSTALLED/);
  await assert.rejects(embedder.embedQuery('x'), /LEGAL_EMBEDDING_RUNTIME_NOT_INSTALLED/);
  assert.equal(attempts, 2);
});

test('backfill embeds pending passages in batches until drained', async () => {
  const pending = Array.from({ length: 5 }, (_, i) => ({
    passage_id: `p${i}`, content: `Passage ${i}`, language_code: 'nb',
  }));
  const stored = [];
  const client = {
    rpc: async (name, args) => {
      if (name === 'legal_embedding_pending_passages') {
        assert.equal(args.p_profile_key, 'multilingual-e5-small-v1');
        const remaining = pending.filter((row) => !stored.includes(row.passage_id));
        return { data: remaining.slice(0, args.p_limit), error: null };
      }
      assert.equal(name, 'legal_embedding_store');
      for (const item of args.p_embeddings) {
        assert.equal(item.embedding.length, DIMS);
        stored.push(item.passage_id);
      }
      return { data: args.p_embeddings.length, error: null };
    },
  };
  const embedder = createLocalLegalEmbedder({ loadExtractor: fakeLoader({ loads: [], inputs: [] }) });
  const result = await runEmbeddingBackfill({ client, embedder, batchSize: 2 });
  assert.deepEqual(result, {
    profileKey: 'multilingual-e5-small-v1', batches: 3, passagesEmbedded: 5, drained: true,
  });
  assert.deepEqual(stored, ['p0', 'p1', 'p2', 'p3', 'p4']);
});

test('backfill fails closed when the store RPC fails, without leaking details', async () => {
  const client = {
    rpc: async (name) =>
      name === 'legal_embedding_pending_passages'
        ? { data: [{ passage_id: 'p1', content: 'text', language_code: 'en' }], error: null }
        : { data: null, error: { message: 'sensitive database error' } },
  };
  const embedder = createLocalLegalEmbedder({ loadExtractor: fakeLoader({ loads: [], inputs: [] }) });
  await assert.rejects(runEmbeddingBackfill({ client, embedder }), /^Error: LEGAL_EMBEDDING_STORE_FAILED$/);
});

test('backfill validates its batch configuration', async () => {
  const embedder = createLocalLegalEmbedder({ loadExtractor: fakeLoader({ loads: [], inputs: [] }) });
  await assert.rejects(
    runEmbeddingBackfill({ client: { rpc: async () => ({ data: [], error: null }) }, embedder, batchSize: 500 }),
    /LEGAL_EMBEDDING_BATCH_SIZE_INVALID/,
  );
});
