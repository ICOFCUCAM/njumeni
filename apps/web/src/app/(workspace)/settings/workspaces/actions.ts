'use server';

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