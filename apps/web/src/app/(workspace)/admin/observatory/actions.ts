'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dispatchEngineeringTask, engineeringEnvironmentFrom } from '@/modules/glci/engineering-runner';
import { aiEnvironmentFrom, GLCI_ENGINES, runCommandWithEngines, type GlciAiSettings, type GlciEngine } from '@/modules/glci/ai-engines';

const PATH = '/admin/observatory';
function back(params: Record<string, string>): never {
  redirect(PATH + '?' + new URLSearchParams(params).toString());
}
function code(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
  const match = /[A-Z][A-Z0-9_]{3,80}/.exec(message);
  return (match?.[0] ?? 'GLCI_ACTION_FAILED').toLowerCase().replace(/_/g, '-');
}

async function dispatchTask(supabase: Awaited<ReturnType<typeof createClient>>, taskId: string): Promise<void> {
  const rpc = (fn: string, args?: Record<string, unknown>) =>
    supabase.rpc(fn as never, args as never) as unknown as Promise<{ data: unknown; error: unknown }>;
  try {
    await dispatchEngineeringTask({ rpc, taskId, environment: engineeringEnvironmentFrom(process.env) });
  } catch {
    // The task stays queued or failed; the observatory shows it with a retry button.
  }
}

/** Operator actions on the observatory. Every RPC re-checks the operator role and audits. */
export async function observatoryAction(form: FormData): Promise<void> {
  const supabase = await createClient();
  const action = String(form.get('action') ?? '');
  const id = String(form.get('id') ?? '');
  const note = String(form.get('note') ?? '');
  const conversation = String(form.get('conversation') ?? '');
  let result: { error: unknown };
  switch (action) {
    case 'approve':
    case 'reject':
      result = await supabase.rpc('glci_decide_proposal', { p_proposal_id: id, p_decision: action === 'approve' ? 'approved' : 'rejected', p_note: note });
      break;
    case 'execute': {
      const executed = await supabase.rpc('glci_execute_proposal', { p_proposal_id: id });
      result = executed;
      // An approved engineering task is handed to an executor at once (Claude Code, else the
      // GitHub workflow). A failed hand-off is recorded on the task and can be retried.
      const taskId = (executed.data as { engineeringTaskId?: string } | null)?.engineeringTaskId;
      if (!executed.error && taskId) await dispatchTask(supabase, taskId);
      break;
    }
    case 'checkpoint':
      result = await supabase.rpc('glci_audit_checkpoint' as never);
      break;
    case 'drill':
      result = await supabase.rpc('glci_run_recovery_drill' as never);
      break;
    case 'tick':
      result = await supabase.rpc('glci_tick' as never);
      break;
    case 'request-activation':
      result = await supabase.rpc('glci_request_action' as never, {
        p_action_type: 'activate_target', p_subject: id, p_payload: {}, p_reason: note,
      } as never);
      break;
    case 'approve-action':
    case 'reject-action':
      result = await supabase.rpc('glci_decide_action' as never, {
        p_request_id: id, p_decision: action === 'approve-action' ? 'approved' : 'rejected', p_note: note,
      } as never);
      break;
    case 'dispatch-task':
      result = { error: null };
      await dispatchTask(supabase, id);
      break;
    case 'dismiss':
      result = await supabase.rpc('glci_dismiss_issue', { p_issue_id: id, p_reason: note });
      break;
    case 'check':
      result = await supabase.rpc('glci_request_check', { p_target_key: id });
      break;
    case 'verify':
      result = await supabase.rpc('glci_run_currency_verification', {});
      break;
    case 'reconcile':
      result = await supabase.rpc('glci_reconcile_issues');
      break;
    case 'ai-settings': {
      const engine = String(form.get('primaryEngine') ?? '');
      const budget = Number(form.get('monthlyBudgetUsd'));
      result = await supabase.rpc('glci_ai_settings_set', {
        p_primary_engine: engine,
        p_fallback_enabled: form.get('fallbackEnabled') === 'on',
        p_anthropic_model: String(form.get('anthropicModel') ?? '').trim() || null,
        p_monthly_budget_usd: Number.isFinite(budget) ? budget : null,
        p_reason: note,
      } as never);
      break;
    }
    default:
      back({ error: 'unknown-action', ...(conversation ? { conversation } : {}) });
  }
  revalidatePath(PATH);
  if (result.error) back({ error: code(result.error), ...(conversation ? { conversation } : {}) });
  back({ done: action, ...(conversation ? { conversation } : {}) });
}

/**
 * The command centre: records the question, then runs the engines in the operator's order
 * (Claude Code → Anthropic API → rules, or one engine chosen for this question). An immediate
 * answer is recorded; a Claude Code answer arrives later through glci_agent_reply.
 */
export async function askCommandCentre(form: FormData): Promise<void> {
  const supabase = await createClient();
  const question = String(form.get('question') ?? '').trim();
  const given = String(form.get('conversation') ?? '');
  const conversation = /^[0-9a-f-]{36}$/.test(given) ? given : randomUUID();
  const choice = String(form.get('engine') ?? 'auto');
  const override = (GLCI_ENGINES as readonly string[]).includes(choice) ? (choice as GlciEngine) : null;
  if (question.length < 3 || question.length > 4000) back({ error: 'question-invalid', conversation });
  const rpc = (fn: string, args?: Record<string, unknown>) =>
    supabase.rpc(fn as never, args as never) as unknown as Promise<{ data: unknown; error: unknown }>;
  const [settings, previous] = await Promise.all([rpc('glci_ai_settings_get'), rpc('glci_command_conversation', { p_conversation_id: conversation })]);
  if (settings.error) back({ error: code(settings.error), conversation });
  const history = ((previous.data ?? []) as { authorKind: 'operator' | 'assistant'; content: string }[]).map((m) => ({
    authorKind: m.authorKind,
    content: m.content,
  }));
  const asked = await rpc('glci_command_record', {
    p_conversation_id: conversation, p_author_kind: 'operator', p_content: question, p_intent: null, p_engine: null, p_data: {},
  });
  if (asked.error || typeof asked.data !== 'number') back({ error: code(asked.error), conversation });
  let failure: string | null = null;
  try {
    const result = await runCommandWithEngines({
      rpc,
      settings: settings.data as GlciAiSettings,
      environment: aiEnvironmentFrom(process.env),
      question,
      conversationId: conversation,
      questionSequence: asked.data as number,
      override,
      history,
    });
    if (result.status === 'answered') {
      const recorded = await rpc('glci_command_record', {
        p_conversation_id: conversation, p_author_kind: 'assistant', p_content: result.content, p_intent: result.rules.intent,
        p_engine: result.engineLabel,
        p_data: { jurisdictions: result.rules.jurisdictions, actions: result.rules.actions, attempts: result.attempts },
      });
      if (recorded.error) failure = code(recorded.error);
    }
  } catch (error) {
    failure = code(error);
  }
  revalidatePath(PATH);
  back(failure ? { error: failure, conversation } : { conversation });
}
