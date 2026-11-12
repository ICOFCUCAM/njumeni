import Link from 'next/link';
import { askResearchQuestion } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ org?: string; ws?: string; error?: string; q?: string }>;

const errors: Record<string, string> = {
  'invalid-scope': 'Choose a workspace first.',
  'invalid-input': 'Enter a question of at least three characters and a valid date.',
  'not-authorized': 'You do not have permission to run research in this workspace.',
  'research-failed': 'The research could not be completed. Try again.',
  quota: 'Your plan’s research allowance for this period is used up. See Plan and usage.',
};

const levelNotes: Record<string, string> = {
  catalogued: 'catalogued: sources listed only, nothing searchable',
  planned: 'planned: no live sources yet',
  pilot: 'pilot: limited live coverage',
  partial: 'partial: defined classes and periods covered',
  supported: 'supported',
  suspended: 'suspended',
};

export default async function ResearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: workspaces }, { data: jurisdictions }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, organization_id, name')
      .eq('status', 'active')
      .order('created_at'),
    supabase.rpc('research_list_jurisdictions'),
  ]);
  const workspaceList = workspaces ?? [];
  const selected =
    workspaceList.find((w) => w.id === params.ws && w.organization_id === params.org) ??
    workspaceList[0];
  const history = selected
    ? await supabase.rpc('research_list_runs', {
        p_organization_id: selected.organization_id,
        p_workspace_id: selected.id,
      })
    : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module B · Legal research engine</p>
        <h1 className="page-title">Legal research</h1>
        <p className="page-description">
          Answers are built only from verified extracts of rights-approved law, as it stood on the
          date you choose. Every citation and quotation is checked by the database; when nothing
          verifiable is found, Njumeni says so rather than guessing. This is legal information, not
          legal advice.
        </p>
      </header>

      {params.error && errors[params.error] ? (
        <p role="alert" className="module-panel">
          {errors[params.error]}
        </p>
      ) : null}

      {workspaceList.length > 1 ? (
        <nav className="module-panel" aria-label="Workspace">
          {workspaceList.map((w) => (
            <Link key={w.id} href={`/research?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected?.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? (
        <>
          <section className="module-panel" aria-labelledby="ask-heading">
            <h2 id="ask-heading" className="section-heading">
              Ask a legal question
            </h2>
            <form action={askResearchQuestion} className="profile-field-grid">
              <input type="hidden" name="organizationId" value={selected.organization_id} />
              <input type="hidden" name="workspaceId" value={selected.id} />
              <label className="profile-field">
                Question
                <textarea
                  name="question"
                  required
                  minLength={3}
                  maxLength={4000}
                  rows={3}
                  defaultValue={(params.q ?? '').slice(0, 4000)}
                />
              </label>
              <label className="profile-field">
                Jurisdiction
                <select name="jurisdictionCode" defaultValue="NO">
                  {(jurisdictions ?? []).map((j) => (
                    <option key={j.code} value={j.code}>
                      {j.name} ({levelNotes[j.coverage_level] ?? j.coverage_level})
                    </option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                Law as it stood on
                <input name="asOfDate" type="date" defaultValue={today} required />
              </label>
              <label className="profile-field">
                Language of the sources
                <select name="language" defaultValue="nb">
                  <option value="nb">Norwegian (Bokmål)</option>
                  <option value="nn">Norwegian (Nynorsk)</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </label>
              <div className="profile-actions">
                <button type="submit" className="auth-submit">
                  Research
                </button>
              </div>
            </form>
          </section>

          <section className="module-panel" aria-labelledby="history-heading">
            <h2 id="history-heading" className="section-heading">
              Research history
            </h2>
            {(history?.data ?? []).length === 0 ? (
              <p>No research yet in this workspace.</p>
            ) : (
              <ul className="membership-list">
                {(history?.data ?? []).map((run) => (
                  <li key={run.run_id} className="membership-row">
                    <Link href={`/research/${run.run_id}`}>{run.question}</Link>{' '}
                    <span className="workspace-status">
                      {run.status === 'answered' ? 'Answered' : 'No verified authority'} ·{' '}
                      {run.jurisdiction_code} · as of {run.as_of_date} · {run.verified_claims}{' '}
                      verified
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="module-panel">You are not a member of any active workspace.</p>
      )}
    </article>
  );
}
