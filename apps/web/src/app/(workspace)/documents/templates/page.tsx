import Link from 'next/link';
import { createTemplate } from '../../professional/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  'not-authorized': 'Only template managers can create organisation templates.',
  template:
    'Write one section per line (at most 40). Mark required sections with * and add guidance after |.',
  failed: 'The template could not be created.',
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, kind')
    .eq('status', 'active')
    .order('created_at');
  const orgs = organizations ?? [];
  const org =
    orgs.find((o) => o.id === params.org) ?? orgs.find((o) => o.kind !== 'personal') ?? orgs[0];
  if (!org) return <p className="module-panel">You are not a member of any organisation.</p>;
  const { data } = await supabase.rpc('document_templates_for', { p_organization_id: org.id });
  const templates = (data ?? []) as {
    key: string;
    name: string;
    organisation: boolean;
    sections: { title: string; required: boolean }[];
  }[];
  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href="/documents">Documents</Link> · templates
        </p>
        <h1 className="page-title">{org.name} templates</h1>
        <p className="page-description">
          System templates plus the organisation’s own, visible only inside the organisation.
        </p>
      </header>
      {params.error && ERRORS[params.error] ? (
        <p role="alert" className="module-panel">
          {ERRORS[params.error]}
        </p>
      ) : null}
      {params.created ? <p className="module-panel">Template created.</p> : null}
      <section className="module-panel" aria-label="Templates">
        <ul className="membership-list">
          {templates.map((t) => (
            <li key={t.key} className="membership-row">
              {t.name}{' '}
              <span className="workspace-status">{t.organisation ? 'organisation' : 'system'}</span>{' '}
              <small>
                {t.sections.map((s) => `${s.title}${s.required ? '*' : ''}`).join(' · ')}
              </small>
            </li>
          ))}
        </ul>
      </section>
      <section className="module-panel" aria-labelledby="new-template">
        <h2 id="new-template" className="section-heading">
          New organisation template
        </h2>
        <form action={createTemplate} className="profile-field-grid">
          <input type="hidden" name="organizationId" value={org.id} />
          <label className="profile-field">
            Name
            <input name="name" required minLength={3} maxLength={120} />
          </label>
          <label className="profile-field">
            Document type
            <input name="documentType" maxLength={40} placeholder="letter, opinion…" />
          </label>
          <label className="profile-field">
            Sections, one per line (Title * | guidance)
            <textarea
              name="sections"
              rows={8}
              required
              placeholder={'Scope of work * | What we will and will not do\nFees *\nTerms'}
            />
          </label>
          <div className="profile-actions">
            <button type="submit" className="auth-submit">
              Create template
            </button>
          </div>
        </form>
      </section>
    </article>
  );
}
