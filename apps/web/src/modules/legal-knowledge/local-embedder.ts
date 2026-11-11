// Local, zero-cost embedder for the multilingual-e5-small profile (decision D-3).
// The model runs on the worker's CPU through the optional @huggingface/transformers runtime,
// which is loaded lazily so that the web application never bundles it.
import {
  ACTIVE_LEGAL_EMBEDDING_PROFILE,
  assertEmbeddingMatchesProfile,
  type LegalEmbeddingProfile,
} from './embedding-profile.ts';
import type { LegalQueryEmbedder } from './supabase-retrieval-provider.ts';

export interface FeatureExtractionOutput {
  tolist(): number[][];
}
export type FeatureExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<FeatureExtractionOutput>;
export type FeatureExtractorLoader = (runtimeModelId: string) => Promise<FeatureExtractor>;

export interface LocalLegalEmbedder {
  readonly profile: LegalEmbeddingProfile;
  embedQuery: LegalQueryEmbedder;
  embedPassages(texts: readonly string[]): Promise<number[][]>;
}

const RUNTIME_MODULE = '@huggingface/transformers';
const MAX_BATCH = 64;

export const loadTransformersFeatureExtractor: FeatureExtractorLoader = async (runtimeModelId) => {
  let runtime: {
    pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
  try {
    // A variable specifier keeps the optional runtime out of type-checking and bundling.
    runtime = await import(/* webpackIgnore: true */ RUNTIME_MODULE);
  } catch {
    throw new Error('LEGAL_EMBEDDING_RUNTIME_NOT_INSTALLED');
  }
  const extractor = await runtime.pipeline('feature-extraction', runtimeModelId, { dtype: 'q8' });
  if (typeof extractor !== 'function') throw new Error('LEGAL_EMBEDDING_RUNTIME_INVALID');
  return extractor as FeatureExtractor;
};

export function createLocalLegalEmbedder(
  options: {
    profile?: LegalEmbeddingProfile;
    loadExtractor?: FeatureExtractorLoader;
  } = {},
): LocalLegalEmbedder {
  const profile = options.profile ?? ACTIVE_LEGAL_EMBEDDING_PROFILE;
  const loadExtractor = options.loadExtractor ?? loadTransformersFeatureExtractor;
  let extractorPromise: Promise<FeatureExtractor> | undefined;

  async function embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > MAX_BATCH) throw new Error('LEGAL_EMBEDDING_BATCH_TOO_LARGE');
    extractorPromise ??= loadExtractor(profile.runtimeModelId);
    let extractor: FeatureExtractor;
    try {
      extractor = await extractorPromise;
    } catch (error) {
      extractorPromise = undefined;
      throw error;
    }
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const vectors = output.tolist();
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      throw new Error('LEGAL_EMBEDDING_OUTPUT_INVALID');
    }
    for (const vector of vectors) assertEmbeddingMatchesProfile(vector, profile);
    return vectors;
  }

  function withPrefix(prefix: string, texts: readonly string[]): string[] {
    return texts.map((text) => {
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LEGAL_EMBEDDING_INPUT_INVALID');
      }
      return prefix + text.trim();
    });
  }

  return {
    profile,
    // e5 models require role prefixes: "query: " for searches, "passage: " for stored text.
    async embedQuery(query: string) {
      const [values] = await embed(withPrefix(profile.queryPrefix, [query]));
      if (!values) throw new Error('LEGAL_EMBEDDING_OUTPUT_INVALID');
      return { modelKey: profile.profileKey, values };
    },
    async embedPassages(texts: readonly string[]) {
      return embed(withPrefix(profile.passagePrefix, texts));
    },
  };
}
