// GLCI-01: the global jurisdiction and authority registry (docs/GLCI_SPECIFICATION.md §4).
// Countries are data: a monitoring profile and monitoring targets per jurisdiction, read through
// public.glci_registry() (platform operators only). Monitoring never authorises ingestion.

export const GLCI_TARGET_TYPES = Object.freeze(['legal_database', 'gazette', 'parliament', 'government', 'regulator', 'court'] as const);
export type GlciTargetType = (typeof GLCI_TARGET_TYPES)[number];
export type GlciTargetStatus = 'planned' | 'active' | 'paused' | 'retired';
/** The five dates a legal change can carry; publication never implies commencement. */
export const LEGAL_DATE_KINDS = Object.freeze(['publication', 'enactment', 'effective', 'repeal', 'transitional'] as const);
export type LegalDateKind = (typeof LEGAL_DATE_KINDS)[number];

export interface GlciAuthorityRank {
  authorityType: string;
  rank: number;
  label?: string;
}
export interface GlciJurisdictionProfile {
  monitoringLanguages: string[];
  authorityHierarchy: GlciAuthorityRank[];
  publicationSchedule: Record<string, unknown>;
  effectiveDateRules: { publicationIsNotCommencement: true; dateKinds: LegalDateKind[]; [key: string]: unknown };
  reviewProcedure: { reviewerRole: 'knowledge_admin' | 'platform_admin'; [key: string]: unknown };
  checkIntervalMinutes: number;
  staleAfterHours: number;
  notes: string | null;
}
export interface GlciMonitoringTarget {
  targetKey: string;
  name: string;
  targetType: GlciTargetType;
  officialUri: string | null;
  sourceKey: string | null;
  sourceRights: string | null;
  monitorAdapter: string | null;
  status: GlciTargetStatus;
  /** Why the target may be active: an approved rights review, or a licence policy naming its host. */
  activationBasis: string | null;
  notes: string | null;
}
export interface GlciJurisdiction {
  code: string;
  name: string;
  status: string;
  officialLanguages: string[];
  profile: GlciJurisdictionProfile | null;
  targets: GlciMonitoringTarget[];
}

function fail(): never {
  throw new Error('GLCI_REGISTRY_RESPONSE_INVALID');
}
const isString = (v: unknown): v is string => typeof v === 'string';
const stringOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : isString(v) ? v : fail());

export function parseGlciRegistry(value: unknown): GlciJurisdiction[] {
  if (!Array.isArray(value)) fail();
  return value.map((item): GlciJurisdiction => {
    const row = item as Record<string, unknown>;
    if (!row || !isString(row.code) || !isString(row.name) || !isString(row.status) || !Array.isArray(row.targets)) fail();
    const profile = row.profile as Record<string, unknown> | null;
    if (profile !== null && (typeof profile !== 'object' || !Array.isArray(profile.authorityHierarchy) ||
        (profile.effectiveDateRules as Record<string, unknown> | undefined)?.publicationIsNotCommencement !== true)) fail();
    return {
      code: row.code,
      name: row.name,
      status: row.status,
      officialLanguages: Array.isArray(row.officialLanguages) ? row.officialLanguages.filter(isString) : [],
      profile: profile as GlciJurisdictionProfile | null,
      targets: (row.targets as Record<string, unknown>[]).map(target => {
        if (!isString(target.targetKey) || !isString(target.name) ||
            !(GLCI_TARGET_TYPES as readonly string[]).includes(String(target.targetType)) || !isString(target.status)) fail();
        return {
          targetKey: target.targetKey,
          name: target.name,
          targetType: target.targetType as GlciTargetType,
          officialUri: stringOrNull(target.officialUri),
          sourceKey: stringOrNull(target.sourceKey),
          sourceRights: stringOrNull(target.sourceRights),
          monitorAdapter: stringOrNull(target.monitorAdapter),
          status: target.status as GlciTargetStatus,
          activationBasis: stringOrNull(target.activationBasis),
          notes: stringOrNull(target.notes),
        };
      }),
    };
  });
}

/** Registry summary for the observatory: what is profiled, monitored and lawfully monitorable. */
export function summariseRegistry(jurisdictions: readonly GlciJurisdiction[]) {
  const targets = jurisdictions.flatMap(j => j.targets);
  return {
    jurisdictions: jurisdictions.length,
    profiled: jurisdictions.filter(j => j.profile !== null).length,
    targets: targets.length,
    activeTargets: targets.filter(t => t.status === 'active').length,
    activatableTargets: targets.filter(t => t.status !== 'active' && t.activationBasis !== null).length,
    awaitingRightsReview: targets.filter(t => t.activationBasis === null).length,
  };
}
