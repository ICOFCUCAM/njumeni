// GLCI-09: hands an approved engineering task to an executor (docs/GLCI_SPECIFICATION.md §5).
//
//   1. The owner's Claude Code routine (the same API trigger as the command centre). The routine
//      receives the brief as data and reports through glci_engineering_task_report.
//   2. Fallback: the "GLCI engineering task" GitHub Actions workflow (anthropics/claude-code-action),
//      started with workflow_dispatch. Its last step reports the result the same way.
// Either works on the task's own branch and ends in a pull request; nothing is merged or deployed
// here. Every outcome (dispatched, or failed with a reason) is recorded and audited.
import type { FetchLike, GlciAiEnvironment } from './ai-engines.ts';

export interface EngineeringEnvironment extends Pick<GlciAiEnvironment, 'claudeCodeRoutineUrl' | 'claudeCodeRoutineToken'> {
  githubToken: string | null;
  githubRepository: string;
  githubRef: string;
}
export function engineeringEnvironmentFrom(env: Record<string, string | undefined>): EngineeringEnvironment {
  const value = (name: string) => env[name]?.trim() || null;
  return {
    claudeCodeRoutineUrl: value('GLCI_CLAUDE_CODE_ROUTINE_URL'),
    claudeCodeRoutineToken: value('GLCI_CLAUDE_CODE_ROUTINE_TOKEN'),
    githubToken: value('GLCI_GITHUB_TOKEN'),
    githubRepository: value('GLCI_GITHUB_REPOSITORY') ?? 'ICOFCUCAM/njumeni',
    githubRef: value('GLCI_GITHUB_REF') ?? 'main',
  };
}

export const ENGINEERING_WORKFLOW_FILE = 'glci-engineering-task.yml';
const ROUTINE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_-]+\/fire$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_BRIEF = 20_000;

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
export interface DispatchAttempt {
  executor: 'claude_code_routine' | 'github_action';
  outcome: 'dispatched' | 'skipped' | 'failed';
  reason: string | null;
}
export interface DispatchResult {
  status: 'dispatched' | 'failed';
  executor: DispatchAttempt['executor'] | null;
  sessionUrl: string | null;
  attempts: DispatchAttempt[];
}

/** The routine's instructions for an engineering task (the brief itself is data). */
export function routineEngineeringText(brief: Record<string, unknown>): string {
  return JSON.stringify({
    ...brief,
    rules: [
      'Work only on the branch named in "branch"; never push to another branch, never deploy, never change the hosted database.',
      'Make the smallest change that fixes the task, with tests, and make the checks of the changed area pass.',
      'Open a pull request against the default branch.',
    ],
    report: "When done: select public.glci_engineering_task_report('<taskId>'::uuid, 'pr_opened', '<pull request url>', '<summary>'); " +
      "if not possible: select public.glci_engineering_task_report('<taskId>'::uuid, 'failed', null, '<summary>', 'AGENT_REPORTED_FAILURE');",
  });
}

export async function dispatchEngineeringTask(options: {
  rpc: Rpc;
  taskId: string;
  environment: EngineeringEnvironment;
  fetch?: FetchLike;
}): Promise<DispatchResult> {
  const fetcher = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const briefResult = await options.rpc('glci_engineering_task_brief', { p_task_id: options.taskId });
  if (briefResult.error || !briefResult.data) throw new Error('GLCI_ENGINEERING_BRIEF_UNAVAILABLE');
  const brief = briefResult.data as Record<string, unknown>;
  const attempts: DispatchAttempt[] = [];
  const env = options.environment;

  // 1. The owner's Claude Code routine.
  if (!env.claudeCodeRoutineUrl || !env.claudeCodeRoutineToken) {
    attempts.push({ executor: 'claude_code_routine', outcome: 'skipped', reason: 'CLAUDE_CODE_NOT_CONFIGURED' });
  } else if (!ROUTINE_URL.test(env.claudeCodeRoutineUrl)) {
    attempts.push({ executor: 'claude_code_routine', outcome: 'skipped', reason: 'CLAUDE_CODE_ROUTINE_URL_INVALID' });
  } else {
    try {
      const response = await fetcher(env.claudeCodeRoutineUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.claudeCodeRoutineToken}`, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'content-type': 'application/json' },
        body: JSON.stringify({ text: routineEngineeringText(brief) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(response.status === 429 ? 'CLAUDE_CODE_RATE_LIMITED' : 'CLAUDE_CODE_TRIGGER_' + response.status);
      const body = (await response.json()) as { claude_code_session_url?: unknown };
      const sessionUrl = typeof body.claude_code_session_url === 'string' && body.claude_code_session_url.startsWith('https://')
        ? body.claude_code_session_url : null;
      const recorded = await options.rpc('glci_engineering_task_dispatched', { p_task_id: options.taskId, p_executor: 'claude_code_routine', p_session_url: sessionUrl });
      if (recorded.error) throw new Error('GLCI_ENGINEERING_DISPATCH_NOT_RECORDED');
      attempts.push({ executor: 'claude_code_routine', outcome: 'dispatched', reason: null });
      return { status: 'dispatched', executor: 'claude_code_routine', sessionUrl, attempts };
    } catch (error) {
      attempts.push({ executor: 'claude_code_routine', outcome: 'failed', reason: error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : 'CLAUDE_CODE_TRIGGER_FAILED' });
    }
  }

  // 2. The GitHub Actions workflow.
  if (!env.githubToken) {
    attempts.push({ executor: 'github_action', outcome: 'skipped', reason: 'GITHUB_NOT_CONFIGURED' });
  } else if (!REPOSITORY.test(env.githubRepository) || !/^[A-Za-z0-9._/-]{1,100}$/.test(env.githubRef)) {
    attempts.push({ executor: 'github_action', outcome: 'skipped', reason: 'GITHUB_CONFIGURATION_INVALID' });
  } else {
    try {
      const briefText = JSON.stringify(brief);
      const response = await fetcher(
        `https://api.github.com/repos/${env.githubRepository}/actions/workflows/${ENGINEERING_WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${env.githubToken}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
          body: JSON.stringify({
            ref: env.githubRef,
            inputs: { task_id: options.taskId, branch: String(brief.branch), brief: briefText.length > MAX_BRIEF ? briefText.slice(0, MAX_BRIEF) : briefText },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok) throw new Error('GITHUB_DISPATCH_' + response.status);
      const recorded = await options.rpc('glci_engineering_task_dispatched', { p_task_id: options.taskId, p_executor: 'github_action', p_session_url: null });
      if (recorded.error) throw new Error('GLCI_ENGINEERING_DISPATCH_NOT_RECORDED');
      attempts.push({ executor: 'github_action', outcome: 'dispatched', reason: null });
      return { status: 'dispatched', executor: 'github_action', sessionUrl: null, attempts };
    } catch (error) {
      attempts.push({ executor: 'github_action', outcome: 'failed', reason: error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : 'GITHUB_DISPATCH_FAILED' });
    }
  }

  const reason = attempts.map(a => a.reason).filter(Boolean).join('_THEN_').slice(0, 80).replace(/[^A-Z0-9_]/g, '_') || 'NO_EXECUTOR_AVAILABLE';
  await options.rpc('glci_engineering_task_dispatch_failed', { p_task_id: options.taskId, p_error: attempts.every(a => a.outcome === 'skipped') ? 'NO_EXECUTOR_CONFIGURED' : reason });
  return { status: 'failed', executor: null, sessionUrl: null, attempts };
}
