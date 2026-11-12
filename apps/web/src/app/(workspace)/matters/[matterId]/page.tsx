import Link from 'next/link';
import { notFound } from 'next/navigation';
import { matterAction, professionalMatterAction } from '../actions';
import { createClient } from '@/lib/supabase/server';
import type { MatterView } from '@/modules/cases/bundle';
import type { IntakeSummary } from '@/modules/cases/intake';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  'not-authorized': 'You do not have permission for that action.',
  closed: 'The matter is closed. Reopen it to make changes.',
  link: 'That item cannot be linked (it must belong to this workspace).',
  status: 'That status change is not allowed.',
  assignee: 'Tasks can only be assigned to workspace members.',
  event: 'Check the entry and try again.',
  barred: 'That person is behind an information barrier on this matter.',
  failed: 'The change could not be saved.',
};
const ROLES = [
  'client',
  'opposing_party',
  'representative',
  'opposing_representative',
  'witness',
  'court',
  'authority',
  'other',
];
const DEADLINE_TYPES = ['limitation', 'filing', 'response', 'appeal', 'hearing', 'other'];
const label = (value: string) => value.replace(/_/g, ' ');

type Matter = Omit<MatterView, 'tasks' | 'deadlines'> & {
  organizationId: string;
  workspaceId: string;
  canEdit: boolean;
  intake: { answers?: Record<string, string>; summary?: IntakeSummary | null };
  tasks: (MatterView['tasks'][number] & { id: string })[];
  deadlines: (MatterView['deadlines'][number] & { id: string })[];
};

function Hidden({ matterId, action }: { matterId: string; action: string }) {
  return (
    <>
      <input type="hidden" name="matterId" value={matterId} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}

export default async function MatterPage({
  params,
  searchParams,
}: {
  params: Promise<{ matterId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { matterId } = await params;
  const { error: errorCode } = await searchParams;
  if (!UUID.test(matterId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('matter_get', { p_matter_id: matterId });
  if (error || !data) notFound();
  const matter = data as unknown as Matter;
  const scope = { p_organization_id: matter.organizationId, p_workspace_id: matter.workspaceId };
  const [evidence, runs, issues, documents] = matter.canEdit
    ? await Promise.all([
        supabase.rpc('evidence_list_items', scope),
        supabase.rpc('research_list_runs', scope),
        supabase.rpc('argument_list_issues', scope),
        supabase.rpc('document_list', scope),
      ])
    : [null, null, null, null];
  const linked = new Set(matter.links.map((l) => `${l.type}:${l.id}`));
  const linkOptions = [
    ...(evidence?.data ?? [])
      .filter((e) => e.status === 'active')
      .map((e) => ({ value: `evidence_item:${e.evidence_item_id}`, text: `Evidence: ${e.title}` })),
    ...(runs?.data ?? []).map((r) => ({
      value: `research_run:${r.run_id}`,
      text: `Research: ${r.question}`,
    })),
    ...(issues?.data ?? []).map((i) => ({
      value: `legal_issue:${i.issue_id}`,
      text: `Argument: ${i.title}`,
    })),
    ...((documents?.data ?? []) as { id: string; title: string }[]).map((d) => ({
      value: `legal_document:${d.id}`,
      text: `Document: ${d.title}`,
    })),
  ].filter((o) => !linked.has(o.value));
  const summary = matter.intake.summary ?? null;
  const [professional, candidates] = await Promise.all([
    supabase.rpc('matter_professional', { p_matter_id: matterId }),
    supabase.rpc('matter_team_candidates', { p_matter_id: matterId }),
  ]);
  const pro = professional.data as {
    client: { name: string; kind: string } | null;
    conflictCheck: { decision: string; decidedAt: string; hits: number } | null;
    team: { name: string; role: string }[];
    barrierCount: number;
    canManageBarriers: boolean;
  } | null;
  const people = (
    (candidates.data ?? []) as {
      principalId: string;
      name: string;
      assignment: string | null;
      barred: boolean;
    }[]
  ).filter((p) => !p.barred);
  const linkHref = (type: string, id: string) =>
    ({
      evidence_item: `/evidence/${id}`,
      research_run: `/research/${id}`,
      legal_issue: `/arguments/${id}`,
      legal_document: `/documents/${id}`,
    })[type] ?? '#';

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href={`/matters?org=${matter.organizationId}&ws=${matter.workspaceId}`}>
            Matters
          </Link>{' '}
          · {matter.matterNumber}
        </p>
        <h1 className="page-title">{matter.title}</h1>
        <p className="page-description">
          {label(matter.legalCategory)} · {matter.jurisdictionCode} ·{' '}
          <strong>{label(matter.status)}</strong>
          {matter.description ? <> · {matter.description.slice(0, 240)}</> : null}
        </p>
      </header>

      {errorCode && ERRORS[errorCode] ? (
        <p role="alert" className="module-panel">
          {ERRORS[errorCode]}
        </p>
      ) : null}

      <section className="module-panel" aria-label="Matter actions">
        <div className="profile-actions">
          <a href={`/api/v1/matters/${matter.id}/export`}>Export case bundle (ZIP)</a>
          {summary ? (
            <>
              {' '}
              ·{' '}
              <Link
                href={`/research?org=${matter.organizationId}&ws=${matter.workspaceId}&q=${encodeURIComponent(summary.researchQuestion)}`}
              >
                Research the intake question
              </Link>
            </>
          ) : null}{' '}
          ·{' '}
          <Link href={`/documents?org=${matter.organizationId}&ws=${matter.workspaceId}`}>
            Draft a document
          </Link>
        </div>
        {matter.status !== 'archived' ? (
          <form action={matterAction} className="profile-actions">
            <Hidden matterId={matter.id} action="status" />
            <select name="status" defaultValue="">
              <option value="" disabled>
                Change status…
              </option>
              {['open', 'on_hold', 'closed', 'archived']
                .filter((s) => s !== matter.status)
                .map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
            </select>{' '}
            <input name="note" placeholder="Reason (optional)" maxLength={500} />{' '}
            <button type="submit">Update status</button>
          </form>
        ) : null}
      </section>

      {pro ? (
        <section className="module-panel" aria-labelledby="team-heading">
          <h2 id="team-heading" className="section-heading">
            Client, conflicts and team
          </h2>
          <p>
            {pro.client ? <>Client: {pro.client.name} · </> : null}
            {pro.conflictCheck
              ? `Conflict check: ${pro.conflictCheck.decision} (${pro.conflictCheck.hits} hit(s), ${pro.conflictCheck.decidedAt.slice(0, 10)})`
              : 'No conflict check recorded'}
            {pro.barrierCount ? ` · ${pro.barrierCount} information barrier(s) in force` : ''}
          </p>
          <ul className="membership-list">
            {pro.team.map((t, i) => (
              <li key={i} className="membership-row">
                {t.name} <span className="workspace-status">{label(t.role)}</span>
              </li>
            ))}
          </ul>
          {matter.canEdit && people.length ? (
            <form action={professionalMatterAction} className="profile-actions">
              <input type="hidden" name="matterId" value={matter.id} />
              <input type="hidden" name="action" value="assign" />
              <select name="principalId">
                {people.map((p) => (
                  <option key={p.principalId} value={p.principalId}>
                    {p.name}
                  </option>
                ))}
              </select>{' '}
              <select name="role" defaultValue="team_member">
                <option value="responsible_lawyer">responsible lawyer</option>
                <option value="team_member">team member</option>
                <option value="supervisor">supervisor</option>
              </select>{' '}
              <button type="submit">Assign</button>
            </form>
          ) : null}
          {pro.canManageBarriers && people.length ? (
            <form action={professionalMatterAction} className="profile-actions">
              <input type="hidden" name="matterId" value={matter.id} />
              <input type="hidden" name="action" value="barrier" />
              <select name="principalId">
                {people.map((p) => (
                  <option key={p.principalId} value={p.principalId}>
                    {p.name}
                  </option>
                ))}
              </select>{' '}
              <input
                name="reason"
                required
                minLength={3}
                maxLength={1000}
                placeholder="Reason for the barrier"
              />{' '}
              <button type="submit">Add information barrier</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {summary ? (
        <section className="module-panel" aria-labelledby="intake-heading">
          <h2 id="intake-heading" className="section-heading">
            Intake summary
          </h2>
          <p>
            <strong>Research question:</strong> {summary.researchQuestion}
          </p>
          {summary.facts.length ? (
            <ul className="membership-list" aria-label="Facts">
              {summary.facts.map((f) => (
                <li key={f} className="membership-row">
                  {f}
                </li>
              ))}
            </ul>
          ) : null}
          {summary.missingInformation.length ? (
            <p>
              <small>Still unknown: {summary.missingInformation.join(' · ')}</small>
            </p>
          ) : null}
          <p>
            <small>
              Prepared by the intake assistant. It organises your account; it is not legal advice.
            </small>
          </p>
        </section>
      ) : null}

      <section className="module-panel" aria-labelledby="deadlines-heading">
        <h2 id="deadlines-heading" className="section-heading">
          Deadlines and hearings
        </h2>
        <ul className="membership-list">
          {matter.deadlines.map((d) => (
            <li key={d.id} className="membership-row">
              <span className="workspace-status">
                {label(d.type)} · {d.status}
                {d.status === 'pending' && new Date(d.dueAt) < new Date() ? ' · OVERDUE' : ''}
              </span>{' '}
              {d.dueAt.slice(0, 16).replace('T', ' ')} UTC · {d.title}
              {d.location ? <small> · {d.location}</small> : null}
              {d.basis ? <small> · basis: {d.basis}</small> : null}
              {matter.canEdit && d.status === 'pending' ? (
                <form action={matterAction} className="profile-actions">
                  <Hidden matterId={matter.id} action="deadline-status" />
                  <input type="hidden" name="deadlineId" value={d.id} />
                  {(d.type === 'hearing' ? ['held', 'waived'] : ['met', 'missed', 'waived']).map(
                    (s) => (
                      <button key={s} type="submit" name="status" value={s}>
                        Mark {s}
                      </button>
                    ),
                  )}
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {matter.canEdit ? (
          <form action={matterAction} className="profile-field-grid">
            <Hidden matterId={matter.id} action="deadline" />
            <label className="profile-field">
              Title
              <input name="title" required minLength={2} maxLength={300} />
            </label>
            <label className="profile-field">
              Type
              <select name="type" defaultValue="filing">
                {DEADLINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              Due (UTC)
              <input name="dueAt" type="datetime-local" required />
            </label>
            <label className="profile-field">
              Location (hearings)
              <input name="location" maxLength={300} />
            </label>
            <label className="profile-field">
              Basis (where the deadline comes from)
              <input name="basis" maxLength={1000} />
            </label>
            <div className="profile-actions">
              <button type="submit">Add</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="module-panel" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="section-heading">
          Tasks
        </h2>
        <ul className="membership-list">
          {matter.tasks.map((t) => (
            <li key={t.id} className="membership-row">
              <span className="workspace-status">
                {label(t.status)} · {t.priority}
              </span>{' '}
              {t.title}
              {t.dueDate ? <small> · due {t.dueDate}</small> : null}
              {t.assigneeName ? <small> · {t.assigneeName}</small> : null}
              {matter.canEdit && (t.status === 'open' || t.status === 'in_progress') ? (
                <form action={matterAction} className="profile-actions">
                  <Hidden matterId={matter.id} action="task-status" />
                  <input type="hidden" name="taskId" value={t.id} />
                  {t.status === 'open' ? (
                    <button type="submit" name="status" value="in_progress">
                      Start
                    </button>
                  ) : null}{' '}
                  <button type="submit" name="status" value="done">
                    Done
                  </button>{' '}
                  <button type="submit" name="status" value="cancelled">
                    Cancel
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {matter.canEdit ? (
          <form action={matterAction} className="profile-field-grid">
            <Hidden matterId={matter.id} action="task" />
            <label className="profile-field">
              Task
              <input name="title" required minLength={2} maxLength={300} />
            </label>
            <label className="profile-field">
              Due date
              <input name="dueDate" type="date" />
            </label>
            <label className="profile-field">
              Priority
              <select name="priority" defaultValue="normal">
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </label>
            <div className="profile-actions">
              <button type="submit">Add task</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="module-panel" aria-labelledby="parties-heading">
        <h2 id="parties-heading" className="section-heading">
          Parties
        </h2>
        <ul className="membership-list">
          {matter.parties.map((p) => (
            <li key={p.id} className="membership-row">
              {p.name} <span className="workspace-status">{label(p.role)}</span>
              {p.representsPartyId ? (
                <small>
                  {' '}
                  · for {matter.parties.find((x) => x.id === p.representsPartyId)?.name}
                </small>
              ) : null}
            </li>
          ))}
        </ul>
        {matter.canEdit ? (
          <form action={matterAction} className="profile-field-grid">
            <Hidden matterId={matter.id} action="party" />
            <label className="profile-field">
              Name
              <input name="name" required maxLength={300} />
            </label>
            <label className="profile-field">
              Role
              <select name="role" defaultValue="client">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {label(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              Represents
              <select name="representsPartyId" defaultValue="">
                <option value="">—</option>
                {matter.parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="profile-actions">
              <button type="submit">Add party</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="module-panel" aria-labelledby="links-heading">
        <h2 id="links-heading" className="section-heading">
          Evidence, research, arguments and documents
        </h2>
        <ul className="membership-list">
          {matter.links.map((l) => (
            <li key={`${l.type}:${l.id}`} className="membership-row">
              <span className="workspace-status">{label(l.type)}</span>{' '}
              <Link href={linkHref(l.type, l.id)}>{l.title ?? l.id}</Link>
              {l.status ? <small> · {l.status.replace('_', ' ')}</small> : null}
            </li>
          ))}
        </ul>
        {matter.canEdit && linkOptions.length > 0 ? (
          <form action={matterAction} className="profile-actions">
            <Hidden matterId={matter.id} action="link" />
            <select name="target" required defaultValue="">
              <option value="" disabled>
                Link an item from this workspace…
              </option>
              {linkOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.text.slice(0, 120)}
                </option>
              ))}
            </select>{' '}
            <button type="submit">Link</button>
          </form>
        ) : null}
      </section>

      <section className="module-panel" aria-labelledby="chronology-heading">
        <h2 id="chronology-heading" className="section-heading">
          Chronology
        </h2>
        {matter.chronology.length === 0 ? (
          <p>Link evidence with dated events, or add deadlines, to build the chronology.</p>
        ) : (
          <ol className="membership-list">
            {matter.chronology.map((c, i) => (
              <li key={i} className="membership-row">
                <strong>{c.date}</strong> · {c.description} <small>({c.source})</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="module-panel" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-heading">
          Procedural history and communications
        </h2>
        {matter.canEdit ? (
          <form action={matterAction} className="profile-field-grid">
            <Hidden matterId={matter.id} action="event" />
            <label className="profile-field">
              Entry
              <select name="eventType" defaultValue="note">
                <option value="note">Research note</option>
                <option value="communication">Communication</option>
                <option value="procedural_step">Procedural step</option>
              </select>
            </label>
            <label className="profile-field">
              Summary
              <input name="summary" required maxLength={2000} />
            </label>
            <label className="profile-field">
              Date
              <input name="occurredOn" type="date" />
            </label>
            <div className="profile-actions">
              <button type="submit">Record</button>
            </div>
          </form>
        ) : null}
        <ul className="membership-list">
          {matter.history.map((h, i) => (
            <li key={i} className="membership-row">
              <small>{h.occurredAt.slice(0, 16).replace('T', ' ')}</small>{' '}
              <span className="workspace-status">{label(h.type)}</span> {h.summary}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
