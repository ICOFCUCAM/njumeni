import Link from 'next/link';
export default function SignInPage() {
  return (
    <main className="signin-panel">
      <p className="page-eyebrow">Identity boundary Â· Phase 1</p>
      <h1>Secure access to Njumeni.</h1>
      <p>
        Authentication and organisation membership are not enabled in the foundation shell. This
        route is reserved for the Phase 1 identity, tenancy and security implementation.
      </p>
      <div className="preview-notice">
        <span className="notice-mark" aria-hidden="true">
          i
        </span>
        <div>
          <strong>No sign-in is being simulated.</strong> Do not enter credentials here. The preview
          has no authentication provider connected.
        </div>
      </div>
      <Link className="nav-link nav-link-active" href="/dashboard">
        Return to the preview workspace
      </Link>
    </main>
  );
}
