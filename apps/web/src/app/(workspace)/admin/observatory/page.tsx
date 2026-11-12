import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { askCommandCentre, observatoryAction } from './actions';

export const dynamic = 'force-dynamic';

interface Currency {
  jurisdictionCode: string;
  verdict: string;
  reasons: string[];
}
interface Proposal {
  id: string;
  actionType: string;
  proposedByKind: string;
  rationale: string;
  status: string;
  decisionNote: string | null;
  executionResult: Record<string, unknown> | null;
}
interface Issue {
  id: string;
  jurisdictionCode: string | null;
  kind: string;
  severity: string;
  status: string;
  title: string;
  openedAt: string;
  proposals: Proposal[];
}
interface Observatory {
  generatedAt: string;
  headline: Record<string, number>;
  currency: Currency[];
  sources: {
    targetKey: string;
    jurisdictionCode: string;
    name: string;
    targetType: string;
    status: string;
    currency: string;
    lastCheckedAt: string | null;
    consecutiveFailures: number;
    activationBasis: string | null;
  }[];
  recentChanges: {
    id: string;
    changeType: string;
    jurisdictionCode: string;
    citation: string | null;
    title: string;
    detectedAt: string;
    effectiveDate: string | null;
    commencementStatus: string;
    reviewStatus: string;
    sectionsChanged: number;
    highImpacts: number;
  }[];
  failedIngestion: {
    sourceKey: string;
    status: string;
    failureCode: string | null;
    finishedAt: string | null;
  }[];
  itemFailures: number;
  issues: Issue[];
  engineeringTasks: { id: string; status: string; title: string }[];
  audit: {
    sequence: number;
    occurredAt: string;
    actorKind: string;
    eventType: string;
    subjectType: string;
    subjectId: string | null;
  }[];
  auditChain: { valid: boolean; events: number };
}
interface Message {
  sequence: number;
  authorKind: 'operator' | 'assistant';
  content: string;
  intent: string | null;
  engine: string | null;
  data: { attempts?: { engine: string; outcome: string; reason: string | null }[] } | null;
  createdAt: string;
}
interface AiSettings {
  primaryEngine: 'claude_code' | 'anthropic_api' | 'rules';
  fallbackEnabled: boolean;
  anthropicModel: string;
  monthlyBudgetUsd: number;
  spentThisMonthUsd: number;
}
interface EngineeringTask {
  id: string;
  status: string;
  executor: string | null;
  branch: string;
  jurisdictionCode: string | null;
  targetKey: string | null;
  instruction: string;
  attempts: number;
  sessionUrl: string | null;
  pullRequestUrl: string | null;
  lastError: string | null;
  summary: string | null;
  createdAt: string;
}
interface Dispatch {
  id: string;
  questionSequence: number;
  status: 'dispatched' | 'answered' | 'failed';
  sessionUrl: string | null;
  dispatchedAt: string;
}
const ENGINE_LABEL: Record<string, string> = {
  claude_code: 'Claude Code (your subscription)',
  anthropic_api: 'Anthropic API (key)',
  rules: 'Built-in rules (no AI)',
};
const engineName = (engine: string | null) =>
  !engine
    ? ''
    : engine === 'claude-code'
      ? 'Claude Code'
      : engine.startsWith('anthropic-api')
        ? 'Anthropic API'
        : 'Rules engine';

const VERDICT_LABEL: Record<string, string> = {
  current: 'Current',
  behind: 'Behind',
  unverified: 'Unverified',
  not_monitored: 'Not monitored',
};
const HEADLINE: [string, string][] = [
  ['jurisdictionsCatalogued', 'Jurisdictions catalogued'],
  ['jurisdictionsProfiled', 'With a monitoring profile'],
  ['activeTargets', 'Sources monitored'],
  ['verifiedCurrent', 'Verified current'],
  ['unresolvedChanges', 'Unresolved legal changes'],
  ['openIssues', 'Open issues'],
  ['awaitingApproval', 'Awaiting approval'],
];
const time = (value: string | null) => (value ? value.slice(0, 16).replace('T', ' ') : '—');

/**
 * Global Legal Observatory (GLCI-07): Super Admin monitoring of the world's legal sources and of
 * Njumeni's own currency, with the AI command centre. Platform operators only; no customer content.
 */
export default async function ObservatoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string; conversation?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: isOperator } = await supabase.rpc('platform_is_operator');
  if (!isOperator) notFound();
  const { data, error } = await supabase.rpc('glci_observatory' as never);
  if (error || !data) notFound();
  const o = data as unknown as Observatory;
  const conversation = /^[0-9a-f-]{36}$/.test(params.conversation ?? '')
    ? params.conversation!
    : null;
  const messages = conversation
    ? (((
        await supabase.rpc(
          'glci_command_conversation' as never,
          { p_conversation_id: conversation } as never,
        )
      ).data ?? []) as unknown as Message[])
    : [];
  const aiSettings = (await supabase.rpc('glci_ai_settings_get' as never))
    .data as unknown as AiSettings | null;
  const dispatches = conversation
    ? (((
        await supabase.rpc(
          'glci_conversation_dispatches' as never,
          { p_conversation_id: conversation } as never,
        )
      ).data ?? []) as unknown as Dispatch[])
    : [];
  const pending = dispatches.filter((d) => d.status === 'dispatched');
  const engineeringTasks = ((await supabase.rpc('glci_engineering_tasks_list' as never)).data ??
    []) as unknown as EngineeringTask[];
  const queue = o.issues.flatMap((issue) =>
    issue.proposals
      .filter((p) => p.status === 'proposed' || p.status === 'approved')
      .map((p) => ({ issue, proposal: p })),
  );

  return (
    <article>
      <header>
        <p className="page-eyebrow">Platform administration</p>
        <h1 className="page-title">Global Legal Observatory</h1>
        <p className="page-description">
          Official legal sources watched per jurisdiction, detected legal changes, their impact on
          Njumeni, and whether Njumeni&apos;s legal knowledge is current. A source that could not be
          checked is shown as unverified, never as current. Measured {time(o.generatedAt)} UTC.
        </p>
      </header>
      {params.error ? (
        <p role="alert" className="module-panel">
          Refused ({params.error.replace(/-/g, ' ')}).
        </p>
      ) : null}
      {params.done ? (
        <p role="status" className="module-panel">
          Done: {params.done}.
        </p>
      ) : null}

      <section className="card-grid" aria-label="Headline">
        {HEADLINE.map(([key, label]) => (
          <article key={key} className="metric-card">
            <p className="metric-label">{label}</p>
            <p className="metric-value" style={{ fontSize: 22 }}>
              {o.headline[key] ?? 0}
            </p>
          </article>
        ))}
        <article className="metric-card">
          <p className="metric-label">GLCI audit chain</p>
          <p className="metric-value" style={{ fontSize: 22 }}>
            {o.auditChain.valid ? 'valid' : 'BROKEN'}
          </p>
        </article>
      </section>

      <section className="module-panel" aria-label="Command centre">
        <h2 className="section-heading">AI command centre</h2>
        <p>
          <small>
            Ask about legal currency, coverage or lag, or request a connector change. Answers come
            from live data. Repository changes become engineering tasks that another operator must
            approve.
          </small>
        </p>
        <ol className="membership-list" aria-label="Conversation">
          {messages.map((m) => (
            <li key={m.sequence} className="membership-row">
              <strong>{m.authorKind === 'operator' ? 'You' : 'Njumeni'}</strong>{' '}
              {m.intent ? (
                <span className="workspace-status">{m.intent.replace(/_/g, ' ')}</span>
              ) : null}{' '}
              {m.authorKind === 'assistant' ? <small>via {engineName(m.engine)}</small> : null}
              <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{m.content}</p>
              {m.data?.attempts?.some((a) => a.outcome !== 'succeeded') ? (
                <p style={{ margin: '4px 0 0' }}>
                  <small>
                    Fallback:{' '}
                    {m.data.attempts
                      .filter((a) => a.outcome !== 'succeeded')
                      .map(
                        (a) =>
                          `${ENGINE_LABEL[a.engine] ?? a.engine} ${a.outcome} (${(a.reason ?? '').toLowerCase().replace(/_/g, ' ')})`,
                      )
                      .join('; ')}
                  </small>
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        {pending.map((d) => (
          <p key={d.id} role="status">
            Claude Code is investigating question {d.questionSequence} (sent {time(d.dispatchedAt)}{' '}
            UTC).{' '}
            {d.sessionUrl ? (
              <a href={d.sessionUrl} target="_blank" rel="noreferrer">
                Watch the session
              </a>
            ) : null}{' '}
            <a href={`/admin/observatory?conversation=${conversation}`}>Refresh</a>
          </p>
        ))}
        <form action={askCommandCentre} className="profile-actions">
          {conversation ? <input type="hidden" name="conversation" value={conversation} /> : null}
          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            name="question"
            required
            minLength={3}
            maxLength={4000}
            rows={2}
            placeholder="Is our European legal coverage current?"
          />
          <label htmlFor="engine">Engine</label>
          <select id="engine" name="engine" defaultValue="auto">
            <option value="auto">
              Default ({ENGINE_LABEL[aiSettings?.primaryEngine ?? 'rules']}
              {aiSettings?.fallbackEnabled ? ', with fallback' : ''})
            </option>
            <option value="claude_code">{ENGINE_LABEL.claude_code}</option>
            <option value="anthropic_api">{ENGINE_LABEL.anthropic_api}</option>
            <option value="rules">{ENGINE_LABEL.rules}</option>
          </select>
          <button type="submit">Ask</button>
        </form>
        {aiSettings ? (
          <details>
            <summary>AI engine settings</summary>
            <form action={observatoryAction} className="profile-actions">
              <input type="hidden" name="action" value="ai-settings" />
              <label htmlFor="primaryEngine">Primary engine</label>
              <select
                id="primaryEngine"
                name="primaryEngine"
                defaultValue={aiSettings.primaryEngine}
              >
                <option value="claude_code">{ENGINE_LABEL.claude_code}</option>
                <option value="anthropic_api">{ENGINE_LABEL.anthropic_api}</option>
                <option value="rules">{ENGINE_LABEL.rules}</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  name="fallbackEnabled"
                  defaultChecked={aiSettings.fallbackEnabled}
                />{' '}
                Fall back to the next engine (Claude Code → Anthropic API → rules)
              </label>
              <label htmlFor="anthropicModel">API model</label>
              <input
                id="anthropicModel"
                name="anthropicModel"
                defaultValue={aiSettings.anthropicModel}
              />
              <label htmlFor="monthlyBudgetUsd">API budget per month (USD)</label>
              <input
                id="monthlyBudgetUsd"
                name="monthlyBudgetUsd"
                type="number"
                min={0}
                step="0.01"
                defaultValue={aiSettings.monthlyBudgetUsd}
              />
              <input
                name="note"
                required
                minLength={5}
                maxLength={2000}
                placeholder="Reason for the change"
              />
              <button type="submit">Save engine settings</button>
            </form>
            <p>
              <small>
                API spend this month: ${Number(aiSettings.spentThisMonthUsd).toFixed(2)} of $
                {Number(aiSettings.monthlyBudgetUsd).toFixed(2)}. Claude Code runs on your Claude
                subscription; it needs GLCI_CLAUDE_CODE_ROUTINE_URL and
                GLCI_CLAUDE_CODE_ROUTINE_TOKEN on the server. The API needs ANTHROPIC_API_KEY. An
                engine that is not configured is skipped.
              </small>
            </p>
          </details>
        ) : null}
      </section>

      <section className="module-panel" aria-label="Jurisdiction currency">
        <h2 className="section-heading">Jurisdiction currency</h2>
        <form action={observatoryAction} className="profile-actions">
          <input type="hidden" name="action" value="verify" />
          <button type="submit">Run currency verification</button>
        </form>
        <ul className="membership-list">
          {o.currency.map((c) => (
            <li key={c.jurisdictionCode} className="membership-row">
              <strong>{c.jurisdictionCode}</strong>{' '}
              <span className="workspace-status">{VERDICT_LABEL[c.verdict] ?? c.verdict}</span>{' '}
              <small>{c.reasons.join(' ')}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="Source availability and health">
        <h2 className="section-heading">Source availability and health</h2>
        <ul className="membership-list">
          {o.sources.map((s) => (
            <li key={s.targetKey} className="membership-row">
              <strong>{s.jurisdictionCode}</strong> {s.name}{' '}
              <span className="workspace-status">
                {s.status === 'active' ? s.currency.replace(/_/g, ' ') : s.status}
              </span>{' '}
              <small>
                {s.targetType.replace('_', ' ')} · last checked {time(s.lastCheckedAt)}
                {s.consecutiveFailures ? ` · ${s.consecutiveFailures} failed check(s)` : ''}
                {s.status !== 'active'
                  ? ` · ${s.activationBasis ? 'may be activated (' + s.activationBasis + ')' : 'awaiting rights review'}`
                  : ''}
              </small>
              {s.status === 'active' ? (
                <form action={observatoryAction} className="profile-actions">
                  <input type="hidden" name="action" value="check" />
                  <input type="hidden" name="id" value={s.targetKey} />
                  <button type="submit">Check now</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="New legislation, amendments and repeals">
        <h2 className="section-heading">New legislation, amendments and repeals</h2>
        {o.recentChanges.length === 0 ? (
          <p>No legal change has been detected yet (first ingestions are baselines).</p>
        ) : null}
        <ul className="membership-list">
          {o.recentChanges.map((c) => (
            <li key={c.id} className="membership-row">
              <span className="workspace-status">{c.changeType.replace('_', ' ')}</span>{' '}
              <strong>{c.citation ?? c.title}</strong>{' '}
              <small>
                {c.jurisdictionCode} · detected {time(c.detectedAt)} · {c.sectionsChanged}{' '}
                section(s) ·{' '}
                {c.commencementStatus === 'pending_commencement'
                  ? `takes effect ${c.effectiveDate}`
                  : c.effectiveDate
                    ? `in force from ${c.effectiveDate}`
                    : 'effective date unknown'}{' '}
                · {c.highImpacts} high impact(s) · review: {c.reviewStatus}
              </small>
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="Human approval queue">
        <h2 className="section-heading">Human approval queue and remediation tasks</h2>
        <form action={observatoryAction} className="profile-actions">
          <input type="hidden" name="action" value="reconcile" />
          <button type="submit">Reconcile issues now</button>
        </form>
        {queue.length === 0 ? <p>Nothing awaits approval.</p> : null}
        <ul className="membership-list">
          {queue.map(({ issue, proposal }) => (
            <li key={proposal.id} className="membership-row">
              <span className="workspace-status">{issue.severity}</span>{' '}
              <strong>{issue.title}</strong>{' '}
              <small>
                {proposal.actionType.replace(/_/g, ' ')} · proposed by {proposal.proposedByKind} ·{' '}
                {proposal.status}
              </small>
              <p style={{ margin: '4px 0' }}>{proposal.rationale}</p>
              {proposal.status === 'proposed' ? (
                <form action={observatoryAction} className="profile-actions">
                  <input type="hidden" name="id" value={proposal.id} />
                  <input
                    name="note"
                    required
                    minLength={5}
                    maxLength={2000}
                    placeholder="Decision note"
                  />
                  <button type="submit" name="action" value="approve">
                    Approve
                  </button>
                  <button type="submit" name="action" value="reject">
                    Reject
                  </button>
                </form>
              ) : (
                <form action={observatoryAction} className="profile-actions">
                  <input type="hidden" name="id" value={proposal.id} />
                  <button type="submit" name="action" value="execute">
                    Execute approved action
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="Open issues">
        <h2 className="section-heading">Outdated knowledge and open issues</h2>
        {o.issues.length === 0 ? <p>No open issue.</p> : null}
        <ul className="membership-list">
          {o.issues.map((issue) => (
            <li key={issue.id} className="membership-row">
              <span className="workspace-status">{issue.severity}</span> {issue.title}{' '}
              <small>
                {issue.kind.replace(/_/g, ' ')} · {issue.jurisdictionCode ?? 'global'} · opened{' '}
                {time(issue.openedAt)} · {issue.status}
              </small>
              <form action={observatoryAction} className="profile-actions">
                <input type="hidden" name="action" value="dismiss" />
                <input type="hidden" name="id" value={issue.id} />
                <input
                  name="note"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="Reason for dismissal"
                />
                <button type="submit">Dismiss</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="Failed ingestion and synchronisation">
        <h2 className="section-heading">Failed ingestion and synchronisation</h2>
        <p>
          {o.failedIngestion.length} recent failed or partial run(s); {o.itemFailures} item(s)
          pending retry or abandoned.
        </p>
        <ul className="membership-list">
          {o.failedIngestion.map((r, i) => (
            <li key={i} className="membership-row">
              {r.sourceKey} <span className="workspace-status">{r.status}</span>{' '}
              <small>
                {r.failureCode ?? ''} · {time(r.finishedAt)}
              </small>
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="Claude Code execution history">
        <h2 className="section-heading">Claude Code execution history</h2>
        <p>
          <small>
            Approved engineering tasks run in your Claude Code (else the GitHub workflow) on their
            own branch and end in a pull request for review. Nothing is merged or deployed from
            here.
          </small>
        </p>
        {engineeringTasks.length === 0 ? <p>No engineering task yet.</p> : null}
        <ul className="membership-list">
          {engineeringTasks.map((t) => (
            <li key={t.id} className="membership-row">
              <span className="workspace-status">{t.status.replace(/_/g, ' ')}</span>{' '}
              <strong>{t.instruction.slice(0, 140)}</strong>{' '}
              <small>
                {t.jurisdictionCode ?? 'global'} · {t.branch} ·{' '}
                {t.executor ? t.executor.replace(/_/g, ' ') : 'not yet dispatched'} · {t.attempts}{' '}
                attempt(s) · {time(t.createdAt)}
                {t.lastError ? ` · ${t.lastError.toLowerCase().replace(/_/g, ' ')}` : ''}
              </small>
              {t.summary ? <p style={{ margin: '4px 0' }}>{t.summary}</p> : null}
              {t.pullRequestUrl ? (
                <a href={t.pullRequestUrl} target="_blank" rel="noreferrer">
                  Review the pull request
                </a>
              ) : null}{' '}
              {t.sessionUrl ? (
                <a href={t.sessionUrl} target="_blank" rel="noreferrer">
                  Watch the Claude Code session
                </a>
              ) : null}
              {t.status === 'queued' || t.status === 'failed' ? (
                <form action={observatoryAction} className="profile-actions">
                  <input type="hidden" name="action" value="dispatch-task" />
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit">Send to Claude Code again</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="module-panel" aria-label="Audit history">
        <h2 className="section-heading">Audit history</h2>
        <p>
          <small>
            {o.auditChain.events} GLCI audit event(s); hash chain{' '}
            {o.auditChain.valid ? 'verifies' : 'DOES NOT VERIFY'}.
          </small>
        </p>
        <ul className="membership-list">
          {o.audit.map((a) => (
            <li key={a.sequence} className="membership-row">
              <small>
                #{a.sequence} · {time(a.occurredAt)} · {a.actorKind} · {a.eventType} ·{' '}
                {a.subjectType}
                {a.subjectId ? ' ' + a.subjectId.slice(0, 40) : ''}
              </small>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
