import Link from 'next/link';
import { notFound } from 'next/navigation';
import { reviewNode } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { evaluateArgumentGraph, type GraphView } from '@/modules/reasoning/argument';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Node {
  id: string;
  nodeType: string;
  label: string;
  origin: 'human' | 'agent';
  reviewStatus: 'proposed' | 'accepted' | 'rejected';
  isAssumption: boolean;
  authorityPassageId: string | null;
  authorityCitation: string | null;
  evidenceItemId: string | null;
  evidenceTitle: string | null;
  propositionId: string | null;
}
interface Graph {
  id: string;
  title: string;
  researchRunId: string | null;
  nodes: Node[];
  edges: { from: string; to: string; edgeType: string }[];
}

const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Issue and questions', types: ['legal_issue', 'legal_question'] },
  {
    title: 'Law',
    types: [
      'applicable_rule',
      'statutory_provision',
      'judicial_interpretation',
      'procedural_requirement',
    ],
  },
  { title: 'Facts and evidence', types: ['fact', 'evidence', 'claim'] },
  { title: 'Arguments', types: ['argument', 'remedy', 'conclusion'] },
  { title: 'Opposition', types: ['counterargument', 'exception', 'defence'] },
];

const label = (value: string) => value.replaceAll('_', ' ');

export default async function ArgumentIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { issueId } = await params;
  const { error: errorCode } = await searchParams;
  if (!UUID.test(issueId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('argument_get_graph', { p_issue_id: issueId });
  if (error || !data) notFound();
  const graph = data as unknown as Graph;
  const evaluation = evaluateArgumentGraph(graph as unknown as GraphView);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  return (
    <article>
      <header>
        <p className="page-eyebrow">
          <Link href="/arguments">Arguments</Link>
        </p>
        <h1 className="page-title">{graph.title}</h1>
        <p className="page-description">
          Argument quality: {Math.round(evaluation.score * 100)}% of structural checks met.
          {graph.researchRunId ? (
            <>
              {' '}
              <Link href={`/research/${graph.researchRunId}`}>View the research</Link>.
            </>
          ) : null}
        </p>
      </header>

      {errorCode === 'review-failed' ? (
        <p role="alert" className="module-panel">
          The review could not be saved. The node may already have been reviewed.
        </p>
      ) : null}

      {GROUPS.map(({ title, types }) => {
        const nodes = graph.nodes.filter((node) => types.includes(node.nodeType));
        if (nodes.length === 0) return null;
        return (
          <section key={title} className="module-panel" aria-label={title}>
            <h2 className="section-heading">{title}</h2>
            <ul className="membership-list">
              {nodes.map((node) => {
                const outgoing = graph.edges.filter((edge) => edge.from === node.id);
                return (
                  <li key={node.id} className="membership-row">
                    <span className="workspace-status">
                      {label(node.nodeType)}
                      {node.isAssumption ? ' · assumption' : ''} ·{' '}
                      {node.reviewStatus === 'proposed'
                        ? 'proposed by AI, awaiting review'
                        : node.reviewStatus}
                    </span>{' '}
                    {node.reviewStatus === 'rejected' ? <s>{node.label}</s> : node.label}
                    {node.authorityCitation ? <small> · {node.authorityCitation}</small> : null}
                    {node.evidenceTitle ? <small> · exhibit: {node.evidenceTitle}</small> : null}
                    {outgoing.length > 0 ? (
                      <small>
                        {' '}
                        ·{' '}
                        {outgoing
                          .map(
                            (edge) =>
                              `${label(edge.edgeType)} → ${(byId.get(edge.to)?.label ?? '').slice(0, 60)}`,
                          )
                          .join('; ')}
                      </small>
                    ) : null}
                    {node.reviewStatus === 'proposed' ? (
                      <form action={reviewNode} className="profile-actions">
                        <input type="hidden" name="issueId" value={graph.id} />
                        <input type="hidden" name="nodeId" value={node.id} />
                        <button
                          type="submit"
                          name="decision"
                          value="accepted"
                          className="auth-submit"
                        >
                          Accept
                        </button>{' '}
                        <button type="submit" name="decision" value="rejected">
                          Reject
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="module-panel" aria-label="Quality checks">
        <h2 className="section-heading">Quality checks</h2>
        <ul className="membership-list">
          {evaluation.checks.map((check) => (
            <li key={check.key} className="membership-row">
              {check.passed ? '✓' : '✗'} {check.detail}
            </li>
          ))}
        </ul>
        <p>
          <small>
            Proposals are legal information for a qualified person to review, not legal advice.
          </small>
        </p>
      </section>
    </article>
  );
}
