import { apiError, apiErrorFromCode, apiJson } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/v1/research/runs/{runId} — one run with its claim ledger and citation checks. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  if (!UUID.test(runId)) return apiError('invalid_request', 'runId must be a UUID.');
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return apiError('unauthenticated', 'Sign in to use the research API.');
  const { data, error } = await supabase.rpc('research_get_run', { p_run_id: runId });
  // Unknown and unauthorised runs are indistinguishable.
  if (error)
    return /NOT_AUTHORISED/.test(error.message)
      ? apiError('not_found', 'Research run not found.')
      : apiErrorFromCode(error.message);
  return apiJson({ data });
}
