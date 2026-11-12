import assert from 'node:assert/strict';
import test from 'node:test';
import { createLegalReranker } from '../src/modules/legal-knowledge/reranker.ts';
import {
  abstentionOptions, CALIBRATED_ABSTENTION, createRetrievalPlan, executeLegalRetrieval,
} from '../src/modules/legal-knowledge/retrieval.ts';

function row(id, authorityId, validFrom, overrides = {}) {
  return {
    passageId: id, authorityId, authorityVersionId: 'v-' + id, authorityTitle: 'Lov ' + authorityId, citation: null,
    jurisdictionCode: 'NO', authorityType: 'act', languageCode: 'nb', legalStatus: 'in_force', validFrom, validUntil: null,
    sourceUri: null, sourceKey: 'lovdata-official', sourceContentHash: 'a'.repeat(64), passageContent: 'Tekst.', pageNumber: null,
    sectionPath: [], lexicalScore: 0.8, semanticScore: 0.85, ...overrides,
  };
}
// The search provider filters by the plan's as-of date, as the database does.
function provider(rows) {
  const inForce = (plan) => rows.filter((r) => !r.validFrom || r.validFrom <= plan.asOfDate);
  return {
    searchLexical: async (plan) => inForce(plan).map((r) => ({ ...r, semanticScore: null })),
    searchSemantic: async (plan) => inForce(plan).map((r) => ({ ...r, lexicalScore: null })),
  };
}
const plan = (asOfDate, mode = 'hybrid') =>
  createRetrievalPlan({ query: 'oppsigelsesfrist', jurisdictionCode: 'NO', asOfDate, languageCodes: ['nb'], mode });
// The employment act (current version from 2026-07-01) answers best; an unrelated act has been in force for years.
const corpus = [
  row('aml-1', 'aml', '2026-07-01', { lexicalScore: 0.95, semanticScore: 0.92 }),
  row('aml-2', 'aml', '2026-07-01', { lexicalScore: 0.9, semanticScore: 0.9 }),
  row('husleie-1', 'husleie', '2000-01-01', { lexicalScore: 0.5, semanticScore: 0.8 }),
];

test('the production abstention policy stays off until a held-out evaluation confirms it', () => {
  assert.deepEqual({ ...CALIBRATED_ABSTENTION }, { temporalCoverage: false, minSemanticScore: null });
  assert.deepEqual(abstentionOptions(CALIBRATED_ABSTENTION), {});
  assert.deepEqual(abstentionOptions({ temporalCoverage: true, minSemanticScore: 0.8 }, '2026-11-12'),
    { temporalCoverage: { currentDate: '2026-11-12' }, minSemanticScore: 0.8 });
});

test('without the temporal check, a past-dated question is answered from whatever else was in force', async () => {
  const result = await executeLegalRetrieval(plan('2025-01-15'), provider(corpus), { reranker: createLegalReranker() });
  assert.deepEqual([...new Set(result.map((p) => p.authorityId))], ['husleie'], 'the misleading answer the check prevents');
});

test('the temporal check abstains when the authority that answers today has no version on the date', async () => {
  let seen;
  const result = await executeLegalRetrieval(plan('2025-01-15'), provider(corpus), {
    reranker: createLegalReranker(), temporalCoverage: { currentDate: '2026-11-12' }, observe: (o) => { seen = o; },
  });
  assert.deepEqual(result, []);
  assert.equal(seen.abstention, 'version_not_held');
  assert.equal(seen.currentTopAuthorityId, 'aml');
});

test('the temporal check answers when the right version was in force, and is skipped for today', async () => {
  const older = [row('aml-0', 'aml', '2020-01-01', { lexicalScore: 0.95, semanticScore: 0.92 }), ...corpus];
  const dated = await executeLegalRetrieval(plan('2025-01-15'), provider(older), {
    reranker: createLegalReranker(), temporalCoverage: { currentDate: '2026-11-12' },
  });
  assert.equal(dated[0].authorityId, 'aml');
  let seen;
  const today = await executeLegalRetrieval(plan('2026-11-12'), provider(corpus), {
    reranker: createLegalReranker(), temporalCoverage: { currentDate: '2026-11-12' }, observe: (o) => { seen = o; },
  });
  assert.ok(today.length > 0);
  assert.equal(seen.currentTopAuthorityId, null, 'no second search for a question about today');
});

test('the semantic floor abstains when nothing is close in meaning, and reports the scores', async () => {
  let seen;
  const far = corpus.map((r) => ({ ...r, validFrom: '2000-01-01', semanticScore: 0.7 }));
  const result = await executeLegalRetrieval(plan('2026-11-12'), provider(far), {
    reranker: createLegalReranker(), minSemanticScore: 0.8, observe: (o) => { seen = o; },
  });
  assert.deepEqual(result, []);
  assert.equal(seen.abstention, 'out_of_scope');
  assert.equal(seen.bestSemanticScore, 0.7);
  const near = await executeLegalRetrieval(plan('2026-11-12'), provider(corpus.map((r) => ({ ...r, validFrom: '2000-01-01' }))), {
    reranker: createLegalReranker(), minSemanticScore: 0.8,
  });
  assert.ok(near.length > 0, 'a close question is answered');
  const lexical = await executeLegalRetrieval(plan('2026-11-12', 'lexical'), provider(far), { reranker: createLegalReranker(), minSemanticScore: 0.8 });
  assert.ok(lexical.length > 0, 'keyword-only search has no semantic score to judge by');
});

test('abstention options need the reranker and valid settings', async () => {
  await assert.rejects(executeLegalRetrieval(plan('2025-01-15'), provider(corpus), { temporalCoverage: { currentDate: '2026-11-12' } }),
    /ABSTENTION_NEEDS_RERANKER/);
  await assert.rejects(executeLegalRetrieval(plan('2026-11-12'), provider(corpus), { reranker: createLegalReranker(), minSemanticScore: 2 }),
    /OPTIONS_INVALID/);
});
