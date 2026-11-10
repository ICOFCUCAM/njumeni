'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitation } from '@/app/(workspace)/settings/workspaces/actions';

export function AcceptInvitationForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const invitationToken = fragment.get('token') ?? '';
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (invitationToken) {
      setToken(invitationToken);
    } else {
      setError(
        'This invitation link is missing its token. Ask the organisation owner for a new link.',
      );
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);

    startTransition(async () => {
      const result = await acceptInvitation(new FormData(form));
      if (result.success) {
        router.replace('/settings/workspaces?message=invitation-accepted');
        router.refresh();
        return;
      }

      if (result.error === 'sign-in-required') {
        setError(
          'Sign in with the invited email address, then reopen the original invitation link.',
        );
      } else if (result.error === 'unavailable') {
        setError('Invitation services are temporarily unavailable. Please try again.');
      } else {
        setError(
          'This invitation is invalid, expired, revoked, already used or assigned to another email address.',
        );
      }
    });
  }

  return (
    <form className="auth-form invitation-accept-form" onSubmit={handleSubmit}>
      <input type="hidden" name="token" value={token} />
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {error?.startsWith('Sign in with') ? (
        <a className="invitation-signin-link" href="/sign-in">
          Go to secure sign-in
        </a>
      ) : null}
      <button className="auth-submit" type="submit" disabled={!token || isPending}>
        {isPending ? 'Verifying invitation…' : 'Accept invitation'}
      </button>
    </form>
  );
}
