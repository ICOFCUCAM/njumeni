import { signIn } from '@/app/(auth)/actions';
import { isSupabaseConfigured } from '@/lib/supabase/server';

type SignInPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const errorMessage =
    params.error === 'credentials'
      ? 'The email address or password is incorrect.'
      : params.error === 'invalid'
        ? 'Enter a valid email address and password.'
        : params.error === 'unavailable'
          ? 'Sign-in is temporarily unavailable. Please try again later.'
          : null;

  return (
    <main className="signin-panel">
      <p className="page-eyebrow">Secure account access</p>
      <h1>Sign in to Njumeni.</h1>
      <p>
        Use the email address and password issued for your Njumeni account. Account registration
        and organisation invitations will be introduced through the controlled onboarding flow.
      </p>
      {params.message === 'signed-out' ? (
        <p className="auth-success" role="status">You have been signed out.</p>
      ) : null}
      {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}
      {!configured ? (
        <div className="preview-notice" role="status">
          <span className="notice-mark" aria-hidden="true">i</span>
          <div>
            <strong>Authentication is not configured in this deployment.</strong> The workspace
            remains protected. Configure the Supabase project URL and publishable key in the
            deployment environment before enabling sign-in.
          </div>
        </div>
      ) : (
        <form action={signIn} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input autoComplete="username" id="email" maxLength={254} name="email" required type="email" />
          <label htmlFor="password">Password</label>
          <input autoComplete="current-password" id="password" maxLength={1024} name="password" required type="password" />
          <button className="auth-submit" type="submit">Sign in securely</button>
        </form>
      )}
      <p className="auth-footnote">
        New accounts are not self-registered yet. Access is provisioned through Njumeni's approved
        account and membership process.
      </p>
    </main>
  );
}
