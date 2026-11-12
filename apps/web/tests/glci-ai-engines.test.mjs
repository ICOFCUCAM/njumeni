import assert from 'node:assert/strict';
import test from 'node:test';
import { aiEnvironmentFrom, ANALYST_SYSTEM_PROMPT, costUsd, engineOrder, runCommandWithEngines } from '../src/modules/glci/ai-engines.ts';

const settings = (extra = {}) => ({ primaryEngine: 'claude_code', fallbackEnabled: true, anthropicModel: 'claude-opus-5-5', monthlyBudgetUsd: 25, spentThisMonthUsd: 0, ...extra });
const ROUTINE = 'https://api.anthropic.com/v1/claude_code/routines/trig_abc123/fire';
const configured = { anthropicApiKey: 'sk-ant-test', claudeCodeRoutineUrl: ROUTINE, claudeCodeRoutineToken: 'routine-token' };
const conversationId = '00000000-0000-4000-8000-0000000000aa';

function fakeRpc() {
  const calls = [];
  const data = {
    glci_observatory: { currency: [{ jurisdictionCode: 'NO', verdict: 'unverified', reasons: ['1 monitored source(s) not verified.'], targets: {}, knowledgeLag: [], completeness: [] }] },
    glci_ai_record_call: null,
    glci_agent_dispatch_create: 'ok',
  };
  const rpc = async (fn, args) => { calls.push([fn, args]); return fn in data ? { data: data[fn], error: null } : { data: null, error: { message: 'missing ' + fn } }; };
  return { rpc, calls };
}
const anthropicReturning = (response) => {
  const requests = [];
  return { requests, client: { beta: { messages: { create: async (params) => { requests.push(params); if (response instanceof Error) throw response; return response; } } } } };
};
const message = (text, extra = {}) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 500 }, ...extra });
const run = (overrides) => {
  const { rpc, calls } = fakeRpc();
  return { calls, promise: runCommandWithEngines({ rpc, settings: settings(), environment: configured, question: 'Is our Norwegian coverage current?',
    conversationId, questionSequence: 3, override: null, history: [], ...overrides(rpc) }) };
};

test('the engine order follows the switch, with fallback Claude Code → API → rules', () => {
  assert.deepEqual(engineOrder({ primaryEngine: 'claude_code', fallbackEnabled: true }, null), ['claude_code', 'anthropic_api', 'rules']);
  assert.deepEqual(engineOrder({ primaryEngine: 'anthropic_api', fallbackEnabled: true }, null), ['anthropic_api', 'rules']);
  assert.deepEqual(engineOrder({ primaryEngine: 'claude_code', fallbackEnabled: false }, null), ['claude_code']);
  assert.deepEqual(engineOrder({ primaryEngine: 'claude_code', fallbackEnabled: true }, 'rules'), ['rules'], 'a choice for one question is used alone');
  assert.equal(costUsd('claude-opus-5-5', 1_000_000, 100_000), 6);
  assert.deepEqual(aiEnvironmentFrom({ ANTHROPIC_API_KEY: ' k ' }), { anthropicApiKey: 'k', claudeCodeRoutineUrl: null, claudeCodeRoutineToken: null });
});

test('Claude Code first: the question is handed to the routine and answered later', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push([url, init]); return { ok: true, status: 200, json: async () => ({ claude_code_session_id: 's1', claude_code_session_url: 'https://claude.ai/code/session_s1' }) }; };
  const { calls, promise } = run(() => ({ fetch }));
  const result = await promise;
  assert.equal(result.status, 'dispatched');
  assert.equal(result.sessionUrl, 'https://claude.ai/code/session_s1');
  assert.equal(sent[0][0], ROUTINE);
  assert.equal(sent[0][1].headers.authorization, 'Bearer routine-token');
  assert.equal(sent[0][1].headers['anthropic-beta'], 'experimental-cc-routine-2026-04-01');
  const handoff = JSON.parse(JSON.parse(sent[0][1].body).text);
  assert.equal(handoff.dispatchId, result.dispatchId);
  assert.equal(handoff.question, 'Is our Norwegian coverage current?');
  assert.match(handoff.reply, /glci_agent_reply/);
  const dispatch = calls.find(([fn]) => fn === 'glci_agent_dispatch_create')[1];
  assert.deepEqual([dispatch.p_dispatch_id, dispatch.p_question_sequence], [result.dispatchId, 3]);
});

test('Claude Code unavailable: the API answers, grounded in live data, with server-side fallbacks', async () => {
  const fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const anthropic = anthropicReturning(message('Norway is unverified: the Lovdata source has not been checked.'));
  const { calls, promise } = run(() => ({ fetch, anthropic: anthropic.client }));
  const result = await promise;
  assert.equal(result.status, 'answered');
  assert.equal(result.engine, 'anthropic_api');
  assert.equal(result.engineLabel, 'anthropic-api:claude-opus-5-5');
  assert.deepEqual(result.attempts.map(a => [a.engine, a.outcome, a.reason]), [['claude_code', 'failed', 'CLAUDE_CODE_RATE_LIMITED'], ['anthropic_api', 'succeeded', null]]);
  const request = anthropic.requests[0];
  assert.equal(request.model, 'claude-opus-5-5');
  assert.equal(request.fallbacks, 'default');
  assert.deepEqual(request.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(request.system, ANALYST_SYSTEM_PROMPT);
  assert.match(request.messages.at(-1).content, /Live Njumeni data \(JSON\)/);
  assert.match(request.messages.at(-1).content, /unverified/);
  const recorded = calls.filter(([fn]) => fn === 'glci_ai_record_call').map(([, a]) => a);
  assert.equal(recorded.at(-1).p_cost_usd, costUsd('claude-opus-5-5', 1000, 500), 'the API cost is recorded for the budget');
});

test('every engine down: the rules engine still answers from live data', async () => {
  const { promise } = run(() => ({ environment: { anthropicApiKey: null, claudeCodeRoutineUrl: null, claudeCodeRoutineToken: null } }));
  const result = await promise;
  assert.equal(result.engine, 'rules');
  assert.match(result.content, /Coverage report/);
  assert.deepEqual(result.attempts.map(a => [a.engine, a.outcome, a.reason]), [
    ['claude_code', 'skipped', 'CLAUDE_CODE_NOT_CONFIGURED'], ['anthropic_api', 'skipped', 'ANTHROPIC_NOT_CONFIGURED'], ['rules', 'succeeded', null]]);
});

test('refusals, errors and an exhausted budget fall through; the history alternates correctly', async () => {
  const refused = anthropicReturning(message('', { stop_reason: 'refusal' }));
  const r1 = await run(() => ({ environment: { ...configured, claudeCodeRoutineUrl: null }, anthropic: refused.client })).promise;
  assert.deepEqual(r1.attempts.slice(1).map(a => [a.engine, a.outcome]), [['anthropic_api', 'refused'], ['rules', 'succeeded']]);
  const broken = anthropicReturning(new Error('boom'));
  const r2 = await run(() => ({ environment: { ...configured, claudeCodeRoutineUrl: null }, anthropic: broken.client })).promise;
  assert.equal(r2.attempts[1].reason, 'ENGINE_UNEXPECTED_ERROR');
  const r3 = await run(() => ({ settings: settings({ spentThisMonthUsd: 25 }), environment: { ...configured, claudeCodeRoutineUrl: null } })).promise;
  assert.equal(r3.attempts[1].reason, 'AI_BUDGET_EXHAUSTED');
  const bad = await run(() => ({ environment: { ...configured, claudeCodeRoutineUrl: 'https://evil.example/fire' }, anthropic: anthropicReturning(message('ok')).client })).promise;
  assert.equal(bad.attempts[0].reason, 'CLAUDE_CODE_ROUTINE_URL_INVALID', 'the token is only ever sent to the Anthropic routine endpoint');
  const withHistory = anthropicReturning(message('ok'));
  await run(() => ({ environment: { ...configured, claudeCodeRoutineUrl: null }, anthropic: withHistory.client,
    history: [{ authorKind: 'assistant', content: 'orphan' }, { authorKind: 'operator', content: 'q1' }, { authorKind: 'assistant', content: 'a1' }, { authorKind: 'operator', content: 'unanswered' }] })).promise;
  assert.deepEqual(withHistory.requests[0].messages.map(m => m.role), ['user', 'assistant', 'user']);
  const noFallback = run(() => ({ settings: settings({ fallbackEnabled: false }), environment: { ...configured, claudeCodeRoutineUrl: null } }));
  await assert.rejects(noFallback.promise, /GLCI_NO_ENGINE_AVAILABLE/, 'without fallback, an unavailable engine is reported, not silently replaced');
});
