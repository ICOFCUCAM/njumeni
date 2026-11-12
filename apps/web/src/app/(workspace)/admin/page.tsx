import { notFound } from 'next/navigation';
import { organisationAction } from '../organisation/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Overview {
  organizations:
    | {
        id: string;
        name: string;
        kind: string;
        status: string;
        members: number;
        workspaces: number;
        createdAt: string;
      }[]
    | null;
  counts: Record<string, number>;
  ai: {
    executions30Days: number;
    failed30Days: number;
    refused30Days: number;
    costUsd30Days: number;
    providers: { key: string; status: string }[];
  };
  auditChainValid: boolean;
  activeSupportGrants: number;
}

/** Platform back office (§16). Operators see platform metadata only, never customer content. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: isOperator } = await supabase.rpc('platform_is_operator');
  if (!isOperator) notFound();
  const [{ data }, commercial] = await Promise.all([
    supabase.rpc('platform_overview'),
    supabase.rpc('platform_commercial_analytics'),
  ]);
  const overview = data as unknown as Overview;
  const sales = commercial.data as {
    mrrMinor: number;
    subscriptionsByPlan: Record<string, number>;
    usageThisMonth: Record<string, number>;
    aiCostUsdThisMonth: number;
    invoicedMinorThisYear: number;
    outstandingMinor: number;
    creditTopUpsThisMonth: number;
  } | null;
  return (
    <article>
      <header>
        <p className="page-eyebrow">Platform administration</p>
        <h1 className="page-title">Back office</h1>
        <p className="page-description">
          Platform metadata only. Operators have no access to customer content; support access must
          be requested and is granted, time-limited and read-only, by the customer.
        </p>
      </header>
      <p className="module-panel">
        <a href="/admin/observatory">Global Legal Observatory</a>: legal source monitoring, legal
        change detection and impact, Njumeni&apos;s legal currency, and the AI command centre.
      </p>
      {params.error ? (
        <p role="alert" className="module-panel">
          Refused ({params.error.replace(/-/g, ' ')}).
        </p>
      ) : null}
      <section className="card-grid" aria-label="Platform">
        {[
          ...Object.entries(overview.counts).map(([k, v]) => [k, String(v)]),
          [
            'AI runs (30 days)',
            `${overview.ai.executions30Days} (${overview.ai.failed30Days} failed, ${overview.ai.refused30Days} refused)`,
          ],
          ['AI cost (30 days)', `$${Number(overview.ai.costUsd30Days).toFixed(2)}`],
          ['Audit chain', overview.auditChainValid ? 'valid' : 'BROKEN'],
          ['Active support grants', String(overview.activeSupportGrants)],
        ].map(([label, value]) => (
          <article key={label} className="metric-card">
            <p className="metric-label">{label}</p>
            <p className="metric-value" style={{ fontSize: 20 }}>
              {value}
            </p>
          </article>
        ))}
      </section>
      {sales ? (
        <section className="module-panel" aria-label="Commercial analytics">
          <h2 className="section-heading">Commercial analytics</h2>
          <p>
            MRR {(sales.mrrMinor / 100).toFixed(2)} USD · invoiced this year{' '}
            {(sales.invoicedMinorThisYear / 100).toFixed(2)} · outstanding{' '}
            {(sales.outstandingMinor / 100).toFixed(2)} · AI cost this month{' '}
            {Number(sales.aiCostUsdThisMonth).toFixed(2)} USD · credit top-ups{' '}
            {sales.creditTopUpsThisMonth}
          </p>
          <p>
            <small>
              Subscriptions:{' '}
              {Object.entries(sales.subscriptionsByPlan)
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ') || 'none'}{' '}
              · Usage:{' '}
              {Object.entries(sales.usageThisMonth)
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ') || 'none'}
            </small>
          </p>
        </section>
      ) : null}
      <section className="module-panel" aria-label="Organisations">
        <h2 className="section-heading">Organisations</h2>
        <ul className="membership-list">
          {(overview.organizations ?? []).map((o) => (
            <li key={o.id} className="membership-row">
              {o.name} <span className="workspace-status">{o.kind}</span>{' '}
              <small>
                {o.members} member(s) · {o.workspaces} workspace(s) · since{' '}
                {o.createdAt.slice(0, 10)}
              </small>
              <form action={organisationAction} className="profile-actions">
                <input type="hidden" name="organizationId" value={o.id} />
                <input type="hidden" name="action" value="support-request" />
                <input type="hidden" name="back" value="admin" />
                <input
                  name="reason"
                  required
                  minLength={10}
                  maxLength={1000}
                  placeholder="Ticket and reason for access"
                />{' '}
                <input name="minutes" type="number" min={15} max={480} defaultValue={60} /> min{' '}
                <button type="submit">Request support access</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="module-panel" aria-label="SSO verification">
        <h2 className="section-heading">Verify an SSO domain</h2>
        <form action={organisationAction} className="profile-actions">
          <input type="hidden" name="organizationId" value="00000000-0000-4000-8000-000000000000" />
          <input type="hidden" name="action" value="verify-domain" />
          <input type="hidden" name="back" value="admin" />
          <input
            name="domain"
            required
            placeholder="example.com (after checking its DNS TXT record)"
          />{' '}
          <button type="submit">Mark verified</button>
        </form>
      </section>
      <section className="module-panel" aria-label="AI providers">
        <h2 className="section-heading">AI providers</h2>
        <ul className="membership-list">
          {overview.ai.providers.map((p) => (
            <li key={p.key} className="membership-row">
              {p.key} <span className="workspace-status">{p.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
