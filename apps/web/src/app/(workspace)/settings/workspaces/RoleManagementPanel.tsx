import { assignRole, revokeRole } from './actions';

type MemberOption = {
  principal_id: string;
  status: string;
};

type AssignableRole = {
  role_key: string;
  display_name: string;
  description: string;
};

type RoleBinding = {
  binding_id: string;
  principal_id: string;
  role_key: string;
  role_name: string;
  assigned_at: string;
};

export function RoleManagementPanel({
  scope,
  organizationId,
  workspaceId,
  members,
  roles,
  bindings,
}: {
  scope: 'organization' | 'workspace';
  organizationId: string;
  workspaceId?: string;
  members: MemberOption[];
  roles: AssignableRole[];
  bindings: RoleBinding[];
}) {
  const title = scope === 'organization' ? 'Organisation roles' : 'Workspace roles';
  const assignableRoleKeys = new Set(roles.map((role) => role.role_key));

  return (
    <section className="membership-section role-management-panel">
      <div className="membership-section-heading">
        <h3>{title}</h3>
        <p>
          Assign only the scoped roles available to your current permissions. Role changes take
          effect immediately and do not create additional workspace membership.
        </p>
      </div>

      {bindings.length === 0 ? (
        <p>No explicit role assignments have been made in this scope.</p>
      ) : (
        <div className="membership-list">
          {bindings.map((binding) => (
            <div className="membership-row" key={binding.binding_id}>
              <span>
                <strong>{binding.role_name}</strong>
                <small>
                  Principal {binding.principal_id.slice(0, 8)} · assigned{' '}
                  {new Date(binding.assigned_at).toLocaleDateString()}
                </small>
              </span>
              {assignableRoleKeys.has(binding.role_key) ? (
                <form action={revokeRole}>
                  <input type="hidden" name="scope" value={scope} />
                  <input type="hidden" name="organization_id" value={organizationId} />
                  {workspaceId ? (
                    <input type="hidden" name="workspace_id" value={workspaceId} />
                  ) : null}
                  <input type="hidden" name="binding_id" value={binding.binding_id} />
                  <button className="sign-out-button" type="submit">
                    Revoke role
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {roles.length > 0 && members.some((member) => member.status === 'active') ? (
        <form action={assignRole} className="profile-form role-assignment-form">
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="organization_id" value={organizationId} />
          {workspaceId ? <input type="hidden" name="workspace_id" value={workspaceId} /> : null}
          <div className="profile-field-grid">
            <div className="profile-field">
              <label htmlFor={`role-principal-${scope}-${workspaceId ?? organizationId}`}>
                Active member
              </label>
              <select
                id={`role-principal-${scope}-${workspaceId ?? organizationId}`}
                name="principal_id"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select a member
                </option>
                {members
                  .filter((member) => member.status === 'active')
                  .map((member) => (
                    <option key={member.principal_id} value={member.principal_id}>
                      Principal {member.principal_id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="profile-field">
              <label htmlFor={`role-key-${scope}-${workspaceId ?? organizationId}`}>Role</label>
              <select
                id={`role-key-${scope}-${workspaceId ?? organizationId}`}
                name="role_key"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select a role
                </option>
                {roles.map((role) => (
                  <option key={role.role_key} value={role.role_key}>
                    {role.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="profile-actions">
            <button className="auth-submit" type="submit">
              Assign role
            </button>
          </div>
          <ul className="role-description-list">
            {roles.map((role) => (
              <li key={role.role_key}>
                <strong>{role.display_name}:</strong> {role.description}
              </li>
            ))}
          </ul>
        </form>
      ) : (
        <p>You do not currently have an assignable role in this scope.</p>
      )}
    </section>
  );
}
