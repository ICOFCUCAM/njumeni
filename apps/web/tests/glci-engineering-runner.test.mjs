import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchEngineeringTask, engineeringEnvironmentFrom, ENGINEERING_WORKFLOW_FILE, routineEngineeringText } from '../src/modules/glci/engineering-runner.ts';
import { reportPayload } from '../../../scripts/glci/report-engineering-task.mjs';

const TASK = '00000000-0000-4000-8000-0000000000e1';
const brief = { kind: 'njumeni-glci-engineering-task', taskId: TASK, branch: 'glci/task-0000abcd', instruction: 'Fix the Lovdata listing monitor.' };
function fakeRpc() {
  const calls = [];
  const rpc = async (fn, args) => { calls.push([fn, args]); return fn === 'glci_engineering_task_brief' ? { data: brief, error: null } : { data: null, error: null }; };
  return { rpc, calls };
}
const env = (extra = {}) => ({ claudeCodeRoutineUrl: 'https://api.anthropic.com/v1/claude_code/routines/trig_1/fire', claudeCodeRoutineToken: 'rt',
  githubToken: 'gh', githubRepository: 'ICOFCUCAM/njumeni', githubRef: 'main', ...extra });

test('Claude Code first: the routine receives the brief and the reporting rule', async () => {
  const { rpc, calls } = fakeRpc();
  const sent = [];
  const fetch = async (url, init) => { sent.push([url, init]); return { ok: true, status: 200, json: async () => ({ claude_code_session_url: 'https://claude.ai/code/session_e1' }) }; };
  const result = await dispatchEngineeringTask({ rpc, taskId: TASK, environment: env(), fetch });
  assert.equal(result.status, 'dispatched');
  assert.equal(result.executor, 'claude_code_routine');
  assert.equal(sent.length, 1, 'GitHub is not used when Claude Code accepts');
  const text = JSON.parse(JSON.parse(sent[0][1].body).text);
  assert.equal(text.branch, 'glci/task-0000abcd');
  assert.match(text.report, /glci_engineering_task_report/);
  assert.ok(text.rules.some(r => /never push to another branch/.test(r)));
  assert.deepEqual(calls.at(-1), ['glci_engineering_task_dispatched', { p_task_id: TASK, p_executor: 'claude_code_routine', p_session_url: 'https://claude.ai/code/session_e1' }]);
});

test('Claude Code unavailable: the GitHub workflow is dispatched with validated inputs', async () => {
  const { rpc, calls } = fakeRpc();
  const sent = [];
  const fetch = async (url, init) => { sent.push([url, init]); return url.includes('anthropic') ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 204, json: async () => ({}) }; };
  const result = await dispatchEngineeringTask({ rpc, taskId: TASK, environment: env(), fetch });
  assert.equal(result.executor, 'github_action');
  assert.deepEqual(result.attempts.map(a => [a.executor, a.outcome, a.reason]), [['claude_code_routine', 'failed', 'CLAUDE_CODE_RATE_LIMITED'], ['github_action', 'dispatched', null]]);
  assert.equal(sent[1][0], `https://api.github.com/repos/ICOFCUCAM/njumeni/actions/workflows/${ENGINEERING_WORKFLOW_FILE}/dispatches`);
  const body = JSON.parse(sent[1][1].body);
  assert.deepEqual([body.ref, body.inputs.task_id, body.inputs.branch], ['main', TASK, 'glci/task-0000abcd']);
  assert.equal(JSON.parse(body.inputs.brief).instruction, 'Fix the Lovdata listing monitor.');
  assert.equal(calls.at(-1)[1].p_executor, 'github_action');
});

test('nothing configured: the task is marked failed with a clear reason, for retry', async () => {
  const { rpc, calls } = fakeRpc();
  const result = await dispatchEngineeringTask({ rpc, taskId: TASK, environment: engineeringEnvironmentFrom({}), fetch: async () => assert.fail('no network call') });
  assert.equal(result.status, 'failed');
  assert.deepEqual(calls.at(-1), ['glci_engineering_task_dispatch_failed', { p_task_id: TASK, p_error: 'NO_EXECUTOR_CONFIGURED' }]);
  const bad = await dispatchEngineeringTask({ rpc, taskId: TASK, environment: env({ claudeCodeRoutineUrl: 'https://evil.example/fire', githubToken: null }), fetch: async () => assert.fail('no call') });
  assert.equal(bad.attempts[0].reason, 'CLAUDE_CODE_ROUTINE_URL_INVALID', 'the routine token is only sent to Anthropic');
  assert.ok(routineEngineeringText(brief).includes('njumeni-glci-engineering-task'));
});

test('the workflow report accepts only a GitHub pull request from a successful run', () => {
  const ok = reportPayload(TASK, JSON.stringify({ status: 'pr_opened', pullRequestUrl: 'https://github.com/ICOFCUCAM/njumeni/pull/7', summary: 'Fixed.' }), 'success');
  assert.deepEqual([ok.p_status, ok.p_pull_request_url, ok.p_error], ['pr_opened', 'https://github.com/ICOFCUCAM/njumeni/pull/7', null]);
  assert.equal(reportPayload(TASK, JSON.stringify({ status: 'pr_opened', pullRequestUrl: 'https://evil.example/pull/7', summary: 'x' }), 'success').p_error, 'PULL_REQUEST_URL_MISSING');
  assert.equal(reportPayload(TASK, '', 'failure').p_error, 'GITHUB_ACTION_FAILED');
  assert.equal(reportPayload(TASK, '{not json', 'success').p_status, 'failed');
  assert.equal(reportPayload(TASK, JSON.stringify({ status: 'failed', summary: 'Could not reproduce' }), 'success').p_error, 'AGENT_REPORTED_FAILURE');
});
