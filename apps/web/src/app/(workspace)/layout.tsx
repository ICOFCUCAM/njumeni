import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { WorkspaceShell } from '@/components/workspace-shell';
import { headers } from 'next/headers';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { navigationLabels, resolveLocale } from '@/modules/global/i18n';

// Never statically render or cache authenticated workspace responses.
export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) redirect('/sign-in?error=unavailable');

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');

  const { data: personalOrganisation } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('kind', 'personal')
    .maybeSingle();

  const { data: personalWorkspace } = personalOrganisation
    ? await supabase
        .from('workspaces')
        .select('name')
        .eq('organization_id', personalOrganisation.id)
        .eq('kind', 'personal')
        .maybeSingle()
    : { data: null };

  const { data: profile } = await supabase.from('user_profiles').select('locale').maybeSingle();
  const locale = resolveLocale(profile?.locale ?? null, (await headers()).get('accept-language'));

  return (
    <WorkspaceShell
      labels={navigationLabels(locale)}
      userEmail={user.email ?? 'Authenticated account'}
      organizationName={personalOrganisation?.name ?? 'Organisation pending'}
      workspaceName={personalWorkspace?.name ?? 'Workspace pending'}
    >
      {children}
    </WorkspaceShell>
  );
}
