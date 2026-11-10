import type { LegalAdapterRegistration } from './adapter-registry.ts';

/**
 * Intentionally empty until a source-specific adapter has completed technical,
 * provenance and licence review. Never register an adapter merely because a
 * source appears in the discovery catalogue.
 */
export const workerAdapterRegistrations: readonly LegalAdapterRegistration[] = Object.freeze([]);
