'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Njumeni application boundary error', { digest: error.digest, name: error.name });
  }, [error]);
  return <main className="signin-panel">
    <p className="page-eyebrow">Application boundary</p>
    <h1>Something interrupted this workspace.</h1>
    <p>The error has been contained. You can retry without exposing confidential page content.</p>
    <button className="nav-link nav-link-active" onClick={() => reset()} type="button">Try again</button>
  </main>;
}
