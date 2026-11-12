import Link from 'next/link';
import { buildArgument } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ org?: string; ws?: string; error?: string; reason?: string }>;

const errors: Record<string, string> = {
  'invalid-scope': 'Choose a workspace first.',
  'invalid-input': 'Choose a research run to build the argument from.',
  'not-authorized': 'You do not have permission to build arguments in this workspace.',
  refused: 'The AI policy of this workspace refused the request.',
  failed: 'The argument could not be built. Try again.',
};

const reasons: Record<string, string> = {
  AI_PROVIDER_NOT_ENABLED: 'the AI provider is not enabled',
  AI_PROVIDER_NOT_ALLOWED_FOR_WORKSPACE: 'the workspace has not allowed this AI provider',
  AI_EGRESS_NOT_PERMITTED: 'the workspace does not allow this data to be sent to the provider',
  AI_BUDGET_EXCEEDED: 'the monthly AI budget is used up',
  AI_PROVIDER_TERMS_UNACCEPTABLE: 'the provider’s data terms are not acceptable',
};

export default async function ArgumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, organization_id, name')
    .eq('status', 'active')
    .order('created_at');
  const workspaceList = workspaces ?? [];
  const selected =
    workspaceList.find((w) => w.id === params.ws && w.organization_id === params.org) ??
    workspaceList[0];
  const scope = selected
    ? { p_organization_id: selected.organization_id, p_workspace_id: selected.id }
    : null;
  const [issues, runs, settings] = scope
    ? await Promise.all([
        supabase.rpc('argument_list_issues', scope),
        supabase.rpc('research_list_runs', scope),
        supabase.rpc('ai_get_workspace_settings', scope),
      ])
    : [null, null, null];
  const policy = settings?.data as
    | { allowedProviders: string[]; allowedEgress: string[]; monthlyTokenBudget: number }
    | null
    | undefined;
  const answered = (runs?.data ?? []).filter((run) => run.status === 'answered');

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module F · Legal reasoning</p>
        <h1 className="page-title">Arguments</h1>
        <p className="page-description">
          The reasoning agent proposes an argument graph from verified research and your recorded
          facts. Rules cite verified passages, facts point to evidence, and every proposed node
          waits for your review. Njumeni structures arguments; it does not decide cases.
        </p>
      </header>

      {params.error && errors[params.error] ? (
        <p role="alert" className="module-panel">
          {errors[params.error]}
          {params.error === 'refused' && params.reason && reasons[params.reason]
            ? `: ${reasons[params.reason]}.`
            : null}
        </p>
      ) : null}

      {workspaceList.length > 1 ? (
        <nav className="module-panel" aria-label="Workspace">
          {workspaceList.map((w) => (
            <Link key={w.id} href={`/arguments?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected?.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? (
        <>
          <section className="module-panel" aria-labelledby="build-heading">
            <h2 id="build-heading" className="section-heading">
              Build an argument
            </h2>
            {answered.length === 0 ? (
              <p>
                Run <Link href="/research">legal research</Link> that finds verified authority
                first.
              </p>
            ) : (
              <form action={buildArgument} className="profile-field-grid">
                <input type="hidden" name="organizationId" value={selected.organization_id} />
                <input type="hidden" name="workspaceId" value={selected.id} />
                <label className="profile-field">
                  From research
                  <select name="researchRunId" required>
                    {answered.map((run) => (
                      <option key={run.run_id} value={run.run_id}>
                        {run.question} ({run.as_of_date})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="profile-actions">
                  <button type="submit" className="auth-submit">
                    Propose argument
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="module-panel" aria-labelledby="issues-heading">
            <h2 id="issues-heading" className="section-heading">
              Legal issues
            </h2>
            {(issues?.data ?? []).length === 0 ? (
              <p>No arguments yet in this workspace.</p>
            ) : (
              <ul className="membership-list">
                {(issues?.data ?? []).map((issue) => (
                  <li key={issue.issue_id} className="membership-row">
                    <Link href={`/arguments/${issue.issue_id}`}>{issue.title}</Link>{' '}
                    <span className="workspace-status">
                      {issue.node_count} nodes · {issue.proposed_count} awaiting review
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {policy ? (
            <section className="module-panel" aria-labelledby="policy-heading">
              <h2 id="policy-heading" className="section-heading">
                AI policy for this workspace
              </h2>
              <ul className="membership-list">
                <li className="membership-row">
                  Providers allowed: {policy.allowedProviders.join(', ')}
                </li>
                <li className="membership-row">
                  Data that may be sent to an external provider:{' '}
                  {policy.allowedEgress.join(', ').replaceAll('_', ' ')}
                </li>
                <li className="membership-row">
                  Monthly budget for paid providers: {policy.monthlyTokenBudget.toLocaleString()}{' '}
                  tokens
                </li>
              </ul>
              <p>
                <small>
                  The built-in deterministic provider runs inside Njumeni and sends nothing out.
                </small>
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <p className="module-panel">You are not a member of any active workspace.</p>
      )}
    </article>
  );
}
