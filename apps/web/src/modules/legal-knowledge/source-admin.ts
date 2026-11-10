import 'server-only';
export {
  recordLegalSourceRightsReview,
  setLegalSourceActivation,
  enqueueLegalSourceIngestion,
} from './source-admin-core.ts';
export type {
  LegalSourceRightsReviewInput,
  LegalSourceActivationInput,
  LegalSourceEnqueueInput,
} from './source-admin-core.ts';
