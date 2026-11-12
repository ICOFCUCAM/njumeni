import Link from 'next/link';
import { notFound } from 'next/navigation';
import { documentWorkflow, draftWithAgent, saveDocument } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { analyseDocument } from '@/modules/documents/analysis';
import { isFinalVersion, type StoredDocument } from '@/modules/documents/service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERRORS: Record<string, string> = {
  conflict:
    'Someone saved a newer version while you were editing. Your changes were not saved; reload and try again.',
  'in-review': 'The document is under review. Withdraw it before editing.',
  'not-authorized': 'You do not have permission for that action.',
  'four-eyes': 'In a team, the author or submitter of a version cannot approve it.',
  'sections-missing': 'Fill every required section before approval.',
  'citation-invalid':
    'A source could not be verified (it may no longer be permitted, or a quotation does not match).',
  'research-required': 'Link the document to research before using the drafting agent.',
  'ai-refused': 'The workspace AI policy refused the drafting request.',
  state: 'That action is not available in the document’s current state.',
  failed: 'The action failed. Try again.',
};
const STATUS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
};
const SEVERITY: Record<string, string> = { error: '✗', warning: '!', info: 'i' };

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ error?: string; version?: string }>;
}) {
  const { documentId } = await params;
  const { error: errorCode, version } = await searchParams;
  if (!UUID.test(documentId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('document_get', {
    p_document_id: documentId,
    ...(version && /^\d{1,6}$/.test(version) ? { p_version: Number(version) } : {}),
  });
  if (error || !data) notFound();
  const doc = data as unknown as StoredDocument;
  const viewingCurrent = doc.version.number === doc.currentVersion;
  const editable = doc.canEdit && viewingCurrent && doc.status !== 'in_review';
  const analysis = analyseDocument(
    doc.template.sections,
    doc.version.sections,
    doc.citations.map((c) => ({ sectionKey: c.sectionKey, marker: c.marker })),
  );
  const run = doc.researchRunId
    ? await supabase.rpc('research_get_run', { p_run_id: doc.researchRunId })
    : null;
  const verifiedClaims = (
    (
      run?.data as {
        claims?: {
          passageId: string | null;
          authorityCitation: string | null;
          statement: string;
          verificationStatus: string;
        }[];
      } | null
    )?.claims ?? []
  ).filter((c) => c.verificationStatus === 'verified' && c.passageId);
  const exportBase = `/api/v1/documents/${doc.id}/export?version=${doc.version.number}`;

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href={`/documents?org=${doc.organizationId}&ws=${doc.workspaceId}`}>Documents</Link>{' '}
          · {doc.template.name}
        </p>
        <h1 className="page-title">{doc.title}</h1>
        <p className="page-description">
          <strong>{STATUS[doc.status]}</strong> · version {doc.version.number} of{' '}
          {doc.currentVersion}
          {doc.version.origin === 'agent' ? ' · drafted by the AI drafting agent' : ''}
          {isFinalVersion(doc) ? ' · this is the approved version' : ''} ·{' '}
          <small>sha256 {doc.version.contentHash.slice(0, 16)}…</small>
        </p>
      </header>

      {errorCode && ERRORS[errorCode] ? (
        <p role="alert" className="module-panel">
          {ERRORS[errorCode]}
        </p>
      ) : null}

      <section className="module-panel" aria-label="Actions">
        <div className="profile-actions">
          <a href={`${exportBase}&format=docx`}>Export DOCX</a> ·{' '}
          <a href={`${exportBase}&format=pdf`}>Export PDF</a>
          {isFinalVersion(doc) ? null : <small> (marked DRAFT)</small>}
        </div>
        {viewingCurrent && doc.canEdit && doc.status === 'draft' && doc.researchRunId ? (
          <form action={draftWithAgent} className="profile-actions">
            <input type="hidden" name="documentId" value={doc.id} />
            <button type="submit">Draft with the drafting agent</button>{' '}
            <small>
              Creates a new version citing only verified research; nothing is approved
              automatically.
            </small>
          </form>
        ) : null}
        {viewingCurrent && doc.canEdit && doc.status === 'draft' ? (
          <form action={documentWorkflow} className="profile-actions">
            <input type="hidden" name="documentId" value={doc.id} />
            <button
              type="submit"
              name="action"
              value="submit"
              className="auth-submit"
              disabled={!analysis.readyForReview}
            >
              Submit for review
            </button>
            {analysis.readyForReview ? null : <small> Resolve the errors below first.</small>}
          </form>
        ) : null}
        {viewingCurrent && doc.status === 'in_review' ? (
          <form action={documentWorkflow} className="profile-field-grid">
            <input type="hidden" name="documentId" value={doc.id} />
            <label className="profile-field">
              Review note (required to request changes)
              <input name="note" maxLength={2000} />
            </label>
            <div className="profile-actions">
              {doc.canApprove ? (
                <button type="submit" name="action" value="approved" className="auth-submit">
                  Approve version {doc.currentVersion}
                </button>
              ) : null}{' '}
              <button type="submit" name="action" value="changes_requested">
                Request changes
              </button>{' '}
              {doc.canEdit ? (
                <button type="submit" name="action" value="withdraw">
                  Withdraw
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section className="module-panel" aria-labelledby="analysis-heading">
        <h2 id="analysis-heading" className="section-heading">
          Document check
        </h2>
        {analysis.findings.length === 0 ? (
          <p>✓ No problems found.</p>
        ) : (
          <ul className="membership-list">
            {analysis.findings.map((f, i) => (
              <li key={`${f.code}-${i}`} className="membership-row">
                {SEVERITY[f.severity]} {f.message}
                {f.sectionKey ? (
                  <small>
                    {' '}
                    · {doc.template.sections.find((s) => s.key === f.sectionKey)?.title}
                  </small>
                ) : null}
                {f.excerpt ? <small> · “{f.excerpt}”</small> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={saveDocument}>
        <input type="hidden" name="documentId" value={doc.id} />
        <input type="hidden" name="expectedVersion" value={doc.currentVersion} />
        {doc.template.sections.map((spec) => {
          const content = doc.version.sections.find((s) => s.key === spec.key)?.content ?? '';
          return (
            <section key={spec.key} className="module-panel" aria-label={spec.title}>
              <h2 className="section-heading">
                {spec.title}
                {spec.required ? ' *' : ''}
              </h2>
              {editable ? (
                <label className="profile-field">
                  <small>{spec.guidance}</small>
                  <textarea
                    name={`section:${spec.key}`}
                    defaultValue={content}
                    rows={Math.min(18, Math.max(4, content.split('\n').length + 2))}
                  />
                </label>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{content || <em>Empty</em>}</div>
              )}
            </section>
          );
        })}

        <section className="module-panel" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="section-heading">
            Sources
          </h2>
          {doc.citations.length === 0 ? (
            <p>No sources attached.</p>
          ) : (
            <ul className="membership-list">
              {doc.citations.map((c) => (
                <li key={c.marker} className="membership-row">
                  [{c.marker}] {c.citation}
                  {c.validFrom ? <small> · in force from {c.validFrom}</small> : null}
                  {c.quotedText ? <small> · “{c.quotedText}”</small> : null}
                  {c.sourceUri ? (
                    <>
                      {' '}
                      <a href={c.sourceUri} rel="noopener noreferrer">
                        official source
                      </a>
                    </>
                  ) : null}
                  {editable ? (
                    <label>
                      {' '}
                      <input type="checkbox" name="removeCitation" value={c.marker} /> remove
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {editable && verifiedClaims.length > 0 ? (
            <div className="profile-field-grid">
              <label className="profile-field">
                Attach a verified source from the linked research
                <select name="attachPassage" defaultValue="">
                  <option value="">None</option>
                  {verifiedClaims.map((c) => (
                    <option key={c.passageId} value={c.passageId!}>
                      {c.authorityCitation ?? ''} {c.statement.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                In section
                <select name="attachSection" defaultValue={doc.template.sections[0]?.key}>
                  {doc.template.sections.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </section>

        {editable ? (
          <section className="module-panel" aria-label="Save">
            <label className="profile-field">
              Change note
              <input name="changeNote" maxLength={500} placeholder="What changed in this version" />
            </label>
            <div className="profile-actions">
              <button type="submit" className="auth-submit">
                Save as version {doc.currentVersion + 1}
              </button>
            </div>
          </section>
        ) : null}
      </form>

      <section className="module-panel" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-heading">
          Versions and decisions
        </h2>
        <ul className="membership-list">
          {doc.versions.map((v) => (
            <li key={v.number} className="membership-row">
              <Link href={`/documents/${doc.id}?version=${v.number}`}>Version {v.number}</Link>{' '}
              <span className="workspace-status">
                {v.origin === 'agent' ? 'drafting agent' : 'person'}
                {v.number === doc.approvedVersion ? ' · approved' : ''}
              </span>{' '}
              {v.changeNote ? <small>{v.changeNote}</small> : null}
              {v.number > 1 ? (
                <>
                  {' '}
                  <Link href={`/documents/${doc.id}/compare?from=${v.number - 1}&to=${v.number}`}>
                    compare with {v.number - 1}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {doc.approvals.length > 0 ? (
          <ul className="membership-list" aria-label="Decisions">
            {doc.approvals.map((a, i) => (
              <li key={i} className="membership-row">
                Version {a.version}: {a.decision.replace('_', ' ')}
                {a.selfReview ? ' (self-review)' : ''}
                {a.note ? <small> · “{a.note}”</small> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </article>
  );
}
