'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ORGANISATION_KINDS = ['law_firm', 'enterprise', 'institution'] as const;
const WORKSPACE_KINDS = ['general', 'team', 'matter', 'research'] as const;

function readField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function createSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect('/sign-in');
  return supabase;
}

export async function createOrganization(formData: FormData): Promise<void> {
  const name = readField(formData, 'name', 160);
  const kindValue = formData.get('kind');
  if (
    !name ||
    typeof kindValue !== 'string' ||
    !ORGANISATION_KINDS.includes(kindValue as (typeof ORGANISATION_KINDS)[number])
  ) {
    redirect('/settings/workspaces?error=invalid-organization');
  }

  const slug = createSlug(name);
  if (slug.length < 3) redirect('/settings/workspaces?error=invalid-organization');

  const supabase = await requireAuthenticatedUser();
  const { error } = await supabase.from('organizations').insert({
    name,
    slug,
    kind: kindValue as (typeof ORGANISATION_KINDS)[number],
  });

  if (error) redirect('/settings/workspaces?error=organization-create-failed');

  revalidatePath('/settings/workspaces');
  revalidatePath('/dashboard');
  redirect('/settings/workspaces?message=organization-created');
}

export async function createWorkspace(formData: FormData): Promise<void> {
  const organizationId = formData.get('organization_id');
  const name = readField(formData, 'name', 160);
  const kindValue = formData.get('kind');

  if (
    typeof organizationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId) ||
    !name ||
    typeof kindValue !== 'string' ||
    !WORKSPACE_KINDS.includes(kindValue as (typeof WORKSPACE_KINDS)[number])
  ) {
    redirect('/settings/workspaces?error=invalid-workspace');
  }

  const slug = createSlug(name);
  if (slug.length < 3) redirect('/settings/workspaces?error=invalid-workspace');

  const supabase = await requireAuthenticatedUser();
  const { error } = await supabase.from('workspaces').insert({
    organization_id: organizationId,
    name,
    slug,
    kind: kindValue as (typeof WORKSPACE_KINDS)[number],
  });

  if (error) redirect('/settings/workspaces?error=workspace-create-failed');

  revalidatePath('/settings/workspaces');
  revalidatePath('/dashboard');
  redirect('/settings/workspaces?message=workspace-created');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

export type InvitationCreationResult = {
  token?: string;
  error?: 'invalid' | 'unavailable';
};

export async function createInvitation(formData: FormData): Promise<InvitationCreationResult> {
  const organizationId = formData.get('organization_id');
  const workspaceValue = formData.get('workspace_id');
  const emailValue = formData.get('email');
  const expiryValue = formData.get('expires_in_days');

  const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
  const workspaceId =
    typeof workspaceValue === 'string' && workspaceValue.trim() ? workspaceValue.trim() : null;
  const expiryDays =
    typeof expiryValue === 'string' && /^\\d+$/.test(expiryValue) ? Number(expiryValue) : 7;

  if (
    typeof organizationId !== 'string' ||
    !UUID_PATTERN.test(organizationId) ||
    (workspaceId !== null && !UUID_PATTERN.test(workspaceId)) ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    !Number.isInteger(expiryDays) ||
    expiryDays < 1 ||
    expiryDays > 30
  ) {
    return { error: 'invalid' };
  }

  try {
    const supabase = await requireAuthenticatedUser();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('organization_invitations').insert({
      organization_id: organizationId,
      workspace_id: workspaceId,
      email_normalized: email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (error) return { error: 'unavailable' };

    revalidatePath('/settings/workspaces');
    return { token };
  } catch {
    return { error: 'unavailable' };
  }
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const invitationId = formData.get('invitation_id');
  if (typeof invitationId !== 'string' || !UUID_PATTERN.test(invitationId)) {
    redirect('/settings/workspaces?error=invalid-invitation');
  }

  const supabase = await requireAuthenticatedUser();
  const { error } = await supabase.rpc('revoke_organization_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) redirect('/settings/workspaces?error=invitation-update-failed');

  revalidatePath('/settings/workspaces');
  redirect('/settings/workspaces?message=invitation-revoked');
}

export async function setOrganizationMembershipStatus(formData: FormData): Promise<void> {
  const membershipId = formData.get('membership_id');
  const status = formData.get('status');
  if (
    typeof membershipId !== 'string' ||
    !UUID_PATTERN.test(membershipId) ||
    (status !== 'suspended' && status !== 'revoked')
  ) {
    redirect('/settings/workspaces?error=invalid-membership');
  }

  const supabase = await requireAuthenticatedUser();
  const { error } = await supabase.rpc('set_organization_membership_status', {
    p_membership_id: membershipId,
    p_status: status,
  });
  if (error) redirect('/settings/workspaces?error=membership-update-failed');

  revalidatePath('/settings/workspaces');
  redirect('/settings/workspaces?message=membership-updated');
}

export async function setWorkspaceMembershipStatus(formData: FormData): Promise<void> {
  const membershipId = formData.get('membership_id');
  const status = formData.get('status');
  if (
    typeof membershipId !== 'string' ||
    !UUID_PATTERN.test(membershipId) ||
    (status !== 'suspended' && status !== 'revoked')
  ) {
    redirect('/settings/workspaces?error=invalid-membership');
  }

  const supabase = await requireAuthenticatedUser();
  const { error } = await supabase.rpc('set_workspace_membership_status', {
    p_membership_id: membershipId,
    p_status: status,
  });
  if (error) redirect('/settings/workspaces?error=membership-update-failed');

  revalidatePath('/settings/workspaces');
  redirect('/settings/workspaces?message=membership-updated');
}

export type InvitationAcceptanceResult = {
  success?: boolean;
  error?: 'invalid' | 'sign-in-required' | 'unavailable';
};

export async function acceptInvitation(formData: FormData): Promise<InvitationAcceptanceResult> {
  const tokenValue = formData.get('token');
  if (typeof tokenValue !== 'string' || tokenValue.length < 40 || tokenValue.length > 100) {
    return { error: 'invalid' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'sign-in-required' };

    const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
    const { error } = await supabase.rpc('accept_organization_invitation', {
      p_token_hash: tokenHash,
    });
    if (error) return { error: 'invalid' };

    revalidatePath('/settings/workspaces');
    revalidatePath('/dashboard');
    return { success: true };
  } catch {
    return { error: 'unavailable' };
  }
}
