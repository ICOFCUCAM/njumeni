'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AgentRefusedError } from '@/modules/ai/core';
import {
  analyseIntake,
  intakeQuestions,
  validateIntake,
  type IntakeSummary,
  type LegalCategory,
} from '@/modules/cases/intake';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  MATTER_NOT_AUTHORISED: 'not-authorized',
  MATTER_CLOSED: 'closed',
  MATTER_LINK_OUT_OF_SCOPE: 'link',
  MATTER_STATUS_INVALID: 'status',
  MATTER_ASSIGNEE_NOT_MEMBER: 'assignee',
  MATTER_ASSIGNEE_BARRED: 'barred',
  MATTER_BARRIER_SELF: 'event',
  MATTER_EVENT_INVALID: 'event',
};
function back(matterId: string, message?: string): never {
  revalidatePath(`/matters/${matterId}`);
  const code = message?.match(/MATTER_[A-Z_]+/)?.[0];
  redirect(`/matters/${matterId}${message ? `?error=${(code && ERRORS[code]) ?? 'failed'}` : ''}`);
}

export async function createMatterFromIntake(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const category = String(formData.get('category') ?? '');
  const jurisdictionCode = String(formData.get('jurisdictionCode') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const form = `/matters/new?org=${organizationId}&ws=${workspaceId}&category=${encodeURIComponent(category)}`;
  if (!UUID.test(organizationId) || !UUID.test(workspaceId))
    redirect('/matters?error=invalid-scope');
  let intake;
  try {
    const raw: Record<string, string> = {};
    for (const q of intakeQuestions(category as LegalCategory))
      raw[q.key] = String(formData.get(`answer:${q.key}`) ?? '');
    intake = validateIntake(category, raw);
  } catch {
    redirect(`${form}&error=invalid-input`);
  }
  if (
    title.length < 3 ||
    intake.missing.length > 0 ||
    !/^[A-Z][A-Z0-9_-]{1,15}$/.test(jurisdictionCode)
  )
    redirect(`${form}&error=missing`);

  const supabase = await createClient();
  const scope = { organizationId, workspaceId };
  let summary: IntakeSummary | null = null;
  let executionId: string | null = null;
  try {
    ({ summary, executionId } = await analyseIntake(supabase, scope, {
      category: intake.category,
      jurisdictionCode,
      answers: intake.answers,
    }));
  } catch (error) {
    // The matter is still created; the intake analysis is optional and its refusal is recorded.
    if (
      !(error instanceof AgentRefusedError) &&
      !(error instanceof Error && error.message.startsWith('AI_'))
    )
      throw error;
  }
  const conflictCheckId = String(formData.get('conflictCheckId') ?? '');
  const clientId = String(formData.get('clientId') ?? '');
  const common = {
    p_organization_id: organizationId,
    p_workspace_id: workspaceId,
    p_title: title,
    p_legal_category: intake.category,
    p_jurisdiction_code: jurisdictionCode,
    p_description: intake.answers.what_happened ?? '',
    p_intake: JSON.parse(
      JSON.stringify({ category: intake.category, answers: intake.answers, summary, executionId }),
    ),
  };
  // Firms open matters through a cleared or waived conflict check (Phase 9).
  const created = UUID.test(conflictCheckId)
    ? await supabase.rpc('matter_open_checked', {
        ...common,
        p_conflict_check_id: conflictCheckId,
        ...(UUID.test(clientId) ? { p_client_id: clientId } : {}),
      })
    : await supabase.rpc('matter_create', common);
  if (created.error || !created.data) {
    const message = created.error?.message ?? '';
    redirect(
      `${form}&error=${/NOT_AUTHORISED/.test(message) ? 'not-authorized' : /CONFLICT_CHECK/.test(message) ? 'conflict-check' : 'failed'}`,
    );
  }
  const matterId = (created.data as { id: string }).id;
  for (const party of summary?.suggestedParties ?? [])
    await supabase.rpc('matter_add_party', {
      p_matter_id: matterId,
      p_name: party.name,
      p_role: party.role,
    });
  for (const task of summary?.suggestedTasks ?? [])
    await supabase.rpc('matter_add_task', {
      p_matter_id: matterId,
      p_title: task.title,
      p_priority: task.priority,
    });
  redirect(`/matters/${matterId}`);
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

export async function matterAction(formData: FormData): Promise<void> {
  const matterId = field(formData, 'matterId');
  const action = field(formData, 'action');
  if (!UUID.test(matterId)) redirect('/matters?error=invalid-input');
  const supabase = await createClient();
  let result: { error: { message: string } | null } = { error: null };
  switch (action) {
    case 'status':
      result = await supabase.rpc('matter_set_status', {
        p_matter_id: matterId,
        p_status: field(formData, 'status'),
        ...(field(formData, 'note') ? { p_note: field(formData, 'note') } : {}),
      });
      break;
    case 'party': {
      const represents = field(formData, 'representsPartyId');
      result = await supabase.rpc('matter_add_party', {
        p_matter_id: matterId,
        p_name: field(formData, 'name'),
        p_role: field(formData, 'role'),
        ...(UUID.test(represents) ? { p_represents_party_id: represents } : {}),
        ...(field(formData, 'contactNote')
          ? { p_contact_note: field(formData, 'contactNote') }
          : {}),
      });
      break;
    }
    case 'link': {
      const [type, id] = field(formData, 'target').split(':');
      if (!type || !UUID.test(id ?? '')) back(matterId, 'MATTER_LINK_OUT_OF_SCOPE');
      result = await supabase.rpc('matter_link', {
        p_matter_id: matterId,
        p_link_type: type,
        p_target_id: id!,
      });
      break;
    }
    case 'task': {
      const due = field(formData, 'dueDate');
      result = await supabase.rpc('matter_add_task', {
        p_matter_id: matterId,
        p_title: field(formData, 'title'),
        p_priority: ['low', 'normal', 'high'].includes(field(formData, 'priority'))
          ? field(formData, 'priority')
          : 'normal',
        ...(/^\d{4}-\d{2}-\d{2}$/.test(due) ? { p_due_date: due } : {}),
      });
      break;
    }
    case 'task-status':
      result = await supabase.rpc('matter_update_task', {
        p_task_id: field(formData, 'taskId'),
        p_status: field(formData, 'status'),
      });
      break;
    case 'deadline': {
      const due = field(formData, 'dueAt');
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(due)) back(matterId, 'MATTER_EVENT_INVALID');
      result = await supabase.rpc('matter_add_deadline', {
        p_matter_id: matterId,
        p_title: field(formData, 'title'),
        p_type: field(formData, 'type'),
        p_due_at: new Date(`${due}:00Z`).toISOString(),
        ...(field(formData, 'location') ? { p_location: field(formData, 'location') } : {}),
        ...(field(formData, 'basis') ? { p_basis: field(formData, 'basis') } : {}),
      });
      break;
    }
    case 'deadline-status':
      result = await supabase.rpc('matter_update_deadline', {
        p_deadline_id: field(formData, 'deadlineId'),
        p_status: field(formData, 'status'),
      });
      break;
    case 'event': {
      const when = field(formData, 'occurredOn');
      result = await supabase.rpc('matter_record_event', {
        p_matter_id: matterId,
        p_event_type: field(formData, 'eventType'),
        p_summary: field(formData, 'summary'),
        ...(/^\d{4}-\d{2}-\d{2}$/.test(when) ? { p_occurred_at: `${when}T12:00:00Z` } : {}),
      });
      break;
    }
    default:
      back(matterId, 'MATTER_EVENT_INVALID');
  }
  back(matterId, result.error?.message);
}

export async function professionalMatterAction(formData: FormData): Promise<void> {
  const matterId = field(formData, 'matterId');
  const principalId = field(formData, 'principalId');
  const action = field(formData, 'action');
  if (!UUID.test(matterId) || !UUID.test(principalId)) redirect('/matters?error=invalid-input');
  const supabase = await createClient();
  const { error } =
    action === 'barrier'
      ? await supabase.rpc('matter_add_barrier', {
          p_matter_id: matterId,
          p_principal_id: principalId,
          p_reason: field(formData, 'reason'),
        })
      : await supabase.rpc('matter_assign', {
          p_matter_id: matterId,
          p_principal_id: principalId,
          p_role: ['responsible_lawyer', 'team_member', 'supervisor'].includes(
            field(formData, 'role'),
          )
            ? field(formData, 'role')
            : 'team_member',
        });
  back(matterId, error?.message);
}
