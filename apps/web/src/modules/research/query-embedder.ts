// Query embedder for live research (web server). The research engine's measured quality
// (Precision@5 0.774, legal-rerank-1.1.0) is for hybrid retrieval: keyword plus meaning. The web
// server therefore embeds questions with the same local profile as the stored passages
// (multilingual-e5-small-v1) whenever the optional runtime is installed on the server.
//
//   LEGAL_QUERY_EMBEDDER=local (default)  embed locally; if the runtime or model is unavailable,
//                                          research falls back to keyword search and says so
//   LEGAL_QUERY_EMBEDDER=off              keyword search only
import {
  createLocalLegalEmbedder,
  type LocalLegalEmbedder,
} from '../legal-knowledge/local-embedder.ts';
import type { LegalQueryEmbedder } from '../legal-knowledge/supabase-retrieval-provider.ts';

let shared: LocalLegalEmbedder | undefined;

export function researchQueryEmbedder(
  env: Record<string, string | undefined> = process.env,
  create?: () => LocalLegalEmbedder,
): LegalQueryEmbedder | undefined {
  const setting = (env.LEGAL_QUERY_EMBEDDER ?? 'local').trim().toLowerCase();
  if (setting === 'off') return undefined;
  if (setting !== 'local') throw new Error('LEGAL_QUERY_EMBEDDER_INVALID');
  // One embedder per server process: the model loads once, on the first question.
  const embedder = create ? create() : (shared ??= createLocalLegalEmbedder());
  return async (query) => {
    try {
      return await embedder.embedQuery(query);
    } catch (error) {
      throw new Error('LEGAL_EMBEDDING_UNAVAILABLE', { cause: error });
    }
  };
}

/** True when an error means meaning-based search is unavailable, not that the search failed. */
export function isEmbeddingUnavailable(error: unknown): boolean {
  return error instanceof Error && /^LEGAL_(EMBEDDING|RETRIEVAL_EMBEDDING)_/.test(error.message);
}

export const KEYWORD_FALLBACK_NOTE =
  'Meaning-based search was unavailable for this question, so this answer used keyword search only. Relevant passages that use different words may be missing.';
