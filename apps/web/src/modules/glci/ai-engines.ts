// GLCI-08: AI engines for the command centre, with the operator's switch and fallback
// (docs/GLCI_SPECIFICATION.md §5; owner decision 2026-11-12).
//
//   claude_code    The owner's Claude Code. The question is handed to a Claude Code routine on
//                  claude.ai through its documented API trigger. The routine runs on the owner's
//                  subscription with the repository and the Njumeni database. It investigates and
//                  answers asynchronously by calling glci_agent_reply.
//   anthropic_api  The Anthropic API with the server's API key. Answers immediately, grounded in
//                  the live GLCI data that the rules engine gathered. Budgeted and audited.
//   rules          The deterministic engine (command-centre.ts). It is always available.
//
// With fallback on, an engine that is not configured, over budget, refused or failing hands over
// to the next one: claude_code → anthropic_api → rules. AI output is advisory: it changes
// nothing; the approval flows do. Secrets come only from the server environment.
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { answerCommand, type CommandAnswer } from './command-centre.ts';

export const GLCI_ENGINES = Object.freeze(['claude_code', 'anthropic_api', 'rules'] as const);
export type GlciEngine = (typeof GLCI_ENGINES)[number];

export interface GlciAiSettings {
  primaryEngine: GlciEngine;
  fallbackEnabled: boolean;
  anthropicModel: string;
  monthlyBudgetUsd: number;
  spentThisMonthUsd: number;
}
export interface GlciAiEnvironment {
  anthropicApiKey: string | null;
  claudeCodeRoutineUrl: string | null;
  claudeCodeRoutineToken: string | null;
}
export function aiEnvironmentFrom(env: Record<string, string | undefined>): GlciAiEnvironment {
  const value = (name: string) => env[name]?.trim() || null;
  return {
    anthropicApiKey: value('ANTHROPIC_API_KEY'),
    claudeCodeRoutineUrl: value('GLCI_CLAUDE_CODE_ROUTINE_URL'),
    claudeCodeRoutineToken: value('GLCI_CLAUDE_CODE_ROUTINE_TOKEN'),
  };
}

/** Engines to try, in order. An explicit choice for one question is tried alone. */
export function engineOrder(settings: Pick<GlciAiSettings, 'primaryEngine' | 'fallbackEnabled'>, override: GlciEngine | null): GlciEngine[] {
  if (override) return [override];
  if (!settings.fallbackEnabled) return [settings.primaryEngine];
  const chain: GlciEngine[] = ['claude_code', 'anthropic_api', 'rules'];
  return [settings.primaryEngine, ...chain.slice(chain.indexOf(settings.primaryEngine) + 1)];
}

// Price per million tokens (USD), for the budget. Unknown models are priced as Claude Opus 5.5.
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-fable-5-2': { input: 8, output: 40 },
};
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? PRICES['claude-opus-5-5']!;
  return Number(((inputTokens * price.input + outputTokens * price.output) / 1_000_000).toFixed(6));
}

export const ANALYST_SYSTEM_PROMPT = [
  "You are Njumeni's legal change analyst, answering a platform administrator in the Super Admin command centre.",
  'Njumeni is a legal research platform. Its Global Legal Change Intelligence system monitors official legal sources, detects new and amended legislation, analyses which Njumeni records depend on changed text, and verifies whether Njumeni\'s legal knowledge is current per jurisdiction.',
  'Answer only from the live Njumeni data in the request. When the data does not establish something, say so; never present a jurisdiction as current unless its verdict is "current".',
  'Keep publication, enactment, effective (commencement) and repeal dates apart, and point out transitional provisions.',
  'When something needs fixing, recommend concrete Njumeni actions: re-synchronise a source, review a detected change, notify affected workspaces, or raise an engineering task for a connector change. These need operator approval, and code changes are made by the engineering agent through a reviewed pull request.',
  'Your answer is advice to the administrator, not legal advice to clients and not an approval. Be concise and structured; reply in the language of the question.',
].join('\n');

interface Rpc {
  (fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}
/** The subset of the Anthropic client used here (lets tests supply a fake). */
export interface AnthropicMessagesClient {
  beta: { messages: { create(params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.Messages.BetaMessage> } };
}
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface EngineAttempt {
  engine: GlciEngine;
  outcome: 'succeeded' | 'dispatched' | 'failed' | 'refused' | 'skipped';
  reason: string | null;
}
export type CommandRunResult =
  | { status: 'answered'; engine: GlciEngine; engineLabel: string; content: string; rules: CommandAnswer; attempts: EngineAttempt[] }
  | { status: 'dispatched'; engine: 'claude_code'; dispatchId: string; sessionUrl: string | null; rules: CommandAnswer; attempts: EngineAttempt[] };

function reasonOf(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'ANTHROPIC_AUTHENTICATION_FAILED';
  if (error instanceof Anthropic.RateLimitError) return 'ANTHROPIC_RATE_LIMITED';
  if (error instanceof Anthropic.BadRequestError) return 'ANTHROPIC_BAD_REQUEST';
  if (error instanceof Anthropic.APIError) return 'ANTHROPIC_API_ERROR';
  if (error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message)) return error.message;
  return 'ENGINE_UNEXPECTED_ERROR';
}

/** The routine prompt receives this text as untrusted input; it names the dispatch to reply to. */
export function claudeCodeHandoffText(input: { dispatchId: string; conversationId: string; question: string; rules: CommandAnswer }): string {
  return JSON.stringify({
    kind: 'njumeni-glci-command',
    dispatchId: input.dispatchId,
    conversationId: input.conversationId,
    question: input.question,
    detectedIntent: input.rules.intent,
    jurisdictions: input.rules.jurisdictions,
    liveDataSummary: input.rules.answer,
    reply: 'Answer with: select public.glci_agent_reply(\'<dispatchId>\'::uuid, \'<answer>\', \'{}\'::jsonb);',
  });
}

export async function runCommandWithEngines(options: {
  rpc: Rpc;
  settings: GlciAiSettings;
  environment: GlciAiEnvironment;
  question: string;
  conversationId: string;
  questionSequence: number;
  override: GlciEngine | null;
  history: { authorKind: 'operator' | 'assistant'; content: string }[];
  anthropic?: AnthropicMessagesClient;
  fetch?: FetchLike;
}): Promise<CommandRunResult> {
  // Live data first: every engine is grounded in it, and the rules engine performs the governed
  // side effects (an engineering request still needs a second operator's approval).
  const rules = await answerCommand(options.rpc, options.question, options.conversationId);
  const attempts: EngineAttempt[] = [];
  const record = async (attempt: EngineAttempt, model: string | null = null, usage: { input: number; output: number } | null = null) => {
    attempts.push(attempt);
    await options.rpc('glci_ai_record_call', {
      p_conversation_id: options.conversationId, p_engine: attempt.engine, p_model: model, p_outcome: attempt.outcome,
      p_reason: attempt.reason, p_input_tokens: usage?.input ?? 0, p_output_tokens: usage?.output ?? 0,
      p_cost_usd: usage && model ? costUsd(model, usage.input, usage.output) : 0,
    });
  };

  for (const engine of engineOrder(options.settings, options.override)) {
    if (engine === 'claude_code') {
      const { claudeCodeRoutineUrl: url, claudeCodeRoutineToken: token } = options.environment;
      if (!url || !token) { await record({ engine, outcome: 'skipped', reason: 'CLAUDE_CODE_NOT_CONFIGURED' }); continue; }
      if (!/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_-]+\/fire$/.test(url)) {
        await record({ engine, outcome: 'skipped', reason: 'CLAUDE_CODE_ROUTINE_URL_INVALID' }); continue;
      }
      const dispatchId = randomUUID();
      try {
        const response = await (options.fetch ?? (globalThis.fetch as unknown as FetchLike))(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'content-type': 'application/json' },
          body: JSON.stringify({ text: claudeCodeHandoffText({ dispatchId, conversationId: options.conversationId, question: options.question, rules }) }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(response.status === 429 ? 'CLAUDE_CODE_RATE_LIMITED' : 'CLAUDE_CODE_TRIGGER_' + response.status);
        const body = (await response.json()) as { claude_code_session_url?: unknown };
        const sessionUrl = typeof body.claude_code_session_url === 'string' && body.claude_code_session_url.startsWith('https://')
          ? body.claude_code_session_url : null;
        const created = await options.rpc('glci_agent_dispatch_create', {
          p_dispatch_id: dispatchId, p_conversation_id: options.conversationId, p_question_sequence: options.questionSequence, p_session_url: sessionUrl,
        });
        if (created.error) throw new Error('GLCI_DISPATCH_NOT_RECORDED');
        await record({ engine, outcome: 'dispatched', reason: null });
        return { status: 'dispatched', engine, dispatchId, sessionUrl, rules, attempts };
      } catch (error) {
        await record({ engine, outcome: 'failed', reason: reasonOf(error) });
        continue;
      }
    }

    if (engine === 'anthropic_api') {
      if (!options.environment.anthropicApiKey) { await record({ engine, outcome: 'skipped', reason: 'ANTHROPIC_NOT_CONFIGURED' }); continue; }
      if (options.settings.monthlyBudgetUsd <= 0 || options.settings.spentThisMonthUsd >= options.settings.monthlyBudgetUsd) {
        await record({ engine, outcome: 'skipped', reason: 'AI_BUDGET_EXHAUSTED' }); continue;
      }
      const client = options.anthropic ?? new Anthropic({ apiKey: options.environment.anthropicApiKey });
      const model = options.settings.anthropicModel;
      try {
        const history: Anthropic.Beta.Messages.BetaMessageParam[] = options.history.slice(-8).map(m => ({
          role: m.authorKind === 'operator' ? 'user' : 'assistant', content: m.content,
        }));
        // Earlier turns must start with a question and end with an answer before the new question.
        while (history.length && history[0]!.role !== 'user') history.shift();
        while (history.length && history[history.length - 1]!.role !== 'assistant') history.pop();
        const response = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          system: ANALYST_SYSTEM_PROMPT,
          output_config: { effort: 'medium' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          messages: [
            ...history,
            { role: 'user', content: `Question: ${options.question}\n\nLive Njumeni data (JSON):\n${JSON.stringify({ intent: rules.intent, jurisdictions: rules.jurisdictions, summary: rules.answer, data: rules.data, actions: rules.actions })}` },
          ],
        });
        const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
        if (response.stop_reason === 'refusal') { await record({ engine, outcome: 'refused', reason: 'ANTHROPIC_REFUSED' }, model, usage); continue; }
        const text = response.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('\n').trim();
        if (!text) { await record({ engine, outcome: 'failed', reason: 'ANTHROPIC_EMPTY_ANSWER' }, model, usage); continue; }
        await record({ engine, outcome: 'succeeded', reason: null }, response.model ?? model, usage);
        return { status: 'answered', engine, engineLabel: 'anthropic-api:' + (response.model ?? model), content: text, rules, attempts };
      } catch (error) {
        await record({ engine, outcome: 'failed', reason: reasonOf(error) }, model);
        continue;
      }
    }

    await record({ engine: 'rules', outcome: 'succeeded', reason: null });
    return { status: 'answered', engine: 'rules', engineLabel: rules.engine, content: rules.answer, rules, attempts };
  }
  throw new Error('GLCI_NO_ENGINE_AVAILABLE');
}
