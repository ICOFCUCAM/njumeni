// Worker-side embedding backfill: embeds passages from approved, active, enabled sources that
// have no embedding under the active profile. Runs only in the trusted worker (service role).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocalLegalEmbedder } from './local-embedder.ts';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

export interface EmbeddingBackfillResult {
  readonly profileKey: string;
  readonly batches: number;
  readonly passagesEmbedded: number;
  readonly drained: boolean;
  readonly centroidsRefreshed?: number;
}

interface PendingPassageRow {
  passage_id: string;
  content: string;
  language_code: string | null;
}

function parsePending(data: unknown): PendingPassageRow[] {
  if (!Array.isArray(data)) throw new Error('LEGAL_EMBEDDING_RESPONSE_INVALID');
  return data.map((item) => {
    const row = item as PendingPassageRow;
    if (!row || typeof row.passage_id !== 'string' || typeof row.content !== 'string') {
      throw new Error('LEGAL_EMBEDDING_RESPONSE_INVALID');
    }
    return row;
  });
}

export async function runEmbeddingBackfill(options: {
  client: RpcClient;
  embedder: LocalLegalEmbedder;
  batchSize?: number;
  maxBatches?: number;
}): Promise<EmbeddingBackfillResult> {
  const { client, embedder } = options;
  const batchSize = options.batchSize ?? 32;
  const maxBatches = options.maxBatches ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64) {
    throw new Error('LEGAL_EMBEDDING_BATCH_SIZE_INVALID');
  }
  if (!Number.isInteger(maxBatches) || maxBatches < 1) {
    throw new Error('LEGAL_EMBEDDING_MAX_BATCHES_INVALID');
  }
  const profileKey = embedder.profile.profileKey;
  // Authority routing reads one centroid per act version: recompute them once the queue drains.
  const refresh = async () => {
    const centroids = await client.rpc('legal_refresh_authority_centroids', { p_profile_key: profileKey });
    if (centroids.error || typeof centroids.data !== 'number') throw new Error('LEGAL_EMBEDDING_CENTROIDS_FAILED');
    return { centroidsRefreshed: centroids.data };
  };
  let batches = 0;
  let passagesEmbedded = 0;

  while (batches < maxBatches) {
    const pending = await client.rpc('legal_embedding_pending_passages', {
      p_profile_key: profileKey,
      p_limit: batchSize,
    });
    if (pending.error) throw new Error('LEGAL_EMBEDDING_PENDING_FAILED');
    const rows = parsePending(pending.data);
    if (rows.length === 0) return { profileKey, batches, passagesEmbedded, drained: true, ...(await refresh()) };

    const vectors = await embedder.embedPassages(rows.map((row) => row.content));
    const stored = await client.rpc('legal_embedding_store', {
      p_profile_key: profileKey,
      p_embeddings: rows.map((row, index) => ({
        passage_id: row.passage_id,
        embedding: vectors[index],
      })),
    });
    if (stored.error || stored.data !== rows.length) {
      throw new Error('LEGAL_EMBEDDING_STORE_FAILED');
    }
    batches += 1;
    passagesEmbedded += rows.length;
    if (rows.length < batchSize) return { profileKey, batches, passagesEmbedded, drained: true, ...(await refresh()) };
  }
  return { profileKey, batches, passagesEmbedded, drained: false };
}
