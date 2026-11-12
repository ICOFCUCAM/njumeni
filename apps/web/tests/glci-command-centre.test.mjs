import assert from 'node:assert/strict';
import test from 'node:test';
import { answerCommand, detectIntent, detectJurisdictions, detectTopicTerms, COMMAND_ENGINE } from '../src/modules/glci/command-centre.ts';

// The four example requests of the specification (§5), plus Norwegian phrasings.
test('intents and jurisdictions are recognised in English and Norwegian', () => {
  assert.equal(detectIntent('Examine all Norwegian immigration legislation and identify whether Njumeni is using outdated provisions.'), 'examine_outdated');
  assert.equal(detectIntent('Why is our legal knowledge base behind the latest amendments?'), 'explain_lag');
  assert.equal(detectIntent('Update the Norwegian legal ingestion connector to support the latest official source format.'), 'update_connector');
  assert.equal(detectIntent('Check whether our European legal coverage is current.'), 'coverage_report');
  assert.equal(detectIntent('Hvorfor er kunnskapsbasen utdatert?'), 'explain_lag');
  assert.equal(detectIntent('Hello'), 'help');
  assert.deepEqual(detectJurisdictions('our European legal coverage'), ['EU', 'EEA', 'NO', 'SE', 'DK', 'FI', 'GB']);
  assert.deepEqual(detectJurisdictions('norsk utlendingslov'), ['NO']);
  assert.deepEqual(detectJurisdictions('Uganda and Cameroon'), ['CM', 'UG']);
  assert.ok(detectTopicTerms('Norwegian immigration legislation').includes('utlending'));
});

const currency = (code, verdict, extra = {}) => ({ jurisdictionCode: code, verdict, reasons: verdict === 'current' ? [] : ['1 monitored source(s) not verified (never checked, stale or failing).'],
  targets: {}, knowledgeLag: [], completeness: [], ...extra });
function fakeRpc(overrides = {}) {
  const calls = [];
  const data = {
    glci_observatory: { currency: [currency('NO', 'unverified'), currency('EU', 'not_monitored'), currency('SE', 'current')], failedIngestion: [], itemFailures: 2,
      sources: [{ jurisdictionCode: 'NO', name: 'Lovdata API — current laws', currency: 'check_failing', consecutiveFailures: 3 }] },
    glci_currency: currency('NO', 'behind'),
    glci_examine_authorities: [
      { citation: 'LOV-2008-05-15-35', title: 'Utlendingsloven', legalStatus: 'in_force', withdrawnFromSource: false, pendingCommencement: true,
        unreviewedChanges: 1, claimsCitingSupersededText: 2, effectiveFrom: '2027-01-01' },
      { citation: 'LOV-2005-06-10-51', title: 'Statsborgerloven', legalStatus: 'in_force', withdrawnFromSource: false, pendingCommencement: false,
        unreviewedChanges: 0, claimsCitingSupersededText: 0, effectiveFrom: '2022-01-01' },
    ],
    glci_registry: [{ code: 'NO', targets: [{ targetKey: 'no-lovdata-current-laws', monitorAdapter: 'lovdata-public-data-listing', status: 'active' }] }],
    glci_request_engineering_task: { issueId: 'i-1', proposalId: 'p-1' },
    ...overrides,
  };
  const rpc = async (fn, args) => { calls.push([fn, args]); return fn in data ? { data: data[fn], error: null } : { data: null, error: { message: 'missing' } }; };
  return { rpc, calls };
}
const conversation = '00000000-0000-4000-8000-000000000001';

test('coverage report: every European jurisdiction, never "current" without verification', async () => {
  const { rpc } = fakeRpc();
  const answer = await answerCommand(rpc, 'Check whether our European legal coverage is current.', conversation);
  assert.equal(answer.engine, COMMAND_ENGINE);
  assert.match(answer.answer, /NO: unverified/);
  assert.match(answer.answer, /SE: current/);
  assert.match(answer.answer, /EEA, DK, FI, GB: no monitoring profile yet/);
  assert.match(answer.answer, /1 verified current/);
});

test('examine outdated provisions: lists what needs attention, with evidence', async () => {
  const { rpc, calls } = fakeRpc();
  const answer = await answerCommand(rpc, 'Examine all Norwegian immigration legislation and identify whether Njumeni is using outdated provisions.', conversation);
  assert.match(answer.answer, /Examined 2 NO authorities/);
  assert.match(answer.answer, /LOV-2008-05-15-35: 1 unreviewed change\(s\); 2 research claim\(s\) cite superseded text; changes take effect 2027-01-01/);
  assert.match(answer.answer, /Caution:/);
  assert.equal(calls.find(([fn]) => fn === 'glci_examine_authorities')[1].p_jurisdiction_code, 'NO');
  const none = await answerCommand(fakeRpc({ glci_examine_authorities: [] }).rpc, 'Examine Norwegian immigration law for outdated provisions', conversation);
  assert.match(none.answer, /not covered, so outdated provisions cannot be ruled out/);
});

test('explain lag: source health, ingestion lag and indexing', async () => {
  const { rpc } = fakeRpc({ glci_observatory: { currency: [currency('NO', 'behind', { knowledgeLag: [{ targetKey: 'no-lovdata-current-laws', changedAt: '2026-11-12T02:32:00Z', lastIngestedAt: null }],
    completeness: [{ sourceKey: 'lovdata-official', missing: 3, passagesWithoutEmbedding: 40 }] })], failedIngestion: [{}], itemFailures: 0,
    sources: [{ jurisdictionCode: 'NO', name: 'Lovdata API — current laws', currency: 'check_failing', consecutiveFailures: 3 }] } });
  const answer = await answerCommand(rpc, 'Why is our legal knowledge base behind the latest amendments?', conversation);
  assert.match(answer.answer, /Lovdata API — current laws is check failing \(3 failed checks\)/);
  assert.match(answer.answer, /changed 2026-11-12, last ingested never/);
  assert.match(answer.answer, /3 missing authorities, 40 passages not embedded/);
  assert.match(answer.answer, /1 recent failed or partial run/);
});

test('connector update: opens an engineering request for approval, never changes code directly', async () => {
  const { rpc, calls } = fakeRpc();
  const answer = await answerCommand(rpc, 'Update the Norwegian legal ingestion connector to support the latest official source format.', conversation);
  const request = calls.find(([fn]) => fn === 'glci_request_engineering_task')[1];
  assert.equal(request.p_target_key, 'no-lovdata-current-laws');
  assert.equal(request.p_conversation_id, conversation);
  assert.deepEqual(answer.actions, [{ kind: 'proposal_created', label: "Engineering task awaiting a second operator's approval", reference: 'p-1' }]);
  assert.match(answer.answer, /only after another operator approves/);
});

test('invalid questions and unavailable data are refused', async () => {
  await assert.rejects(answerCommand(fakeRpc().rpc, 'x', conversation), /GLCI_COMMAND_INVALID/);
  await assert.rejects(answerCommand(fakeRpc({ glci_observatory: undefined }).rpc, 'Is our coverage current?', conversation).catch(e => { throw e; }), /GLCI_COMMAND_DATA_UNAVAILABLE|Cannot read/);
});
