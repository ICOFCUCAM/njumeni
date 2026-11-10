import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegalIngestionPersistence } from './worker.ts';
import type { PassageDraft } from './contracts.ts';

type RpcClient=Pick<SupabaseClient,'rpc'>;
function rpcError(code:string,error:unknown):Error {
  return new Error(code,{cause:error});
}
export function createSupabaseLegalIngestionPersistence(client:RpcClient):LegalIngestionPersistence {
  return {
    async beginRun(input) {
      const {data,error}=await client.rpc('legal_ingestion_begin_run',{
        p_source_key:input.sourceKey,p_adapter_key:input.adapterKey,
        p_adapter_version:input.adapterVersion,p_cursor:input.cursor,p_batch_key:input.batchKey,
      });
      if(error)throw rpcError('LEGAL_INGESTION_BEGIN_RUN_FAILED',error);
      if(typeof data!=='string'||!data)throw new Error('LEGAL_INGESTION_BEGIN_RUN_RESPONSE_INVALID');
      return {runId:data};
    },
    async appendAuthority(input) {
      if(!input.lease)throw new Error('LEGAL_INGESTION_LEASE_REQUIRED');
      const passages:PassageDraft[]=input.passages;
      if(!passages.length)throw new Error('LEGAL_INGESTION_PASSAGES_REQUIRED');
      const {data,error}=await client.rpc('legal_ingestion_append_authority',{
        p_source_key:input.sourceKey,p_jurisdiction_code:input.jurisdictionCode,
        p_authority:input.authority as unknown as Record<string,unknown>,
        p_source_uri:input.sourceUri,p_retrieved_at:input.retrievedAt,
        p_normalisation_profile:input.normalisationProfile,
        p_passages:passages as unknown as Record<string,unknown>[],
        p_job_id:input.lease.jobId,p_lease_token:input.lease.leaseToken,
      });
      if(error)throw rpcError('LEGAL_INGESTION_APPEND_AUTHORITY_FAILED',error);
      if(data!=='created'&&data!=='unchanged')throw new Error('LEGAL_INGESTION_APPEND_AUTHORITY_RESPONSE_INVALID');
      for(const relationship of input.authority.relationships??[]){
        const {error:relationshipError}=await client.rpc('legal_ingestion_append_relationship',{
          p_source_key:input.sourceKey,
          p_from_external_id:input.authority.externalId,
          p_to_external_id:relationship.targetExternalId,
          p_relationship_type:relationship.relationshipType,
          p_effective_from:relationship.effectiveFrom,
          p_source_note:relationship.sourceNote,
          p_provenance_uri:relationship.provenanceUri??input.sourceUri,
          p_job_id:input.lease.jobId,
          p_lease_token:input.lease.leaseToken,
        });
        if(relationshipError)throw rpcError('LEGAL_INGESTION_APPEND_RELATIONSHIP_FAILED',relationshipError);
      }
      return data;
    },
    async persistRunResult(input) {
      const {data,error}=await client.rpc('legal_ingestion_persist_run_result',{
        p_run_id:input.runId,p_status:input.status,p_discovered:input.discovered,
        p_created:input.created,p_unchanged:input.unchanged,p_skipped:input.skipped,
        p_next_cursor:input.nextCursor,p_failure_codes:[...input.failureCodes],
      });
      if(error)throw rpcError('LEGAL_INGESTION_PERSIST_RUN_RESULT_FAILED',error);
      if(data!==true)throw new Error('LEGAL_INGESTION_PERSIST_RUN_RESULT_REJECTED');
    },
  };
}
