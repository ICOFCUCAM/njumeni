import Link from 'next/link';
import { ModuleIcon } from '@/components/module-icon';
import { moduleRegistry } from '@/modules/registry';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const quickActions = [
  {
    title: 'Ask a legal question',
    description: 'Start a source-grounded legal intelligence workflow.',
    href: '/intelligence',
    icon: 'sparkles' as const,
  },
  {
    title: 'Open a matter',
    description: 'Start with a guided interview; Njumeni organises the facts and first tasks.',
    href: '/matters',
    icon: 'folder' as const,
  },
  {
    title: 'Research an authority',
    description: 'Explore legislation, judgments and legal sources.',
    href: '/research',
    icon: 'search' as const,
  },
  {
    title: 'Organise evidence',
    description: 'Prepare a secure, traceable evidence workspace.',
    href: '/evidence',
    icon: 'file' as const,
  },
];

interface Agenda {
  deadlines: {
    matterId: string;
    matterNumber: string;
    matterTitle: string;
    title: string;
    type: string;
    dueAt: string;
    overdue: boolean;
  }[];
  tasks: {
    matterId: string;
    matterNumber: string;
    title: string;
    dueDate: string | null;
    priority: string;
    status: string;
    assignedToMe: boolean;
  }[];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('matter_my_agenda', { p_days: 30 });
  const agenda = (data ?? { deadlines: [], tasks: [] }) as unknown as Agenda;
  const overdue = agenda.deadlines.filter((d) => d.overdue).length;
  return (
    <>
      <header>
        <p className="page-eyebrow">Personal workspace</p>
        <h1 className="page-title">Your legal work, clearly organised.</h1>
        <p className="page-description">
          Your agenda across every matter you can see: deadlines and hearings in the next 30 days,
          anything overdue, and the open tasks assigned to you or to nobody.
        </p>
      </header>
      <section aria-labelledby="agenda-title">
        <div className="section-heading">
          <div>
            <h2 id="agenda-title">Your agenda</h2>
            <p>
              Deadlines are as recorded on each matter. Verify every legal deadline at its source.
            </p>
          </div>
        </div>
        <div className="card-grid">
          {[
            [
              'Deadlines (30 days)',
              String(agenda.deadlines.length),
              overdue ? `${overdue} overdue` : 'None overdue',
            ],
            [
              'Open tasks',
              String(agenda.tasks.length),
              `${agenda.tasks.filter((t) => t.assignedToMe).length} assigned to you`,
            ],
          ].map(([label, value, note]) => (
            <article className="metric-card" key={label}>
              <p className="metric-label">{label}</p>
              <p className="metric-value">{value}</p>
              <p className="metric-note">{note}</p>
            </article>
          ))}
        </div>
        {agenda.deadlines.length > 0 ? (
          <ul className="membership-list" aria-label="Deadlines">
            {agenda.deadlines.map((d, i) => (
              <li key={i} className="membership-row">
                <span className="workspace-status">
                  {d.overdue ? 'OVERDUE · ' : ''}
                  {d.type}
                </span>{' '}
                {d.dueAt.slice(0, 16).replace('T', ' ')} UTC · {d.title} ·{' '}
                <Link href={`/matters/${d.matterId}`}>
                  {d.matterNumber} {d.matterTitle}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {agenda.tasks.length > 0 ? (
          <ul className="membership-list" aria-label="Tasks">
            {agenda.tasks.slice(0, 15).map((t, i) => (
              <li key={i} className="membership-row">
                <span className="workspace-status">{t.priority}</span> {t.title}
                {t.dueDate ? <small> · due {t.dueDate}</small> : null} ·{' '}
                <Link href={`/matters/${t.matterId}`}>{t.matterNumber}</Link>
              </li>
            ))}
          </ul>
        ) : null}
        {agenda.deadlines.length === 0 && agenda.tasks.length === 0 ? (
          <p>
            Nothing due. <Link href="/matters">Open a matter</Link> to start.
          </p>
        ) : null}
      </section>
      <section aria-labelledby="quick-actions-title">
        <div className="section-heading">
          <div>
            <h2 id="quick-actions-title">Start with an intelligence workflow</h2>
            <p>Entry points to the workflows you use most.</p>
          </div>
        </div>
        <div className="card-grid">
          {quickActions.map((action) => (
            <Link className="action-card" href={action.href} key={action.title}>
              <span className="action-card-arrow" aria-hidden="true">
                ↗
              </span>
              <span className="action-card-mark">
                <ModuleIcon name={action.icon} />
              </span>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="modules-title">
        <div className="section-heading">
          <div>
            <h2 id="modules-title">The Njumeni platform</h2>
            <p>
              All thirteen canonical product modules have a route entry in the application shell.
            </p>
          </div>
          <span className="module-status">13 module routes</span>
        </div>
        <div className="card-grid">
          {moduleRegistry.map((module) => (
            <Link className="action-card" href={module.href} key={module.id}>
              <span className="action-card-arrow" aria-hidden="true">
                ↗
              </span>
              <span className="module-code">MODULE {module.id}</span>
              <h3>{module.shortLabel}</h3>
              <p>{module.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
