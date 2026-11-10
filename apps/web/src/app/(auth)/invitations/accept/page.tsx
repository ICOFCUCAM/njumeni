import { AcceptInvitationForm } from './AcceptInvitationForm';

export const dynamic = 'force-dynamic';

export default function AcceptInvitationPage() {
  return (
    <main className="signin-panel">
      <p className="page-eyebrow">Organisation access</p>
      <h1>Accept your Njumeni invitation.</h1>
      <p>
        Invitations are bound to the recipient’s confirmed email address, expire automatically and
        can be used only once. Sign in with the invited account before accepting.
      </p>
      <AcceptInvitationForm />
      <p className="auth-footnote">
        If you are not signed in, sign in first and reopen the original invitation link. For your
        protection, Njumeni does not preserve invitation tokens across authentication redirects.
      </p>
    </main>
  );
}
