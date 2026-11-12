import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LEGAL_CATEGORIES } from '@/modules/cases/intake';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ org?: string; ws?: string; error?: string }>;
interface MatterRow {
  id: string;
  matterNumber: string;
  title: string;
  legalCategory: string;
  jurisdictionCode: string;
  status: string;
  openTasks: number;
  nextDeadline: { title: string; dueAt: string; type: string } | null;
}

const errors: Record<string, string> = {
  'invalid-scope': 'Choose a workspace first.',
  'not-authorized': 'You do not have permission to open matters in this workspace.',
};

export default async function MattersPage({ searchParams }: { searchParams: SearchParams }) {
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
  const { data } = selected
    ? await supabase.rpc('matter_list', {
        p_organization_id: selected.organization_id,
        p_workspace_id: selected.id,
      })
    : { data: null };
  const matters = (data ?? []) as unknown as MatterRow[];

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module D · Case management</p>
        <h1 className="page-title">Matters</h1>
        <p className="page-description">
          Each matter brings together parties, evidence, research, arguments, documents, tasks,
          deadlines and hearings, with a complete procedural history. Matters are never deleted:
          closed matters can be archived and exported as a case bundle.
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
            <Link key={w.id} href={`/matters?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected?.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {selected ? (
        <>
          <section className="module-panel" aria-labelledby="new-heading">
            <h2 id="new-heading" className="section-heading">
              Start a new matter
            </h2>
            <p>Choose the area of law. A short guided interview collects the facts.</p>
            <ul className="membership-list">
              {LEGAL_CATEGORIES.map((category) => (
                <li key={category} className="membership-row">
                  <Link
                    href={`/matters/new?org=${selected.organization_id}&ws=${selected.id}&category=${category}`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="module-panel" aria-labelledby="list-heading">
            <h2 id="list-heading" className="section-heading">
              Matters in this workspace
            </h2>
            {matters.length === 0 ? (
              <p>No matters yet.</p>
            ) : (
              <ul className="membership-list">
                {matters.map((matter) => (
                  <li key={matter.id} className="membership-row">
                    <Link href={`/matters/${matter.id}`}>
                      {matter.matterNumber} · {matter.title}
                    </Link>{' '}
                    <span className="workspace-status">
                      {matter.legalCategory} · {matter.jurisdictionCode} ·{' '}
                      {matter.status.replace('_', ' ')} · {matter.openTasks} open task
                      {matter.openTasks === 1 ? '' : 's'}
                      {matter.nextDeadline
                        ? ` · next: ${matter.nextDeadline.title} ${matter.nextDeadline.dueAt.slice(0, 10)}`
                        : ''}
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
