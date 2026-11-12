'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const f = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const optional = (key: string, value: string) => (value ? { [key]: value } : {});

function errorParam(message?: string): string {
  const code = message?.match(/[A-Z][A-Z_]{5,}/)?.[0];
  return code ? code.toLowerCase().replace(/_/g, '-') : 'failed';
}

export async function organisationAction(formData: FormData): Promise<void> {
  const org = f(formData, 'organizationId');
  const action = f(formData, 'action');
  const back = f(formData, 'back') === 'admin' ? '/admin' : `/organisation?org=${org}`;
  if (!UUID.test(org) && action !== 'verify-domain') redirect('/organisation?error=invalid');
  const supabase = await createClient();
  let error: { message: string } | null = null;
  switch (action) {
    case 'unit':
      ({ error } = await supabase.rpc('org_unit_create', {
        p_organization_id: org,
        p_kind: f(formData, 'kind') === 'office' ? 'office' : 'team',
        p_name: f(formData, 'name'),
        ...(UUID.test(f(formData, 'parentId')) ? { p_parent_id: f(formData, 'parentId') } : {}),
        ...optional('p_location', f(formData, 'location')),
      }));
      break;
    case 'unit-member':
      ({ error } = await supabase.rpc('org_unit_add_member', {
        p_unit_id: f(formData, 'unitId'),
        p_principal_id: f(formData, 'principalId'),
      }));
      break;
    case 'retention':
      ({ error } = await supabase.rpc('retention_set_policy', {
        p_organization_id: org,
        p_class: f(formData, 'class'),
        p_years: Math.min(50, Math.max(1, Number(f(formData, 'years')) || 1)),
      }));
      break;
    case 'sso-domain':
      ({ error } = await supabase.rpc('sso_add_domain', {
        p_organization_id: org,
        p_domain: f(formData, 'domain'),
      }));
      break;
    case 'sso-configure':
      ({ error } = await supabase.rpc('sso_configure', {
        p_organization_id: org,
        p_protocol: f(formData, 'protocol') === 'oidc' ? 'oidc' : 'saml',
        p_issuer: f(formData, 'issuer'),
        ...optional('p_metadata_url', f(formData, 'metadataUrl')),
        p_enforced: f(formData, 'enforced') === 'on',
      }));
      break;
    case 'support-decide':
      ({ error } = await supabase.rpc('support_access_decide', {
        p_request_id: f(formData, 'requestId'),
        p_decision: f(formData, 'decision'),
      }));
      break;
    case 'ai-risk':
      ({ error } = await supabase.rpc('ai_set_risk_classification', {
        p_organization_id: org,
        p_workspace_id: f(formData, 'workspaceId'),
        p_class: f(formData, 'class') === 'high_risk_justice' ? 'high_risk_justice' : 'standard',
        ...optional('p_conformity_reference', f(formData, 'conformity')),
      }));
      break;
    case 'api-key-revoke':
      ({ error } = await supabase.rpc('api_key_revoke', { p_key_id: f(formData, 'keyId') }));
      break;
    case 'support-request':
      ({ error } = await supabase.rpc('support_access_request', {
        p_organization_id: org,
        p_reason: f(formData, 'reason'),
        p_minutes: Math.min(480, Math.max(15, Number(f(formData, 'minutes')) || 60)),
      }));
      break;
    case 'verify-domain':
      ({ error } = await supabase.rpc('platform_verify_sso_domain', {
        p_domain: f(formData, 'domain'),
      }));
      break;
    default:
      redirect(`${back}${back.includes('?') ? '&' : '?'}error=invalid`);
  }
  revalidatePath(back.split('?')[0]!);
  redirect(
    error ? `${back}${back.includes('?') ? '&' : '?'}error=${errorParam(error.message)}` : back,
  );
}

export interface CreatedKey {
  key?: string;
  error?: string;
}

/** Returns the new key to the page once; it is never stored or logged in plain text. */
export async function createApiKey(_state: CreatedKey, formData: FormData): Promise<CreatedKey> {
  const org = f(formData, 'organizationId');
  const ws = f(formData, 'workspaceId');
  if (!UUID.test(org) || !UUID.test(ws)) return { error: 'Choose a workspace.' };
  const scopes = formData
    .getAll('scopes')
    .map(String)
    .filter((s) => s === 'research.read' || s === 'matters.read');
  if (scopes.length === 0) return { error: 'Choose at least one scope.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('api_key_create', {
    p_organization_id: org,
    p_workspace_id: ws,
    p_name: f(formData, 'name'),
    p_scopes: scopes,
    p_days: Math.min(365, Math.max(1, Number(f(formData, 'days')) || 90)),
  });
  if (error || !data)
    return {
      error: /NOT_AUTHORISED/.test(error?.message ?? '')
        ? 'You cannot issue keys for this workspace.'
        : 'The key could not be created.',
    };
  revalidatePath('/organisation');
  return { key: (data as { key: string }).key };
}

export async function complianceAction(formData: FormData): Promise<void> {
  const org = f(formData, 'organizationId');
  const ws = f(formData, 'workspaceId');
  const back = `/compliance?org=${org}&ws=${ws}`;
  const supabase = await createClient();
  let error: { message: string } | null = null;
  if (f(formData, 'action') === 'obligation') {
    ({ error } = await supabase.rpc('compliance_add_obligation', {
      p_organization_id: org,
      p_workspace_id: ws,
      p_title: f(formData, 'title'),
      p_authority_passage_id: f(formData, 'passageId'),
      ...optional('p_description', f(formData, 'description')),
      p_review_interval_days: Math.min(1825, Math.max(7, Number(f(formData, 'interval')) || 365)),
    }));
  } else {
    ({ error } = await supabase.rpc('compliance_assess', {
      p_obligation_id: f(formData, 'obligationId'),
      p_status: f(formData, 'status'),
      p_note: f(formData, 'note'),
      ...(UUID.test(f(formData, 'evidenceItemId'))
        ? { p_evidence_item_id: f(formData, 'evidenceItemId') }
        : {}),
    }));
  }
  revalidatePath('/compliance');
  redirect(error ? `${back}&error=${errorParam(error.message)}` : back);
}
