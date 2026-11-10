import type { LegalSourceRights } from './contracts.ts';
import type { LegalSourceRightsEvidence } from './source-governance.ts';
import { assertLegalSourceCanIngest } from './source-governance.ts';

export interface SourceWorkerConfig {
  sourceId: string;
  sourceKey: string;
  rights: LegalSourceRights;
  evidence: LegalSourceRightsEvidence;
}
export interface WorkerSourceConfigRpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}
function parseSourceConfig(value: unknown): SourceWorkerConfig {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') throw new Error('LEGAL_WORKER_SOURCE_CONFIG_INVALID');
  const data = row as Record<string, unknown>;
  if (typeof data.source_id !== 'string' || typeof data.source_key !== 'string' ||
      !data.rights || typeof data.rights !== 'object' ||
      !data.evidence || typeof data.evidence !== 'object') {
    throw new Error('LEGAL_WORKER_SOURCE_CONFIG_INVALID');
  }
  return {
    sourceId: data.source_id, sourceKey: data.source_key,
    rights: data.rights as LegalSourceRights,
    evidence: data.evidence as LegalSourceRightsEvidence,
  };
}
export async function loadTrustedWorkerSourceConfig(
  client: WorkerSourceConfigRpcClient, sourceId: string, expectedSourceKey: string,
): Promise<SourceWorkerConfig> {
  const { data, error } = await client.rpc('legal_worker_source_config', { p_source_id: sourceId });
  if (error) throw new Error('LEGAL_WORKER_SOURCE_CONFIG_LOAD_FAILED');
  const config = parseSourceConfig(data);
  if (config.sourceId !== sourceId || config.sourceKey !== expectedSourceKey ||
      config.evidence.sourceKey !== expectedSourceKey) {
    throw new Error('LEGAL_WORKER_SOURCE_REGISTRY_MISMATCH');
  }
  assertLegalSourceCanIngest(config.rights, config.evidence);
  return config;
}
