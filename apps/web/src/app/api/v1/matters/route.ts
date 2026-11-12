import { apiError, apiErrorFromCode, apiJson } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';
import { bearerApiKey, keyClient, keyErrorStatus } from '@/modules/enterprise/api-keys';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/v1/matters — matters of a workspace. With an API key (scope matters.read) the key's
 *  workspace is used; with a session, organizationId and workspaceId are required. */
export async function GET(request: Request): Promise<Response> {
  const apiKey = bearerApiKey(request);
  if (apiKey === 'malformed') return apiError('unauthenticated', 'The API key is not valid.');
  if (apiKey) {
    const { data, error } = await keyClient().rpc('api_key_matter_list', { p_key: apiKey });
    if (error) {
      const status = keyErrorStatus(error.message);
      return apiError(
        status === 'not_found' ? 'forbidden' : status,
        'The API key cannot be used for this request.',
      );
    }
    return apiJson({ data });
  }
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return apiError('unauthenticated', 'Sign in or use an API key.');
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId') ?? '';
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  if (!UUID.test(organizationId) || !UUID.test(workspaceId))
    return apiError('invalid_request', 'organizationId and workspaceId are required UUIDs.');
  const { data, error } = await supabase.rpc('matter_list', {
    p_organization_id: organizationId,
    p_workspace_id: workspaceId,
  });
  if (error)
    return apiErrorFromCode(error.message.match(/[A-Z][A-Z_]{5,}/)?.[0] ?? 'MATTER_FAILED');
  return apiJson({ data });
}
