import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  name: string;
  aiRiskClass: string;
  conformityRecorded: boolean;
  openMatters: number;
  closedMatters: number;
  overdueDeadlines: number;
  approvedDocuments: number;
  obligations: number;
  nonCompliant: number;
  aiExecutions30Days: number;
  aiRefusals30Days: number;
}

export default async function InstitutionalPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
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
  const { data, error } = await supabase.rpc('institutional_report', { p_organization_id: org.id });
  const report = data as {
    workspaces: Row[];
    pendingReviews: number;
    conflictChecks90Days: number;
    activeSupportGrants: number;
  } | null;
  return (
    <article>
      <header>
        <p className="page-eyebrow">Module K · Institutional workspace</p>
        <h1 className="page-title">Institutional report · {org.name}</h1>
        <p className="page-description">
          Aggregates only: no case content leaves its workspace. Workspaces that assist the
          administration of justice are high-risk under the EU AI Act; their AI stays blocked until
          a conformity assessment is recorded (
          <Link href={`/organisation?org=${org.id}`}>administration</Link>).
        </p>
      </header>
      {error || !report ? (
        <p className="module-panel">
          The institutional report is available to organisation administrators and auditors.
        </p>
      ) : (
        <>
          <section className="card-grid" aria-label="Organisation">
            {[
              ['Pending quality reviews', report.pendingReviews],
              ['Conflict checks (90 days)', report.conflictChecks90Days],
              ['Active support grants', report.activeSupportGrants],
            ].map(([label, value]) => (
              <article key={String(label)} className="metric-card">
                <p className="metric-label">{label}</p>
                <p className="metric-value">{value}</p>
              </article>
            ))}
          </section>
          <section className="module-panel" aria-label="Workspaces">
            <table>
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>AI classification</th>
                  <th>Open / closed matters</th>
                  <th>Overdue deadlines</th>
                  <th>Approved documents</th>
                  <th>Obligations (non-compliant)</th>
                  <th>AI runs / refusals (30 days)</th>
                </tr>
              </thead>
              <tbody>
                {report.workspaces.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>
                      {w.aiRiskClass.replace(/_/g, ' ')}
                      {w.aiRiskClass === 'high_risk_justice'
                        ? w.conformityRecorded
                          ? ' (conformity recorded)'
                          : ' (AI blocked)'
                        : ''}
                    </td>
                    <td>
                      {w.openMatters} / {w.closedMatters}
                    </td>
                    <td>{w.overdueDeadlines}</td>
                    <td>{w.approvedDocuments}</td>
                    <td>
                      {w.obligations} ({w.nonCompliant})
                    </td>
                    <td>
                      {w.aiExecutions30Days} / {w.aiRefusals30Days}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </article>
  );
}
