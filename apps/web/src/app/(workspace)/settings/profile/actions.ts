'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const MAX_NAME_LENGTH = 120;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function field(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}

export async function updateProfile(formData: FormData): Promise<void> {
  const displayName = field(formData, 'display_name', MAX_NAME_LENGTH);
  const givenName = field(formData, 'given_name', 80);
  const familyName = field(formData, 'family_name', 80);
  const avatarUrl = field(formData, 'avatar_url', 2048);
  const locale = field(formData, 'locale', 35);
  const timezone = field(formData, 'timezone', 100);

  if (
    displayName === null ||
    givenName === null ||
    familyName === null ||
    avatarUrl === null ||
    locale === null ||
    timezone === null ||
    (locale !== '' && !LOCALE_PATTERN.test(locale)) ||
    (avatarUrl !== '' && !/^https:\/\//i.test(avatarUrl)) ||
    timezone.length === 0
  ) {
    redirect('/settings/profile?error=invalid');
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) redirect('/sign-in');

    // Resolve the principal through the caller's RLS-filtered profile row.
    // The browser never supplies a principal ID or identity-provider subject.
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('principal_id')
      .single();

    if (profileError || !profile) redirect('/settings/profile?error=profile-unavailable');

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        display_name: displayName || null,
        given_name: givenName || null,
        family_name: familyName || null,
        avatar_url: avatarUrl || null,
        locale: locale || 'en',
        timezone,
      })
      .eq('principal_id', profile.principal_id);

    if (updateError) redirect('/settings/profile?error=save-failed');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    )
      throw error;
    redirect('/settings/profile?error=unavailable');
  }

  revalidatePath('/settings/profile');
  redirect('/settings/profile?message=saved');
}
