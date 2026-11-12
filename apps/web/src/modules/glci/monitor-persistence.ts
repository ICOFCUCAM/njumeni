import type { SupabaseClient } from '@supabase/supabase-js';
import type { MonitorPersistence, MonitorTarget } from './monitor.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;
interface ClaimRow {
  target_key: string; jurisdiction_code: string; monitor_adapter_key: string | null; official_uri: string | null;
  config: Record<string, unknown> | null; source_key: string | null; previous_fingerprint: string | null; lease_token: string;
}

/** Service-role persistence for the monitoring worker (glci_monitor_claim / glci_monitor_record). */
export function createSupabaseMonitorPersistence(client: RpcClient): MonitorPersistence {
  return {
    async claim(workerId, limit) {
      const { data, error } = await client.rpc('glci_monitor_claim', { p_worker_id: workerId, p_limit: limit, p_lease_seconds: 300 });
      if (error) throw new Error('GLCI_MONITOR_CLAIM_FAILED', { cause: error });
      if (!Array.isArray(data)) throw new Error('GLCI_MONITOR_CLAIM_RESPONSE_INVALID');
      return (data as ClaimRow[]).map((row): MonitorTarget => ({
        targetKey: row.target_key, jurisdictionCode: row.jurisdiction_code, monitorAdapterKey: row.monitor_adapter_key,
        officialUri: row.official_uri, config: row.config ?? {}, sourceKey: row.source_key,
        previousFingerprint: row.previous_fingerprint, leaseToken: row.lease_token,
      }));
    },
    async record(input) {
      const { data, error } = await client.rpc('glci_monitor_record', {
        p_target_key: input.targetKey, p_lease_token: input.leaseToken, p_fingerprint: input.fingerprint,
        p_observed: input.observed, p_failure_code: input.failureCode, p_failure_class: input.failureClass,
        p_duration_ms: input.durationMs,
      });
      if (error) throw new Error('GLCI_MONITOR_RECORD_FAILED', { cause: error });
      if (typeof data !== 'string') throw new Error('GLCI_MONITOR_RECORD_RESPONSE_INVALID');
      return data;
    },
  };
}
