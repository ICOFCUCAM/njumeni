import Link from 'next/link';
import { complianceAction } from '../organisation/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUSES = ['compliant', 'partially_compliant', 'non_compliant', 'not_applicable'];
interface Obligation {
  id: string;
  title: string;
  description: string | null;
  status: string;
  citation: string;
  validFrom: string;
  validUntil: string | null;
  lastAssessedAt: string | null;
  nextReview: string;
  lawChanged: boolean;
  reviewRequired: boolean;
  assessments: { status: string; note: string; at: string; evidence: string | null }[];
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ws?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, organization_id, name')
    .eq('status', 'active')
    .order('created_at');
  const list = workspaces ?? [];
  const selected =
    list.find((w) => w.id === params.ws && w.organization_id === params.org) ?? list[0];
  if (!selected)
    return <p className="module-panel">You are not a member of any active workspace.</p>;
  const scope = { p_organization_id: selected.organization_id, p_workspace_id: selected.id };
  const [register, evidence, runs] = await Promise.all([
    supabase.rpc('compliance_register', scope),
    supabase.rpc('evidence_list_items', scope),
    supabase.rpc('research_list_runs', scope),
  ]);
  const obligations = (register.data ?? []) as unknown as Obligation[];
  // Verified authority passages from this workspace's research can anchor new obligations.
  const passages: { id: string; text: string }[] = [];
  for (const run of (runs.data ?? []).filter((r) => r.status === 'answered').slice(0, 10)) {
    const detail = await supabase.rpc('research_get_run', { p_run_id: run.run_id });
    for (const claim of (
      detail.data as {
        claims?: {
          passageId: string | null;
          verificationStatus: string;
          authorityCitation: string | null;
          statement: string;
        }[];
      } | null
    )?.claims ?? [])
      if (
        claim.passageId &&
        claim.verificationStatus === 'verified' &&
        !passages.some((p) => p.id === claim.passageId)
      )
        passages.push({
          id: claim.passageId,
          text: `${claim.authorityCitation ?? ''} ${claim.statement}`.slice(0, 140),
        });
  }
  const due = obligations.filter((o) => o.reviewRequired).length;
  const Scope = () => (
    <>
      <input type="hidden" name="organizationId" value={selected.organization_id} />
      <input type="hidden" name="workspaceId" value={selected.id} />
    </>
  );

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module L · Compliance and risk</p>
        <h1 className="page-title">Obligation register</h1>
        <p className="page-description">
          Every obligation rests on a verified provision and its version in force. When the law
          changes after an assessment, or a review falls due, the obligation is flagged for review.
          No generic risk scores: only traceable obligations and evidence.
        </p>
      </header>
      {list.length > 1 ? (
        <nav className="module-panel" aria-label="Workspace">
          {list.map((w) => (
            <Link key={w.id} href={`/compliance?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {params.error ? (
        <p role="alert" className="module-panel">
          The change was refused ({params.error.replace(/-/g, ' ')}).
        </p>
      ) : null}
      <section className="module-panel" aria-label="Register">
        <h2 className="section-heading">
          {obligations.length} obligation(s) · {due} need review
        </h2>
        <ul className="membership-list">
          {obligations.map((o) => (
            <li key={o.id} className="membership-row">
              <span className="workspace-status">
                {o.status.replace(/_/g, ' ')}
                {o.reviewRequired ? ' · REVIEW REQUIRED' : ''}
                {o.lawChanged ? ' · law changed since assessment' : ''}
              </span>{' '}
              <strong>{o.title}</strong>{' '}
              <small>
                · {o.citation} (in force from {o.validFrom}) · next review {o.nextReview}
              </small>
              {o.assessments[0] ? (
                <small>
                  {' '}
                  · last: “{o.assessments[0].note}”
                  {o.assessments[0].evidence ? ` (evidence: ${o.assessments[0].evidence})` : ''}
                </small>
              ) : null}
              <form action={complianceAction} className="profile-actions">
                <Scope />
                <input type="hidden" name="action" value="assess" />
                <input type="hidden" name="obligationId" value={o.id} />
                <select name="status" defaultValue="compliant">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>{' '}
                <input
                  name="note"
                  required
                  minLength={3}
                  maxLength={4000}
                  placeholder="Assessment note"
                />{' '}
                <select name="evidenceItemId" defaultValue="">
                  <option value="">No evidence</option>
                  {(evidence.data ?? [])
                    .filter((e) => e.status === 'active')
                    .map((e) => (
                      <option key={e.evidence_item_id} value={e.evidence_item_id}>
                        {e.title}
                      </option>
                    ))}
                </select>{' '}
                <button type="submit">Record assessment</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="module-panel" aria-labelledby="new-obligation">
        <h2 id="new-obligation" className="section-heading">
          New obligation
        </h2>
        {passages.length === 0 ? (
          <p>
            Run{' '}
            <Link href={`/research?org=${selected.organization_id}&ws=${selected.id}`}>
              legal research
            </Link>{' '}
            first: obligations are anchored in verified provisions.
          </p>
        ) : (
          <form action={complianceAction} className="profile-field-grid">
            <Scope />
            <input type="hidden" name="action" value="obligation" />
            <label className="profile-field">
              Obligation
              <input name="title" required minLength={3} maxLength={300} />
            </label>
            <label className="profile-field">
              Provision
              <select name="passageId">
                {passages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.text}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              Description
              <input name="description" maxLength={4000} />
            </label>
            <label className="profile-field">
              Review every (days)
              <input name="interval" type="number" min={7} max={1825} defaultValue={365} />
            </label>
            <div className="profile-actions">
              <button type="submit" className="auth-submit">
                Add to register
              </button>
            </div>
          </form>
        )}
      </section>
    </article>
  );
}
