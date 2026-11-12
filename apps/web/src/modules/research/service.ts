// Research service (Phase 4): plan → workspace-scoped retrieval → authority context and source
// permissions → extractive composition → database-verified recording. Runs with the caller's
// own session; the database re-checks research.create on every call.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createRetrievalPlan,
  executeLegalRetrieval,
  type RetrievalMode,
} from '../legal-knowledge/retrieval.ts';
import {
  createSupabaseLegalPassageSearchProvider,
  workspaceResearchRouting,
  type LegalQueryEmbedder,
} from '../legal-knowledge/supabase-retrieval-provider.ts';
import {
  composeResearchAnswer,
  RESEARCH_ENGINE_VERSION,
  type AuthorityContextEdge,
  type SourcePermission,
} from './composer.ts';
import { detectLanguage } from '../global/language.ts';
import { CALIBRATED_RERANK_OPTIONS, createLegalReranker } from '../legal-knowledge/reranker.ts';
import { translateQuery, type GlossaryTerm } from '../global/glossary.ts';
import { isEmbeddingUnavailable, KEYWORD_FALLBACK_NOTE } from './query-embedder.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResearchRequest {
  organizationId: string;
  workspaceId: string;
  question: string;
  jurisdictionCode: string;
  asOfDate: string;
  languageCodes: readonly string[];
  mode?: RetrievalMode;
}

function fail(code: string): never {
  throw new Error(code);
}

export async function runLegalResearch(
  client: RpcClient,
  request: ResearchRequest,
  embedQuery?: LegalQueryEmbedder,
): Promise<{ runId: string }> {
  if (!UUID.test(request.organizationId) || !UUID.test(request.workspaceId))
    fail('RESEARCH_SCOPE_INVALID');
  const question = request.question.trim();
  if (question.length < 3 || question.length > 4000) fail('RESEARCH_QUESTION_INVALID');
  // Semantic retrieval needs a configured embedder; without one the engine stays lexical.
  const mode: RetrievalMode = request.mode ?? (embedQuery ? 'hybrid' : 'lexical');
  if (mode !== 'lexical' && !embedQuery) fail('RESEARCH_SEMANTIC_NOT_CONFIGURED');

  // Cross-language research (U-22): a question asked in another language than the sources is
  // searched as the legal concepts it mentions, via the glossary, and the rewrite is disclosed.
  let searchQuery = question;
  let crossLanguageNote: string | null = null;
  const asked = detectLanguage(question);
  const target = request.languageCodes[0];
  if (
    asked !== 'unknown' &&
    target &&
    !request.languageCodes.includes(asked) &&
    !(asked === 'nn' && request.languageCodes.includes('nb'))
  ) {
    const glossary = await client.rpc('legal_glossary_terms', {
      p_languages: [asked === 'nn' ? 'nb' : asked, target],
    });
    const translated = glossary.error
      ? null
      : translateQuery(
          question,
          asked === 'nn' ? 'nb' : asked,
          target,
          (glossary.data ?? []) as GlossaryTerm[],
        );
    if (translated) {
      searchQuery = translated.query;
      crossLanguageNote = `The question was asked in ${asked} and searched in ${target} as the legal concepts “${translated.query}” (legal glossary). Check that these match your question.`;
    }
  }

  const planInput = {
    query: searchQuery,
    jurisdictionCode: request.jurisdictionCode,
    asOfDate: request.asOfDate,
    languageCodes: request.languageCodes,
    mode,
    limit: 12,
  };
  let plan = createRetrievalPlan(planInput);
  const jurisdictions = await client.rpc('research_list_jurisdictions');
  if (jurisdictions.error || !Array.isArray(jurisdictions.data))
    fail('RESEARCH_JURISDICTIONS_UNAVAILABLE');
  const jurisdiction = (jurisdictions.data as { code: string; coverage_level: string }[]).find(
    (row) => row.code === plan.jurisdictionCode,
  );
  if (!jurisdiction) fail('RESEARCH_JURISDICTION_UNKNOWN');

  const provider = createSupabaseLegalPassageSearchProvider(
    client,
    embedQuery,
    undefined,
    workspaceResearchRouting(request.organizationId, request.workspaceId),
  );
  // Second stage: legal reranking (provision, citation, authority, currency, jurisdiction and
  // language signals) over a wider first-stage pool; every finding keeps its ranking trace.
  const retrieve = (retrievalPlan: typeof plan) =>
    executeLegalRetrieval(retrievalPlan, provider, {
      reranker: createLegalReranker({
        ...CALIBRATED_RERANK_OPTIONS,
        preferredLanguage: target ?? null,
      }),
      // Provision and citation matching see the question as asked and, when translated, as searched.
      question: searchQuery === question ? question : question + '\n' + searchQuery,
    });
  let passages: Awaited<ReturnType<typeof retrieve>>;
  let fallbackNote: string | null = null;
  try {
    passages = await retrieve(plan);
  } catch (error) {
    // Meaning-based search unavailable (runtime or model missing): fall back to keyword search,
    // record the run as lexical and tell the reader. An explicitly requested mode still fails.
    if (request.mode || plan.mode === 'lexical' || !isEmbeddingUnavailable(error)) throw error;
    plan = createRetrievalPlan({ ...planInput, mode: 'lexical' });
    passages = await retrieve(plan);
    fallbackNote = KEYWORD_FALLBACK_NOTE;
  }

  const scope = { p_organization_id: request.organizationId, p_workspace_id: request.workspaceId };
  const authorityIds = [...new Set(passages.map((passage) => passage.authorityId))].slice(0, 50);
  const sourceKeys = [...new Set(passages.map((passage) => passage.sourceKey))];
  const [context, permissions] = passages.length
    ? await Promise.all([
        client.rpc('research_authority_context', {
          ...scope,
          p_authority_ids: authorityIds,
          p_as_of_date: plan.asOfDate,
        }),
        client.rpc('research_source_permissions', { ...scope, p_source_keys: sourceKeys }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (context.error || permissions.error) fail('RESEARCH_CONTEXT_UNAVAILABLE');

  const composed = composeResearchAnswer({
    question: searchQuery,
    asOfDate: plan.asOfDate,
    jurisdictionCode: plan.jurisdictionCode,
    coverageLevel: jurisdiction.coverage_level,
    passages,
    context: (context.data ?? []) as AuthorityContextEdge[],
    permissions: (permissions.data ?? []) as SourcePermission[],
  });

  const recorded = await client.rpc('research_record_run', {
    ...scope,
    p_question: question,
    p_jurisdiction_code: plan.jurisdictionCode,
    p_as_of_date: plan.asOfDate,
    p_language_codes: plan.languageCodes,
    p_retrieval_mode: plan.mode,
    p_limitations: [crossLanguageNote, fallbackNote, ...composed.limitations].filter(
      (note): note is string => Boolean(note),
    ),
    p_engine_version: RESEARCH_ENGINE_VERSION,
    p_findings: composed.findings,
    p_claims: composed.claims,
  });
  if (recorded.error || typeof recorded.data !== 'string')
    fail(
      /QUOTA_EXCEEDED/.test(recorded.error?.message ?? '')
        ? 'RESEARCH_QUOTA_EXCEEDED'
        : 'RESEARCH_RECORD_FAILED',
    );
  return { runId: recorded.data };
}
