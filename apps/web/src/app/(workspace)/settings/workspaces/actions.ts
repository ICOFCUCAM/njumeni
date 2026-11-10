'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeInvitationEmail, parseInvitationExpiryDays } from '@/lib/invitation-validation';

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

async function requirePermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  permission: string,
  organizationId: string,
  workspaceId: string | null = null,
): Promise<void> {
  const { data, error } = await supabase.rpc('has_permission', {
    p_permission_key: permission,
    p_organization_id: organizationId,
    p_workspace_id: workspaceId,
  });
  if (error || data !== true) redirect('/settings/workspaces?error=not-authorized');
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
  await requirePermission(supabase, 'workspace.create', organizationId);
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

export type InvitationCreationResult = {
  token?: string;
  error?: 'invalid' | 'unavailable';
};

export async function createInvitation(formData: FormData): Promise<InvitationCreationResult> {
  const organizationId = formData.get('organization_id');
  const workspaceValue = formData.get('workspace_id');
  const emailValue = formData.get('email');
  const expiryValue = formData.get('expires_in_days');

  const email = normalizeInvitationEmail(emailValue);
  const workspaceId =
    typeof workspaceValue === 'string' && workspaceValue.trim() ? workspaceValue.trim() : null;
  const expiryDays = parseInvitationExpiryDays(expiryValue);

  if (
    typeof organizationId !== 'string' ||
    !UUID_PATTERN.test(organizationId) ||
    (workspaceId !== null && !UUID_PATTERN.test(workspaceId)) ||
    email === null ||
    expiryDays === null
  ) {
    return { error: 'invalid' };
  }

  try {
    const supabase = await requireAuthenticatedUser();
    await requirePermission(supabase, 'organization.manage_members', organizationId);
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
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }
    return { error: 'unavailable' };
  }
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const invitationId = formData.get('invitation_id');
  if (typeof invitationId !== 'string' || !UUID_PATTERN.test(invitationId)) {
    redirect('/settings/workspaces?error=invalid-invitation');
  }

  const supabase = await requireAuthenticatedUser();
  const { data: invitation } = await supabase
    .from('organization_invitations')
    .select('organization_id')
    .eq('id', invitationId)
    .maybeSingle();
  if (!invitation) redirect('/settings/workspaces?error=invitation-update-failed');
  await requirePermission(supabase, 'organization.manage_members', invitation.organization_id);
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
  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) redirect('/settings/workspaces?error=membership-update-failed');
  await requirePermission(supabase, 'organization.manage_members', membership.organization_id);
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
  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('workspace_id')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) redirect('/settings/workspaces?error=membership-update-failed');
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('organization_id')
    .eq('id', membership.workspace_id)
    .maybeSingle();
  if (!workspace) redirect('/settings/workspaces?error=membership-update-failed');
  await requirePermission(supabase, 'workspace.manage_members', workspace.organization_id, membership.workspace_id);
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


const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

export async function assignRole(formData: FormData): Promise<void> {
  const scope = formData.get('scope');
  const organizationId = formData.get('organization_id');
  const workspaceValue = formData.get('workspace_id');
  const principalId = formData.get('principal_id');
  const roleKey = formData.get('role_key');
  const workspaceId =
    typeof workspaceValue === 'string' && workspaceValue.trim() ? workspaceValue.trim() : null;

  if (
    (scope !== 'organization' && scope !== 'workspace') ||
    typeof organizationId !== 'string' ||
    !UUID_PATTERN.test(organizationId) ||
    typeof principalId !== 'string' ||
    !UUID_PATTERN.test(principalId) ||
    typeof roleKey !== 'string' ||
    !ROLE_KEY_PATTERN.test(roleKey) ||
    (scope === 'workspace' && (!workspaceId || !UUID_PATTERN.test(workspaceId))) ||
    (scope === 'organization' && workspaceId !== null)
  ) {
    redirect('/settings/workspaces?error=invalid-role');
  }

  const supabase = await requireAuthenticatedUser();
  await requirePermission(
    supabase,
    scope === 'organization' ? 'organization.manage_roles' : 'workspace.manage_roles',
    organizationId,
    workspaceId,
  );

  const { error } =
    scope === 'organization'
      ? await supabase.rpc('assign_organization_role', {
          p_organization_id: organizationId,
          p_principal_id: principalId,
          p_role_key: roleKey,
        })
      : await supabase.rpc('assign_workspace_role', {
          p_organization_id: organizationId,
          p_workspace_id: workspaceId!,
          p_principal_id: principalId,
          p_role_key: roleKey,
        });

  if (error) redirect('/settings/workspaces?error=role-assignment-failed');
  revalidatePath('/settings/workspaces');
  redirect('/settings/workspaces?message=role-assigned');
}

export async function revokeRole(formData: FormData): Promise<void> {
  const scope = formData.get('scope');
  const organizationId = formData.get('organization_id');
  const workspaceValue = formData.get('workspace_id');
  const bindingId = formData.get('binding_id');
  const workspaceId =
    typeof workspaceValue === 'string' && workspaceValue.trim() ? workspaceValue.trim() : null;

  if (
    (scope !== 'organization' && scope !== 'workspace') ||
    typeof organizationId !== 'string' ||
    !UUID_PATTERN.test(organizationId) ||
    typeof bindingId !== 'string' ||
    !UUID_PATTERN.test(bindingId) ||
    (scope === 'workspace' && (!workspaceId || !UUID_PATTERN.test(workspaceId))) ||
    (scope === 'organization' && workspaceId !== null)
  ) {
    redirect('/settings/workspaces?error=invalid-role');
  }

  const supabase = await requireAuthenticatedUser();
  await requirePermission(
    supabase,
    scope === 'organization' ? 'organization.manage_roles' : 'workspace.manage_roles',
    organizationId,
    workspaceId,
  );

  const { error } =
    scope === 'organization'
      ? await supabase.rpc('revoke_organization_role', { p_binding_id: bindingId })
      : await supabase.rpc('revoke_workspace_role', { p_binding_id: bindingId });

  if (error) redirect('/settings/workspaces?error=role-revocation-failed');
  revalidatePath('/settings/workspaces');
  redirect('/settings/workspaces?message=role-revoked');
}
