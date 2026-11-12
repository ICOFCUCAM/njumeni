import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  evaluateRetrieval,
  validateRetrievalDataset,
  DEFAULT_RETRIEVAL_GATES,
} from '../src/modules/legal-knowledge/retrieval-evaluation.ts';

const dataset = JSON.parse(
  await readFile(new URL('../../../legal-data/evaluation-datasets/synthetic-no-v1.json', import.meta.url), 'utf8'),
);

function hit(citation, validFrom, n = 0) {
  return {
    passageId: `${citation}-${n}`, authorityId: citation, authorityVersionId: `${citation}-${validFrom}`,
    authorityTitle: citation, citation, jurisdictionCode: 'NO', authorityType: 'act', languageCode: 'nb',
    legalStatus: 'in_force', validFrom, validUntil: null, sourceUri: null, sourceKey: 'synthetic-eval',
    sourceContentHash: 'a'.repeat(64), passageContent: 'text', pageNumber: null, sectionPath: [],
    lexicalScore: 1, semanticScore: null, score: 1, rank: n + 1,
  };
}

test('the synthetic dataset is valid and covers abstention and currency cases', () => {
  const valid = validateRetrievalDataset(dataset);
  assert.equal(valid.cases.length, 4);
  assert.ok(valid.cases.some((item) => item.relevant.length === 0));
  assert.ok(valid.cases.some((item) => item.expectedValidFrom));
});

test('a perfect search passes every gate', async () => {
  const report = await evaluateRetrieval({
    dataset,
    search: async (query) => {
      if (query.query.includes('romfart')) return [];
      if (query.query.includes('klagefrist')) return [hit('SYN-LOV-2010-07', '2010-07-01')];
      return [hit('SYN-LOV-2018-01', query.asOfDate < '2022-01-01' ? '2018-01-01' : '2022-01-01'),
        hit('SYN-LOV-2018-01', '2022-01-01', 1)];
    },
  });
  assert.equal(report.passed, true);
  assert.equal(report.metrics.recallAt10, 1);
  assert.equal(report.metrics.precisionAt5, 1);
  assert.equal(report.metrics.meanReciprocalRank, 1);
  assert.equal(report.metrics.currencyAccuracy, 1);
  assert.equal(report.metrics.abstentionAccuracy, 1);
  assert.deepEqual(report.gates.map((gate) => gate.metric), DEFAULT_RETRIEVAL_GATES.map((gate) => gate.metric));
});

test('substituting the current version for a historic question fails the currency gate', async () => {
  const report = await evaluateRetrieval({
    dataset,
    search: async (query) => {
      if (query.query.includes('romfart')) return [];
      if (query.query.includes('klagefrist')) return [hit('SYN-LOV-2010-07', '2010-07-01')];
      return [hit('SYN-LOV-2018-01', '2022-01-01')];
    },
  });
  assert.equal(report.metrics.currencyAccuracy, 0.5);
  assert.equal(report.passed, false);
  assert.equal(report.gates.find((gate) => gate.metric === 'currencyAccuracy').passed, false);
});

test('irrelevant results, missed authorities and failed abstention are all measured', async () => {
  const report = await evaluateRetrieval({
    dataset,
    search: async (query) => {
      if (query.query.includes('klagefrist')) return [hit('SYN-OTHER', null), hit('SYN-LOV-2010-07', '2010-07-01', 1)];
      if (query.query.includes('romfart')) return [hit('SYN-OTHER', null)];
      return [];
    },
  });
  const byId = Object.fromEntries(report.cases.map((item) => [item.id, item]));
  assert.equal(byId['syn-complaint-deadline'].reciprocalRank, 0.5);
  assert.equal(byId['syn-complaint-deadline'].precisionAt5, 0.5);
  assert.equal(byId['syn-accident-notice'].recallAt10, 0);
  assert.equal(byId['syn-out-of-scope'].abstainedCorrectly, false);
  assert.equal(report.passed, false);
});

test('search errors are recorded as failures, not skipped', async () => {
  const report = await evaluateRetrieval({
    dataset,
    search: async () => { throw new Error('LEGAL_RETRIEVAL_LEXICAL_PROVIDER_FAILED'); },
  });
  assert.equal(report.passed, false);
  assert.ok(report.cases.every((item) => item.error === 'LEGAL_RETRIEVAL_LEXICAL_PROVIDER_FAILED'));
});

test('a gate with nothing to measure fails instead of passing silently', async () => {
  const onlyAbstention = { ...dataset, cases: dataset.cases.filter((item) => item.relevant.length === 0) };
  const report = await evaluateRetrieval({ dataset: onlyAbstention, search: async () => [] });
  assert.equal(report.metrics.recallAt10, null);
  assert.equal(report.passed, false);
});

test('invalid datasets are rejected', () => {
  assert.throws(() => validateRetrievalDataset({ ...dataset, contentLicence: '' }), /contentLicence/);
  assert.throws(() => validateRetrievalDataset({ ...dataset, cases: [dataset.cases[0], dataset.cases[0]] }), /case id/);
  assert.throws(
    () => validateRetrievalDataset({ ...dataset, cases: [{ ...dataset.cases[3], expectedValidFrom: '2020-01-01' }] }),
    /currency check requires/,
  );
});

test('the Lovdata dataset is valid, names real citations and records expected sections', async () => {
  const lovdata = validateRetrievalDataset(JSON.parse(
    await readFile(new URL('../../../legal-data/evaluation-datasets/lovdata-no-v1.json', import.meta.url), 'utf8'),
  ));
  assert.equal(lovdata.datasetKey, 'lovdata-no-v1');
  assert.ok(lovdata.cases.length >= 30);
  for (const item of lovdata.cases) {
    for (const ref of item.relevant) {
      assert.equal(ref.sourceKey, 'lovdata-official');
      assert.match(ref.citation, /^LOV-\d{4}-\d{2}-\d{2}(-\d+)?$/);
    }
    if (item.relevant.length) assert.ok(item.expectedSections?.length, item.id + ' names its section');
  }
  assert.ok(lovdata.cases.filter((item) => item.expectedValidFrom).length >= 5, 'currency cases');
  assert.ok(lovdata.cases.some((item) => item.relevant.length === 0), 'abstention cases');
});

test('section hits count only expected sections of relevant authorities', async () => {
  const sectioned = {
    datasetKey: 'section-check', version: 1, jurisdictionCode: 'NO', description: 'unit', contentLicence: 'synthetic',
    cases: [
      { id: 'hit', question: 'q', asOfDate: '2026-01-01', languageCodes: ['nb'], relevant: [{ sourceKey: 'synthetic-eval', citation: 'A' }], expectedSections: ['§ 2'] },
      { id: 'miss', question: 'q', asOfDate: '2026-01-01', languageCodes: ['nb'], relevant: [{ sourceKey: 'synthetic-eval', citation: 'A' }], expectedSections: ['§ 9'] },
    ],
  };
  const report = await evaluateRetrieval({
    dataset: sectioned,
    search: async () => [{ ...hit('B', null), sectionPath: ['§ 9'] }, { ...hit('A', null, 1), sectionPath: ['Kapittel 1', '§ 2'] }],
  });
  assert.deepEqual(report.cases.map((item) => item.sectionHit), [true, false]);
  assert.equal(report.metrics.sectionHitAt10, 0.5);
  assert.throws(() => validateRetrievalDataset({ ...sectioned, cases: [{ ...sectioned.cases[0], relevant: [] }] }), /expectedSections/);
});
