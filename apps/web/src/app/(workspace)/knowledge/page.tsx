import Link from 'next/link';
import { publishKnowledge } from '../professional/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KINDS = [
  'saved_research',
  'precedent',
  'opinion',
  'approved_argument',
  'note',
  'template_guidance',
];
const ERRORS: Record<string, string> = {
  'not-authorized':
    'Only people with knowledge publishing rights can promote work into organisation knowledge.',
  source:
    'Only answered research, approved documents and arguments from this organisation can be promoted.',
  failed: 'The item could not be published.',
};
interface Item {
  id: string;
  kind: string;
  title: string;
  excerpt: string;
  tags: string[];
  reviewDue: string | null;
  reviewOverdue: boolean;
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; q?: string; kind?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: organizations }, { data: workspaces }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, kind')
      .eq('status', 'active')
      .order('created_at'),
    supabase.from('workspaces').select('id, organization_id, name').eq('status', 'active'),
  ]);
  const orgs = organizations ?? [];
  const org =
    orgs.find((o) => o.id === params.org) ?? orgs.find((o) => o.kind !== 'personal') ?? orgs[0];
  if (!org) return <p className="module-panel">You are not a member of any organisation.</p>;
  const kind = KINDS.includes(params.kind ?? '') ? params.kind! : undefined;
  const { data } = await supabase.rpc('knowledge_search', {
    p_organization_id: org.id,
    ...(params.q ? { p_query: params.q.slice(0, 300) } : {}),
    ...(kind ? { p_kind: kind } : {}),
  });
  const items = (data ?? []) as unknown as Item[];
  const scopes = (workspaces ?? []).filter((w) => w.organization_id === org.id);
  const sources: { value: string; text: string }[] = [];
  for (const w of scopes) {
    const scope = { p_organization_id: org.id, p_workspace_id: w.id };
    const [runs, docs] = await Promise.all([
      supabase.rpc('research_list_runs', scope),
      supabase.rpc('document_list', scope),
    ]);
    for (const r of runs.data ?? [])
      if (r.status === 'answered')
        sources.push({
          value: `research_run:${r.run_id}`,
          text: `Research (${w.name}): ${r.question}`,
        });
    for (const d of (docs.data ?? []) as { id: string; title: string; status: string }[])
      if (d.status === 'approved')
        sources.push({ value: `legal_document:${d.id}`, text: `Document (${w.name}): ${d.title}` });
  }

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module M · Legal knowledge</p>
        <h1 className="page-title">{org.name} knowledge</h1>
        <p className="page-description">
          Saved research, precedents, opinions and approved arguments shared across the
          organisation. Client work never becomes shared knowledge automatically: promotion is a
          deliberate, permissioned and audited act, and stores a reviewed summary rather than the
          client file.
        </p>
      </header>
      {params.error && ERRORS[params.error] ? (
        <p role="alert" className="module-panel">
          {ERRORS[params.error]}
        </p>
      ) : null}
      <form className="module-panel profile-actions" action="/knowledge">
        <input type="hidden" name="org" value={org.id} />
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search knowledge"
          maxLength={300}
        />{' '}
        <select name="kind" defaultValue={kind ?? ''}>
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, ' ')}
            </option>
          ))}
        </select>{' '}
        <button type="submit">Search</button>
      </form>
      <section className="module-panel" aria-label="Results">
        {items.length === 0 ? (
          <p>No published knowledge matches.</p>
        ) : (
          <ul className="membership-list">
            {items.map((item) => (
              <li key={item.id} className="membership-row">
                <span className="workspace-status">
                  {item.kind.replace(/_/g, ' ')}
                  {item.reviewOverdue ? ' · review overdue' : ''}
                </span>{' '}
                <Link href={`/knowledge/${item.id}`}>{item.title}</Link>{' '}
                <small>{item.excerpt}</small>
                {item.tags.length ? <small> · {item.tags.join(', ')}</small> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="module-panel" aria-labelledby="publish-heading">
        <h2 id="publish-heading" className="section-heading">
          Promote work into knowledge
        </h2>
        <form action={publishKnowledge} className="profile-field-grid">
          <input type="hidden" name="organizationId" value={org.id} />
          <label className="profile-field">
            Kind
            <select name="kind" defaultValue="saved_research">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="profile-field">
            Title
            <input name="title" required minLength={3} maxLength={300} />
          </label>
          <label className="profile-field">
            Summary (remove client-identifying details)
            <textarea name="body" required rows={6} maxLength={50000} />
          </label>
          <label className="profile-field">
            Source
            <select name="source" defaultValue="">
              <option value="">None</option>
              {sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.text.slice(0, 120)}
                </option>
              ))}
            </select>
          </label>
          <label className="profile-field">
            Tags (comma-separated)
            <input name="tags" maxLength={400} />
          </label>
          <label className="profile-field">
            Review by
            <input name="reviewDue" type="date" />
          </label>
          <div className="profile-actions">
            <button type="submit" className="auth-submit">
              Publish
            </button>
          </div>
        </form>
      </section>
    </article>
  );
}
