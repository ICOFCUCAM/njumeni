// Trusted evidence worker pipeline (service role). For each pending file: download the stored
// bytes, verify the declared SHA-256, scan, then extract passages, entities and chronology.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildChronology,
  buildPassages,
  extractEntities,
  fullText,
  sha256Hex,
} from './analysis.ts';
import { EXTRACTOR_VERSION, extractEvidenceText } from './extractors.ts';
import { scanEvidenceFile, type ExternalMalwareScanner } from './scanner.ts';

type WorkerClient = Pick<SupabaseClient, 'rpc' | 'storage'>;

interface PendingFile {
  evidence_file_id: string;
  storage_object_key: string;
  content_sha256: string;
  mime_type: string;
  scan_status: 'pending' | 'clean';
  needs_extraction: boolean;
}

export interface EvidencePipelineResult {
  processed: number;
  scanned: { clean: number; infected: number; rejected: number };
  extracted: { succeeded: number; unsupported: number; failed: number };
  errors: { fileId: string; code: string }[];
}

const BUCKET = 'njumeni-workspace-files';

async function download(client: WorkerClient, key: string): Promise<Uint8Array> {
  const { data, error } = await client.storage.from(BUCKET).download(key);
  if (error || !data) throw new Error('EVIDENCE_DOWNLOAD_FAILED');
  return new Uint8Array(await data.arrayBuffer());
}

export async function processPendingEvidence(options: {
  client: WorkerClient;
  limit?: number;
  externalScanner?: ExternalMalwareScanner;
}): Promise<EvidencePipelineResult> {
  const { client } = options;
  const result: EvidencePipelineResult = {
    processed: 0,
    scanned: { clean: 0, infected: 0, rejected: 0 },
    extracted: { succeeded: 0, unsupported: 0, failed: 0 },
    errors: [],
  };
  const { data, error } = await client.rpc('evidence_worker_pending_files', {
    p_limit: options.limit ?? 10,
  });
  if (error || !Array.isArray(data)) throw new Error('EVIDENCE_PENDING_QUERY_FAILED');

  for (const file of data as PendingFile[]) {
    result.processed += 1;
    try {
      const bytes = await download(client, file.storage_object_key);
      const observedSha256 = sha256Hex(bytes);
      let scanStatus = file.scan_status;
      let kind = undefined as Awaited<ReturnType<typeof scanEvidenceFile>>['kind'] | undefined;

      if (file.scan_status === 'pending') {
        const scan = await scanEvidenceFile(bytes, file.mime_type, options.externalScanner);
        kind = scan.kind;
        const recorded = await client.rpc('evidence_worker_record_scan', {
          p_evidence_file_id: file.evidence_file_id,
          p_verdict: scan.verdict,
          p_detail: scan.detail,
          p_observed_sha256: observedSha256,
        });
        if (recorded.error) throw new Error('EVIDENCE_SCAN_RECORD_FAILED');
        // The database rejects a clean verdict whose bytes do not match the declared hash.
        const effective =
          scan.verdict === 'clean' && observedSha256 !== file.content_sha256
            ? 'rejected'
            : scan.verdict;
        result.scanned[effective] += 1;
        if (effective !== 'clean') continue;
        scanStatus = 'clean';
      }
      if (scanStatus !== 'clean') continue;
      if (observedSha256 !== file.content_sha256) throw new Error('EVIDENCE_CONTENT_CHANGED');
      kind ??= (await scanEvidenceFile(bytes, file.mime_type)).kind;

      const outcome = await extractEvidenceText(kind, bytes);
      let payload: Record<string, unknown>;
      if (outcome.status === 'succeeded') {
        const passages = buildPassages(outcome.pages);
        payload = {
          p_status: 'succeeded',
          p_failure_code: null,
          p_text_sha256: sha256Hex(fullText(outcome.pages)),
          p_page_count: outcome.pages.length,
          p_passages: passages,
          p_entities: extractEntities(passages),
          p_events: buildChronology(passages),
        };
      } else {
        payload = {
          p_status: outcome.status,
          p_failure_code: outcome.failureCode,
          p_text_sha256: null,
          p_page_count: null,
          p_passages: [],
          p_entities: [],
          p_events: [],
        };
      }
      const stored = await client.rpc('evidence_worker_record_extraction', {
        p_evidence_file_id: file.evidence_file_id,
        p_extractor: outcome.extractor,
        p_extractor_version: EXTRACTOR_VERSION,
        ...payload,
      });
      if (stored.error) throw new Error('EVIDENCE_EXTRACTION_RECORD_FAILED');
      result.extracted[outcome.status] += 1;
    } catch (caught) {
      const code =
        caught instanceof Error && /^EVIDENCE_[A-Z_]+$/.test(caught.message)
          ? caught.message
          : 'EVIDENCE_PIPELINE_FAILED';
      result.errors.push({ fileId: file.evidence_file_id, code });
    }
  }
  return result;
}
