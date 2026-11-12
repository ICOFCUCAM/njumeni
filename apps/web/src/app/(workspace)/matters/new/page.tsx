import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createMatterFromIntake } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { intakeQuestions, LEGAL_CATEGORIES, type LegalCategory } from '@/modules/cases/intake';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errors: Record<string, string> = {
  missing: 'Give the matter a title and answer every required question.',
  'invalid-input': 'Dates must be entered as dates.',
  'not-authorized': 'You do not have permission to open matters in this workspace.',
  failed: 'The matter could not be created. Try again.',
};

export default async function NewMatterPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ws?: string; category?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (
    !UUID.test(params.org ?? '') ||
    !UUID.test(params.ws ?? '') ||
    !(LEGAL_CATEGORIES as readonly string[]).includes(params.category ?? '')
  )
    notFound();
  const category = params.category as LegalCategory;
  const supabase = await createClient();
  const { data: jurisdictions } = await supabase.rpc('research_list_jurisdictions');
  const questions = intakeQuestions(category);

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href={`/matters?org=${params.org}&ws=${params.ws}`}>Matters</Link> · guided intake
        </p>
        <h1 className="page-title">New {category} matter</h1>
        <p className="page-description">
          Describe your situation in your own words. The intake assistant turns your answers into a
          research question, the facts to prove and first tasks. It does not give legal advice, and
          it never states a deadline as fact: verify every deadline.
        </p>
      </header>
      {params.error && errors[params.error] ? (
        <p role="alert" className="module-panel">
          {errors[params.error]}
        </p>
      ) : null}
      <form action={createMatterFromIntake} className="module-panel profile-field-grid">
        <input type="hidden" name="organizationId" value={params.org} />
        <input type="hidden" name="workspaceId" value={params.ws} />
        <input type="hidden" name="category" value={category} />
        <label className="profile-field">
          Matter title *
          <input name="title" required minLength={3} maxLength={300} />
        </label>
        <label className="profile-field">
          Jurisdiction *
          <select name="jurisdictionCode" defaultValue="NO">
            {(jurisdictions ?? []).map((j) => (
              <option key={j.code} value={j.code}>
                {j.name}
              </option>
            ))}
          </select>
        </label>
        {questions.map((q) => (
          <label key={q.key} className="profile-field">
            {q.label}
            {q.required ? ' *' : ''}
            {q.kind === 'longtext' ? (
              <textarea name={`answer:${q.key}`} rows={5} maxLength={6000} required={q.required} />
            ) : (
              <input
                name={`answer:${q.key}`}
                type={q.kind === 'date' ? 'date' : 'text'}
                maxLength={500}
                required={q.required}
              />
            )}
          </label>
        ))}
        <div className="profile-actions">
          <button type="submit" className="auth-submit">
            Open matter
          </button>
        </div>
      </form>
    </article>
  );
}
