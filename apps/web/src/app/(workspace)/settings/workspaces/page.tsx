import { InvitationForm } from './InvitationForm';
import { RoleManagementPanel } from './RoleManagementPanel';
import {
  createOrganization,
  createWorkspace,
  revokeInvitation,
  setOrganizationMembershipStatus,
  setWorkspaceMembershipStatus,
} from './actions';
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
  'invalid-invitation': 'The invitation request is invalid.',
  'invitation-update-failed': 'The invitation could not be updated.',
  'invalid-membership': 'The membership request is invalid.',
  'membership-update-failed': 'The membership could not be updated.',
  'not-authorized': 'You do not have permission to perform that action.',
  'invalid-role': 'The role assignment request is invalid.',
  'role-assignment-failed': 'The role could not be assigned. Check the member and scope.',
  'role-revocation-failed': 'The role could not be revoked.',
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
  const organisationIds = organisationList.map((organisation) => organisation.id);

  const { data: workspaces, error: workspacesError } = organisationIds.length
    ? await supabase
        .from('workspaces')
        .select('id, organization_id, name, slug, kind, status, created_at')
        .in('organization_id', organisationIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null };
  const workspaceRows: Array<{
    id: string;
    organization_id: string;
    name: string;
    slug: string;
    kind: string;
    status: string;
    created_at: string;
  }> = workspaces ?? [];
  const workspaceIds = workspaceRows.map((workspace) => workspace.id);

  const [membershipsResult, invitationsResult, workspaceMembershipsResult, ownerChecks] =
    await Promise.all([
      organisationIds.length
        ? supabase
            .from('organization_memberships')
            .select('id, organization_id, principal_id, status, joined_at')
            .in('organization_id', organisationIds)
            .order('joined_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      organisationIds.length
        ? supabase
            .from('organization_invitations')
            .select(
              'id, organization_id, workspace_id, email_normalized, status, expires_at, created_at',
            )
            .in('organization_id', organisationIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      workspaceIds.length
        ? supabase
            .from('workspace_memberships')
            .select('id, workspace_id, principal_id, status, joined_at')
            .in('workspace_id', workspaceIds)
            .order('joined_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      Promise.all(
        organisationList.map(async (organisation) => {
          const [owner, manageMembers, manageRoles, createWorkspaces] = await Promise.all([
            supabase.rpc('is_organization_owner', {
              p_organization_id: organisation.id,
            }),
            supabase.rpc('has_permission', {
              p_permission_key: 'organization.manage_members',
              p_organization_id: organisation.id,
            }),
            supabase.rpc('has_permission', {
              p_permission_key: 'organization.manage_roles',
              p_organization_id: organisation.id,
            }),
            supabase.rpc('has_permission', {
              p_permission_key: 'workspace.create',
              p_organization_id: organisation.id,
            }),
          ]);
          return {
            organizationId: organisation.id,
            isOwner: owner.data === true,
            canManageMembers: manageMembers.data === true,
            canManageRoles: manageRoles.data === true,
            canCreateWorkspaces: createWorkspaces.data === true,
            error:
              owner.error ?? manageMembers.error ?? manageRoles.error ?? createWorkspaces.error,
          };
        }),
      ),
    ]);

  const membershipRows = membershipsResult.data ?? [];
  const invitationRows = invitationsResult.data ?? [];
  const workspaceMembershipRows = workspaceMembershipsResult.data ?? [];
  const ownerError = ownerChecks.find((check) => check.error)?.error;
  const serviceError =
    error ||
    workspacesError ||
    membershipsResult.error ||
    invitationsResult.error ||
    workspaceMembershipsResult.error ||
    ownerError;
  const accessByOrganisation = new Map(ownerChecks.map((check) => [check.organizationId, check]));
  const roleManagementByOrganisation = await Promise.all(
    organisationList.map(async (organisation) => {
      const access = accessByOrganisation.get(organisation.id);
      if (!access?.canManageRoles) {
        return { organizationId: organisation.id, roles: [], bindings: [] };
      }
      const [rolesResult, bindingsResult] = await Promise.all([
        supabase.rpc('list_assignable_roles', {
          p_organization_id: organisation.id,
        }),
        supabase.rpc('list_role_bindings', {
          p_organization_id: organisation.id,
        }),
      ]);
      return {
        organizationId: organisation.id,
        roles: rolesResult.data ?? [],
        bindings: bindingsResult.data ?? [],
      };
    }),
  );
  const roleManagementByWorkspace = await Promise.all(
    workspaceRows.map(async (workspace) => {
      const [manageMembers, manageRoles] = await Promise.all([
        supabase.rpc('has_permission', {
          p_permission_key: 'workspace.manage_members',
          p_organization_id: workspace.organization_id,
          p_workspace_id: workspace.id,
        }),
        supabase.rpc('has_permission', {
          p_permission_key: 'workspace.manage_roles',
          p_organization_id: workspace.organization_id,
          p_workspace_id: workspace.id,
        }),
      ]);
      if (manageRoles.data !== true) {
        return {
          workspaceId: workspace.id,
          canManageMembers: manageMembers.data === true,
          canManageRoles: false,
          roles: [],
          bindings: [],
        };
      }
      const [rolesResult, bindingsResult] = await Promise.all([
        supabase.rpc('list_assignable_roles', {
          p_organization_id: workspace.organization_id,
          p_workspace_id: workspace.id,
        }),
        supabase.rpc('list_role_bindings', {
          p_organization_id: workspace.organization_id,
          p_workspace_id: workspace.id,
        }),
      ]);
      return {
        workspaceId: workspace.id,
        canManageMembers: manageMembers.data === true,
        canManageRoles: true,
        roles: rolesResult.data ?? [],
        bindings: bindingsResult.data ?? [],
      };
    }),
  );
  const roleManagementByOrganisationId = new Map(
    roleManagementByOrganisation.map((item) => [item.organizationId, item]),
  );
  const roleManagementByWorkspaceId = new Map(
    roleManagementByWorkspace.map((item) => [item.workspaceId, item]),
  );

  return (
    <>
      <header>
        <p className="page-eyebrow">Account</p>
        <h1 className="page-title">Organisations and workspaces</h1>
        <p className="page-description">
          Your personal organisation is created automatically. Manage organisation contexts,
          workspaces, verified-email invitations, scoped roles and membership lifecycle. Every role
          applies only within its assigned organisation or workspace.
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
              : params.message === 'invitation-accepted'
                ? 'Invitation accepted. Your new organisation access is ready.'
                : params.message === 'invitation-revoked'
                  ? 'Invitation revoked.'
                  : params.message === 'membership-updated'
                    ? 'Membership updated.'
                    : params.message === 'role-assigned'
                      ? 'Role assigned.'
                      : params.message === 'role-revoked'
                        ? 'Role revoked.'
                        : 'Changes saved.'}
        </p>
      ) : null}

      {serviceError ? (
        <section className="module-panel" aria-labelledby="tenant-unavailable-title">
          <h2 id="tenant-unavailable-title">Tenant services are not available yet</h2>
          <p>
            The organisation, membership or invitation database migrations have not been deployed to
            this environment, or the service is temporarily unavailable. No tenant or membership
            data has been changed.
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
              <p>Only organisations visible to your active principal are listed.</p>
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
              {organisationList.map((organisation) => {
                const organisationAccess = accessByOrganisation.get(organisation.id);
                const isOwner = organisationAccess?.isOwner === true;
                const canManageMembers = organisationAccess?.canManageMembers === true;
                const canManageRoles = organisationAccess?.canManageRoles === true;
                const canCreateWorkspaces = organisationAccess?.canCreateWorkspaces === true;
                const organisationRoleManagement = roleManagementByOrganisationId.get(
                  organisation.id,
                );
                const organisationWorkspaces = workspaceRows.filter(
                  (workspace) => workspace.organization_id === organisation.id,
                );
                const organisationMemberships = membershipRows.filter(
                  (membership) => membership.organization_id === organisation.id,
                );
                const organisationInvitations = invitationRows.filter(
                  (invitation) => invitation.organization_id === organisation.id,
                );

                return (
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
                        {organisation.kind === 'personal'
                          ? 'Personal account'
                          : isOwner
                            ? 'Owner'
                            : canManageRoles
                              ? 'Administrator'
                              : 'Member'}
                      </span>
                    </div>

                    <div className="tenant-workspaces">
                      <h3>Workspaces</h3>
                      {organisationWorkspaces.length === 0 ? (
                        <p>No workspace is currently available to this membership.</p>
                      ) : (
                        <ul>
                          {organisationWorkspaces.map((workspace) => {
                            const workspaceMembers = workspaceMembershipRows.filter(
                              (membership) => membership.workspace_id === workspace.id,
                            );
                            const workspaceAccess = roleManagementByWorkspaceId.get(workspace.id);

                            return (
                              <li className="workspace-entry" key={workspace.id}>
                                <div className="workspace-entry-main">
                                  <span>
                                    <strong>{workspace.name}</strong>
                                    <small>
                                      {workspace.kind} · {workspace.slug}
                                    </small>
                                  </span>
                                  <span className="workspace-status">{workspace.status}</span>
                                </div>
                                {workspaceMembers.length > 0 ? (
                                  <div className="workspace-members">
                                    <span className="membership-subheading">Workspace members</span>
                                    {workspaceMembers.map((membership) => (
                                      <div className="membership-row" key={membership.id}>
                                        <span>
                                          <strong>
                                            Principal {membership.principal_id.slice(0, 8)}
                                          </strong>
                                          <small>{membership.status}</small>
                                        </span>
                                        {workspaceAccess?.canManageMembers ? (
                                          <div className="membership-actions">
                                            <form action={setWorkspaceMembershipStatus}>
                                              <input
                                                type="hidden"
                                                name="membership_id"
                                                value={membership.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="status"
                                                value="suspended"
                                              />
                                              <button className="sign-out-button" type="submit">
                                                Suspend
                                              </button>
                                            </form>
                                            <form action={setWorkspaceMembershipStatus}>
                                              <input
                                                type="hidden"
                                                name="membership_id"
                                                value={membership.id}
                                              />
                                              <input type="hidden" name="status" value="revoked" />
                                              <button className="sign-out-button" type="submit">
                                                Revoke
                                              </button>
                                            </form>
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {workspaceAccess?.canManageRoles ? (
                                  <RoleManagementPanel
                                    scope="workspace"
                                    organizationId={organisation.id}
                                    workspaceId={workspace.id}
                                    members={workspaceMembers}
                                    roles={workspaceAccess.roles}
                                    bindings={workspaceAccess.bindings}
                                  />
                                ) : null}
                              </li>
                            );
                          })}
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
                          <label htmlFor={`workspace-kind-${organisation.id}`}>
                            Workspace type
                          </label>
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
                      {canCreateWorkspaces ? (
                        <div className="profile-actions">
                          <button className="auth-submit" type="submit">
                            Create workspace
                          </button>
                        </div>
                      ) : null}
                    </form>

                    <div className="membership-section">
                      <div className="membership-section-heading">
                        <h3>Organisation members</h3>
                        <p>
                          {canManageMembers
                            ? 'You can suspend or revoke a member. Re-invitation restores a suspended or revoked membership.'
                            : 'Your access is limited to the memberships assigned to your account.'}
                        </p>
                      </div>
                      {organisationMemberships.length === 0 ? (
                        <p>No additional members have joined this organisation.</p>
                      ) : (
                        <div className="membership-list">
                          {organisationMemberships.map((membership) => (
                            <div className="membership-row" key={membership.id}>
                              <span>
                                <strong>Principal {membership.principal_id.slice(0, 8)}</strong>
                                <small>
                                  {membership.status} · joined{' '}
                                  {new Date(membership.joined_at).toLocaleDateString()}
                                </small>
                              </span>
                              {canManageMembers ? (
                                <div className="membership-actions">
                                  <form action={setOrganizationMembershipStatus}>
                                    <input
                                      type="hidden"
                                      name="membership_id"
                                      value={membership.id}
                                    />
                                    <input type="hidden" name="status" value="suspended" />
                                    <button className="sign-out-button" type="submit">
                                      Suspend
                                    </button>
                                  </form>
                                  <form action={setOrganizationMembershipStatus}>
                                    <input
                                      type="hidden"
                                      name="membership_id"
                                      value={membership.id}
                                    />
                                    <input type="hidden" name="status" value="revoked" />
                                    <button className="sign-out-button" type="submit">
                                      Revoke
                                    </button>
                                  </form>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {canManageRoles && organisationRoleManagement ? (
                      <RoleManagementPanel
                        scope="organization"
                        organizationId={organisation.id}
                        members={organisationMemberships}
                        roles={organisationRoleManagement.roles}
                        bindings={organisationRoleManagement.bindings}
                      />
                    ) : null}

                    <div className="membership-section">
                      <div className="membership-section-heading">
                        <h3>Invitations</h3>
                        <p>One-time links are bound to a confirmed email address and expire.</p>
                      </div>
                      {canManageMembers ? (
                        <>
                          {organisationInvitations.length === 0 ? (
                            <p>No invitations have been issued for this organisation.</p>
                          ) : (
                            <div className="membership-list">
                              {organisationInvitations.map((invitation) => {
                                const isExpired =
                                  invitation.status === 'pending' &&
                                  new Date(invitation.expires_at).getTime() <= Date.now();
                                const displayStatus = isExpired ? 'expired' : invitation.status;

                                return (
                                  <div className="membership-row" key={invitation.id}>
                                    <span>
                                      <strong>{invitation.email_normalized}</strong>
                                      <small>
                                        {invitation.workspace_id
                                          ? 'Workspace invitation'
                                          : 'Organisation invitation'}{' '}
                                        · {displayStatus} · expires{' '}
                                        {new Date(invitation.expires_at).toLocaleDateString()}
                                      </small>
                                    </span>
                                    {invitation.status === 'pending' && !isExpired ? (
                                      <form action={revokeInvitation}>
                                        <input
                                          type="hidden"
                                          name="invitation_id"
                                          value={invitation.id}
                                        />
                                        <button className="sign-out-button" type="submit">
                                          Revoke link
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <InvitationForm
                            organizationId={organisation.id}
                            workspaces={organisationWorkspaces.map((workspace) => ({
                              id: workspace.id,
                              name: workspace.name,
                            }))}
                          />
                        </>
                      ) : (
                        <p>
                          Invitation creation and revocation require organisation
                          membership-administration permission.
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
