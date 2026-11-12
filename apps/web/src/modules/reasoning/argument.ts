// Legal reasoning engine (Phase 5; Master Plan v2.0 §6, U-14). Turns a verified research run and
// the workspace's factual propositions into a proposed argument graph. The proposal is produced by
// the "reasoning" agent through runAgent, so it is authorised, isolated, validated and recorded;
// every node it stores is "proposed" until a human accepts or rejects it.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createMockProvider,
  DATA_ISOLATION_NOTICE,
  runAgent,
  type ModelProvider,
  type ModelRequest,
  type UntrustedBlock,
} from '../ai/core.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

export const REASONING_PROMPT_VERSION = 'reasoning-1.0.0';
const MAX_FACTS = 12;

export const NODE_TYPES = [
  'legal_issue',
  'legal_question',
  'applicable_rule',
  'statutory_provision',
  'judicial_interpretation',
  'fact',
  'evidence',
  'claim',
  'argument',
  'counterargument',
  'exception',
  'defence',
  'procedural_requirement',
  'remedy',
  'conclusion',
] as const;
export const EDGE_TYPES = [
  'raises',
  'governed_by',
  'interpreted_by',
  'supports',
  'contradicts',
  'qualifies',
  'argues_for',
  'argues_against',
  'rebuts',
  'excepts',
  'requires',
  'yields',
  'distinguishes',
] as const;
const LAW_NODES = new Set(['applicable_rule', 'statutory_provision', 'judicial_interpretation']);

export interface ResearchRunView {
  id: string;
  question: string;
  status: string;
  claims: {
    ordinal: number;
    category: string;
    statement: string;
    quotedText: string | null;
    passageId: string | null;
    authorityCitation: string | null;
    verificationStatus: string;
  }[];
}
export interface PropositionView {
  id: string;
  statement: string;
  status: string;
  links: {
    evidenceItemId: string;
    evidenceTitle: string;
    passageId: string | null;
    relation: string;
  }[];
}
export interface ProposedNode {
  key: string;
  node_type: (typeof NODE_TYPES)[number];
  label: string;
  authority_passage_id?: string;
  evidence_item_id?: string;
  evidence_passage_id?: string;
  proposition_id?: string;
  is_assumption?: boolean;
}
export interface ProposedEdge {
  from: string;
  to: string;
  edge_type: (typeof EDGE_TYPES)[number];
}
export interface ArgumentProposal {
  nodes: ProposedNode[];
  edges: ProposedEdge[];
}
export interface ReasoningInput {
  question: string;
  claims: ResearchRunView['claims'];
  propositions: PropositionView[];
}

const WORD = /[\p{L}\p{N}]{4,}/gu;
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(WORD) ?? []);
}
function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const word of a) if (b.has(word)) count += 1;
  return count;
}
function clip(text: string, max = 300): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Deterministic argument construction used by the mock provider (and as the reference output). */
export function buildArgumentProposal(input: ReasoningInput): ArgumentProposal {
  const nodes: ProposedNode[] = [
    { key: 'issue', node_type: 'legal_issue', label: clip(input.question, 500) },
  ];
  const edges: ProposedEdge[] = [];
  const verified = input.claims.filter(
    (claim) => claim.verificationStatus === 'verified' && claim.passageId,
  );
  const rules: string[] = [];
  for (const claim of verified) {
    const citation = claim.authorityCitation ? `${claim.authorityCitation}: ` : '';
    const label = clip(`${citation}${claim.quotedText ?? claim.statement}`, 600);
    const key = `c${claim.ordinal}`;
    if (claim.category === 'verified_authority') {
      nodes.push({
        key,
        node_type: 'applicable_rule',
        label,
        authority_passage_id: claim.passageId!,
      });
      edges.push({ from: 'issue', to: key, edge_type: 'governed_by' });
      rules.push(key);
    } else if (claim.category === 'interpretation') {
      nodes.push({
        key,
        node_type: 'judicial_interpretation',
        label,
        authority_passage_id: claim.passageId!,
      });
      edges.push({
        from: rules[0] ?? 'issue',
        to: key,
        edge_type: rules[0] ? 'interpreted_by' : 'governed_by',
      });
    } else if (claim.category === 'conflicting_authority') {
      nodes.push({
        key,
        node_type: 'counterargument',
        label,
        authority_passage_id: claim.passageId!,
      });
      edges.push({ from: key, to: 'issue', edge_type: 'argues_against' });
    }
  }
  for (const claim of input.claims.filter((c) => c.category === 'unresolved_question')) {
    const key = `q${claim.ordinal}`;
    nodes.push({ key, node_type: 'legal_question', label: clip(claim.statement, 500) });
    edges.push({ from: 'issue', to: key, edge_type: 'raises' });
  }

  // Facts: the propositions most related to the question and the retrieved law.
  const context = words(
    [input.question, ...verified.map((c) => c.quotedText ?? c.statement)].join(' '),
  );
  const facts = input.propositions
    .filter((p) => p.status !== 'withdrawn')
    .map((p) => ({ p, score: overlap(words(p.statement), context) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))
    .slice(0, MAX_FACTS)
    .map((entry) => entry.p);

  if (rules.length > 0) {
    nodes.push({
      key: 'arg',
      node_type: 'argument',
      label: facts.length
        ? `The facts below are relevant to ${rules.length === 1 ? 'the rule' : 'the rules'} governing the issue; a lawyer must decide whether each requirement is met.`
        : 'The governing rules are identified, but no recorded fact addresses them yet.',
    });
    edges.push({ from: 'arg', to: 'issue', edge_type: 'argues_for' });
    for (const rule of rules) edges.push({ from: 'arg', to: rule, edge_type: 'governed_by' });
  }
  const evidenceKeys = new Map<string, string>();
  facts.forEach((proposition, index) => {
    const key = `f${index}`;
    nodes.push({
      key,
      node_type: 'fact',
      label: clip(proposition.statement, 500),
      proposition_id: proposition.id,
    });
    edges.push({
      from: key,
      to: rules.length ? 'arg' : 'issue',
      edge_type: rules.length ? 'supports' : 'raises',
    });
    for (const link of proposition.links) {
      const id = `${link.evidenceItemId}:${link.passageId ?? ''}`;
      let evidenceKey = evidenceKeys.get(id);
      if (!evidenceKey) {
        evidenceKey = `e${evidenceKeys.size}`;
        evidenceKeys.set(id, evidenceKey);
        nodes.push({
          key: evidenceKey,
          node_type: 'evidence',
          label: clip(link.evidenceTitle, 300),
          evidence_item_id: link.evidenceItemId,
          ...(link.passageId ? { evidence_passage_id: link.passageId } : {}),
        });
      }
      const relation =
        (['supports', 'contradicts', 'qualifies'] as const).find((r) => r === link.relation) ??
        'supports';
      edges.push({ from: evidenceKey, to: key, edge_type: relation });
    }
    if (proposition.links.length === 0) {
      nodes.push({
        key: `${key}u`,
        node_type: 'legal_question',
        label: clip(`What evidence proves: ${proposition.statement}`, 500),
      });
      edges.push({ from: key, to: `${key}u`, edge_type: 'raises' });
    }
  });
  if (rules.length === 0) {
    nodes.push({
      key: 'gap',
      node_type: 'legal_question',
      label:
        'No verified authority governs this issue yet; further research is required before an argument can be built.',
    });
    edges.push({ from: 'issue', to: 'gap', edge_type: 'raises' });
  }
  return { nodes, edges };
}

/**
 * Validates model output before anything is stored. Law nodes may cite only passages that were
 * verified in the research run, and facts/evidence only items supplied as input, so a model cannot
 * invent a citation or reach outside the material it was given.
 */
export function validateArgumentProposal(raw: unknown, input: ReasoningInput): ArgumentProposal {
  const fail = (): never => {
    throw new Error('AI_OUTPUT_INVALID');
  };
  if (!raw || typeof raw !== 'object') fail();
  const { nodes, edges } = raw as { nodes?: unknown; edges?: unknown };
  if (
    !Array.isArray(nodes) ||
    !Array.isArray(edges) ||
    nodes.length === 0 ||
    nodes.length > 200 ||
    edges.length > 400
  )
    fail();
  const passages = new Set(
    input.claims
      .filter((c) => c.verificationStatus === 'verified' && c.passageId)
      .map((c) => c.passageId!),
  );
  const propositions = new Set(input.propositions.map((p) => p.id));
  const evidenceItems = new Set(
    input.propositions.flatMap((p) => p.links.map((l) => l.evidenceItemId)),
  );
  const evidencePassages = new Set(
    input.propositions.flatMap((p) => p.links.map((l) => l.passageId).filter(Boolean)),
  );
  const keys = new Set<string>();
  const cleanNodes: ProposedNode[] = (nodes as Record<string, unknown>[]).map((node) => {
    const key = node.key;
    const type = node.node_type;
    const label = node.label;
    if (typeof key !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(key) || keys.has(key)) fail();
    if (typeof type !== 'string' || !(NODE_TYPES as readonly string[]).includes(type)) fail();
    if (typeof label !== 'string' || !label.trim() || label.length > 2000) fail();
    const ref = (field: string, allowed: Set<unknown>): string | undefined => {
      const value = node[field];
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string' || !allowed.has(value)) throw new Error('AI_OUTPUT_UNGROUNDED');
      return value;
    };
    const refs = {
      authority_passage_id: ref('authority_passage_id', passages),
      proposition_id: ref('proposition_id', propositions),
      evidence_item_id: ref('evidence_item_id', evidenceItems),
      evidence_passage_id: ref('evidence_passage_id', evidencePassages),
    };
    const out: ProposedNode = {
      key: key as string,
      node_type: type as ProposedNode['node_type'],
      label: (label as string).trim(),
    };
    for (const [field, value] of Object.entries(refs))
      if (value) out[field as keyof typeof refs] = value;
    if (node.is_assumption === true) out.is_assumption = true;
    if (LAW_NODES.has(out.node_type) && !out.authority_passage_id)
      throw new Error('AI_OUTPUT_UNGROUNDED');
    if (
      (out.node_type === 'fact' || out.node_type === 'evidence') &&
      !out.proposition_id &&
      !out.evidence_item_id &&
      !out.is_assumption
    )
      throw new Error('AI_OUTPUT_UNGROUNDED');
    keys.add(out.key);
    return out;
  });
  const cleanEdges: ProposedEdge[] = (edges as Record<string, unknown>[]).map((edge) => {
    if (
      typeof edge.from !== 'string' ||
      typeof edge.to !== 'string' ||
      !keys.has(edge.from) ||
      !keys.has(edge.to) ||
      edge.from === edge.to
    )
      fail();
    if (
      typeof edge.edge_type !== 'string' ||
      !(EDGE_TYPES as readonly string[]).includes(edge.edge_type)
    )
      fail();
    return {
      from: edge.from as string,
      to: edge.to as string,
      edge_type: edge.edge_type as ProposedEdge['edge_type'],
    };
  });
  if (!cleanNodes.some((node) => node.node_type === 'legal_issue')) fail();
  return { nodes: cleanNodes, edges: cleanEdges };
}

// ----- evaluation --------------------------------------------------------------------------------
export interface GraphNodeView {
  id: string;
  nodeType: string;
  reviewStatus: string;
  isAssumption: boolean;
  authorityPassageId: string | null;
  evidenceItemId: string | null;
  propositionId: string | null;
}
export interface GraphView {
  nodes: GraphNodeView[];
  edges: { from: string; to: string; edgeType: string }[];
}
export interface GraphEvaluation {
  score: number;
  checks: { key: string; passed: boolean; detail: string }[];
}

/** Structural rubric for argument quality (master plan §18, reasoning evaluation). */
export function evaluateArgumentGraph(graph: GraphView): GraphEvaluation {
  const live = graph.nodes.filter((node) => node.reviewStatus !== 'rejected');
  const ids = new Set(live.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const law = live.filter((node) => LAW_NODES.has(node.nodeType));
  const facts = live.filter((node) => node.nodeType === 'fact');
  const assumptions = facts.filter((node) => node.isAssumption);
  const checks = [
    {
      key: 'issue_defined',
      passed: live.some((n) => n.nodeType === 'legal_issue'),
      detail: 'The graph states the legal issue.',
    },
    {
      key: 'law_identified',
      passed: law.length > 0,
      detail: `${law.length} rule or interpretation node(s).`,
    },
    {
      key: 'law_cited',
      passed: law.every((n) => n.authorityPassageId),
      detail: 'Every rule node cites an authority passage.',
    },
    { key: 'facts_present', passed: facts.length > 0, detail: `${facts.length} fact node(s).` },
    {
      key: 'facts_grounded',
      passed:
        facts.length > 0 &&
        facts.every((n) => n.propositionId || n.evidenceItemId || n.isAssumption),
      detail: `${assumptions.length} of ${facts.length} fact(s) are assumptions.`,
    },
    {
      key: 'opposition_considered',
      passed:
        live.some((n) => ['counterargument', 'exception', 'defence'].includes(n.nodeType)) ||
        edges.some((e) => e.edgeType === 'contradicts'),
      detail: 'A counterargument, exception, defence or contradicting evidence is represented.',
    },
    {
      key: 'connected',
      passed: live.length <= 1 || live.every((n) => connected.has(n.id)),
      detail: 'No node is disconnected from the argument.',
    },
    {
      key: 'human_reviewed',
      passed: live.length > 0 && graph.nodes.every((n) => n.reviewStatus !== 'proposed'),
      detail: `${graph.nodes.filter((n) => n.reviewStatus === 'proposed').length} node(s) await review.`,
    },
  ];
  return { score: checks.filter((c) => c.passed).length / checks.length, checks };
}

// ----- service ---------------------------------------------------------------------------------
export const reasoningMockProvider: ModelProvider = createMockProvider({
  reasoning: (request) =>
    JSON.stringify(buildArgumentProposal(request.structuredInput as ReasoningInput)),
});

export function buildReasoningRequest(input: ReasoningInput): ModelRequest {
  const data: UntrustedBlock[] = [
    { id: 'question', kind: 'question', text: input.question },
    ...input.claims
      .filter((c) => c.verificationStatus === 'verified' && c.passageId)
      .map((c) => ({
        id: `passage:${c.passageId}`,
        kind: 'legal_passage' as const,
        text: `${c.authorityCitation ?? ''} ${c.quotedText ?? c.statement}`.trim(),
      })),
    ...input.propositions.map((p) => ({
      id: `proposition:${p.id}`,
      kind: 'evidence' as const,
      text: p.statement,
    })),
  ];
  return {
    agentKey: 'reasoning',
    promptVersion: REASONING_PROMPT_VERSION,
    system:
      'You are the Njumeni reasoning agent. You structure legal arguments; you do not decide cases. ' +
      DATA_ISOLATION_NOTICE,
    instructions:
      'Build an argument graph as JSON {nodes:[{key,node_type,label,authority_passage_id?,proposition_id?,evidence_item_id?,evidence_passage_id?,is_assumption?}],edges:[{from,to,edge_type}]}. ' +
      'Cite only passage and proposition ids present in the data. Mark any fact without evidence as an assumption. Include opposing arguments.',
    data,
    structuredInput: input,
    maxOutputTokens: 4000,
  };
}

export async function proposeArgument(
  client: RpcClient,
  request: { organizationId: string; workspaceId: string; researchRunId: string; title?: string },
  provider: ModelProvider = reasoningMockProvider,
): Promise<{
  issueId: string;
  executionId: string;
  nodes: number;
  edges: number;
  safetyFlags: string[];
}> {
  const run = await client.rpc('research_get_run', { p_run_id: request.researchRunId });
  if (run.error || !run.data)
    throw new Error(
      /NOT_AUTHORISED/.test(run.error?.message ?? '')
        ? 'AI_NOT_AUTHORISED'
        : 'ARGUMENT_RUN_UNAVAILABLE',
    );
  const view = run.data as ResearchRunView;
  const props = await client.rpc('evidence_list_propositions', {
    p_organization_id: request.organizationId,
    p_workspace_id: request.workspaceId,
  });
  if (props.error) throw new Error('ARGUMENT_PROPOSITIONS_UNAVAILABLE');
  const input: ReasoningInput = {
    question: view.question,
    claims: view.claims,
    propositions: (props.data as PropositionView[]) ?? [],
  };
  const { executionId, output, safetyFlags } = await runAgent({
    client,
    scope: { organizationId: request.organizationId, workspaceId: request.workspaceId },
    provider,
    request: buildReasoningRequest(input),
    parse: (text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('AI_OUTPUT_INVALID');
      }
      return validateArgumentProposal(parsed, input);
    },
    inputRefs: { researchRunId: view.id, propositionCount: input.propositions.length },
    retrievalRefs: input.claims.flatMap((c) => (c.passageId ? [c.passageId] : [])),
  });
  const issue = await client.rpc('argument_create_issue', {
    p_organization_id: request.organizationId,
    p_workspace_id: request.workspaceId,
    p_title: clip(request.title ?? view.question, 500),
    p_research_run_id: view.id,
  });
  if (issue.error || typeof issue.data !== 'string') throw new Error('ARGUMENT_ISSUE_FAILED');
  const added = await client.rpc('argument_add_graph', {
    p_issue_id: issue.data,
    p_nodes: output.nodes,
    p_edges: output.edges,
    p_ai_execution_id: executionId,
  });
  if (added.error) throw new Error('ARGUMENT_GRAPH_FAILED');
  return {
    issueId: issue.data,
    executionId,
    nodes: output.nodes.length,
    edges: output.edges.length,
    safetyFlags,
  };
}
