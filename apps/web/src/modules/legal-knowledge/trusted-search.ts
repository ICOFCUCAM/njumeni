import type { SupabaseClient } from '@supabase/supabase-js';
import 'server-only';
import { createSupabaseLegalPassageSearchProvider, type LegalQueryEmbedder } from './supabase-retrieval-provider.ts';
import { createRetrievalPlan, executeLegalRetrieval, type RetrievalQuery, type RankedLegalPassage } from './retrieval.ts';
import { buildLegalCitationBundle } from './citation-bundle.ts';
import { loadLegalCitationSourceMetadata } from './citation-metadata.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;
export interface TrustedLegalSearchInput extends RetrievalQuery { requestId: string; }
export interface TrustedLegalSearchResult {
  requestId: string;
  jurisdictionCode: string;
  asOfDate: string;
  queryMode: RetrievalQuery['mode'];
  passages: RankedLegalPassage[];
  citations: ReturnType<typeof buildLegalCitationBundle>;
  resultCount: number;
  warnings: string[];
}
export function createTrustedLegalKnowledgeSearch(
  client: RpcClient, embedQuery?: LegalQueryEmbedder,
) {
  const provider = createSupabaseLegalPassageSearchProvider(client, embedQuery);
  return async function search(input: TrustedLegalSearchInput): Promise<TrustedLegalSearchResult> {
    if (!input.requestId.trim() || input.requestId.length > 128) {
      throw new Error('LEGAL_SEARCH_REQUEST_ID_INVALID');
    }
    const plan = createRetrievalPlan(input);
    const retrieved = await executeLegalRetrieval(plan, provider);
    const metadata = await loadLegalCitationSourceMetadata(client, retrieved.map(item => item.sourceKey));
    const citations = buildLegalCitationBundle({
      answerId: input.requestId, jurisdictionCode: plan.jurisdictionCode,
      asOfDate: plan.asOfDate, passageIds: retrieved.map(item => item.passageId),
      retrievedPassages: retrieved, sources: metadata,
    });
    const permitted = new Map(citations.entries.map(entry => [entry.passageId, entry]));
    const passages = retrieved.flatMap((passage): RankedLegalPassage[] => {
      const citation = permitted.get(passage.passageId);
      if (!citation || !citation.displayPermitted) return [];
      return [{ ...passage, passageContent: citation.quotePermitted ? passage.passageContent : '' }];
    });
    const warnings = [...citations.warnings];
    if (!passages.length) warnings.push('No source passage is available for display under the current jurisdiction, rights and retrieval scope.');
    return {
      requestId: input.requestId, jurisdictionCode: plan.jurisdictionCode,
      asOfDate: plan.asOfDate, queryMode: plan.mode, passages, citations,
      resultCount: passages.length, warnings,
    };
  };
}
