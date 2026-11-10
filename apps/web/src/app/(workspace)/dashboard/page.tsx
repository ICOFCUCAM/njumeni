import Link from 'next/link';
import { ModuleIcon } from '@/components/module-icon';
import { moduleRegistry } from '@/modules/registry';

const quickActions = [
  { title: 'Ask a legal question', description: 'Start a source-grounded legal intelligence workflow.', href: '/intelligence', icon: 'sparkles' as const },
  { title: 'Research an authority', description: 'Explore legislation, judgments and legal sources.', href: '/research', icon: 'search' as const },
  { title: 'Organise evidence', description: 'Prepare a secure, traceable evidence workspace.', href: '/evidence', icon: 'file' as const },
];

export default function DashboardPage() {
  return <>
    <header>
      <p className="page-eyebrow">Workspace overview</p>
      <h1 className="page-title">Your legal work, clearly organised.</h1>
      <p className="page-description">A connected workspace for legal research, evidence, reasoning and verified work product. The foundation shell establishes the routes and boundaries for the complete Njumeni platform.</p>
    </header>
    <div className="preview-notice" role="status">
      <span className="notice-mark" aria-hidden="true">i</span>
      <div><strong>Foundation preview — no live case data is connected.</strong> Authentication, database access, document storage and AI providers are not connected in this shell. No customer or matter records are being displayed.</div>
    </div>
    <section aria-labelledby="workspace-status-title">
      <div className="section-heading"><div><h2 id="workspace-status-title">Workspace at a glance</h2><p>Live metrics will appear after identity, tenancy and data services are implemented.</p></div></div>
      <div className="card-grid">
        {[
          ['Active matters', 'Not connected', 'Matter data is not available in this preview.'],
          ['Research sessions', 'Not connected', 'Research history will be workspace-scoped.'],
          ['Evidence records', 'Not connected', 'Evidence remains private and matter-scoped.'],
        ].map(([label, value, note]) => <article className="metric-card" key={label}>
          <p className="metric-label">{label}</p><p className="metric-value" style={{ fontSize: 20 }}>{value}</p><p className="metric-note">{note}</p>
        </article>)}
      </div>
    </section>
    <section aria-labelledby="quick-actions-title">
      <div className="section-heading"><div><h2 id="quick-actions-title">Start with an intelligence workflow</h2><p>These links open module entry points; the underlying workflows are not yet enabled.</p></div></div>
      <div className="card-grid">
        {quickActions.map((action) => <Link className="action-card" href={action.href} key={action.title}>
          <span className="action-card-arrow" aria-hidden="true">↗</span><span className="action-card-mark"><ModuleIcon name={action.icon} /></span>
          <h3>{action.title}</h3><p>{action.description}</p>
        </Link>)}
      </div>
    </section>
    <section aria-labelledby="modules-title">
      <div className="section-heading"><div><h2 id="modules-title">The Njumeni platform</h2><p>All thirteen canonical product modules have a route entry in the application shell.</p></div><span className="module-status">13 module routes</span></div>
      <div className="card-grid">
        {moduleRegistry.map((module) => <Link className="action-card" href={module.href} key={module.id}>
          <span className="action-card-arrow" aria-hidden="true">↗</span><span className="module-code">MODULE {module.id}</span>
          <h3>{module.shortLabel}</h3><p>{module.summary}</p>
        </Link>)}
      </div>
    </section>
  </>;
}
