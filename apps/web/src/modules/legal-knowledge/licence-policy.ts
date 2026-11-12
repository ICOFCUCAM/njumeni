// Source-specific licence policies (database: private.legal_source_licence_policies).
//
// A policy belongs to one source and never extends to another. A source without a policy keeps
// the general rights-evidence rules, except that model training, fine-tuning and website scraping
// are never permitted without an explicit policy that says so.

export const LICENSED_USES = Object.freeze([
  'retrieval_augmented_generation',
  'commercial_use',
  'display',
  'quotation',
  'redistribution',
  'model_training',
  'model_fine_tuning',
  'website_scraping',
] as const);
export type LicensedUse = (typeof LICENSED_USES)[number];

const NEVER_WITHOUT_POLICY: readonly LicensedUse[] = Object.freeze([
  'model_training',
  'model_fine_tuning',
  'website_scraping',
]);

export interface LegalSourceLicencePolicy {
  sourceKey: string;
  policyVersion: number;
  licenceIdentifier: string;
  licenceUri: string;
  attributionText: string;
  acquisitionHosts: readonly string[];
  permittedDatasets: readonly string[];
  permittedUses: Readonly<Record<LicensedUse, boolean>>;
  conditions: readonly string[];
  evidenceUris: readonly string[];
}

/** Mirrors policy version 1 seeded by migration 20261113000000 (owner decision 2026-11-12). */
export const LOVDATA_LICENCE_POLICY: LegalSourceLicencePolicy = Object.freeze({
  sourceKey: 'lovdata-official',
  policyVersion: 1,
  licenceIdentifier: 'NLOD-2.0',
  licenceUri: 'https://data.norge.no/nlod/en/2.0',
  attributionText:
    'Inneholder data under Norsk lisens for offentlige data (NLOD) 2.0 tilgjengeliggjort av Lovdata. ' +
    'Contains data under the Norwegian Licence for Open Government Data (NLOD) 2.0 made available by Lovdata.',
  acquisitionHosts: Object.freeze(['api.lovdata.no']),
  permittedDatasets: Object.freeze(['gjeldende-lover.tar.bz2', 'gjeldende-sentrale-forskrifter.tar.bz2']),
  permittedUses: Object.freeze({
    retrieval_augmented_generation: true,
    commercial_use: true,
    display: true,
    quotation: true,
    redistribution: true,
    model_training: false,
    model_fine_tuning: false,
    website_scraping: false,
  }),
  conditions: Object.freeze([
    'Attribution to Lovdata under NLOD 2.0 must accompany displayed or redistributed material.',
    'Acquire data only from the official API (api.lovdata.no); ordinary website scraping is prohibited (Lovdata user terms).',
    'Only the licensed public API datasets of current laws and central regulations are covered.',
    'Ordinary Lovdata website content must not be used for AI training.',
    'No model fine-tuning on Lovdata material without separate legal confirmation.',
    'This policy does not extend to any other source.',
  ]),
  evidenceUris: Object.freeze([
    'https://lovdata.no/info/brukeravtale',
    'https://lovdata.no/artikkel/lovdata_tilrettelegger_for_bruk_tilpasset_var_ki-hverdag_gjor_api_av_oppdatert_regelverk_gratis_tilgjengelig_for_alle/5277',
    'https://api.lovdata.no/',
    'https://data.norge.no/nlod/en/2.0',
  ]),
});

export function isLicensedUse(value: unknown): value is LicensedUse {
  return typeof value === 'string' && (LICENSED_USES as readonly string[]).includes(value);
}

/** Whether a use is permitted. No policy: general rules, but never training, fine-tuning or scraping. */
export function licencePermitsUse(policy: LegalSourceLicencePolicy | null, use: LicensedUse): boolean {
  if (!isLicensedUse(use)) throw new Error('LEGAL_SOURCE_USE_UNKNOWN');
  if (!policy) return !NEVER_WITHOUT_POLICY.includes(use);
  return policy.permittedUses[use] === true;
}

export function assertUsePermitted(policy: LegalSourceLicencePolicy | null, use: LicensedUse): void {
  if (!licencePermitsUse(policy, use)) throw new Error('LEGAL_SOURCE_USE_NOT_PERMITTED');
}

/**
 * Checks that material is acquired as the policy allows: an https URL on a permitted acquisition
 * host and, when the policy lists datasets, one of those datasets.
 */
export function assertAcquisitionPermitted(
  policy: LegalSourceLicencePolicy,
  input: { uri: string; dataset: string | null },
): void {
  let url: URL;
  try {
    url = new URL(input.uri);
  } catch {
    throw new Error('LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !policy.acquisitionHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED');
  }
  if (policy.permittedDatasets.length > 0 &&
      (input.dataset === null || !policy.permittedDatasets.includes(input.dataset))) {
    throw new Error('LEGAL_SOURCE_LICENCE_DATASET_NOT_PERMITTED');
  }
}

/** Parses the JSON returned by public.legal_source_licence_policy_get. */
export function parseLicencePolicy(value: unknown): LegalSourceLicencePolicy | null {
  if (value === null || value === undefined) return null;
  const row = value as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : null;
  const uses = row.permittedUses as Record<string, unknown> | undefined;
  const acquisitionHosts = strings(row.acquisitionHosts);
  const permittedDatasets = strings(row.permittedDatasets);
  const conditions = strings(row.conditions);
  const evidenceUris = strings(row.evidenceUris);
  if (typeof row.sourceKey !== 'string' || !Number.isInteger(row.policyVersion) ||
      typeof row.licenceIdentifier !== 'string' || typeof row.licenceUri !== 'string' ||
      typeof row.attributionText !== 'string' || !acquisitionHosts?.length || !permittedDatasets ||
      !conditions || !evidenceUris || !uses || typeof uses !== 'object' ||
      LICENSED_USES.some(use => typeof uses[use] !== 'boolean')) {
    throw new Error('LEGAL_SOURCE_LICENCE_POLICY_INVALID');
  }
  return Object.freeze({
    sourceKey: row.sourceKey,
    policyVersion: row.policyVersion as number,
    licenceIdentifier: row.licenceIdentifier,
    licenceUri: row.licenceUri,
    attributionText: row.attributionText,
    acquisitionHosts: Object.freeze(acquisitionHosts),
    permittedDatasets: Object.freeze(permittedDatasets),
    permittedUses: Object.freeze(Object.fromEntries(LICENSED_USES.map(use => [use, uses[use] === true]))) as Record<LicensedUse, boolean>,
    conditions: Object.freeze(conditions),
    evidenceUris: Object.freeze(evidenceUris),
  });
}

/**
 * Guard for any export of source material for model training or fine-tuning. Every source in the
 * export must hold a policy that permits the use; no policy means no.
 */
export function assertTrainingExportPermitted(
  sources: readonly { sourceKey: string; policy: LegalSourceLicencePolicy | null }[],
  use: 'model_training' | 'model_fine_tuning',
): void {
  const refused = sources.filter(source => !licencePermitsUse(source.policy, use)).map(source => source.sourceKey);
  if (refused.length) throw new Error('LEGAL_SOURCE_USE_NOT_PERMITTED');
}
