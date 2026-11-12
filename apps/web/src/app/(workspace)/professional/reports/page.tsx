import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface Report {
  mattersByStatus: Record<string, number>;
  mattersByCategory: Record<string, number>;
  overdueDeadlines: number;
  deadlinesNext14Days: number;
  openTasks: number;
  documentsInReview: number;
  documentsApproved: number;
  pendingReviews: number;
  researchRuns30Days: number;
  aiExecutions30Days: number;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ws?: string }>;
}) {
  const { org, ws } = await searchParams;
  if (!UUID.test(org ?? '') || !UUID.test(ws ?? '')) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('professional_report', {
    p_organization_id: org!,
    p_workspace_id: ws!,
  });
  if (error || !data) notFound();
  const report = data as unknown as Report;
  const cards: [string, number, string][] = [
    ['Overdue deadlines', report.overdueDeadlines, 'Pending and past due'],
    ['Deadlines in 14 days', report.deadlinesNext14Days, 'Pending'],
    ['Open tasks', report.openTasks, 'Open or in progress'],
    ['Documents in review', report.documentsInReview, `${report.documentsApproved} approved`],
    ['Quality reviews pending', report.pendingReviews, 'Human review gates'],
    ['Research (30 days)', report.researchRuns30Days, `${report.aiExecutions30Days} AI executions`],
  ];
  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href={`/professional?org=${org}`}>Professional workspace</Link> · report
        </p>
        <h1 className="page-title">Matter report</h1>
        <p className="page-description">Counts exclude matters you are barred from.</p>
      </header>
      <section className="card-grid" aria-label="Indicators">
        {cards.map(([label, value, note]) => (
          <article key={label} className="metric-card">
            <p className="metric-label">{label}</p>
            <p className="metric-value">{value}</p>
            <p className="metric-note">{note}</p>
          </article>
        ))}
      </section>
      {(['mattersByStatus', 'mattersByCategory'] as const).map((key) => (
        <section key={key} className="module-panel" aria-label={key}>
          <h2 className="section-heading">
            {key === 'mattersByStatus' ? 'Matters by status' : 'Active matters by area of law'}
          </h2>
          <table>
            <tbody>
              {Object.entries(report[key]).map(([name, count]) => (
                <tr key={name}>
                  <td>{name.replace('_', ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </article>
  );
}
