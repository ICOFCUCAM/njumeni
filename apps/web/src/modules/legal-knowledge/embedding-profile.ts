// Embedding profile selected by owner decision D-3 (11 November 2026).
// Must stay identical to the row seeded in private.legal_embedding_profiles.
export interface LegalEmbeddingProfile {
  readonly profileKey: string;
  readonly modelId: string;
  readonly runtimeModelId: string;
  readonly dimensions: number;
  readonly queryPrefix: string;
  readonly passagePrefix: string;
  readonly maxInputTokens: number;
  readonly languageCodes: readonly string[];
  readonly licence: string;
}

export const MULTILINGUAL_E5_SMALL_V1: LegalEmbeddingProfile = Object.freeze({
  profileKey: 'multilingual-e5-small-v1',
  modelId: 'intfloat/multilingual-e5-small',
  runtimeModelId: 'Xenova/multilingual-e5-small',
  dimensions: 384,
  queryPrefix: 'query: ',
  passagePrefix: 'passage: ',
  maxInputTokens: 512,
  languageCodes: Object.freeze(['nb', 'nn', 'no', 'en', 'fr']),
  licence: 'MIT',
});

export const ACTIVE_LEGAL_EMBEDDING_PROFILE = MULTILINGUAL_E5_SMALL_V1;

export function assertEmbeddingMatchesProfile(
  values: readonly number[],
  profile: LegalEmbeddingProfile,
): void {
  if (values.length !== profile.dimensions || values.some((value) => !Number.isFinite(value))) {
    throw new Error('LEGAL_EMBEDDING_PROFILE_INVALID');
  }
}
