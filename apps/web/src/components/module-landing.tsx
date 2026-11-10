import { ModuleIcon } from '@/components/module-icon';
import type { ModuleDefinition } from '@/modules/registry';
export function ModuleLanding({ module }: { module: ModuleDefinition }) {
  return (
    <>
      <header>
        <p className="page-eyebrow">Njumeni product module</p>
        <h1 className="page-title">{module.shortLabel}</h1>
        <p className="page-description">{module.summary}</p>
        <div className="module-meta">
          <span className="module-code">MODULE {module.id}</span>
          <span className="module-status">
            Route boundary established Â· implementation pending
          </span>
        </div>
      </header>
      <section className="module-panel" aria-labelledby="module-purpose">
        <div className="action-card-mark">
          <ModuleIcon name={module.icon} />
        </div>
        <h2 id="module-purpose">{module.name}</h2>
        <p>{module.description}</p>
        <div className="module-boundary">
          <div className="boundary-card">
            <span>Product module</span>
            <strong>
              {module.id} â {module.name}
            </strong>
          </div>
          <div className="boundary-card">
            <span>Planned delivery</span>
            <strong>{module.deliveryPhase}</strong>
          </div>
          <div className="boundary-card">
            <span>Route</span>
            <strong>/{module.slug}</strong>
          </div>
          <div className="boundary-card">
            <span>Current state</span>
            <strong>Foundation route only</strong>
          </div>
        </div>
      </section>
      <div className="preview-notice" role="status">
        <span className="notice-mark" aria-hidden="true">
          i
        </span>
        <div>
          <strong>This module entry point is intentionally non-operational.</strong>
          The route and product boundary are established. Authentication, database records, provider
          integrations and module workflows will be implemented in their numbered delivery phases.
          No legal advice, evidence processing or live case operation is simulated here.
        </div>
      </div>
    </>
  );
}
