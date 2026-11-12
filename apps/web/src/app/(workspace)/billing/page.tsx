import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { describeMeter, formatMoney, type Meter } from '@/modules/billing/billing';

export const dynamic = 'force-dynamic';

interface Overview {
  plan: {
    key: string;
    name: string;
    priceMinor: number | null;
    currency: string;
    status: string;
    overage: boolean;
  };
  periodStart: string;
  periodEnd: string;
  meters: Meter[];
  seats: { used: number; limit: number | null };
  topUps: { credits: number; source: string; at: string }[];
  invoices: {
    id: string;
    number: string;
    periodStart: string;
    totalMinor: number;
    currency: string;
    status: string;
  }[];
}
interface Plan {
  key: string;
  name: string;
  priceMinor: number | null;
  currency: string;
  overage: boolean;
  allowances: Record<string, number | null>;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: organizations }, { data: plans }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, kind')
      .eq('status', 'active')
      .order('created_at'),
    supabase.rpc('billing_plans'),
  ]);
  const orgs = organizations ?? [];
  const org = orgs.find((o) => o.id === params.org) ?? orgs[0];
  if (!org) return <p className="module-panel">You are not a member of any organisation.</p>;
  const { data, error } = await supabase.rpc('billing_overview', { p_organization_id: org.id });
  const overview = data as unknown as Overview | null;
  const catalogue = (plans ?? []) as unknown as Plan[];

  return (
    <article>
      <header>
        <p className="page-eyebrow">Commercial</p>
        <h1 className="page-title">Plan and usage · {org.name}</h1>
        <p className="page-description">
          Usage is metered as it happens. On the free plan allowances are hard limits; paid plans
          continue and bill overage. Billing never affects access to legal records, and
          Njumeni&apos;s built-in AI never uses credits.
        </p>
      </header>
      {orgs.length > 1 ? (
        <nav className="module-panel" aria-label="Organisation">
          {orgs.map((o) => (
            <Link key={o.id} href={`/billing?org=${o.id}`}>
              {o.id === org.id ? <strong>{o.name}</strong> : o.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {error || !overview ? (
        <p className="module-panel">
          Billing is visible to organisation owners and billing managers.
        </p>
      ) : (
        <>
          <section className="card-grid" aria-label="Usage">
            <article className="metric-card">
              <p className="metric-label">Plan</p>
              <p className="metric-value" style={{ fontSize: 22 }}>
                {overview.plan.name}
              </p>
              <p className="metric-note">
                {formatMoney(overview.plan.priceMinor, overview.plan.currency)} / month ·{' '}
                {overview.plan.status} · period {overview.periodStart.slice(0, 10)} to{' '}
                {overview.periodEnd.slice(0, 10)}
              </p>
            </article>
            {overview.meters.map((m) => {
              const d = describeMeter(m, overview.plan.overage);
              return (
                <article key={m.key} className="metric-card">
                  <p className="metric-label">{d.label}</p>
                  <p className="metric-value" style={{ fontSize: 22 }}>
                    {d.text}
                  </p>
                  <p className="metric-note">
                    {d.state === 'exhausted'
                      ? 'Allowance used: further use is blocked'
                      : d.state === 'overage'
                        ? 'Beyond allowance: billed as overage'
                        : d.state === 'warning'
                          ? 'Nearly used'
                          : 'Within allowance'}
                  </p>
                </article>
              );
            })}
            <article className="metric-card">
              <p className="metric-label">Seats</p>
              <p className="metric-value" style={{ fontSize: 22 }}>
                {overview.seats.used}
                {overview.seats.limit !== null ? ` of ${overview.seats.limit}` : ''}
              </p>
            </article>
          </section>
          <section className="module-panel" aria-labelledby="invoices-heading">
            <h2 id="invoices-heading" className="section-heading">
              Invoices
            </h2>
            {overview.invoices.length === 0 ? (
              <p>No invoices yet.</p>
            ) : (
              <ul className="membership-list">
                {overview.invoices.map((i) => (
                  <li key={i.id} className="membership-row">
                    {i.number} <span className="workspace-status">{i.status}</span>{' '}
                    {formatMoney(i.totalMinor, i.currency)}{' '}
                    <small>· {i.periodStart.slice(0, 7)}</small>{' '}
                    <a href={`/api/v1/billing/invoices/${i.id}/pdf`}>PDF</a>
                  </li>
                ))}
              </ul>
            )}
            {overview.topUps.length ? (
              <p>
                <small>
                  Credit top-ups:{' '}
                  {overview.topUps
                    .map((t) => `${t.credits} (${t.source}, ${t.at.slice(0, 10)})`)
                    .join(' · ')}
                </small>
              </p>
            ) : null}
          </section>
        </>
      )}
      <section className="module-panel" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="section-heading">
          Plans
        </h2>
        <p>
          <small>
            Prices are hypotheses under test (master plan §17.1). Payment checkout opens when a
            payment provider is connected.
          </small>
        </p>
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Monthly</th>
              <th>AI credits</th>
              <th>Research runs</th>
              <th>Documents</th>
              <th>API requests</th>
              <th>Overage</th>
            </tr>
          </thead>
          <tbody>
            {catalogue.map((p) => (
              <tr key={p.key}>
                <td>{p.name}</td>
                <td>{formatMoney(p.priceMinor, p.currency)}</td>
                {[
                  'ai.credits.monthly',
                  'research.runs.monthly',
                  'documents.generated.monthly',
                  'api.requests.monthly',
                ].map((k) => (
                  <td key={k}>
                    {p.allowances[k] === null
                      ? 'contract'
                      : p.allowances[k]?.toLocaleString('en-GB')}
                  </td>
                ))}
                <td>{p.overage ? 'billed' : 'hard limit'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}
