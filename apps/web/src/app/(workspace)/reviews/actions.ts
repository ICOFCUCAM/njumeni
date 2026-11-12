'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { decideReview } from '@/modules/verification/quality';

const DECISIONS = new Set(['approved', 'rejected', 'changes_requested']);
const ERRORS: Record<string, string> = {
  REVIEW_FOUR_EYES_REQUIRED: 'four-eyes',
  REVIEW_ALREADY_DECIDED: 'already-decided',
  QUALITY_NOT_AUTHORISED: 'not-authorized',
  REVIEW_NOTE_REQUIRED: 'note-required',
};

export async function decideReviewAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '');
  const back = String(formData.get('back') ?? '/reviews');
  const safeBack = /^\/reviews(\?org=[0-9a-f-]{36}&ws=[0-9a-f-]{36})?$/.test(back)
    ? back
    : '/reviews';
  const join = safeBack.includes('?') ? '&' : '?';
  if (!DECISIONS.has(decision)) redirect(`${safeBack}${join}error=invalid-input`);
  try {
    const supabase = await createClient();
    await decideReview(
      supabase,
      requestId,
      decision as 'approved' | 'rejected' | 'changes_requested',
      note,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    redirect(`${safeBack}${join}error=${ERRORS[code] ?? 'failed'}`);
  }
  revalidatePath('/reviews');
  redirect(safeBack);
}
