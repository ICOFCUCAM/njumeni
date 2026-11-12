// Trusted server/worker clients for the bitemporal as-of query (Task 2.2) and the
// database-backed authority graph (Task 2.6). Both RPCs are service-role only.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthorityGraphPath, AuthorityGraphTrace } from './authority-graph.ts';
import {
  LEGAL_AUTHORITY_RELATIONSHIP_TYPES,
  type LegalAuthorityRelationshipType,
} from './relationships.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AuthorityVersionAsOf {
  authorityVersionId: string;
  versionNumber: number;
  validFrom: string | null;
  validUntil: string | null;
  recordedAt: string;
  sourceUri: string | null;
  sourceContentHash: string;
  normalisedContentHash: string | null;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Returns the version in force on `validOn`, as known at `knownAt` (default: now), or null. */
export async function getAuthorityVersionAsOf(
  client: RpcClient,
  input: { authorityId: string; validOn: string; knownAt?: string },
): Promise<AuthorityVersionAsOf | null> {
  if (!UUID.test(input.authorityId)) throw new Error('LEGAL_AS_OF_AUTHORITY_INVALID');
  if (!isValidIsoDate(input.validOn)) throw new Error('LEGAL_AS_OF_DATE_INVALID');
  if (input.knownAt !== undefined && Number.isNaN(Date.parse(input.knownAt))) {
    throw new Error('LEGAL_AS_OF_KNOWN_AT_INVALID');
  }
  const { data, error } = await client.rpc('legal_authority_version_as_of', {
    p_authority_id: input.authorityId,
    p_valid_on: input.validOn,
    ...(input.knownAt ? { p_known_at: input.knownAt } : {}),
  });
  if (error) throw new Error('LEGAL_AS_OF_QUERY_FAILED');
  if (!Array.isArray(data)) throw new Error('LEGAL_AS_OF_RESPONSE_INVALID');
  if (data.length === 0) return null;
  const row = data[0] as Record<string, unknown>;
  if (
    typeof row.authority_version_id !== 'string' ||
    typeof row.version_number !== 'number' ||
    typeof row.recorded_at !== 'string' ||
    typeof row.source_content_hash !== 'string'
  ) {
    throw new Error('LEGAL_AS_OF_RESPONSE_INVALID');
  }
  return {
    authorityVersionId: row.authority_version_id,
    versionNumber: row.version_number,
    validFrom: typeof row.valid_from === 'string' ? row.valid_from : null,
    validUntil: typeof row.valid_until === 'string' ? row.valid_until : null,
    recordedAt: row.recorded_at,
    sourceUri: typeof row.source_uri === 'string' ? row.source_uri : null,
    sourceContentHash: row.source_content_hash,
    normalisedContentHash:
      typeof row.normalised_content_hash === 'string' ? row.normalised_content_hash : null,
  };
}

function parsePath(value: unknown): AuthorityGraphPath {
  const path = value as Record<string, unknown>;
  const ids = path?.authorityIds;
  const types = path?.relationshipTypes;
  const uris = path?.provenanceUris;
  if (
    !Array.isArray(ids) ||
    !Array.isArray(types) ||
    !Array.isArray(uris) ||
    ids.length !== types.length + 1 ||
    uris.length !== types.length ||
    !ids.every((id) => typeof id === 'string' && UUID.test(id)) ||
    !types.every((type) =>
      LEGAL_AUTHORITY_RELATIONSHIP_TYPES.includes(type as LegalAuthorityRelationshipType),
    ) ||
    !uris.every((uri) => uri === null || typeof uri === 'string')
  ) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_RESPONSE_INVALID');
  }
  return {
    authorityIds: ids as string[],
    relationshipTypes: types as LegalAuthorityRelationshipType[],
    provenanceUris: uris as (string | null)[],
  };
}

/** Database-backed equivalent of traceAuthorityGraph; results are identical for the same edges. */
export async function traceAuthorityGraphInDatabase(
  client: RpcClient,
  rootAuthorityId: string,
  options: {
    maxDepth?: number;
    maxNodes?: number;
    asOfDate?: string;
    relationshipTypes?: readonly LegalAuthorityRelationshipType[];
  } = {},
): Promise<AuthorityGraphTrace> {
  const maxDepth = options.maxDepth ?? 4;
  const maxNodes = options.maxNodes ?? 100;
  if (!UUID.test(rootAuthorityId)) throw new Error('LEGAL_AUTHORITY_GRAPH_ROOT_INVALID');
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > 12 ||
    !Number.isInteger(maxNodes) ||
    maxNodes < 1 ||
    maxNodes > 500
  ) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_LIMIT_INVALID');
  }
  if (options.asOfDate !== undefined && !isValidIsoDate(options.asOfDate)) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_DATE_INVALID');
  }
  const { data, error } = await client.rpc('legal_authority_graph', {
    p_root_authority_id: rootAuthorityId,
    p_max_depth: maxDepth,
    p_max_nodes: maxNodes,
    ...(options.asOfDate ? { p_as_of: options.asOfDate } : {}),
    ...(options.relationshipTypes ? { p_relationship_types: [...options.relationshipTypes] } : {}),
  });
  if (error) throw new Error('LEGAL_AUTHORITY_GRAPH_QUERY_FAILED');
  const trace = data as Record<string, unknown> | null;
  if (
    !trace ||
    trace.rootAuthorityId !== rootAuthorityId.toLowerCase() ||
    !Array.isArray(trace.relatedAuthorityIds) ||
    !trace.relatedAuthorityIds.every((id) => typeof id === 'string' && UUID.test(id)) ||
    !Array.isArray(trace.paths) ||
    typeof trace.truncated !== 'boolean'
  ) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_RESPONSE_INVALID');
  }
  return {
    rootAuthorityId: trace.rootAuthorityId,
    relatedAuthorityIds: trace.relatedAuthorityIds as string[],
    paths: trace.paths.map(parsePath),
    truncated: trace.truncated,
  };
}
