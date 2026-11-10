import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="signin-panel">
      <p className="page-eyebrow">404 Â· Route not found</p>
      <h1>This page is not part of the workspace.</h1>
      <p>The requested route is not registered in the Njumeni application shell.</p>
      <Link className="nav-link nav-link-active" href="/dashboard">
        Return to workspace
      </Link>
    </main>
  );
}
