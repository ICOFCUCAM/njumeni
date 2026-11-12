import Link from 'next/link';
import { professionalAction } from './actions';
import { createClient } from '@/lib/supabase/server';
import { describeHit, type ConflictHit } from '@/modules/professional/templates';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  'not-authorized': 'You do not have permission for that action.',
  decision:
    'A check with hits cannot be cleared: record a conflict, or have an authorised person waive it.',
  waiver:
    'Waivers need organisation authority, and in a firm the person who ran the check cannot waive it.',
  justification: 'A waiver needs a written justification (at least 10 characters).',
  decided: 'That check has already been decided.',
  names: 'Enter at least one name of two or more characters.',
  invalid: 'Check the form and try again.',
  failed: 'The action failed.',
};
interface Check {
  id: string;
  workspaceId: string;
  subject: string;
  names: string[];
  hits: ConflictHit[];
  decision: string;
  decisionNote: string | null;
  runAt: string;
  ranByMe: boolean;
  usedByMatter: string | null;
}

export default async function ProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: organizations }, { data: workspaces }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, kind')
      .eq('status', 'active')
      .order('created_at'),
    supabase
      .from('workspaces')
      .select('id, organization_id, name')
      .eq('status', 'active')
      .order('created_at'),
  ]);
  const orgs = organizations ?? [];
  const org =
    orgs.find((o) => o.id === params.org) ?? orgs.find((o) => o.kind !== 'personal') ?? orgs[0];
  if (!org) return <p className="module-panel">You are not a member of any organisation.</p>;
  const orgWorkspaces = (workspaces ?? []).filter((w) => w.organization_id === org.id);
  const [settings, clients, checks] = await Promise.all([
    supabase.rpc('organization_get_settings', { p_organization_id: org.id }),
    supabase.rpc('client_list', { p_organization_id: org.id }),
    supabase.rpc('conflict_check_list', { p_organization_id: org.id }),
  ]);
  const config = settings.data as {
    requireConflictCheck: boolean;
    validityDays: number;
    canUpdate: boolean;
  } | null;
  const clientList = (clients.data ?? []) as {
    id: string;
    name: string;
    kind: string;
    identifier: string | null;
    matters: number;
  }[];
  const checkList = (checks.data ?? []) as unknown as Check[];
  const Org = () => <input type="hidden" name="organizationId" value={org.id} />;

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module I · Professional workspace</p>
        <h1 className="page-title">{org.name}</h1>
        <p className="page-description">
          Clients, conflict checks and the firm’s professional controls. Conflict checks search
          clients and parties across the whole organisation and reveal only what a decision needs.{' '}
          {orgWorkspaces.map((w) => (
            <span key={w.id}>
              <Link href={`/professional/reports?org=${org.id}&ws=${w.id}`}>
                Report: {w.name}
              </Link>{' '}
            </span>
          ))}
          · <Link href={`/knowledge?org=${org.id}`}>Knowledge</Link> ·{' '}
          <Link href={`/documents/templates?org=${org.id}`}>Templates</Link>
        </p>
      </header>
      {orgs.length > 1 ? (
        <nav className="module-panel" aria-label="Organisation">
          {orgs.map((o) => (
            <Link key={o.id} href={`/professional?org=${o.id}`}>
              {o.id === org.id ? <strong>{o.name}</strong> : o.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {params.error && ERRORS[params.error] ? (
        <p role="alert" className="module-panel">
          {ERRORS[params.error]}
        </p>
      ) : null}

      <section className="module-panel" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="section-heading">
          Matter opening policy
        </h2>
        <p>
          {config?.requireConflictCheck
            ? `A cleared or waived conflict check (valid ${config.validityDays} days) is required to open a matter.`
            : 'Matters can be opened without a conflict check.'}
        </p>
        {config?.canUpdate ? (
          <form action={professionalAction} className="profile-actions">
            <Org />
            <input type="hidden" name="action" value="settings" />
            <label>
              <input type="checkbox" name="require" defaultChecked={config.requireConflictCheck} />{' '}
              Require conflict checks
            </label>{' '}
            <label>
              valid for{' '}
              <input
                name="validityDays"
                type="number"
                min={1}
                max={365}
                defaultValue={config.validityDays}
              />{' '}
              days
            </label>{' '}
            <button type="submit">Save policy</button>
          </form>
        ) : null}
      </section>

      <section className="module-panel" aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="section-heading">
          Conflict checks
        </h2>
        <form action={professionalAction} className="profile-field-grid">
          <Org />
          <input type="hidden" name="action" value="check" />
          <label className="profile-field">
            Subject
            <input
              name="subject"
              required
              minLength={3}
              maxLength={300}
              placeholder="Prospective matter"
            />
          </label>
          <label className="profile-field">
            Names to check (client, adverse parties, related companies)
            <textarea name="names" rows={3} required />
          </label>
          <label className="profile-field">
            For workspace
            <select name="workspaceId">
              {orgWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <div className="profile-actions">
            <button type="submit" className="auth-submit">
              Run check
            </button>
          </div>
        </form>
        <ul className="membership-list">
          {checkList.map((check) => (
            <li key={check.id} className="membership-row">
              <span className="workspace-status">
                {check.decision} · {check.hits.length} hit{check.hits.length === 1 ? '' : 's'}
                {check.usedByMatter ? ` · used by ${check.usedByMatter}` : ''}
              </span>{' '}
              {check.subject} <small>({check.names.join(', ')})</small>
              {check.hits.length ? (
                <ul>
                  {check.hits.map((hit, i) => (
                    <li key={i}>
                      <small>{describeHit(hit)}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
              {check.decisionNote ? <small> · “{check.decisionNote}”</small> : null}
              {check.decision === 'pending' ? (
                <form action={professionalAction} className="profile-actions">
                  <Org />
                  <input type="hidden" name="action" value="decide" />
                  <input type="hidden" name="checkId" value={check.id} />
                  <input
                    name="note"
                    placeholder="Note (required for a waiver)"
                    maxLength={2000}
                  />{' '}
                  {check.hits.length === 0 ? (
                    <button type="submit" name="decision" value="clear">
                      Clear
                    </button>
                  ) : (
                    <>
                      <button type="submit" name="decision" value="conflict">
                        Record conflict
                      </button>{' '}
                      <button type="submit" name="decision" value="waived">
                        Waive
                      </button>
                    </>
                  )}
                </form>
              ) : null}
              {(check.decision === 'clear' || check.decision === 'waived') &&
              !check.usedByMatter ? (
                <small>
                  {' '}
                  ·{' '}
                  <Link href={`/matters?org=${org.id}&ws=${check.workspaceId}`}>
                    open a matter with this check
                  </Link>
                </small>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-labelledby="clients-heading">
        <h2 id="clients-heading" className="section-heading">
          Clients
        </h2>
        <ul className="membership-list">
          {clientList.map((c) => (
            <li key={c.id} className="membership-row">
              {c.name} <span className="workspace-status">{c.kind}</span>
              {c.identifier ? <small> · {c.identifier}</small> : null}{' '}
              <small>· {c.matters} matter(s)</small>
            </li>
          ))}
        </ul>
        <form action={professionalAction} className="profile-field-grid">
          <Org />
          <input type="hidden" name="action" value="client" />
          <label className="profile-field">
            Name
            <input name="name" required minLength={2} maxLength={300} />
          </label>
          <label className="profile-field">
            Kind
            <select name="kind" defaultValue="individual">
              <option value="individual">individual</option>
              <option value="organisation">organisation</option>
            </select>
          </label>
          <label className="profile-field">
            Identifier (e.g. organisation number)
            <input name="identifier" maxLength={60} />
          </label>
          <div className="profile-actions">
            <button type="submit">Register client</button>
          </div>
        </form>
      </section>
    </article>
  );
}
