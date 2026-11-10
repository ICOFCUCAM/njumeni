'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createInvitation } from './actions';

type WorkspaceOption = {
  id: string;
  name: string;
};

export function InvitationForm({
  organizationId,
  workspaces,
}: {
  organizationId: string;
  workspaces: WorkspaceOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setInvitationUrl(null);
    setCopyMessage(null);

    startTransition(async () => {
      const result = await createInvitation(new FormData(form));
      if (!result.token) {
        setError(
          result.error === 'invalid'
            ? 'Check the email, workspace and expiry period.'
            : 'The invitation could not be created. Please try again.',
        );
        return;
      }

      const url = new URL('/invitations/accept', window.location.origin);
      url.hash = new URLSearchParams({ token: result.token }).toString();
      setInvitationUrl(url.toString());
      form.reset();
    });
  }

  async function copyInvitation() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyMessage('Invitation link copied.');
    } catch {
      setCopyMessage('Copy is unavailable. Select and copy the link above.');
    }
  }

  return (
    <section className="membership-invite-panel" aria-label="Invite a member">
      <div>
        <h3>Invite a member</h3>
        <p>
          The invitation is bound to the recipient’s confirmed email address. Share the generated
          one-time link privately.
        </p>
      </div>
      <form className="profile-form membership-invite-form" onSubmit={handleSubmit}>
        <input type="hidden" name="organization_id" value={organizationId} />
        <div className="profile-field-grid">
          <div className="profile-field">
            <label htmlFor={`invite-email-${organizationId}`}>Recipient email</label>
            <input
              id={`invite-email-${organizationId}`}
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              placeholder="colleague@example.com"
            />
          </div>
          <div className="profile-field">
            <label htmlFor={`invite-workspace-${organizationId}`}>Workspace scope</label>
            <select id={`invite-workspace-${organizationId}`} name="workspace_id" defaultValue="">
              <option value="">Organisation membership</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="profile-field">
          <label htmlFor={`invite-expiry-${organizationId}`}>Invitation expires after</label>
          <select id={`invite-expiry-${organizationId}`} name="expires_in_days" defaultValue="7">
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="profile-actions">
          <button className="auth-submit" type="submit" disabled={isPending}>
            {isPending ? 'Creating invitation…' : 'Create invitation link'}
          </button>
        </div>
      </form>
      {invitationUrl ? (
        <div className="invitation-link-result">
          <p className="invitation-result-label">One-time invitation link</p>
          <input aria-label="Invitation link" readOnly value={invitationUrl} />
          <div className="invitation-copy-row">
            <button className="sign-out-button" onClick={copyInvitation} type="button">
              Copy link
            </button>
            {copyMessage ? (
              <span role="status" className="workspace-status">
                {copyMessage}
              </span>
            ) : null}
          </div>
          <p className="invitation-link-warning">
            This link contains a secret invitation token and is shown only once. Do not post it
            publicly or include it in support tickets.
          </p>
        </div>
      ) : null}
    </section>
  );
}
