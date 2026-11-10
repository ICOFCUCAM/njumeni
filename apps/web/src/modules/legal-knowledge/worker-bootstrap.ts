import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LegalSourceAdapter } from './contracts.ts';
import type { LegalAdapterRegistry } from './adapter-registry.ts';
import { createSupabaseLegalIngestionPersistence } from './supabase-persistence.ts';
import { createSupabaseDurableIngestionQueue } from './durable-queue.ts';
import { runLegalIngestionWorkerProcess } from './worker-process.ts';
import { loadTrustedWorkerSourceConfig, type WorkerSourceConfigRpcClient } from './worker-source-config.ts';

function requiredEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) throw new Error('LEGAL_WORKER_ENV_MISSING_'+name);
  return value;
}

export interface WorkerBootstrapOptions {
  registry: LegalAdapterRegistry;
  env?: NodeJS.ProcessEnv;
  client?: SupabaseClient;
  writeLog?: (line: string) => void;
  maxJobs?: number;
}
export async function startTrustedLegalIngestionWorker(options: WorkerBootstrapOptions) {
  const env = options.env ?? process.env;
  const url = requiredEnv('SUPABASE_URL', env);
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY', env);
  const workerId = requiredEnv('LEGAL_INGESTION_WORKER_ID', env);
  const normalisationProfile = requiredEnv('LEGAL_NORMALISATION_PROFILE', env);
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(workerId)) throw new Error('LEGAL_WORKER_ID_INVALID');
  const client = options.client ?? createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Njumeni-Worker': workerId } },
  });
  const rpcClient = client as unknown as WorkerSourceConfigRpcClient;
  const resolveAdapter = async (key: string, version: string): Promise<LegalSourceAdapter | null> =>
    options.registry.resolve(key, version);
  const resolveRights = async (sourceId: string, sourceKey: string) => {
    const initial = await loadTrustedWorkerSourceConfig(rpcClient, sourceId, sourceKey);
    return {
      sourceId: initial.sourceId,
      load: async () => {
        const current = await loadTrustedWorkerSourceConfig(rpcClient, sourceId, sourceKey);
        return { rights: current.rights, rightsEvidence: current.evidence };
      },
    };
  };
  return runLegalIngestionWorkerProcess({
    queue: createSupabaseDurableIngestionQueue(client),
    persistence: createSupabaseLegalIngestionPersistence(client),
    resolveAdapter,
    resolveRights,
    workerId,
    normalisationProfile,
  }, {
    ...(options.maxJobs === undefined ? {} : { maxJobs: options.maxJobs }),
    ...(options.writeLog === undefined ? {} : { writeLog: options.writeLog }),
  });
}
