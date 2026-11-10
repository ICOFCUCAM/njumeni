import { createOrganization, createWorkspace } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ error?: string; message?: string }>;

const messages: Record<string, string> = {
  'invalid-organization': 'Enter a valid organisation name and type.',
  'organization-create-failed':
    'The organisation could not be created. Check the name and try again.',
  'invalid-workspace': 'Enter a valid workspace name and type.',
  'workspace-create-failed':
    'The workspace could not be created. Confirm that you own the selected organisation.',
};

export default async function WorkspacesSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: organisations, error } = await supabase
    .from('organizations')
    .select('id, name, slug, kind, status, created_at')
    .order('created_at', { ascending: true });
  const organisationList = organisations ?? [];
  const { data: workspaces, error: workspacesError } = organisationList.length
    ? await supabase
        .from('workspaces')
        .select('id, organization_id, name, slug, kind, status, created_at')
        .in(
          'organization_id',
          organisationList.map((organisation) => organisation.id),
        )
        .order('created_at', { ascending: true })
    : { data: [], error: null };
  const workspaceRows = workspaces ?? [];
  const workspaceByOrganisation = new Map<string, NonNullable<typeof workspaces>>();
  for (const workspace of workspaces ?? []) {
    const current = workspaceByOrganisation.get(workspace.organization_id) ?? [];
    current.push(workspace);
    workspaceByOrganisation.set(workspace.organization_id, current);
  }

  return (
    <>
      <header>
        <p className="page-eyebrow">Account</p>
        <h1 className="page-title">Organisations and workspaces</h1>
        <p className="page-description">
          Your personal organisation is created automatically. You can create additional
          organisation contexts and working areas. Access is currently owner-only; team memberships
          and invitations are introduced in a later foundation task.
        </p>
      </header>

      {params.error ? (
        <p className="auth-error" role="alert">
          {messages[params.error] ?? 'The requested organisation or workspace operation failed.'}
        </p>
      ) : null}
      {params.message ? (
        <p className="auth-success" role="status">
          {params.message === 'organization-created'
            ? 'Organisation created.'
            : params.message === 'workspace-created'
              ? 'Workspace created.'
              : 'Changes saved.'}
        </p>
      ) : null}

      {error || workspacesError ? (
        <section className="module-panel" aria-labelledby="tenant-unavailable-title">
          <h2 id="tenant-unavailable-title">Tenant services are not available yet</h2>
          <p>
            The organisation database migration has not been deployed to this environment, or the
            service is temporarily unavailable. No organisation or workspace data has been changed.
          </p>
        </section>
      ) : (
        <>
          <section className="profile-panel" aria-labelledby="create-organisation-title">
            <div className="profile-panel-heading">
              <div>
                <h2 id="create-organisation-title">Create an organisation</h2>
                <p>
                  Organisation ownership is assigned by the database from your active principal.
                </p>
              </div>
            </div>
            <form action={createOrganization} className="profile-form">
              <div className="profile-field-grid">
                <div className="profile-field">
                  <label htmlFor="organisation-name">Organisation name</label>
                  <input
                    id="organisation-name"
                    name="name"
                    maxLength={160}
                    required
                    placeholder="Example Legal Group"
                  />
                </div>
                <div className="profile-field">
                  <label htmlFor="organisation-kind">Organisation type</label>
                  <select id="organisation-kind" name="kind" defaultValue="law_firm" required>
                    <option value="law_firm">Law firm</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="institution">Institution</option>
                  </select>
                </div>
              </div>
              <div className="profile-actions">
                <button className="auth-submit" type="submit">
                  Create organisation
                </button>
              </div>
            </form>
          </section>

          <div className="section-heading">
            <div>
              <h2>Your organisations</h2>
              <p>Only organisations owned by your active principal are listed.</p>
            </div>
          </div>

          {organisationList.length === 0 ? (
            <section className="module-panel">
              <h2>No organisation is available</h2>
              <p>
                Your personal organisation should be provisioned automatically when your identity is
                created. If it is missing, contact the platform administrator.
              </p>
            </section>
          ) : (
            <div className="tenant-list">
              {organisationList.map((organisation) => (
                <section className="profile-panel tenant-panel" key={organisation.id}>
                  <div className="profile-panel-heading">
                    <div>
                      <p className="page-eyebrow">{organisation.kind.replaceAll('_', ' ')}</p>
                      <h2>{organisation.name}</h2>
                      <p>
                        {organisation.slug} · {organisation.status}
                      </p>
                    </div>
                    <span className="profile-state">
                      {organisation.kind === 'personal' ? 'Personal account' : 'Owner'}
                    </span>
                  </div>

                  <div className="tenant-workspaces">
                    <h3>Workspaces</h3>
                    {workspaceRows.filter(
                      (workspace) => workspace.organization_id === organisation.id,
                    ).length === 0 ? (
                      <p>No workspace is currently available.</p>
                    ) : (
                      <ul>
                        {workspaceRows
                          .filter((workspace) => workspace.organization_id === organisation.id)
                          .map((workspace) => (
                            <li key={workspace.id}>
                              <span>
                                <strong>{workspace.name}</strong>
                                <small>
                                  {workspace.kind} · {workspace.slug}
                                </small>
                              </span>
                              <span className="workspace-status">{workspace.status}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  <form action={createWorkspace} className="profile-form tenant-create-form">
                    <input type="hidden" name="organization_id" value={organisation.id} />
                    <div className="profile-field-grid">
                      <div className="profile-field">
                        <label htmlFor={`workspace-name-${organisation.id}`}>
                          New workspace name
                        </label>
                        <input
                          id={`workspace-name-${organisation.id}`}
                          name="name"
                          maxLength={160}
                          required
                          placeholder="Research or matter workspace"
                        />
                      </div>
                      <div className="profile-field">
                        <label htmlFor={`workspace-kind-${organisation.id}`}>Workspace type</label>
                        <select
                          id={`workspace-kind-${organisation.id}`}
                          name="kind"
                          defaultValue="team"
                          required
                        >
                          <option value="team">Team</option>
                          <option value="matter">Matter</option>
                          <option value="research">Research</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                    </div>
                    <div className="profile-actions">
                      <button className="auth-submit" type="submit">
                        Create workspace
                      </button>
                    </div>
                  </form>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
