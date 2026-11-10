import type { SupabaseClient } from '@supabase/supabase-js';
import type { CitationSourceMetadata } from './citation-bundle.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;
function parseCitationMetadata(value: unknown): Readonly<Record<string, CitationSourceMetadata>> {
  if (!Array.isArray(value)) throw new Error('LEGAL_CITATION_METADATA_RESPONSE_INVALID');
  const output: Record<string, CitationSourceMetadata> = {};
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('LEGAL_CITATION_METADATA_RESPONSE_INVALID');
    const row = item as Record<string, unknown>;
    if (typeof row.sourceKey !== 'string' || typeof row.sourceName !== 'string' ||
        typeof row.issuingAuthority !== 'string' || typeof row.licenceIdentifier !== 'string' ||
        typeof row.attributionText !== 'string' ||
        !['review_required','approved','restricted','prohibited'].includes(String(row.rightsStatus)) ||
        typeof row.displayPermitted !== 'boolean' || typeof row.quotePermitted !== 'boolean') {
      throw new Error('LEGAL_CITATION_METADATA_RESPONSE_INVALID');
    }
    output[row.sourceKey] = row as unknown as CitationSourceMetadata;
  }
  return Object.freeze(output);
}
export async function loadLegalCitationSourceMetadata(
  client: RpcClient, sourceKeys: readonly string[],
): Promise<Readonly<Record<string, CitationSourceMetadata>>> {
  const keys = [...new Set(sourceKeys)].sort();
  if (!keys.length) return Object.freeze({});
  const { data, error } = await client.rpc('legal_citation_source_metadata', { p_source_keys: keys });
  if (error) throw new Error('LEGAL_CITATION_METADATA_LOAD_FAILED');
  return parseCitationMetadata(data);
}
