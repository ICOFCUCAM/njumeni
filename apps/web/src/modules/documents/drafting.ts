// Drafting agent (Phase 7; journey §15.5): template + research + reviewed argument → a draft version.
// Runs through runAgent (authorised, isolated, validated, recorded). The draft may cite only passages
// verified in the research run; where it has nothing grounded to say it leaves a visible placeholder
// for the lawyer, which the document analysis flags and approval cannot pass.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createMockProvider,
  DATA_ISOLATION_NOTICE,
  runAgent,
  type ModelProvider,
  type UntrustedBlock,
} from '../ai/core.ts';
import type { TemplateSection } from './analysis.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

export const DRAFTING_PROMPT_VERSION = 'drafting-1.0.0';

export interface DraftingClaim {
  ordinal: number;
  category: string;
  statement: string;
  quotedText: string | null;
  passageId: string | null;
  authorityCitation: string | null;
  verificationStatus: string;
}
export interface DraftingNode {
  nodeType: string;
  label: string;
  reviewStatus: string;
  isAssumption: boolean;
}
export interface DraftingInput {
  template: TemplateSection[];
  question: string;
  jurisdictionCode: string;
  asOfDate: string;
  coverageLevel: string;
  limitations: string[];
  claims: DraftingClaim[];
  argumentNodes: DraftingNode[];
}
export interface DraftCitation {
  section_key: string;
  marker: number;
  authority_passage_id: string;
  quoted_text?: string;
}
export interface DraftOutput {
  sections: { key: string; content: string }[];
  citations: DraftCitation[];
}

const QUESTION_KEYS = new Set(['question', 'subject']);
const LAW_KEYS = new Set(['law', 'legal_basis', 'findings', 'grounds']);
const FACT_KEYS = new Set(['facts', 'background', 'chronology']);

/** Deterministic reference drafting, used by the mock provider. */
export function buildDraft(input: DraftingInput): DraftOutput {
  const verified = input.claims.filter((c) => c.verificationStatus === 'verified' && c.passageId);
  const law = verified.filter(
    (c) => c.category === 'verified_authority' || c.category === 'interpretation',
  );
  const conflicts = verified.filter((c) => c.category === 'conflicting_authority');
  const accepted = input.argumentNodes.filter((n) => n.reviewStatus === 'accepted');
  const citations: DraftCitation[] = [];
  let marker = 0;
  const cite = (sectionKey: string, claim: DraftingClaim): string => {
    marker += 1;
    citations.push({
      section_key: sectionKey,
      marker,
      authority_passage_id: claim.passageId!,
      ...(claim.quotedText ? { quoted_text: claim.quotedText } : {}),
    });
    const text = claim.quotedText ? `“${claim.quotedText}”` : claim.statement;
    return `${claim.authorityCitation ? `${claim.authorityCitation}: ` : ''}${text} [${marker}]`;
  };
  const sections = input.template.map((spec) => {
    let content: string;
    if (QUESTION_KEYS.has(spec.key)) {
      content = `${input.question}\n\nThe law of ${input.jurisdictionCode} is applied as it stood on ${input.asOfDate}.`;
    } else if (LAW_KEYS.has(spec.key)) {
      content = law.length
        ? law.map((c) => cite(spec.key, c)).join('\n\n')
        : '[To be completed: no verified authority was found for this question.]';
    } else if (spec.key === 'conflicts') {
      content = conflicts.length
        ? conflicts.map((c) => cite(spec.key, c)).join('\n\n')
        : 'No conflicting authority was identified.';
    } else if (FACT_KEYS.has(spec.key)) {
      const facts = accepted.filter((n) => n.nodeType === 'fact' || n.nodeType === 'evidence');
      content = facts.length
        ? facts.map((n) => `${n.isAssumption ? 'Assumed: ' : ''}${n.label}`).join('\n')
        : `[To be completed: ${spec.guidance ?? 'state the facts relied on.'}]`;
    } else if (spec.key === 'analysis') {
      const args = accepted.filter((n) =>
        ['argument', 'counterargument', 'exception', 'defence'].includes(n.nodeType),
      );
      content = args.length
        ? args
            .map((n) => (n.nodeType === 'argument' ? n.label : `Against: ${n.label}`))
            .join('\n\n')
        : '[To be completed: apply the law to the facts, including counterarguments.]';
    } else if (spec.key === 'limitations') {
      content = [
        `Coverage for ${input.jurisdictionCode} is “${input.coverageLevel}”.`,
        ...input.limitations,
        'This document is legal information prepared for review by a qualified person.',
      ].join('\n');
    } else if (spec.key === 'sources') {
      content = `Rights-approved official sources for ${input.jurisdictionCode}, as stored on ${input.asOfDate}. Coverage: ${input.coverageLevel}.`;
    } else {
      content = `[To be completed: ${spec.guidance ?? spec.title}]`;
    }
    return { key: spec.key, content };
  });
  return { sections, citations };
}

/** Rejects output that cites anything not verified in the research run, or writes outside the template. */
export function validateDraft(raw: unknown, input: DraftingInput): DraftOutput {
  const fail = (code = 'AI_OUTPUT_INVALID'): never => {
    throw new Error(code);
  };
  if (!raw || typeof raw !== 'object') fail();
  const { sections, citations } = raw as { sections?: unknown; citations?: unknown };
  if (!Array.isArray(sections) || !Array.isArray(citations)) fail();
  const keys = new Set(input.template.map((s) => s.key));
  const passages = new Map(
    input.claims
      .filter((c) => c.verificationStatus === 'verified' && c.passageId)
      .map((c) => [c.passageId!, c]),
  );
  const seen = new Set<string>();
  const cleanSections = (sections as Record<string, unknown>[]).map((s) => {
    if (
      typeof s.key !== 'string' ||
      !keys.has(s.key) ||
      seen.has(s.key) ||
      typeof s.content !== 'string' ||
      s.content.length > 50000
    )
      fail();
    seen.add(s.key as string);
    return { key: s.key as string, content: s.content as string };
  });
  const markers = new Set<number>();
  const cleanCitations = (citations as Record<string, unknown>[]).map((c) => {
    const marker = c.marker;
    if (
      typeof c.section_key !== 'string' ||
      !seen.has(c.section_key) ||
      typeof marker !== 'number' ||
      !Number.isInteger(marker) ||
      markers.has(marker)
    )
      fail();
    const claim =
      typeof c.authority_passage_id === 'string' ? passages.get(c.authority_passage_id) : undefined;
    if (!claim) fail('AI_OUTPUT_UNGROUNDED');
    if (c.quoted_text !== undefined && c.quoted_text !== claim!.quotedText)
      fail('AI_OUTPUT_UNGROUNDED');
    markers.add(marker as number);
    return {
      section_key: c.section_key as string,
      marker: marker as number,
      authority_passage_id: c.authority_passage_id as string,
      ...(typeof c.quoted_text === 'string' ? { quoted_text: c.quoted_text } : {}),
    };
  });
  return { sections: cleanSections, citations: cleanCitations };
}

export const draftingMockProvider: ModelProvider = createMockProvider({
  drafting: (request) => JSON.stringify(buildDraft(request.structuredInput as DraftingInput)),
});

export async function draftDocument(
  client: RpcClient,
  documentId: string,
  provider: ModelProvider = draftingMockProvider,
): Promise<{ version: number; executionId: string; safetyFlags: string[] }> {
  const doc = await client.rpc('document_get', { p_document_id: documentId });
  if (doc.error || !doc.data) throw new Error('DOCUMENT_NOT_AUTHORISED');
  const document = doc.data as {
    organizationId: string;
    workspaceId: string;
    currentVersion: number;
    researchRunId: string | null;
    issueId: string | null;
    template: { sections: TemplateSection[] };
  };
  if (!document.researchRunId) throw new Error('DOCUMENT_RESEARCH_REQUIRED');
  const run = await client.rpc('research_get_run', { p_run_id: document.researchRunId });
  if (run.error || !run.data) throw new Error('DOCUMENT_RESEARCH_UNAVAILABLE');
  const research = run.data as {
    question: string;
    jurisdictionCode: string;
    asOfDate: string;
    coverageLevel: string;
    limitations: string[];
    claims: DraftingClaim[];
  };
  let argumentNodes: DraftingNode[] = [];
  if (document.issueId) {
    const graph = await client.rpc('argument_get_graph', { p_issue_id: document.issueId });
    if (!graph.error && graph.data) argumentNodes = (graph.data as { nodes: DraftingNode[] }).nodes;
  }
  const input: DraftingInput = {
    template: document.template.sections,
    question: research.question,
    jurisdictionCode: research.jurisdictionCode,
    asOfDate: research.asOfDate,
    coverageLevel: research.coverageLevel,
    limitations: research.limitations,
    claims: research.claims,
    argumentNodes,
  };
  const data: UntrustedBlock[] = [
    { id: 'question', kind: 'question', text: research.question },
    ...research.claims
      .filter((c) => c.verificationStatus === 'verified' && c.passageId)
      .map((c) => ({
        id: `passage:${c.passageId}`,
        kind: 'legal_passage' as const,
        text: c.quotedText ?? c.statement,
      })),
    ...argumentNodes
      .filter(
        (n) =>
          n.reviewStatus === 'accepted' && (n.nodeType === 'fact' || n.nodeType === 'evidence'),
      )
      .map((n, i) => ({ id: `fact:${i}`, kind: 'evidence' as const, text: n.label })),
  ];
  const { executionId, output, safetyFlags } = await runAgent({
    client,
    scope: { organizationId: document.organizationId, workspaceId: document.workspaceId },
    provider,
    request: {
      agentKey: 'drafting',
      promptVersion: DRAFTING_PROMPT_VERSION,
      system: `You are the Njumeni drafting agent. You draft; a qualified person decides. ${DATA_ISOLATION_NOTICE}`,
      instructions:
        'Return JSON {sections:[{key,content}],citations:[{section_key,marker,authority_passage_id,quoted_text?}]}. ' +
        'Use only the template section keys. Cite only the passages supplied, quote them exactly, and mark each citation in the text as [n]. ' +
        'Where nothing grounded can be said, write a bracketed placeholder for the lawyer.',
      data,
      structuredInput: input,
      maxOutputTokens: 8000,
    },
    parse: (text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('AI_OUTPUT_INVALID');
      }
      return validateDraft(parsed, input);
    },
    inputRefs: { documentId, researchRunId: document.researchRunId, issueId: document.issueId },
    retrievalRefs: research.claims.flatMap((c) => (c.passageId ? [c.passageId] : [])),
  });
  const saved = await client.rpc('document_save_version', {
    p_document_id: documentId,
    p_expected_version: document.currentVersion,
    p_sections: output.sections,
    p_citations: output.citations,
    p_ai_execution_id: executionId,
    p_change_note: 'Draft prepared by the drafting agent',
  });
  if (saved.error || typeof saved.data !== 'number') {
    const code = saved.error?.message.match(/DOCUMENT_[A-Z_]+/)?.[0];
    throw new Error(code ?? 'DOCUMENT_SAVE_FAILED');
  }
  return { version: saved.data, executionId, safetyFlags };
}
