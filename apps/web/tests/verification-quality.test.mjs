import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideReview,
  qualityStatus,
  sortFindings,
  verifyResearchRun,
} from '../src/modules/verification/quality.ts';

const RUN = '33333333-3333-4333-8333-333333333333';
const report = (outcome, findings = []) => ({
  id: 'r',
  checkedAsOf: '2026-11-12',
  outcome,
  checkerVersion: 'v',
  createdAt: 'x',
  findings,
});
const review = (status, gate = 'changed_law') => ({
  id: 'q',
  gate,
  reason: 'r',
  status,
  decidedAt: null,
  decisionNote: null,
  selfReview: false,
});
const base = { organizationId: 'o', workspaceId: 'w' };

test('quality status requires a clear check and every gate approved', () => {
  assert.equal(qualityStatus({ ...base, latestReport: null, reviews: [] }).state, 'unchecked');
  assert.equal(
    qualityStatus({ ...base, latestReport: report('clear'), reviews: [] }).state,
    'verified',
  );
  assert.equal(
    qualityStatus({
      ...base,
      latestReport: report('review_required'),
      reviews: [review('pending')],
    }).state,
    'awaiting_review',
  );
  assert.equal(
    qualityStatus({
      ...base,
      latestReport: report('review_required'),
      reviews: [review('approved')],
    }).label,
    'Reviewed and approved',
  );
  assert.equal(
    qualityStatus({
      ...base,
      latestReport: report('blocked'),
      reviews: [review('pending', 'verification_failure')],
    }).state,
    'blocked',
  );
  assert.equal(
    qualityStatus({
      ...base,
      latestReport: report('blocked'),
      reviews: [review('approved', 'verification_failure')],
    }).state,
    'blocked',
    'approving a gate never turns a blocked report into a verified one',
  );
  assert.equal(
    qualityStatus({ ...base, latestReport: report('clear'), reviews: [review('rejected')] }).state,
    'rejected',
  );
  assert.equal(
    qualityStatus({
      ...base,
      latestReport: report('clear'),
      reviews: [review('changes_requested')],
    }).state,
    'changes_requested',
  );
});

test('findings are ordered by severity, then claim', () => {
  const sorted = sortFindings([
    {
      claimOrdinal: null,
      checkType: 'limitation',
      severity: 'info',
      code: 'ABSTAINED',
      detail: '',
    },
    {
      claimOrdinal: 1,
      checkType: 'currency',
      severity: 'warning',
      code: 'LAW_CHANGED_SINCE_RESEARCH',
      detail: '',
    },
    {
      claimOrdinal: 0,
      checkType: 'jurisdiction_fit',
      severity: 'blocking',
      code: 'JURISDICTION_MISMATCH',
      detail: '',
    },
  ]);
  assert.deepEqual(
    sorted.map((f) => f.code),
    ['JURISDICTION_MISMATCH', 'LAW_CHANGED_SINCE_RESEARCH', 'ABSTAINED'],
  );
});

test('services validate input and map database errors to stable codes', async () => {
  const calls = [];
  const client = (result) => ({ rpc: async (name, args) => (calls.push({ name, args }), result) });
  await assert.rejects(verifyResearchRun(client({}), 'not-a-uuid'), /VERIFICATION_INPUT_INVALID/);
  await assert.rejects(
    verifyResearchRun(client({}), RUN, '12-11-2026'),
    /VERIFICATION_INPUT_INVALID/,
  );
  const ok = await verifyResearchRun(
    client({ data: { reportId: 'r', outcome: 'clear', findings: 0 }, error: null }),
    RUN,
  );
  assert.equal(ok.outcome, 'clear');
  assert.deepEqual(calls.at(-1).args, { p_run_id: RUN });
  await assert.rejects(
    verifyResearchRun(client({ data: null, error: { message: 'QUALITY_NOT_AUTHORISED' } }), RUN),
    /QUALITY_NOT_AUTHORISED/,
  );
  await assert.rejects(
    verifyResearchRun(client({ data: null, error: { message: 'boom: internal detail' } }), RUN),
    /VERIFICATION_FAILED/,
  );
  await assert.rejects(
    decideReview(client({ error: null }), RUN, 'rejected', ' '),
    /REVIEW_NOTE_REQUIRED/,
  );
  await assert.rejects(
    decideReview(client({ error: { message: 'REVIEW_FOUR_EYES_REQUIRED' } }), RUN, 'approved', ''),
    /REVIEW_FOUR_EYES_REQUIRED/,
  );
  await decideReview(client({ error: null }), RUN, 'approved', '');
  assert.deepEqual(calls.at(-1).args, { p_request_id: RUN, p_decision: 'approved' });
});
