import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLegalReranker,
  extractProvisionReferences,
  LEGAL_RERANKER_VERSION,
  DEFAULT_RERANK_WEIGHTS,
} from '../src/modules/legal-knowledge/reranker.ts';
import { createRetrievalPlan, executeLegalRetrieval, rankLegalPassages } from '../src/modules/legal-knowledge/retrieval.ts';
import { composeResearchAnswer } from '../src/modules/research/composer.ts';

const plan = createRetrievalPlan({ query: 'oppsigelse', jurisdictionCode: 'NO', asOfDate: '2026-11-01', languageCodes: ['nb'], mode: 'hybrid' });
let counter = 0;
function passage(overrides = {}) {
  counter++;
  const id = overrides.passageId ?? 'p' + counter;
  return {
    passageId: id, authorityId: overrides.authorityId ?? 'a-' + id, authorityVersionId: 'v-' + id,
    authorityTitle: 'Lov om noe', citation: null, jurisdictionCode: 'NO', authorityType: 'act', languageCode: 'nb',
    legalStatus: 'in_force', validFrom: '2020-01-01', validUntil: null, sourceUri: 'https://api.lovdata.no/x', sourceKey: 'lovdata-official',
    sourceContentHash: 'a'.repeat(64), passageContent: 'Tekst.', pageNumber: null, sectionPath: [],
    lexicalScore: 0.5, semanticScore: 0.5, score: 0.5, rank: counter, citationLabel: 'x',
    ...overrides,
  };
}
const ranked = list => list.map((p, i) => ({ ...p, rank: i + 1 }));

test('provision references are read from questions in several languages', () => {
  assert.deepEqual(extractProvisionReferences('Hva sier § 15-3 i arbeidsmiljøloven?'), [{ kind: 'section', label: '15-3' }]);
  assert.deepEqual(extractProvisionReferences('What does Article 5 require?'), [{ kind: 'article', label: '5' }]);
  assert.deepEqual(extractProvisionReferences('kapittel 4 og §§ 2-1'), [{ kind: 'section', label: '2-1' }, { kind: 'chapter', label: '4' }]);
  assert.deepEqual(extractProvisionReferences('Quand un contrat est-il nul ?'), []);
});

test('the exact provision named in the question outranks a better first-stage match', () => {
  const reranker = createLegalReranker();
  const result = reranker.rerank(plan, 'Hva sier § 15-3 om oppsigelsesfrister?', ranked([
    passage({ passageId: 'other', score: 0.8, lexicalScore: 0.8, semanticScore: 0.8, sectionPath: ['Kapittel 15', '§ 15-1'] }),
    passage({ passageId: 'exact', score: 0.55, lexicalScore: 0.55, semanticScore: 0.55, sectionPath: ['Kapittel 15', '§ 15-3'] }),
  ]));
  assert.equal(result[0].passageId, 'exact');
  assert.equal(result[0].rerank.features.provision, 1);
  assert.ok(result[0].rerank.reasons.includes('Matches the provision named in the question.'));
  assert.equal(result[0].rerank.firstStageRank, 2);
});

test('an authority the question names (by short title or citation) is preferred', () => {
  const reranker = createLegalReranker();
  const result = reranker.rerank(plan, 'Oppsigelse etter arbeidsmiljøloven', ranked([
    passage({ passageId: 'unnamed', score: 0.62, authorityTitle: 'Lov om ferie (ferieloven)' }),
    passage({ passageId: 'named', score: 0.55, authorityTitle: 'Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)' }),
  ]));
  assert.equal(result[0].passageId, 'named');
  assert.equal(result[0].rerank.features.citation, 1);
  const byCitation = reranker.rerank(plan, 'Hva sier LOV-2005-06-17-62?', ranked([passage({ passageId: 'c', citation: 'LOV-2005-06-17-62' })]));
  assert.equal(byCitation[0].rerank.features.citation, 1);
});

test('legal authority and currency break ties between equally relevant passages', () => {
  const reranker = createLegalReranker({ relativeCutoff: 0 });
  const byAuthority = reranker.rerank(plan, 'frister', ranked([
    passage({ passageId: 'guidance', authorityType: 'official_guidance' }),
    passage({ passageId: 'act', authorityType: 'act' }),
    passage({ passageId: 'constitution', authorityType: 'constitution' }),
  ]));
  assert.deepEqual(byAuthority.map(p => p.passageId), ['constitution', 'act', 'guidance']);
  const byCurrency = reranker.rerank(plan, 'frister', ranked([
    passage({ passageId: 'unknown', legalStatus: 'unknown' }),
    passage({ passageId: 'in-force', legalStatus: 'in_force' }),
  ]));
  assert.deepEqual(byCurrency.map(p => p.passageId), ['in-force', 'unknown']);
  assert.match(byCurrency[1].rerank.reasons.join(' '), /Currency on the as-of date is less certain \(unknown\)/);
});

test('related jurisdictions and other languages rank below the home jurisdiction and preferred language', () => {
  const reranker = createLegalReranker({ relatedJurisdictions: { EU: 0.6 }, preferredLanguage: 'nb', relativeCutoff: 0 });
  const result = reranker.rerank(plan, 'frister', ranked([
    passage({ passageId: 'eu', jurisdictionCode: 'EU', languageCode: 'en' }),
    passage({ passageId: 'en', languageCode: 'en' }),
    passage({ passageId: 'home' }),
  ]));
  assert.deepEqual(result.map(p => p.passageId), ['home', 'en', 'eu']);
  assert.equal(result[2].rerank.features.jurisdiction, 0.6);
  assert.ok(result[2].rerank.reasons.some(r => r.includes('related jurisdiction (EU)')));
});

test('the first stage admits related jurisdictions only when the plan names them', () => {
  const candidate = { ...passage({ passageId: 'eu', jurisdictionCode: 'EU' }) };
  delete candidate.score; delete candidate.rank; delete candidate.citationLabel;
  assert.equal(rankLegalPassages(plan, [candidate]).length, 0);
  const withEu = createRetrievalPlan({ query: 'x', jurisdictionCode: 'NO', asOfDate: '2026-11-01', languageCodes: ['nb'], mode: 'hybrid', relatedJurisdictionCodes: ['EU', 'NO'] });
  assert.deepEqual(withEu.relatedJurisdictionCodes, ['EU']);
  assert.equal(rankLegalPassages(withEu, [candidate]).length, 1);
  assert.equal('relatedJurisdictionCodes' in plan, false, 'plans without related jurisdictions are unchanged');
});

test('a hybrid hit found by both searches beats a single-list hit of the same score', () => {
  const reranker = createLegalReranker({ relativeCutoff: 0 });
  const result = reranker.rerank(plan, 'frister', ranked([
    passage({ passageId: 'lexical-only', score: 0.5, lexicalScore: 0.5, semanticScore: null }),
    passage({ passageId: 'both', score: 0.5, lexicalScore: 0.5, semanticScore: 0.5 }),
  ]));
  assert.equal(result[0].passageId, 'both');
  assert.ok(result[0].rerank.reasons.includes('Found by both lexical and semantic search.'));
});

test('weak tails are cut, redundant passages per authority are capped, and weak pools abstain', () => {
  const reranker = createLegalReranker({ maxPassagesPerAuthority: 2 });
  const result = reranker.rerank(plan, 'frister', ranked([
    passage({ passageId: 's1', authorityId: 'A', score: 0.9, lexicalScore: 0.9, semanticScore: 0.9 }),
    passage({ passageId: 's2', authorityId: 'A', score: 0.85, lexicalScore: 0.85, semanticScore: 0.85 }),
    passage({ passageId: 's3', authorityId: 'A', score: 0.8, lexicalScore: 0.8, semanticScore: 0.8 }),
    passage({ passageId: 'tail', authorityId: 'B', score: 0.05, lexicalScore: 0.05, semanticScore: null, authorityType: 'other', legalStatus: 'unknown' }),
  ]));
  assert.deepEqual(result.map(p => p.passageId), ['s1', 's2']);
  assert.ok(result[0].rerank.authoritySupport > 0, 'corroborating passages raise the authority');
  const weak = createLegalReranker({ abstainBelow: 0.5 }).rerank(plan, 'frister', ranked([
    passage({ score: 0.1, lexicalScore: 0.1, semanticScore: null, authorityType: 'other', legalStatus: 'unknown', validFrom: null }),
  ]));
  assert.deepEqual(weak, [], 'nothing reaches the minimum: abstain');
  assert.deepEqual(createLegalReranker().rerank(plan, 'x', []), []);
});

test('reranking is deterministic and traceable', () => {
  const pool = ranked([passage({ passageId: 'x1', score: 0.7 }), passage({ passageId: 'x2', score: 0.6 }), passage({ passageId: 'x3', score: 0.65 })]);
  const a = createLegalReranker().rerank(plan, 'frister', pool);
  const b = createLegalReranker().rerank(plan, 'frister', [...pool].reverse());
  assert.deepEqual(a.map(p => p.passageId), b.map(p => p.passageId));
  for (const item of a) {
    assert.equal(item.rerank.rerankerVersion, LEGAL_RERANKER_VERSION);
    assert.equal(item.score, item.rerank.score);
    assert.deepEqual(Object.keys(item.rerank.features).sort(), Object.keys(DEFAULT_RERANK_WEIGHTS).sort());
    assert.equal(typeof item.rerank.firstStageScore, 'number');
  }
  assert.deepEqual(a.map(p => p.rank), a.map((_, i) => i + 1));
});

test('invalid reranker configuration is refused', () => {
  assert.throws(() => createLegalReranker({ weights: { retrieval: 0.9 } }), /WEIGHTS_INVALID/);
  assert.throws(() => createLegalReranker({ relativeCutoff: 1 }), /OPTIONS_INVALID/);
  assert.throws(() => createLegalReranker({ maxPassagesPerAuthority: 0 }), /OPTIONS_INVALID/);
  assert.throws(() => createLegalReranker({ relatedJurisdictions: { EU: 2 } }), /OPTIONS_INVALID/);
});

test('with a reranker, retrieval searches a wider pool and returns at most the plan limit', async () => {
  const seen = [];
  const rows = Array.from({ length: 40 }, (_, i) => {
    const p = passage({ passageId: 'pool-' + String(i).padStart(2, '0'), lexicalScore: 0.9 - i * 0.01, semanticScore: 0.9 - i * 0.01 });
    delete p.score; delete p.rank; delete p.citationLabel;
    return p;
  });
  const provider = {
    searchLexical: async p => { seen.push(['lexical', p.limit]); return rows.slice(0, p.limit).map(r => ({ ...r, semanticScore: null })); },
    searchSemantic: async p => { seen.push(['semantic', p.limit]); return rows.slice(0, p.limit).map(r => ({ ...r, lexicalScore: null })); },
  };
  const firstStage = await executeLegalRetrieval(plan, provider);
  assert.equal(firstStage.length, 12);
  assert.equal(firstStage[0].rerank, undefined, 'without a reranker the first stage is returned unchanged');
  seen.length = 0;
  const reranked = await executeLegalRetrieval(plan, provider, { reranker: createLegalReranker(), question: 'frister' });
  assert.deepEqual(seen, [['lexical', 36], ['semantic', 36]]);
  assert.ok(reranked.length <= 12 && reranked.length > 0);
  assert.ok(reranked.every(p => p.rerank.rerankerVersion === LEGAL_RERANKER_VERSION));
});

test('research findings carry the reranking trace for the run record', () => {
  const [reranked] = createLegalReranker().rerank(plan, '§ 15-3', ranked([passage({ passageId: '00000000-0000-4000-8000-000000000001', sectionPath: ['§ 15-3'], passageContent: '§ 15-3. Oppsigelsesfrister' })]));
  const composed = composeResearchAnswer({
    question: '§ 15-3', asOfDate: '2026-11-01', jurisdictionCode: 'NO', coverageLevel: 'pilot', passages: [reranked], context: [],
    permissions: [{ source_key: 'lovdata-official', display_permitted: true, quote_permitted: true, attribution_text: 'NLOD', licence_identifier: 'NLOD-2.0' }],
  });
  assert.equal(composed.findings[0].trace.rerankerVersion, LEGAL_RERANKER_VERSION);
  assert.equal(composed.findings[0].trace.features.provision, 1);
});
