import { apiError, apiErrorFromCode } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';
import { buildCaseBundle, type BundleDocument, type MatterView } from '@/modules/cases/bundle';
import { buildExportModel, type StoredDocument } from '@/modules/documents/service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/v1/matters/{matterId}/export — the case bundle as a ZIP. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matterId: string }> },
): Promise<Response> {
  const { matterId } = await params;
  if (!UUID.test(matterId)) return apiError('invalid_request', 'matterId must be a UUID.');
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return apiError('unauthenticated', 'Sign in to export case bundles.');
  const { data, error } = await supabase.rpc('matter_get', { p_matter_id: matterId });
  if (error)
    return /NOT_AUTHORISED/.test(error.message)
      ? apiError('not_found', 'Matter not found.')
      : apiErrorFromCode(error.message.match(/[A-Z][A-Z_]{5,}/)?.[0] ?? 'MATTER_EXPORT_FAILED');
  const matter = data as unknown as MatterView;
  const generatedAt = new Date().toISOString();
  // Only approved documents go into the bundle, at their approved version.
  const documents: BundleDocument[] = [];
  for (const link of matter.links.filter(
    (l) => l.type === 'legal_document' && l.status === 'approved',
  )) {
    const current = await supabase.rpc('document_get', { p_document_id: link.id });
    const approved = (current.data as unknown as StoredDocument | null)?.approvedVersion;
    if (!approved) continue;
    const version = await supabase.rpc('document_get', {
      p_document_id: link.id,
      p_version: approved,
    });
    if (version.data) {
      const stored = version.data as unknown as StoredDocument;
      documents.push({ title: stored.title, model: buildExportModel(stored, generatedAt) });
    }
  }
  const bundle = buildCaseBundle(matter, documents, generatedAt);
  const recorded = await supabase.rpc('matter_record_export', {
    p_matter_id: matterId,
    p_sha256: bundle.sha256,
    p_files: bundle.files.length + 1,
  });
  if (recorded.error)
    return /NOT_AUTHORISED/.test(recorded.error.message)
      ? apiError('forbidden', 'You do not have permission to export this matter.')
      : apiError('internal_error', 'The export could not be recorded.');
  return new Response(Buffer.from(bundle.zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${matter.matterNumber}-case-bundle.zip"`,
      'Cache-Control': 'no-store',
      'X-Content-SHA256': bundle.sha256,
    },
  });
}
