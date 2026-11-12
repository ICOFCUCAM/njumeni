'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const AUDIENCES = [
  'individual',
  'legal_professional',
  'law_firm',
  'enterprise',
  'public_institution',
];
const JURISDICTIONS = [
  'NO',
  'SE',
  'DK',
  'FI',
  'GB',
  'EU',
  'US',
  'CM',
  'GH',
  'KE',
  'NG',
  'SN',
  'UG',
  'ZA',
];

export async function requestEarlyAccess(formData: FormData): Promise<void> {
  const field = (name: string) => String(formData.get(name) ?? '').trim();
  const interest = field('interest') === 'demonstration' ? 'demonstration' : 'early_access';
  const back = (query: string) => redirect(`/early-access?${query}`);
  // Bots fill the hidden field; they get the normal confirmation and nothing is stored.
  if (field('website')) back('status=received');
  const email = field('email');
  const fullName = field('fullName');
  const audience = field('audience');
  const jurisdictions = formData
    .getAll('jurisdictions')
    .map(String)
    .filter((code) => JURISDICTIONS.includes(code));
  if (formData.get('consent') !== 'yes') back(`error=consent&interest=${interest}`);
  if (
    !/^[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,24}$/.test(email) ||
    fullName.length < 2 ||
    !AUDIENCES.includes(audience)
  ) {
    back(`error=invalid&interest=${interest}`);
  }
  let failure: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('early_access_request', {
      p_email: email,
      p_full_name: fullName.slice(0, 120),
      p_organisation: field('organisation').slice(0, 160),
      p_audience: audience,
      p_interest: interest,
      p_jurisdictions: jurisdictions,
      p_message: field('message').slice(0, 1500),
      p_consent: true,
    });
    if (error)
      failure = /BUSY/.test(error.message)
        ? 'busy'
        : /INVALID/.test(error.message)
          ? 'invalid'
          : 'unavailable';
  } catch {
    failure = 'unavailable';
  }
  back(failure ? `error=${failure}&interest=${interest}` : 'status=received');
}
