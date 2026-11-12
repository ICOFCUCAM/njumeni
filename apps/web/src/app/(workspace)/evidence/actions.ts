'use server';

import { createHash, randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { EVIDENCE_MAX_BYTES, EVIDENCE_MIME_KINDS } from '@/modules/evidence/file-kind';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVIDENCE_TYPES = new Set([
  'document',
  'email',
  'spreadsheet',
  'image',
  'correspondence',
  'contract',
  'witness_statement',
  'medical',
  'employment',
  'other',
]);
const SENSITIVITIES = new Set(['standard', 'confidential', 'special_category']);
const PRIVILEGES = new Set(['none', 'legal_advice', 'litigation', 'work_product']);

function back(
  workspace: string,
  organisation: string,
  key: 'error' | 'message',
  value: string,
): never {
  redirect(`/evidence?org=${organisation}&ws=${workspace}&${key}=${value}`);
}

function safeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .trim()
    .slice(0, 160);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'evidence';
}

/**
 * Creates an evidence item and uploads its first file. The file stays quarantined until the
 * trusted evidence worker has scanned it; nothing is readable before then.
 */
export async function uploadEvidence(formData: FormData): Promise<void> {
  const organisation = String(formData.get('organizationId') ?? '');
  const workspace = String(formData.get('workspaceId') ?? '');
  if (!UUID.test(organisation) || !UUID.test(workspace)) redirect('/evidence?error=invalid-scope');

  const title = String(formData.get('title') ?? '').trim();
  const evidenceType = String(formData.get('evidenceType') ?? 'document');
  const sensitivity = String(formData.get('sensitivity') ?? 'confidential');
  const privilege = String(formData.get('privilege') ?? 'none');
  const file = formData.get('file');
  if (
    !title ||
    title.length > 300 ||
    !EVIDENCE_TYPES.has(evidenceType) ||
    !SENSITIVITIES.has(sensitivity) ||
    !PRIVILEGES.has(privilege)
  ) {
    back(workspace, organisation, 'error', 'invalid-input');
  }
  if (!(file instanceof File) || file.size === 0)
    back(workspace, organisation, 'error', 'file-required');
  if (file.size > EVIDENCE_MAX_BYTES) back(workspace, organisation, 'error', 'file-too-large');
  if (!EVIDENCE_MIME_KINDS[file.type]) back(workspace, organisation, 'error', 'file-type');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const supabase = await createClient();

  const created = await supabase.rpc('evidence_create_item', {
    p_organization_id: organisation,
    p_workspace_id: workspace,
    p_title: title,
    p_evidence_type: evidenceType,
    p_sensitivity: sensitivity,
    p_privilege: privilege,
  });
  if (created.error || typeof created.data !== 'string')
    back(workspace, organisation, 'error', 'not-authorized');

  const filename = safeFilename(file.name);
  const objectKey = [organisation, workspace, randomUUID(), filename].join('/');
  // Storage policies re-check document.upload against the object path.
  const uploaded = await supabase.storage
    .from('njumeni-workspace-files')
    .upload(objectKey, bytes, { contentType: file.type, upsert: false });
  if (uploaded.error) back(workspace, organisation, 'error', 'upload-failed');

  const registered = await supabase.rpc('evidence_register_file', {
    p_evidence_item_id: created.data,
    p_storage_object_key: objectKey,
    p_content_sha256: sha256,
    p_byte_size: bytes.byteLength,
    p_mime_type: file.type,
    p_original_filename: filename,
  });
  if (registered.error) back(workspace, organisation, 'error', 'register-failed');

  revalidatePath('/evidence');
  back(workspace, organisation, 'message', 'uploaded');
}

export async function setLegalHold(formData: FormData): Promise<void> {
  const item = String(formData.get('evidenceItemId') ?? '');
  const hold = formData.get('hold') === 'true';
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(item)) redirect('/evidence?error=invalid-input');
  const supabase = await createClient();
  const { error } = await supabase.rpc('evidence_set_legal_hold', {
    p_evidence_item_id: item,
    p_hold: hold,
    p_reason: reason,
  });
  redirect(`/evidence/${item}?${error ? 'error=legal-hold-failed' : 'message=legal-hold-updated'}`);
}
