'use client';

import { useActionState } from 'react';
import { createApiKey, type CreatedKey } from './actions';

export function ApiKeyForm({
  organizationId,
  workspaces,
}: {
  organizationId: string;
  workspaces: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<CreatedKey, FormData>(createApiKey, {});
  return (
    <form action={action} className="profile-field-grid">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label className="profile-field">
        Name
        <input
          name="name"
          required
          minLength={3}
          maxLength={100}
          placeholder="Reporting integration"
        />
      </label>
      <label className="profile-field">
        Workspace
        <select name="workspaceId">
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="profile-field">
        <legend>Scopes</legend>
        <label>
          <input type="checkbox" name="scopes" value="research.read" defaultChecked /> research.read
        </label>{' '}
        <label>
          <input type="checkbox" name="scopes" value="matters.read" /> matters.read
        </label>
      </fieldset>
      <label className="profile-field">
        Valid for (days)
        <input name="days" type="number" min={1} max={365} defaultValue={90} />
      </label>
      <div className="profile-actions">
        <button type="submit" disabled={pending}>
          Issue key
        </button>
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.key ? (
        <p role="status">
          Copy this key now; it will not be shown again: <code>{state.key}</code>
        </p>
      ) : null}
    </form>
  );
}
