#!/usr/bin/env node
// Release gates (Master Plan v2.0 §18.3), checked on every push.
// 1. Every gate in quality/release-gates.json is backed by evidence that still exists:
//    each named test or workflow file must contain the named assertion or step.
// 2. The §18.2 evaluation thresholds do not regress: compared with the base commit, no threshold is
//    lowered or removed unless a recalibration entry names it.
// 3. Thresholds enforced in code (DEFAULT_RETRIEVAL_GATES) match the thresholds file.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

export function checkGateEvidence(gates, fileReader) {
  const failures = [];
  const ids = new Set();
  for (const gate of gates.gates ?? []) {
    if (!/^RG-\d{2}$/.test(gate.id ?? '') || ids.has(gate.id))
      failures.push(`GATE_ID_INVALID ${gate.id}`);
    ids.add(gate.id);
    if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) {
      failures.push(`GATE_WITHOUT_EVIDENCE ${gate.id}`);
      continue;
    }
    for (const item of gate.evidence) {
      const content = fileReader(item.file);
      if (content === null) failures.push(`EVIDENCE_FILE_MISSING ${gate.id} ${item.file}`);
      else if (!content.includes(item.contains))
        failures.push(`EVIDENCE_ASSERTION_MISSING ${gate.id} ${item.file}: ${item.contains}`);
    }
  }
  return failures;
}

export function checkThresholdRegression(current, base) {
  if (!base) return [];
  const failures = [];
  const recalibrated = new Set((current.recalibrations ?? []).map((entry) => entry.metric));
  const now = new Map((current.thresholds ?? []).map((t) => [t.metric, t.minimum]));
  for (const previous of base.thresholds ?? []) {
    if (recalibrated.has(previous.metric)) continue;
    if (!now.has(previous.metric)) failures.push(`THRESHOLD_REMOVED ${previous.metric}`);
    else if (now.get(previous.metric) < previous.minimum)
      failures.push(
        `THRESHOLD_LOWERED ${previous.metric} ${previous.minimum} -> ${now.get(previous.metric)}`,
      );
  }
  for (const entry of current.recalibrations ?? []) {
    if (!entry.metric || !entry.reason || !entry.evidence)
      failures.push(`RECALIBRATION_INCOMPLETE ${entry.metric ?? '?'}`);
  }
  return failures;
}

export function checkCodeGates(thresholds, source) {
  const failures = [];
  for (const threshold of thresholds.thresholds ?? []) {
    if (threshold.codeGate !== 'DEFAULT_RETRIEVAL_GATES') continue;
    const match = source.match(
      new RegExp(`metric:\\s*'${threshold.metric}',\\s*threshold:\\s*([0-9.]+)`),
    );
    if (!match) failures.push(`CODE_GATE_MISSING ${threshold.metric}`);
    else if (Number(match[1]) < threshold.minimum)
      failures.push(
        `CODE_GATE_BELOW_THRESHOLD ${threshold.metric} ${match[1]} < ${threshold.minimum}`,
      );
  }
  return failures;
}

function baseThresholds() {
  const sha = process.env.RELEASE_GATE_BASE_SHA;
  if (!sha || /^0+$/.test(sha)) return null;
  try {
    return JSON.parse(
      execFileSync('git', ['show', `${sha}:quality/evaluation-thresholds.json`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    return null; // The base predates the thresholds file, or is unavailable.
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gates = JSON.parse(read('quality/release-gates.json'));
  const thresholds = JSON.parse(read('quality/evaluation-thresholds.json'));
  const failures = [
    ...checkGateEvidence(gates, (path) => (existsSync(resolve(root, path)) ? read(path) : null)),
    ...checkThresholdRegression(thresholds, baseThresholds()),
    ...checkCodeGates(
      thresholds,
      read('apps/web/src/modules/legal-knowledge/retrieval-evaluation.ts'),
    ),
  ];
  if (failures.length > 0) {
    for (const failure of failures) console.error(`::error::${failure}`);
    process.exit(1);
  }
  console.log(
    `Release gates passed: ${gates.gates.length} gates evidenced; ${thresholds.thresholds.length} evaluation thresholds held.`,
  );
}
