'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseNames, parseTemplateSections } from '@/modules/professional/templates';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const f = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const ERRORS: Record<string, string> = {
  PROFESSIONAL_NOT_AUTHORISED: 'not-authorized',
  CONFLICT_DECISION_INVALID: 'decision',
  CONFLICT_WAIVER_NOT_AUTHORISED: 'waiver',
  CONFLICT_ALREADY_DECIDED: 'decided',
  CONFLICT_NAMES_INVALID: 'names',
  KNOWLEDGE_SOURCE_INVALID: 'source',
  TEMPLATE_INVALID: 'template',
};
function code(message?: string): string {
  const match = message?.match(/[A-Z][A-Z_]{5,}/)?.[0];
  return (
    (match && ERRORS[match]) ??
    (/check constraint|23514/.test(message ?? '') ? 'justification' : 'failed')
  );
}

export async function professionalAction(formData: FormData): Promise<void> {
  const org = f(formData, 'organizationId');
  const action = f(formData, 'action');
  const back = `/professional?org=${org}`;
  if (!UUID.test(org)) redirect('/professional?error=invalid');
  const supabase = await createClient();
  let error: { message: string } | null = null;
  if (action === 'settings') {
    ({ error } = await supabase.rpc('organization_update_settings', {
      p_organization_id: org,
      p_require_conflict_check: f(formData, 'require') === 'on',
      p_validity_days: Math.min(365, Math.max(1, Number(f(formData, 'validityDays')) || 30)),
    }));
  } else if (action === 'client') {
    ({ error } = await supabase.rpc('client_create', {
      p_organization_id: org,
      p_name: f(formData, 'name'),
      p_kind: f(formData, 'kind') === 'organisation' ? 'organisation' : 'individual',
      ...(f(formData, 'identifier') ? { p_identifier: f(formData, 'identifier') } : {}),
    }));
  } else if (action === 'check') {
    const ws = f(formData, 'workspaceId');
    if (!UUID.test(ws)) redirect(`${back}&error=invalid`);
    ({ error } = await supabase.rpc('conflict_check_run', {
      p_organization_id: org,
      p_workspace_id: ws,
      p_subject: f(formData, 'subject'),
      p_names: parseNames(f(formData, 'names')),
    }));
  } else if (action === 'decide') {
    ({ error } = await supabase.rpc('conflict_check_decide', {
      p_check_id: f(formData, 'checkId'),
      p_decision: f(formData, 'decision'),
      ...(f(formData, 'note') ? { p_note: f(formData, 'note') } : {}),
    }));
  } else redirect(`${back}&error=invalid`);
  revalidatePath('/professional');
  redirect(error ? `${back}&error=${code(error.message)}` : back);
}

export async function publishKnowledge(formData: FormData): Promise<void> {
  const org = f(formData, 'organizationId');
  if (!UUID.test(org)) redirect('/knowledge?error=invalid');
  const [sourceType, sourceId] = f(formData, 'source').split(':');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('knowledge_publish', {
    p_organization_id: org,
    p_kind: f(formData, 'kind'),
    p_title: f(formData, 'title'),
    p_body: f(formData, 'body'),
    p_tags: f(formData, 'tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    ...(sourceType && UUID.test(sourceId ?? '')
      ? { p_source_type: sourceType, p_source_id: sourceId }
      : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(f(formData, 'reviewDue'))
      ? { p_review_due: f(formData, 'reviewDue') }
      : {}),
  });
  if (error || typeof data !== 'string')
    redirect(`/knowledge?org=${org}&error=${code(error?.message)}`);
  redirect(`/knowledge/${data}`);
}

export async function retireKnowledge(formData: FormData): Promise<void> {
  const id = f(formData, 'itemId');
  if (!UUID.test(id)) redirect('/knowledge');
  const supabase = await createClient();
  await supabase.rpc('knowledge_retire', { p_item_id: id });
  revalidatePath(`/knowledge/${id}`);
  redirect(`/knowledge/${id}`);
}

export async function createTemplate(formData: FormData): Promise<void> {
  const org = f(formData, 'organizationId');
  if (!UUID.test(org)) redirect('/documents/templates?error=invalid');
  let sections;
  try {
    sections = parseTemplateSections(String(formData.get('sections') ?? ''));
  } catch {
    redirect(`/documents/templates?org=${org}&error=template`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('document_template_create', {
    p_organization_id: org,
    p_name: f(formData, 'name'),
    p_document_type: f(formData, 'documentType') || 'custom',
    p_sections: JSON.parse(JSON.stringify(sections)),
  });
  revalidatePath('/documents/templates');
  redirect(
    `/documents/templates?org=${org}${error ? `&error=${code(error.message)}` : '&created=1'}`,
  );
}
