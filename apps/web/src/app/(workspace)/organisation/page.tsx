import Link from 'next/link';
import { organisationAction } from './actions';
import { ApiKeyForm } from './api-key-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CLASSES = ['closed_matters', 'evidence', 'documents', 'research', 'ai_executions'];
interface Unit {
  id: string;
  kind: string;
  name: string;
  location: string | null;
  parentId: string | null;
  members: string[];
}

export default async function OrganisationPage({
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
  const [structure, directory, retention, sso, support, settingsList] = await Promise.all([
    supabase.rpc('org_structure', { p_organization_id: org.id }),
    supabase.rpc('org_member_directory', { p_organization_id: org.id }),
    supabase.rpc('retention_report', { p_organization_id: org.id }),
    supabase.rpc('sso_status', { p_organization_id: org.id }),
    supabase.rpc('support_access_list', { p_organization_id: org.id }),
    supabase.rpc('institutional_report', { p_organization_id: org.id }),
  ]);
  const isAdmin = !retention.error;
  const units = (structure.data ?? []) as unknown as Unit[];
  const people = (directory.data ?? []) as { principalId: string; name: string }[];
  const report = retention.data as {
    policies: Record<string, number>;
    closedMattersDue: number;
    evidenceDue: number;
    evidenceOnLegalHold: number;
    documentsDue: number;
    researchDue: number;
  } | null;
  const ssoState = sso.data as {
    configuration: { protocol: string; issuer: string; enforced: boolean } | null;
    domains: { domain: string; verified: boolean; txtRecord: string }[];
  } | null;
  const grants = (support.data ?? []) as {
    id: string;
    reason: string;
    minutes: number;
    status: string;
    operator: string;
    expiresAt: string | null;
  }[];
  const aiByWorkspace =
    (
      settingsList.data as {
        workspaces?: { id: string; aiRiskClass: string; conformityRecorded: boolean }[];
      } | null
    )?.workspaces ?? [];
  const keyLists = isAdmin
    ? await Promise.all(
        orgWorkspaces.map((w) =>
          supabase.rpc('api_key_list', { p_organization_id: org.id, p_workspace_id: w.id }),
        ),
      )
    : [];
  const Hidden = ({ action }: { action: string }) => (
    <>
      <input type="hidden" name="organizationId" value={org.id} />
      <input type="hidden" name="action" value={action} />
    </>
  );

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module J · Enterprise administration</p>
        <h1 className="page-title">{org.name}</h1>
        <p className="page-description">
          Structure, retention, single sign-on, support access, API keys and AI governance.{' '}
          <Link href={`/institutional?org=${org.id}`}>Institutional report</Link> ·{' '}
          <Link href={`/professional?org=${org.id}`}>Professional workspace</Link>
        </p>
      </header>
      {orgs.length > 1 ? (
        <nav className="module-panel" aria-label="Organisation">
          {orgs.map((o) => (
            <Link key={o.id} href={`/organisation?org=${o.id}`}>
              {o.id === org.id ? <strong>{o.name}</strong> : o.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {params.error ? (
        <p role="alert" className="module-panel">
          The action was refused ({params.error.replace(/-/g, ' ')}).
        </p>
      ) : null}

      <section className="module-panel" aria-labelledby="structure-heading">
        <h2 id="structure-heading" className="section-heading">
          Offices and teams
        </h2>
        <ul className="membership-list">
          {units.map((u) => (
            <li key={u.id} className="membership-row">
              <span className="workspace-status">{u.kind}</span> {u.name}
              {u.location ? <small> · {u.location}</small> : null}
              {u.parentId ? (
                <small> · in {units.find((p) => p.id === u.parentId)?.name}</small>
              ) : null}
              <small> · {u.members.join(', ') || 'no members'}</small>
              {isAdmin && people.length ? (
                <form action={organisationAction} className="profile-actions">
                  <Hidden action="unit-member" />
                  <input type="hidden" name="unitId" value={u.id} />
                  <select name="principalId">
                    {people.map((p) => (
                      <option key={p.principalId} value={p.principalId}>
                        {p.name}
                      </option>
                    ))}
                  </select>{' '}
                  <button type="submit">Add member</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {isAdmin ? (
          <form action={organisationAction} className="profile-actions">
            <Hidden action="unit" />
            <select name="kind" defaultValue="team">
              <option value="office">Office</option>
              <option value="team">Team</option>
            </select>{' '}
            <input name="name" required minLength={2} maxLength={200} placeholder="Name" />{' '}
            <select name="parentId" defaultValue="">
              <option value="">No parent</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>{' '}
            <input name="location" maxLength={200} placeholder="Location (offices)" />{' '}
            <button type="submit">Create</button>
          </form>
        ) : null}
      </section>

      {isAdmin ? (
        <>
          <section className="module-panel" aria-labelledby="ai-heading">
            <h2 id="ai-heading" className="section-heading">
              AI risk classification (EU AI Act)
            </h2>
            <p>
              Workspaces that assist the administration of justice are classified high-risk. No AI
              agent runs in them until a conformity assessment is recorded.
            </p>
            <ul className="membership-list">
              {orgWorkspaces.map((w) => {
                const current = aiByWorkspace.find((a) => a.id === w.id);
                return (
                  <li key={w.id} className="membership-row">
                    {w.name}{' '}
                    <span className="workspace-status">
                      {current?.aiRiskClass ?? 'standard'}
                      {current?.aiRiskClass === 'high_risk_justice'
                        ? current.conformityRecorded
                          ? ' · conformity recorded'
                          : ' · AI blocked'
                        : ''}
                    </span>
                    <form action={organisationAction} className="profile-actions">
                      <Hidden action="ai-risk" />
                      <input type="hidden" name="workspaceId" value={w.id} />
                      <select name="class" defaultValue={current?.aiRiskClass ?? 'standard'}>
                        <option value="standard">standard</option>
                        <option value="high_risk_justice">high risk (justice)</option>
                      </select>{' '}
                      <input
                        name="conformity"
                        maxLength={300}
                        placeholder="Conformity assessment reference"
                      />{' '}
                      <button type="submit">Save</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="module-panel" aria-labelledby="retention-heading">
            <h2 id="retention-heading" className="section-heading">
              Retention
            </h2>
            {report ? (
              <p>
                Past retention: {report.closedMattersDue} closed matter(s), {report.evidenceDue}{' '}
                evidence item(s), {report.documentsDue} document(s), {report.researchDue} research
                run(s). {report.evidenceOnLegalHold} evidence item(s) on legal hold are never due.
              </p>
            ) : null}
            <form action={organisationAction} className="profile-actions">
              <Hidden action="retention" />
              <select name="class">
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}{' '}
                    {report?.policies[c] ? `(now ${report.policies[c]} years)` : ''}
                  </option>
                ))}
              </select>{' '}
              <input name="years" type="number" min={1} max={50} defaultValue={10} /> years{' '}
              <button type="submit">Set policy</button>
            </form>
          </section>

          <section className="module-panel" aria-labelledby="sso-heading">
            <h2 id="sso-heading" className="section-heading">
              Single sign-on
            </h2>
            <p>
              {ssoState?.configuration
                ? `${ssoState.configuration.protocol.toUpperCase()} · ${ssoState.configuration.issuer} · ${ssoState.configuration.enforced ? 'enforced' : 'not enforced'}`
                : 'Not configured.'}
            </p>
            <ul className="membership-list">
              {(ssoState?.domains ?? []).map((d) => (
                <li key={d.domain} className="membership-row">
                  {d.domain}{' '}
                  <span className="workspace-status">{d.verified ? 'verified' : 'pending'}</span>
                  {d.verified ? null : (
                    <small>
                      {' '}
                      · add DNS TXT record <code>{d.txtRecord}</code>, then ask Njumeni support to
                      verify
                    </small>
                  )}
                </li>
              ))}
            </ul>
            <form action={organisationAction} className="profile-actions">
              <Hidden action="sso-domain" />
              <input name="domain" required placeholder="example.com" />{' '}
              <button type="submit">Add domain</button>
            </form>
            <form action={organisationAction} className="profile-actions">
              <Hidden action="sso-configure" />
              <select name="protocol">
                <option value="saml">SAML</option>
                <option value="oidc">OpenID Connect</option>
              </select>{' '}
              <input name="issuer" required placeholder="Identity provider issuer" />{' '}
              <input name="metadataUrl" placeholder="https://…/metadata" />{' '}
              <label>
                <input type="checkbox" name="enforced" /> enforce
              </label>{' '}
              <button type="submit">Save</button>
            </form>
          </section>

          <section className="module-panel" aria-labelledby="support-heading">
            <h2 id="support-heading" className="section-heading">
              Support access
            </h2>
            <p>
              Njumeni staff cannot see your content. They can request time-limited, read-only
              access, which only you can grant.
            </p>
            <ul className="membership-list">
              {grants.length === 0 ? <li className="membership-row">No requests.</li> : null}
              {grants.map((g) => (
                <li key={g.id} className="membership-row">
                  <span className="workspace-status">{g.status}</span> {g.operator}: {g.reason}{' '}
                  <small>({g.minutes} min)</small>
                  {g.status === 'pending' || g.status === 'approved' ? (
                    <form action={organisationAction} className="profile-actions">
                      <Hidden action="support-decide" />
                      <input type="hidden" name="requestId" value={g.id} />
                      {g.status === 'pending' ? (
                        <>
                          <button type="submit" name="decision" value="approved">
                            Approve
                          </button>{' '}
                          <button type="submit" name="decision" value="denied">
                            Deny
                          </button>
                        </>
                      ) : (
                        <button type="submit" name="decision" value="revoked">
                          Revoke now
                        </button>
                      )}
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="module-panel" aria-labelledby="keys-heading">
            <h2 id="keys-heading" className="section-heading">
              API keys
            </h2>
            <p>
              Keys act as the person who issued them, limited to one workspace and the chosen
              scopes. Only a hash is stored.
            </p>
            <ul className="membership-list">
              {keyLists.flatMap((list, i) =>
                (
                  (list.data ?? []) as {
                    id: string;
                    name: string;
                    prefix: string;
                    scopes: string[];
                    expiresAt: string;
                    revoked: boolean;
                    lastUsedAt: string | null;
                  }[]
                ).map((k) => (
                  <li key={k.id} className="membership-row">
                    {k.name} <code>njk_{k.prefix}_…</code>{' '}
                    <span className="workspace-status">
                      {k.revoked ? 'revoked' : `expires ${k.expiresAt.slice(0, 10)}`}
                    </span>
                    <small>
                      {' '}
                      · {orgWorkspaces[i]?.name} · {k.scopes.join(', ')} · last used{' '}
                      {k.lastUsedAt?.slice(0, 16).replace('T', ' ') ?? 'never'}
                    </small>
                    {k.revoked ? null : (
                      <form action={organisationAction} className="profile-actions">
                        <Hidden action="api-key-revoke" />
                        <input type="hidden" name="keyId" value={k.id} />
                        <button type="submit">Revoke</button>
                      </form>
                    )}
                  </li>
                )),
              )}
            </ul>
            <ApiKeyForm
              organizationId={org.id}
              workspaces={orgWorkspaces.map((w) => ({ id: w.id, name: w.name }))}
            />
          </section>
        </>
      ) : (
        <p className="module-panel">
          Administration settings are available to organisation administrators.
        </p>
      )}
    </article>
  );
}
