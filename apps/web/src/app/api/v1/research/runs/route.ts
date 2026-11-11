import { apiError, apiErrorFromCode, apiJson } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';
import { runLegalResearch } from '@/modules/research/service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function authenticated() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : supabase;
}

/** GET /api/v1/research/runs?organizationId=&workspaceId= — research history. */
export async function GET(request: Request): Promise<Response> {
  const supabase = await authenticated();
  if (!supabase) return apiError('unauthenticated', 'Sign in to use the research API.');
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId') ?? '';
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  if (!UUID.test(organizationId) || !UUID.test(workspaceId)) {
    return apiError('invalid_request', 'organizationId and workspaceId are required UUIDs.');
  }
  const { data, error } = await supabase.rpc('research_list_runs', {
    p_organization_id: organizationId,
    p_workspace_id: workspaceId,
  });
  if (error) return apiErrorFromCode(error.message);
  return apiJson({ data });
}

/** POST /api/v1/research/runs — run grounded, verified legal research. */
export async function POST(request: Request): Promise<Response> {
  const supabase = await authenticated();
  if (!supabase) return apiError('unauthenticated', 'Sign in to use the research API.');
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('invalid_request', 'The body must be JSON.');
  }
  const { organizationId, workspaceId, question, jurisdictionCode, asOfDate, languageCodes } = body;
  if (
    typeof organizationId !== 'string' ||
    typeof workspaceId !== 'string' ||
    typeof question !== 'string' ||
    typeof jurisdictionCode !== 'string' ||
    typeof asOfDate !== 'string' ||
    !DATE.test(asOfDate) ||
    !Array.isArray(languageCodes) ||
    !languageCodes.every((code) => typeof code === 'string')
  ) {
    return apiError(
      'invalid_request',
      'Required: organizationId, workspaceId, question, jurisdictionCode, asOfDate (YYYY-MM-DD), languageCodes[].',
    );
  }
  try {
    const { runId } = await runLegalResearch(supabase, {
      organizationId,
      workspaceId,
      question,
      jurisdictionCode,
      asOfDate,
      languageCodes: languageCodes as string[],
    });
    const { data, error } = await supabase.rpc('research_get_run', { p_run_id: runId });
    if (error) return apiErrorFromCode(error.message);
    return apiJson({ data }, 201);
  } catch (caught) {
    return apiErrorFromCode(caught instanceof Error ? caught.message : 'UNKNOWN');
  }
}
