'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runLegalResearch } from '@/modules/research/service';
import { researchQueryEmbedder } from '@/modules/research/query-embedder';
import { MANUAL_GATES, verifyResearchRun } from '@/modules/verification/quality';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function askResearchQuestion(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const question = String(formData.get('question') ?? '').trim();
  const jurisdictionCode = String(formData.get('jurisdictionCode') ?? '');
  const asOfDate = String(formData.get('asOfDate') ?? '');
  const language = String(formData.get('language') ?? 'nb');
  const back = `/research?org=${organizationId}&ws=${workspaceId}`;
  if (!UUID.test(organizationId) || !UUID.test(workspaceId))
    redirect('/research?error=invalid-scope');
  if (question.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate))
    redirect(`${back}&error=invalid-input`);

  let runId: string;
  try {
    const supabase = await createClient();
    ({ runId } = await runLegalResearch(
      supabase,
      {
        organizationId,
        workspaceId,
        question,
        jurisdictionCode,
        asOfDate,
        languageCodes: [language],
      },
      researchQueryEmbedder(),
    ));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    redirect(
      `${back}&error=${/NOT_AUTHORISED/.test(code) ? 'not-authorized' : /QUOTA_EXCEEDED/.test(code) ? 'quota' : 'research-failed'}`,
    );
  }
  redirect(`/research/${runId}`);
}

export async function recheckResearch(formData: FormData): Promise<void> {
  const runId = String(formData.get('runId') ?? '');
  if (!UUID.test(runId)) redirect('/research?error=invalid-input');
  let failure: string | null = null;
  try {
    const supabase = await createClient();
    await verifyResearchRun(supabase, runId);
  } catch (error) {
    failure =
      error instanceof Error && error.message === 'QUALITY_NOT_AUTHORISED'
        ? 'not-authorized'
        : 'check-failed';
  }
  // Refresh the run page so the new verification report is shown immediately.
  revalidatePath(`/research/${runId}`);
  redirect(`/research/${runId}${failure ? `?error=${failure}` : '#verification'}`);
}

export async function requestResearchReview(formData: FormData): Promise<void> {
  const runId = String(formData.get('runId') ?? '');
  const organizationId = String(formData.get('organizationId') ?? '');
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const gate = String(formData.get('gate') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (
    ![runId, organizationId, workspaceId].every((id) => UUID.test(id)) ||
    reason.length < 3 ||
    !(MANUAL_GATES as readonly string[]).includes(gate)
  )
    redirect(`/research/${UUID.test(runId) ? runId : ''}?error=invalid-review`);
  const supabase = await createClient();
  const { error } = await supabase.rpc('review_request_create', {
    p_organization_id: organizationId,
    p_workspace_id: workspaceId,
    p_subject_type: 'research_run',
    p_subject_id: runId,
    p_gate: gate,
    p_reason: reason,
  });
  revalidatePath(`/research/${runId}`);
  redirect(
    `/research/${runId}${error ? `?error=${/ALREADY_PENDING/.test(error.message) ? 'review-pending' : 'review-failed'}` : '#verification'}`,
  );
}
