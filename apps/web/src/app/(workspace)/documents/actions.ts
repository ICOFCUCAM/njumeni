'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AgentRefusedError } from '@/modules/ai/core';
import { draftDocument } from '@/modules/documents/drafting';
import type { StoredDocument } from '@/modules/documents/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function code(message: string | undefined): string {
  return message?.match(/(DOCUMENT|AI)_[A-Z_]+/)?.[0] ?? 'DOCUMENT_FAILED';
}
const ERROR_PARAM: Record<string, string> = {
  DOCUMENT_VERSION_CONFLICT: 'conflict',
  DOCUMENT_IN_REVIEW: 'in-review',
  DOCUMENT_NOT_AUTHORISED: 'not-authorized',
  DOCUMENT_FOUR_EYES_REQUIRED: 'four-eyes',
  DOCUMENT_REQUIRED_SECTIONS_MISSING: 'sections-missing',
  DOCUMENT_QUOTATION_MISMATCH: 'citation-invalid',
  DOCUMENT_CITATION_NOT_PERMITTED: 'citation-invalid',
  DOCUMENT_CITATION_NOT_FOUND: 'citation-invalid',
  DOCUMENT_RESEARCH_REQUIRED: 'research-required',
  DOCUMENT_STATE_INVALID: 'state',
};
function back(documentId: string, error?: string): never {
  revalidatePath(`/documents/${documentId}`);
  redirect(`/documents/${documentId}${error ? `?error=${ERROR_PARAM[error] ?? 'failed'}` : ''}`);
}

export async function createDocument(formData: FormData): Promise<void> {
  const organizationId = String(formData.get('organizationId') ?? '');
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const templateKey = String(formData.get('templateKey') ?? '');
  const researchRunId = String(formData.get('researchRunId') ?? '');
  const issueId = String(formData.get('issueId') ?? '');
  const list = `/documents?org=${organizationId}&ws=${workspaceId}`;
  if (!UUID.test(organizationId) || !UUID.test(workspaceId))
    redirect('/documents?error=invalid-scope');
  if (title.length < 3 || !/^[a-z_]{3,60}$/.test(templateKey))
    redirect(`${list}&error=invalid-input`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('document_create', {
    p_organization_id: organizationId,
    p_workspace_id: workspaceId,
    p_title: title,
    p_template_key: templateKey,
    ...(UUID.test(researchRunId) ? { p_research_run_id: researchRunId } : {}),
    ...(UUID.test(issueId) ? { p_issue_id: issueId } : {}),
  });
  if (error || typeof data !== 'string')
    redirect(
      `${list}&error=${/NOT_AUTHORISED/.test(error?.message ?? '') ? 'not-authorized' : 'failed'}`,
    );
  redirect(`/documents/${data}`);
}

type CitationInput = {
  section_key: string;
  marker: number;
  authority_passage_id?: string;
  evidence_item_id?: string;
  quoted_text?: string;
};

export async function saveDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  if (!UUID.test(documentId)) redirect('/documents?error=invalid-input');
  const expected = Number(formData.get('expectedVersion'));
  const supabase = await createClient();
  const current = await supabase.rpc('document_get', { p_document_id: documentId });
  if (current.error || !current.data) back(documentId, code(current.error?.message));
  const document = current.data as unknown as StoredDocument;

  const sections = document.template.sections.map((spec) => ({
    key: spec.key,
    content: String(formData.get(`section:${spec.key}`) ?? '').slice(0, 50000),
  }));
  // Citations are rebuilt from the stored version (never from client-supplied passage data).
  const removed = new Set(formData.getAll('removeCitation').map(Number));
  const citations: CitationInput[] = document.citations
    .filter((c) => !removed.has(c.marker))
    .map((c) => ({
      section_key: c.sectionKey,
      marker: c.marker,
      ...(c.authorityPassageId ? { authority_passage_id: c.authorityPassageId } : {}),
      ...(c.evidenceItemId ? { evidence_item_id: c.evidenceItemId } : {}),
      ...(c.quotedText ? { quoted_text: c.quotedText } : {}),
    }));
  const attach = String(formData.get('attachPassage') ?? '');
  const attachSection = String(formData.get('attachSection') ?? '');
  if (
    UUID.test(attach) &&
    sections.some((s) => s.key === attachSection) &&
    document.researchRunId
  ) {
    const run = await supabase.rpc('research_get_run', { p_run_id: document.researchRunId });
    const claim = (
      run.data as {
        claims?: {
          passageId: string | null;
          quotedText: string | null;
          verificationStatus: string;
        }[];
      } | null
    )?.claims?.find((c) => c.passageId === attach && c.verificationStatus === 'verified');
    if (claim) {
      const marker = Math.max(0, ...citations.map((c) => c.marker)) + 1;
      citations.push({
        section_key: attachSection,
        marker,
        authority_passage_id: attach,
        ...(claim.quotedText ? { quoted_text: claim.quotedText } : {}),
      });
      const section = sections.find((s) => s.key === attachSection)!;
      section.content = `${section.content.trimEnd()}${section.content.trim() ? ' ' : ''}[${marker}]`;
    }
  }
  const { error } = await supabase.rpc('document_save_version', {
    p_document_id: documentId,
    p_expected_version: expected,
    p_sections: sections,
    p_citations: citations,
    p_change_note: String(formData.get('changeNote') ?? '').slice(0, 500) || 'Edited',
  });
  back(documentId, error ? code(error.message) : undefined);
}

export async function draftWithAgent(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  if (!UUID.test(documentId)) redirect('/documents?error=invalid-input');
  let failure: string | undefined;
  try {
    const supabase = await createClient();
    await draftDocument(supabase, documentId);
  } catch (error) {
    failure =
      error instanceof AgentRefusedError
        ? 'AI_REFUSED'
        : error instanceof Error
          ? error.message
          : undefined;
  }
  if (failure === 'AI_REFUSED') {
    revalidatePath(`/documents/${documentId}`);
    redirect(`/documents/${documentId}?error=ai-refused`);
  }
  back(documentId, failure);
}

export async function documentWorkflow(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!UUID.test(documentId)) redirect('/documents?error=invalid-input');
  const supabase = await createClient();
  let result: { error: { message: string } | null };
  if (action === 'submit')
    result = await supabase.rpc('document_submit', { p_document_id: documentId });
  else if (action === 'withdraw')
    result = await supabase.rpc('document_withdraw', { p_document_id: documentId });
  else if (action === 'approved' || action === 'changes_requested')
    result = await supabase.rpc('document_decide', {
      p_document_id: documentId,
      p_decision: action,
      ...(note ? { p_note: note } : {}),
    });
  else back(documentId, 'DOCUMENT_STATE_INVALID');
  back(documentId, result.error ? code(result.error.message) : undefined);
}
