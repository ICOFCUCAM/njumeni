import Link from 'next/link';
import { uploadEvidence } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ org?: string; ws?: string; error?: string; message?: string }>;

const messages: Record<string, string> = {
  'invalid-scope': 'Choose a workspace first.',
  'invalid-input': 'Check the title and classification fields.',
  'file-required': 'Choose a file to upload.',
  'file-too-large': 'Files must be 100 MB or smaller.',
  'file-type':
    'Accepted types: PDF, DOCX, XLSX, plain text, CSV, email (.eml), PNG, JPEG and TIFF.',
  'not-authorized': 'You do not have permission to add evidence in this workspace.',
  'upload-failed': 'The file could not be stored. Try again.',
  'register-failed': 'The file was stored but could not be registered.',
  uploaded: 'Uploaded. The file is quarantined until it has been scanned, then it is extracted.',
};

const statusLabels: Record<string, string> = {
  quarantined: 'Quarantined — awaiting scan',
  active: 'Available',
  rejected: 'Rejected by scan',
};

export default async function EvidencePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, organization_id, name')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  const workspaceList = workspaces ?? [];
  const selected =
    workspaceList.find((w) => w.id === params.ws && w.organization_id === params.org) ??
    workspaceList[0];

  const [items, chronology, conflicts] = selected
    ? await Promise.all([
        supabase.rpc('evidence_list_items', {
          p_organization_id: selected.organization_id,
          p_workspace_id: selected.id,
        }),
        supabase.rpc('evidence_chronology', {
          p_organization_id: selected.organization_id,
          p_workspace_id: selected.id,
        }),
        supabase.rpc('evidence_proposition_conflicts', {
          p_organization_id: selected.organization_id,
          p_workspace_id: selected.id,
        }),
      ])
    : [null, null, null];
  const notice = params.error ?? params.message;

  return (
    <article>
      <header>
        <p className="page-eyebrow">Module C · Evidence intelligence</p>
        <h1 className="page-title">Evidence</h1>
        <p className="page-description">
          Originals are fingerprinted (SHA-256), scanned before anyone can read them, and every
          action is written to a tamper-evident chain of custody. Use synthetic material only until
          the platform is approved for confidential data.
        </p>
      </header>

      {notice && messages[notice] ? (
        <p role={params.error ? 'alert' : 'status'} className="module-panel">
          {messages[notice]}
        </p>
      ) : null}

      {workspaceList.length > 1 ? (
        <nav className="module-panel" aria-label="Workspace">
          {workspaceList.map((w) => (
            <Link key={w.id} href={`/evidence?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected?.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? (
        <>
          <section className="module-panel" aria-labelledby="upload-heading">
            <h2 id="upload-heading" className="section-heading">
              Add evidence to {selected.name}
            </h2>
            <form action={uploadEvidence} className="profile-field-grid">
              <input type="hidden" name="organizationId" value={selected.organization_id} />
              <input type="hidden" name="workspaceId" value={selected.id} />
              <label className="profile-field">
                Title
                <input
                  name="title"
                  required
                  maxLength={300}
                  placeholder="Employer letter, 14 March"
                />
              </label>
              <label className="profile-field">
                Type
                <select name="evidenceType" defaultValue="document">
                  <option value="document">Document</option>
                  <option value="email">Email</option>
                  <option value="correspondence">Correspondence</option>
                  <option value="contract">Contract</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="witness_statement">Witness statement</option>
                  <option value="employment">Employment record</option>
                  <option value="medical">Medical record</option>
                  <option value="image">Image</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="profile-field">
                Sensitivity
                <select name="sensitivity" defaultValue="confidential">
                  <option value="standard">Standard</option>
                  <option value="confidential">Confidential</option>
                  <option value="special_category">Special category (health, etc.)</option>
                </select>
              </label>
              <label className="profile-field">
                Legal privilege
                <select name="privilege" defaultValue="none">
                  <option value="none">None</option>
                  <option value="legal_advice">Legal advice</option>
                  <option value="litigation">Litigation</option>
                  <option value="work_product">Work product</option>
                </select>
              </label>
              <label className="profile-field">
                File
                <input name="file" type="file" required />
              </label>
              <div className="profile-actions">
                <button type="submit" className="auth-submit">
                  Upload
                </button>
              </div>
            </form>
          </section>

          <section className="module-panel" aria-labelledby="items-heading">
            <h2 id="items-heading" className="section-heading">
              Evidence items
            </h2>
            {items?.error ? (
              <p role="alert">You do not have permission to view evidence in this workspace.</p>
            ) : (items?.data ?? []).length === 0 ? (
              <p>No evidence yet.</p>
            ) : (
              <ul className="membership-list">
                {(items?.data ?? []).map((item) => (
                  <li key={item.evidence_item_id} className="membership-row">
                    <Link href={`/evidence/${item.evidence_item_id}`}>{item.title}</Link>{' '}
                    <span className="workspace-status">
                      {statusLabels[item.status] ?? item.status}
                      {item.legal_hold ? ' · Legal hold' : ''}
                      {item.privilege !== 'none' ? ' · Privileged' : ''}
                    </span>{' '}
                    <span>
                      {item.latest_filename} (v{item.latest_version}) · {item.passage_count}{' '}
                      passages · {item.event_count} dated events
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="module-panel" aria-labelledby="chronology-heading">
            <h2 id="chronology-heading" className="section-heading">
              Chronology
            </h2>
            {(chronology?.data ?? []).length === 0 ? (
              <p>Dated events found in evidence will appear here, in date order.</p>
            ) : (
              <ol className="membership-list">
                {(chronology?.data ?? []).map((event) => (
                  <li key={event.event_id} className="membership-row">
                    <time dateTime={event.event_date}>
                      {event.date_precision === 'month'
                        ? event.event_date.slice(0, 7)
                        : event.event_date}
                    </time>{' '}
                    {event.description}{' '}
                    <Link href={`/evidence/${event.evidence_item_id}`}>
                      ({event.evidence_title})
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {(conflicts?.data ?? []).length > 0 ? (
            <section className="module-panel" aria-labelledby="conflicts-heading">
              <h2 id="conflicts-heading" className="section-heading">
                Contradictions to review
              </h2>
              <ul className="membership-list">
                {(conflicts?.data ?? []).map((conflict) => (
                  <li key={conflict.proposition_id} className="membership-row">
                    {conflict.statement} — supported by {conflict.supporting_items}, contradicted by{' '}
                    {conflict.contradicting_items}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="module-panel">You are not a member of any active workspace.</p>
      )}
    </article>
  );
}
