import Link from 'next/link';
import { createDocument } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  org?: string;
  ws?: string;
  error?: string;
  run?: string;
  issue?: string;
}>;

const errors: Record<string, string> = {
  'invalid-scope': 'Choose a workspace first.',
  'invalid-input': 'Give the document a title of at least three characters and choose a template.',
  'not-authorized': 'You do not have permission to create documents in this workspace.',
  failed: 'The document could not be created. Try again.',
};
const STATUS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
};

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: workspaces }, { data: templates }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, organization_id, name')
      .eq('status', 'active')
      .order('created_at'),
    supabase.rpc('document_list_templates'),
  ]);
  const workspaceList = workspaces ?? [];
  const selected =
    workspaceList.find((w) => w.id === params.ws && w.organization_id === params.org) ??
    workspaceList[0];
  const scope = selected
    ? { p_organization_id: selected.organization_id, p_workspace_id: selected.id }
    : null;
  const [documents, runs, issues] = scope
    ? await Promise.all([
        supabase.rpc('document_list', scope),
        supabase.rpc('research_list_runs', scope),
        supabase.rpc('argument_list_issues', scope),
      ])
    : [null, null, null];
  const documentList = (documents?.data ?? []) as {
    id: string;
    title: string;
    status: string;
    currentVersion: number;
    approvedVersion: number | null;
    template: string;
  }[];
  const templateList = (templates ?? []) as { key: string; name: string }[];

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module E · Legal document intelligence</p>
        <h1 className="page-title">Documents</h1>
        <p className="page-description">
          Draft from a template, with sources checked by the database. Every save is a new version
          with its own content hash. A document becomes final only when someone with approval rights
          approves it; in a team, that cannot be the author. Exports are marked DRAFT until then.
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
            <Link key={w.id} href={`/documents?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected?.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? (
        <>
          <section className="module-panel" aria-labelledby="new-heading">
            <h2 id="new-heading" className="section-heading">
              New document
            </h2>
            <form action={createDocument} className="profile-field-grid">
              <input type="hidden" name="organizationId" value={selected.organization_id} />
              <input type="hidden" name="workspaceId" value={selected.id} />
              <label className="profile-field">
                Title
                <input name="title" required minLength={3} maxLength={300} />
              </label>
              <label className="profile-field">
                Template
                <select name="templateKey" defaultValue="legal_memorandum">
                  {templateList.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                Based on research (lets the drafting agent cite verified sources)
                <select name="researchRunId" defaultValue={params.run ?? ''}>
                  <option value="">None</option>
                  {(runs?.data ?? [])
                    .filter((run) => run.status === 'answered')
                    .map((run) => (
                      <option key={run.run_id} value={run.run_id}>
                        {run.question} ({run.as_of_date})
                      </option>
                    ))}
                </select>
              </label>
              <label className="profile-field">
                Argument (reviewed facts and arguments are used)
                <select name="issueId" defaultValue={params.issue ?? ''}>
                  <option value="">None</option>
                  {(issues?.data ?? []).map((issue) => (
                    <option key={issue.issue_id} value={issue.issue_id}>
                      {issue.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profile-actions">
                <button type="submit" className="auth-submit">
                  Create
                </button>
              </div>
            </form>
          </section>

          <section className="module-panel" aria-labelledby="list-heading">
            <h2 id="list-heading" className="section-heading">
              Documents in this workspace
            </h2>
            {documentList.length === 0 ? (
              <p>No documents yet.</p>
            ) : (
              <ul className="membership-list">
                {documentList.map((doc) => (
                  <li key={doc.id} className="membership-row">
                    <Link href={`/documents/${doc.id}`}>{doc.title}</Link>{' '}
                    <span className="workspace-status">
                      {doc.template} · {STATUS[doc.status] ?? doc.status} · version{' '}
                      {doc.currentVersion}
                      {doc.approvedVersion ? ` · approved v${doc.approvedVersion}` : ''}
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
