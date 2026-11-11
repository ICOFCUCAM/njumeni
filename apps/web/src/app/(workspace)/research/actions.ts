'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { runLegalResearch } from '@/modules/research/service';

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
    ({ runId } = await runLegalResearch(supabase, {
      organizationId,
      workspaceId,
      question,
      jurisdictionCode,
      asOfDate,
      languageCodes: [language],
    }));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    redirect(`${back}&error=${/NOT_AUTHORISED/.test(code) ? 'not-authorized' : 'research-failed'}`);
  }
  redirect(`/research/${runId}`);
}
