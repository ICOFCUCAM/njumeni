import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { compareVersions } from '@/modules/documents/compare';
import type { StoredDocument } from '@/modules/documents/service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANGE: Record<string, string> = {
  unchanged: 'Unchanged',
  added: 'Added',
  removed: 'Removed',
  modified: 'Changed',
};

export default async function CompareVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { documentId } = await params;
  const { from, to } = await searchParams;
  if (!UUID.test(documentId) || !/^\d{1,6}$/.test(from ?? '') || !/^\d{1,6}$/.test(to ?? ''))
    notFound();
  const supabase = await createClient();
  const [left, right] = await Promise.all([
    supabase.rpc('document_get', { p_document_id: documentId, p_version: Number(from) }),
    supabase.rpc('document_get', { p_document_id: documentId, p_version: Number(to) }),
  ]);
  if (left.error || right.error || !left.data || !right.data) notFound();
  const a = left.data as unknown as StoredDocument;
  const b = right.data as unknown as StoredDocument;
  const comparison = compareVersions(a.version.sections, b.version.sections);
  const citationsA = new Set(a.citations.map((c) => `${c.marker}:${c.citation}`));
  const citationsB = new Set(b.citations.map((c) => `${c.marker}:${c.citation}`));

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href={`/documents/${documentId}`}>{b.title}</Link>
        </p>
        <h1 className="page-title">
          Version {from} → version {to}
        </h1>
        <p className="page-description">
          <del>Removed text</del> and <ins>added text</ins> are shown per section.
        </p>
      </header>
      {comparison.map((section) => (
        <section key={section.key} className="module-panel" aria-label={section.title}>
          <h2 className="section-heading">
            {section.title} <small>· {CHANGE[section.change]}</small>
          </h2>
          {section.change === 'unchanged' ? null : (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {section.ops.map((op, i) =>
                op.op === 'equal' ? (
                  <span key={i}>{op.text}</span>
                ) : op.op === 'delete' ? (
                  <del key={i}>{op.text}</del>
                ) : (
                  <ins key={i}>{op.text}</ins>
                ),
              )}
            </div>
          )}
        </section>
      ))}
      <section className="module-panel" aria-label="Sources">
        <h2 className="section-heading">Sources</h2>
        <ul className="membership-list">
          {[...citationsB]
            .filter((c) => !citationsA.has(c))
            .map((c) => (
              <li key={`+${c}`} className="membership-row">
                <ins>Added [{c.replace(':', '] ')}</ins>
              </li>
            ))}
          {[...citationsA]
            .filter((c) => !citationsB.has(c))
            .map((c) => (
              <li key={`-${c}`} className="membership-row">
                <del>Removed [{c.replace(':', '] ')}</del>
              </li>
            ))}
          {[...citationsA].every((c) => citationsB.has(c)) &&
          [...citationsB].every((c) => citationsA.has(c)) ? (
            <li className="membership-row">No change to sources.</li>
          ) : null}
        </ul>
      </section>
    </article>
  );
}
