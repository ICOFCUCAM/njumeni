import { createHash } from 'node:crypto';
import { apiError, apiErrorFromCode } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';
import { buildExportModel, type StoredDocument } from '@/modules/documents/service';
import { renderDocx, renderPdf } from '@/modules/documents/export';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
} as const;

/** GET /api/v1/documents/{documentId}/export?format=docx|pdf&version=n */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const { documentId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  const versionParam = url.searchParams.get('version');
  if (!UUID.test(documentId)) return apiError('invalid_request', 'documentId must be a UUID.');
  if (format !== 'docx' && format !== 'pdf')
    return apiError('invalid_request', 'format must be docx or pdf.');
  if (versionParam !== null && !/^[1-9]\d{0,5}$/.test(versionParam))
    return apiError('invalid_request', 'version must be a positive integer.');
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return apiError('unauthenticated', 'Sign in to export documents.');

  const { data, error } = await supabase.rpc('document_get', {
    p_document_id: documentId,
    ...(versionParam ? { p_version: Number(versionParam) } : {}),
  });
  if (error)
    return /NOT_AUTHORISED/.test(error.message)
      ? apiError('not_found', 'Document not found.')
      : apiErrorFromCode(error.message.match(/[A-Z][A-Z_]{5,}/)?.[0] ?? 'DOCUMENT_EXPORT_FAILED');
  const stored = data as unknown as StoredDocument;
  const model = buildExportModel(stored, new Date().toISOString());
  const bytes = format === 'docx' ? renderDocx(model) : renderPdf(model);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const recorded = await supabase.rpc('document_record_export', {
    p_document_id: documentId,
    p_version: stored.version.number,
    p_format: format,
    p_sha256: sha256,
  });
  if (recorded.error)
    return /NOT_AUTHORISED/.test(recorded.error.message)
      ? apiError('forbidden', 'You do not have permission to export this document.')
      : apiError('internal_error', 'The export could not be recorded.');
  const name = `${
    stored.title
      .replace(/[^\p{L}\p{N} _-]+/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'document'
  }-v${stored.version.number}${model.final ? '' : '-draft'}.${format}`;
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': TYPES[format],
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
      'X-Document-Version': String(stored.version.number),
      'X-Document-Final': String(model.final),
      'X-Content-SHA256': sha256,
    },
  });
}
