import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  checkCodeGates,
  checkGateEvidence,
  checkThresholdRegression,
} from '../scripts/ci/check-release-gates.mjs';

const gates = JSON.parse(
  readFileSync(new URL('../quality/release-gates.json', import.meta.url), 'utf8'),
);
const thresholds = JSON.parse(
  readFileSync(new URL('../quality/evaluation-thresholds.json', import.meta.url), 'utf8'),
);

test('all twelve §18.3 release gates are registered with evidence', () => {
  assert.equal(gates.gates.length, 12);
  assert.deepEqual(
    gates.gates.map((gate) => gate.id),
    Array.from({ length: 12 }, (_, i) => `RG-${String(i + 1).padStart(2, '0')}`),
  );
  const fileReader = (path) => {
    try {
      return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    } catch {
      return null;
    }
  };
  assert.deepEqual(checkGateEvidence(gates, fileReader), []);
});

test('removing the assertion behind a gate fails the check', () => {
  const failures = checkGateEvidence(
    {
      gates: [
        {
          id: 'RG-01',
          blocksReleaseIf: 'x',
          evidence: [{ file: 'a.sql', contains: 'outsider denied' }],
        },
      ],
    },
    () => 'nothing here',
  );
  assert.match(failures[0], /EVIDENCE_ASSERTION_MISSING RG-01/);
  assert.match(
    checkGateEvidence({ gates: [{ id: 'RG-02', evidence: [] }] }, () => '')[0],
    /GATE_WITHOUT_EVIDENCE/,
  );
});

test('lowering or removing a threshold without recalibration fails', () => {
  const base = {
    thresholds: [
      { metric: 'recallAt10', minimum: 0.8 },
      { metric: 'citationAccuracy', minimum: 1 },
    ],
  };
  assert.deepEqual(
    checkThresholdRegression(
      {
        thresholds: [
          { metric: 'recallAt10', minimum: 0.85 },
          { metric: 'citationAccuracy', minimum: 1 },
        ],
      },
      base,
    ),
    [],
  );
  assert.deepEqual(
    checkThresholdRegression({ thresholds: [{ metric: 'recallAt10', minimum: 0.7 }] }, base),
    ['THRESHOLD_LOWERED recallAt10 0.8 -> 0.7', 'THRESHOLD_REMOVED citationAccuracy'],
  );
  assert.deepEqual(
    checkThresholdRegression(
      {
        thresholds: [
          { metric: 'recallAt10', minimum: 0.7 },
          { metric: 'citationAccuracy', minimum: 1 },
        ],
        recalibrations: [
          { metric: 'recallAt10', reason: 'calibrated on lovdata-no-v1', evidence: 'run 42' },
        ],
      },
      base,
    ),
    [],
  );
});

test('code gates may not be weaker than the thresholds file', () => {
  const source = readFileSync(
    new URL('../apps/web/src/modules/legal-knowledge/retrieval-evaluation.ts', import.meta.url),
    'utf8',
  );
  assert.deepEqual(checkCodeGates(thresholds, source), []);
  assert.match(
    checkCodeGates(thresholds, "{ metric: 'recallAt10', threshold: 0.5 }")[0],
    /CODE_GATE_BELOW_THRESHOLD recallAt10/,
  );
});

test('citation accuracy and limitation disclosure are absolute gates', () => {
  const byMetric = Object.fromEntries(thresholds.thresholds.map((t) => [t.metric, t.minimum]));
  assert.equal(byMetric.citationAccuracy, 1);
  assert.equal(byMetric.limitationDisclosure, 1);
});
