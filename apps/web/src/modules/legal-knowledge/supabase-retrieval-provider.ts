import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegalPassageSearchProvider, RetrievalCandidate, RetrievalPlan } from './retrieval.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;
export interface LegalQueryEmbedding {
  modelKey: string;
  values: readonly number[];
}
export type LegalQueryEmbedder = (query: string) => Promise<LegalQueryEmbedding>;
interface RetrievalRow {
  passage_id: string; authority_id: string; authority_version_id: string;
  authority_title: string; citation: string | null; jurisdiction_code: string;
  authority_type: string; language_code: string | null; legal_status: RetrievalCandidate['legalStatus'];
  valid_from: string | null; valid_until: string | null; source_uri: string | null;
  source_content_hash: string; passage_content: string; page_number: number | null;
  section_path: string[] | null; source_key: string; lexical_score?: number | null;
  semantic_score?: number | null;
}
function mapRows(data: unknown, scoreKey: 'lexical_score' | 'semantic_score'): RetrievalCandidate[] {
  if (!Array.isArray(data)) throw new Error('LEGAL_RETRIEVAL_RESPONSE_INVALID');
  return data.map((item): RetrievalCandidate => {
    if (!item || typeof item !== 'object') throw new Error('LEGAL_RETRIEVAL_RESPONSE_INVALID');
    const row = item as RetrievalRow;
    for (const field of ['passage_id','authority_id','authority_version_id','authority_title',
      'jurisdiction_code','authority_type','source_content_hash','passage_content','source_key'] as const) {
      if (typeof row[field] !== 'string') throw new Error('LEGAL_RETRIEVAL_RESPONSE_INVALID');
    }
    const score = row[scoreKey];
    return {
      passageId: row.passage_id, authorityId: row.authority_id,
      authorityVersionId: row.authority_version_id, authorityTitle: row.authority_title,
      citation: row.citation ?? null, jurisdictionCode: row.jurisdiction_code,
      authorityType: row.authority_type, languageCode: row.language_code ?? null,
      legalStatus: row.legal_status, validFrom: row.valid_from ?? null,
      validUntil: row.valid_until ?? null, sourceUri: row.source_uri ?? null,
      sourceKey: row.source_key, sourceContentHash: row.source_content_hash,
      passageContent: row.passage_content, pageNumber: row.page_number ?? null,
      sectionPath: Array.isArray(row.section_path) ? row.section_path : [],
      lexicalScore: scoreKey === 'lexical_score' && typeof score === 'number' ? score : null,
      semanticScore: scoreKey === 'semantic_score' && typeof score === 'number' ? score : null,
    };
  });
}
function rpcFailure(code: string): Error { return new Error(code); }
export function createSupabaseLegalPassageSearchProvider(
  client: RpcClient,
  embedQuery?: LegalQueryEmbedder,
): LegalPassageSearchProvider {
  return {
    async searchLexical(plan: RetrievalPlan) {
      const { data, error } = await client.rpc('legal_search_passages_lexical', {
        p_query: plan.queryText, p_jurisdiction_code: plan.jurisdictionCode,
        p_as_of_date: plan.asOfDate, p_language_codes: plan.languageCodes,
        p_authority_types: plan.authorityTypes, p_limit: plan.limit,
      });
      if (error) throw rpcFailure('LEGAL_RETRIEVAL_LEXICAL_PROVIDER_FAILED');
      return mapRows(data, 'lexical_score');
    },
    async searchSemantic(plan: RetrievalPlan) {
      if (!embedQuery) throw new Error('LEGAL_RETRIEVAL_EMBEDDING_PROVIDER_NOT_CONFIGURED');
      const embedding = await embedQuery(plan.queryText);
      if (!embedding.modelKey.trim() || embedding.values.length !== 1536 ||
          embedding.values.some(value => !Number.isFinite(value))) {
        throw new Error('LEGAL_RETRIEVAL_EMBEDDING_PROFILE_INVALID');
      }
      const vector = '[' + embedding.values.join(',') + ']';
      const { data, error } = await client.rpc('legal_search_passages_semantic', {
        p_embedding: vector, p_embedding_model_key: embedding.modelKey,
        p_jurisdiction_code: plan.jurisdictionCode, p_as_of_date: plan.asOfDate,
        p_language_codes: plan.languageCodes, p_authority_types: plan.authorityTypes,
        p_limit: plan.limit,
      });
      if (error) throw rpcFailure('LEGAL_RETRIEVAL_SEMANTIC_PROVIDER_FAILED');
      return mapRows(data, 'semantic_score');
    },
  };
}
