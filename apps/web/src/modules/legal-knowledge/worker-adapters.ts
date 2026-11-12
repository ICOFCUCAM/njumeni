import type { LegalAdapterRegistration } from './adapter-registry.ts';
import { lovdataAdapterRegistration } from './lovdata-adapter.ts';

/**
 * Adapters that have completed technical and provenance review (Task 2.8: Lovdata public data).
 * Registration only makes an exact adapter version available to the worker. Ingestion still needs
 * the database gates: an approved rights review, operator activation, ingestion enablement and
 * the same adapter key and version pinned on the source. Never register an adapter merely because
 * a source appears in the discovery catalogue.
 */
export const workerAdapterRegistrations: readonly LegalAdapterRegistration[] = Object.freeze([
  lovdataAdapterRegistration(),
]);
