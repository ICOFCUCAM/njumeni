import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { WorkspaceShell } from '@/components/workspace-shell';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) redirect('/sign-in?error=unavailable');

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');

  return (
    <WorkspaceShell userEmail={user.email ?? 'Authenticated account'}>{children}</WorkspaceShell>
  );
}
