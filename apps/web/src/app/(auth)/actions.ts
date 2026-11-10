'use server';

import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export async function signIn(formData: FormData): Promise<void> {
  const emailValue = formData.get('email');
  const passwordValue = formData.get('password');

  if (
    typeof emailValue !== 'string' ||
    typeof passwordValue !== 'string' ||
    !emailValue.trim() ||
    !passwordValue ||
    emailValue.length > 254 ||
    passwordValue.length > 1024
  ) {
    redirect('/sign-in?error=invalid');
  }

  if (!isSupabaseConfigured()) {
    redirect('/sign-in?error=unavailable');
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailValue.trim(),
      password: passwordValue,
    });
    if (error) redirect('/sign-in?error=credentials');
  } catch (error) {
    // Re-throw Next.js redirect control flow; do not expose provider/network errors.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    )
      throw error;
    redirect('/sign-in?error=unavailable');
  }

  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect('/sign-in?error=unavailable');
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    // Supabase clears this local session before its best-effort server revocation
    // request. A returned error therefore means local logout occurred, but the
    // server may retain the refresh token until it expires.
    if (error) {
      redirect('/sign-in?message=signed-out&warning=revocation-unconfirmed');
    }
  } catch (error) {
    // Re-throw Next.js redirect control flow. Unexpected failures must not be
    // presented as a successful sign-out.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    )
      throw error;
    redirect('/sign-in?error=signout');
  }

  redirect('/sign-in?message=signed-out');
}
