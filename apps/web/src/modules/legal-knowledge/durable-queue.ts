import type { SupabaseClient } from '@supabase/supabase-js';

export interface DurableIngestionLease {
  jobId:string; sourceId:string; adapterKey:string; adapterVersion:string;
  cursor:string|null; checkpoint:Record<string,unknown>; leaseToken:string; attempt:number;
}
export interface DurableCheckpoint {
  cursor:string|null; completedExternalIds:readonly string[];
  discovered:number; created:number; unchanged:number; skipped:number; failures:number;
}
export interface DurableQueue {
  claim(workerId:string,leaseSeconds?:number):Promise<DurableIngestionLease|null>;
  heartbeat(lease:DurableIngestionLease,leaseSeconds?:number):Promise<boolean>;
  saveCheckpoint(lease:DurableIngestionLease,checkpoint:DurableCheckpoint):Promise<boolean>;
  finish(lease:DurableIngestionLease,status:'succeeded'|'partial'|'failed'|'cancelled',
    failureCode?:string|null,retryDelaySeconds?:number|null):Promise<'succeeded'|'partial'|'failed'|'cancelled'|'queued'|'dead_letter'|'lease_lost'>;
}
type RpcClient=Pick<SupabaseClient,'rpc'>;
function requiredString(value:unknown,code:string):string {
  if(typeof value!=='string'||!value.trim())throw new Error(code);
  return value;
}
function nullableString(value:unknown):string|null {
  return typeof value==='string'?value:null;
}
function objectValue(value:unknown):Record<string,unknown> {
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
export function createSupabaseDurableIngestionQueue(client:RpcClient):DurableQueue {
  return {
    async claim(workerId,leaseSeconds=90) {
      const {data,error}=await client.rpc('legal_ingestion_claim_job',{
        p_worker_id:workerId,p_lease_seconds:leaseSeconds,
      });
      if(error)throw new Error('LEGAL_INGESTION_CLAIM_FAILED',{cause:error});
      const row=Array.isArray(data)?data[0]:null;
      if(!row)return null;
      const value=row as Record<string,unknown>;
      return {
        jobId:requiredString(value.job_id,'LEGAL_INGESTION_CLAIM_RESPONSE_INVALID'),
        sourceId:requiredString(value.source_id,'LEGAL_INGESTION_CLAIM_RESPONSE_INVALID'),
        adapterKey:requiredString(value.adapter_key,'LEGAL_INGESTION_CLAIM_RESPONSE_INVALID'),
        adapterVersion:requiredString(value.adapter_version,'LEGAL_INGESTION_CLAIM_RESPONSE_INVALID'),
        cursor:nullableString(value.cursor_reference),checkpoint:objectValue(value.checkpoint),
        leaseToken:requiredString(value.lease_token,'LEGAL_INGESTION_CLAIM_RESPONSE_INVALID'),
        attempt:Number(value.attempt_count),
      };
    },
    async heartbeat(lease,leaseSeconds=90) {
      const {data,error}=await client.rpc('legal_ingestion_heartbeat',{
        p_job_id:lease.jobId,p_lease_token:lease.leaseToken,p_lease_seconds:leaseSeconds,
      });
      if(error)throw new Error('LEGAL_INGESTION_HEARTBEAT_FAILED',{cause:error});
      return data===true;
    },
    async saveCheckpoint(lease,checkpoint) {
      const {data,error}=await client.rpc('legal_ingestion_save_checkpoint',{
        p_job_id:lease.jobId,p_lease_token:lease.leaseToken,p_cursor:checkpoint.cursor,
        p_completed_external_ids:[...checkpoint.completedExternalIds],
        p_discovered:checkpoint.discovered,p_created:checkpoint.created,
        p_unchanged:checkpoint.unchanged,p_skipped:checkpoint.skipped,p_failures:checkpoint.failures,
      });
      if(error)throw new Error('LEGAL_INGESTION_CHECKPOINT_FAILED',{cause:error});
      return data===true;
    },
    async finish(lease,status,failureCode=null,retryDelaySeconds=null) {
      const {data,error}=await client.rpc('legal_ingestion_finish_job',{
        p_job_id:lease.jobId,p_lease_token:lease.leaseToken,p_status:status,
        p_failure_code:failureCode,p_retry_delay_seconds:retryDelaySeconds,
      });
      if(error)throw new Error('LEGAL_INGESTION_FINISH_FAILED',{cause:error});
      const allowed=new Set(['succeeded','partial','failed','cancelled','queued','dead_letter','lease_lost']);
      if(typeof data!=='string'||!allowed.has(data))throw new Error('LEGAL_INGESTION_FINISH_RESPONSE_INVALID');
      return data as Awaited<ReturnType<DurableQueue['finish']>>;
    },
  };
}
