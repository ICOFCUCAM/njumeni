import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setLegalHold } from '../actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EvidenceItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { itemId } = await params;
  const query = await searchParams;
  if (!UUID.test(itemId)) notFound();
  const supabase = await createClient();

  const [custody, log, entities] = await Promise.all([
    supabase.rpc('evidence_verify_custody', { p_evidence_item_id: itemId }),
    supabase.rpc('evidence_custody_log', { p_evidence_item_id: itemId }),
    supabase.rpc('evidence_list_entities', { p_evidence_item_id: itemId }),
  ]);
  // Unknown and unauthorised items look the same.
  if (custody.error) notFound();
  // Reading passages is itself recorded in the chain of custody.
  const passages = await supabase.rpc('evidence_read_passages', { p_evidence_item_id: itemId });
  const verification = custody.data as { valid: boolean; events: number; headHash?: string };

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href="/evidence">Evidence</Link>
        </p>
        <h1 className="page-title">Evidence item</h1>
        <p className="page-description">
          Chain of custody:{' '}
          <strong>
            {verification.valid ? 'intact' : 'BROKEN — investigate before relying on this item'}
          </strong>{' '}
          ({verification.events} recorded events)
        </p>
      </header>
      {query.error ? <p role="alert">The action could not be completed.</p> : null}
      {query.message ? <p role="status">Updated.</p> : null}

      <section className="module-panel" aria-labelledby="passages-heading">
        <h2 id="passages-heading" className="section-heading">
          Extracted text
        </h2>
        {passages.error ? (
          <p>The text is not available yet: the file is awaiting its scan, or it was rejected.</p>
        ) : (passages.data ?? []).length === 0 ? (
          <p>
            No text was extracted. Images and scanned PDFs need OCR, which is not configured yet.
          </p>
        ) : (
          (passages.data ?? []).map((passage) => (
            <p key={passage.passage_id}>
              <small>
                p. {passage.page_number ?? '—'} · ¶ {passage.ordinal + 1}
                {passage.redaction_count > 0 ? ' · redacted' : ''}
              </small>
              <br />
              {passage.content}
            </p>
          ))
        )}
      </section>

      <section className="module-panel" aria-labelledby="entities-heading">
        <h2 id="entities-heading" className="section-heading">
          Detected dates, amounts and references
        </h2>
        {(entities.data ?? []).length === 0 ? (
          <p>None detected.</p>
        ) : (
          <ul className="membership-list">
            {(entities.data ?? []).map((entity, index) => (
              <li key={`${entity.passage_id}-${index}`} className="membership-row">
                <span className="workspace-status">{entity.entity_type}</span> {entity.raw_value}
                {entity.normalised_value !== entity.raw_value
                  ? ` (${entity.normalised_value})`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="module-panel" aria-labelledby="custody-heading">
        <h2 id="custody-heading" className="section-heading">
          Chain of custody
        </h2>
        <ol className="membership-list">
          {(log.data ?? []).map((event) => (
            <li key={event.item_sequence} className="membership-row">
              {event.item_sequence}. {event.event_type.replace(/_/g, ' ')} · {event.actor_kind} ·{' '}
              <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toISOString()}</time>{' '}
              <code title="Record hash">{event.record_hash.slice(0, 12)}…</code>
            </li>
          ))}
        </ol>
        <form action={setLegalHold} className="profile-actions">
          <input type="hidden" name="evidenceItemId" value={itemId} />
          <label className="profile-field">
            Legal hold reason
            <input name="reason" minLength={3} maxLength={500} required />
          </label>
          <button type="submit" name="hold" value="true" className="sign-out-button">
            Place legal hold
          </button>
          <button type="submit" name="hold" value="false" className="sign-out-button">
            Release legal hold
          </button>
        </form>
      </section>
    </article>
  );
}
