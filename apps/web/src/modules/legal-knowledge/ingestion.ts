import {
  assertSourceIngestionAllowed,
  sha256,
  validateSourceManifest,
  type LegalSourceManifest,
  type LegalSourceRights,
} from './contracts.ts';

export type IngestionRunStatus = 'queued'|'running'|'succeeded'|'partial'|'failed'|'cancelled';
export type IngestionFailureClass = 'retryable'|'terminal'|'skip';

const transitions:Record<IngestionRunStatus,readonly IngestionRunStatus[]> = {
  queued:['running','cancelled'],
  running:['succeeded','partial','failed','cancelled'],
  succeeded:[],
  partial:[],
  failed:[],
  cancelled:[],
};

export interface IngestionBatchInput {
  manifest:LegalSourceManifest;
  rights:LegalSourceRights;
  cursor:string|null;
  externalIds:readonly string[];
  maxBatchSize?:number;
}
export interface IngestionBatchItem {
  externalId:string;
  idempotencyKey:string;
}
export interface IngestionBatchPlan {
  batchKey:string;
  sourceKey:string;
  adapterVersion:string;
  cursor:string|null;
  items:IngestionBatchItem[];
}

export function transitionIngestionRun(current:IngestionRunStatus,next:IngestionRunStatus):IngestionRunStatus {
  if(!transitions[current].includes(next))throw new Error('LEGAL_INGESTION_STATE_TRANSITION_INVALID');
  return next;
}

export function classifyIngestionFailure(code:string):IngestionFailureClass {
  if(['RATE_LIMITED','NETWORK_TIMEOUT','UPSTREAM_5XX','UPSTREAM_UNAVAILABLE'].includes(code))return 'retryable';
  if(['SOURCE_RECORD_NOT_FOUND','DUPLICATE_SOURCE_RECORD'].includes(code))return 'skip';
  return 'terminal';
}

export function retryDelayMs(attempt:number,baseDelayMs=1000,maxDelayMs=60_000):number {
  if(!Number.isInteger(attempt)||attempt<1||attempt>20)throw new Error('LEGAL_INGESTION_ATTEMPT_INVALID');
  if(!Number.isInteger(baseDelayMs)||baseDelayMs<1||!Number.isInteger(maxDelayMs)||maxDelayMs<baseDelayMs) {
    throw new Error('LEGAL_INGESTION_RETRY_POLICY_INVALID');
  }
  return Math.min(maxDelayMs,baseDelayMs*2**(attempt-1));
}

export function planIngestionBatch(input:IngestionBatchInput):IngestionBatchPlan {
  validateSourceManifest(input.manifest);
  assertSourceIngestionAllowed(input.rights);
  const maxBatchSize=input.maxBatchSize??250;
  if(!Number.isInteger(maxBatchSize)||maxBatchSize<1||maxBatchSize>500) {
    throw new Error('LEGAL_INGESTION_BATCH_SIZE_INVALID');
  }
  const uniqueIds=[...new Set(input.externalIds)];
  if(uniqueIds.some(id=>!id||id.length>512||/[\u0000-\u001f]/.test(id))) {
    throw new Error('LEGAL_INGESTION_EXTERNAL_ID_INVALID');
  }
  if(uniqueIds.length>maxBatchSize)throw new Error('LEGAL_INGESTION_BATCH_TOO_LARGE');
  const orderedIds=[...uniqueIds].sort();
  const cursor=input.cursor??'';
  const batchKey=sha256([input.manifest.sourceKey,input.manifest.adapterVersion,cursor,...orderedIds].join('\n'));
  return {
    batchKey,
    sourceKey:input.manifest.sourceKey,
    adapterVersion:input.manifest.adapterVersion,
    cursor:input.cursor,
    items:orderedIds.map(externalId=>({
      externalId,
      idempotencyKey:sha256([input.manifest.sourceKey,input.manifest.adapterVersion,externalId].join('\n')),
    })),
  };
}
