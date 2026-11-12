import Link from 'next/link';
import { notFound } from 'next/navigation';
import { retireKnowledge } from '../../professional/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface Item {
  id: string;
  organizationId: string;
  kind: string;
  title: string;
  body: string;
  tags: string[];
  status: string;
  reviewDue: string | null;
  publishedAt: string;
  sourceType: string | null;
  sourceId: string | null;
  canRetire: boolean;
}

export default async function KnowledgeItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('knowledge_get', { p_item_id: itemId });
  if (error || !data) notFound();
  const item = data as unknown as Item;
  const sourceHref = item.sourceId
    ? item.sourceType === 'research_run'
      ? `/research/${item.sourceId}`
      : item.sourceType === 'legal_document'
        ? `/documents/${item.sourceId}`
        : `/arguments/${item.sourceId}`
    : null;
  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href={`/knowledge?org=${item.organizationId}`}>Knowledge</Link> ·{' '}
          {item.kind.replace(/_/g, ' ')}
        </p>
        <h1 className="page-title">{item.title}</h1>
        <p className="page-description">
          {item.status === 'retired' ? <strong>Retired · </strong> : null}
          Published {item.publishedAt.slice(0, 10)}
          {item.reviewDue ? ` · review by ${item.reviewDue}` : ''}
          {item.tags.length ? ` · ${item.tags.join(', ')}` : ''}
          {sourceHref ? (
            <>
              {' '}
              · <Link href={sourceHref}>source</Link>
            </>
          ) : item.sourceType ? (
            ' · source in a workspace you cannot access'
          ) : null}
        </p>
      </header>
      <section className="module-panel" style={{ whiteSpace: 'pre-wrap' }}>
        {item.body}
      </section>
      {item.canRetire && item.status === 'published' ? (
        <form action={retireKnowledge} className="module-panel profile-actions">
          <input type="hidden" name="itemId" value={item.id} />
          <button type="submit">Retire this item</button>
        </form>
      ) : null}
    </article>
  );
}
