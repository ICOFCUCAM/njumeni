'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AgentRefusedError } from '@/modules/ai/core';
import { proposeArgument } from '@/modules/reasoning/argument';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function buildArgument(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const researchRunId = String(formData.get('researchRunId') ?? '');
  const back = `/arguments?org=${organizationId}&ws=${workspaceId}`;
  if (!UUID.test(organizationId) || !UUID.test(workspaceId))
    redirect('/arguments?error=invalid-scope');
  if (!UUID.test(researchRunId)) redirect(`${back}&error=invalid-input`);
  let issueId: string;
  try {
    const supabase = await createClient();
    ({ issueId } = await proposeArgument(supabase, { organizationId, workspaceId, researchRunId }));
  } catch (error) {
    if (error instanceof AgentRefusedError)
      redirect(`${back}&error=refused&reason=${error.reason}`);
    const code = error instanceof Error ? error.message : '';
    redirect(`${back}&error=${/NOT_AUTHORISED/.test(code) ? 'not-authorized' : 'failed'}`);
  }
  redirect(`/arguments/${issueId}`);
}

export async function reviewNode(formData: FormData): Promise<void> {
  const issueId = String(formData.get('issueId') ?? '');
  const nodeId = String(formData.get('nodeId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!UUID.test(issueId) || !UUID.test(nodeId) || !['accepted', 'rejected'].includes(decision))
    redirect('/arguments?error=invalid-input');
  const supabase = await createClient();
  const { error } = await supabase.rpc('argument_review_node', {
    p_node_id: nodeId,
    p_decision: decision,
  });
  if (error) redirect(`/arguments/${issueId}?error=review-failed`);
  revalidatePath(`/arguments/${issueId}`);
  redirect(`/arguments/${issueId}`);
}
