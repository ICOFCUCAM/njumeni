'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Jurisdictions a question can be left for. Norway is the first to open; the others are in the
// framework and their questions tell us where demand is.
const JURISDICTIONS = ['NO', 'SE', 'DK', 'FI', 'GB', 'EU', 'OTHER'];
const LANGUAGES = ['nb', 'nn', 'en'];

const isCalendarDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().startsWith(value);

// Stores a question for when live research opens. It never answers it: nothing here calls the
// research engine, and the page shows only a confirmation.
export async function submitQuestion(formData: FormData): Promise<void> {
  const field = (name: string) => String(formData.get(name) ?? '').trim();
  const question = field('question').replace(/\s+/g, ' ');
  const back = (query: string) => redirect(`/ask?${query}`);
  // Bots fill the hidden field; they get the normal confirmation and nothing is stored.
  if (field('website')) back('status=received');
  const keep = `&q=${encodeURIComponent(question.slice(0, 1000))}`;
  if (formData.get('consent') !== 'yes') back(`error=consent${keep}`);
  const jurisdiction = field('jurisdiction');
  const language = field('language');
  const date = field('date');
  const email = field('email').toLowerCase();
  if (
    question.length < 5 ||
    question.length > 1000 ||
    !JURISDICTIONS.includes(jurisdiction) ||
    !LANGUAGES.includes(language) ||
    (date !== '' && !isCalendarDate(date)) ||
    (email !== '' && !/^[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,24}$/.test(email))
  ) {
    back(`error=invalid${keep}`);
  }
  let failure: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('research_question_submit', {
      p_question: question,
      p_jurisdiction_code: jurisdiction,
      // Optional values are sent as SQL null; the generated types do not mark them nullable.
      p_as_of_date: (date || null) as string,
      p_response_language: language,
      p_contact_email: (email || null) as string,
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
  back(failure ? `error=${failure}${keep}` : `status=received${email ? '&email=1' : ''}`);
}
