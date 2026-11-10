import {
  assertSourceIngestionAllowed,
  normaliseAuthority,
  createPassages,
  validateSourceManifest,
  validateSourceUri,
  type LegalSourceAdapter,
  type LegalSourceRights,
} from './contracts.ts';
import {classifyIngestionFailure,planIngestionBatch,type IngestionFailureClass} from './ingestion.ts';
import {assertLegalSourceCanIngest,type LegalSourceRightsEvidence} from './source-governance.ts';

export interface LegalIngestionPersistence {
  beginRun(input:{sourceKey:string;adapterKey:string;adapterVersion:string;batchKey:string;cursor:string|null}):Promise<{runId:string}>;
  appendAuthority(input:{
    sourceKey:string;jurisdictionCode:string|null;authority:ReturnType<typeof normaliseAuthority>;
    sourceUri:string;retrievedAt:string;normalisationProfile:string;passages:ReturnType<typeof createPassages>;lease?:{jobId:string;leaseToken:string};
  }):Promise<'created'|'unchanged'>;
  persistRunResult(input:{
    runId:string;status:'succeeded'|'partial'|'failed';
    discovered:number;created:number;unchanged:number;skipped:number;
    nextCursor:string|null;failureCodes:readonly string[];
  }):Promise<void>;
}
export interface LegalIngestionResult {
  runId:string;
  status:'succeeded'|'partial'|'failed';
  discovered:number;created:number;unchanged:number;skipped:number;
  nextCursor:string|null;
  failureCodes:string[];
}
export interface ExecuteIngestionOptions {
  adapter:LegalSourceAdapter;
  loadRights:()=>Promise<{rights:LegalSourceRights;rightsEvidence:LegalSourceRightsEvidence}>;
  persistence:LegalIngestionPersistence;
  cursor:string|null;
  maxBatchSize?:number;
  concurrency?:number;
  normalisationProfile:string;
  isCancelled?:()=>boolean;
  completedExternalIds?:readonly string[];
}
function errorCode(error:unknown):string {
  if(error instanceof Error&&/^[A-Z0-9_]{1,80}$/.test(error.message))return error.message;
  return 'INGESTION_UNEXPECTED_ERROR';
}
async function mapBounded<T,R>(items:readonly T[],concurrency:number,fn:(item:T)=>Promise<R>):Promise<R[]> {
  const results=new Array<R>(items.length);let next=0;
  const workers=Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(true){const index=next++;if(index>=items.length)return;const item=items[index]!;results[index]=await fn(item);}
  });
  await Promise.all(workers);return results;
}
export async function executeLegalIngestionBatch(options:ExecuteIngestionOptions):Promise<LegalIngestionResult> {
  validateSourceManifest(options.adapter.manifest);
  const initialRights=await options.loadRights();
  assertSourceIngestionAllowed(initialRights.rights);
  if(initialRights.rightsEvidence.sourceKey!==options.adapter.manifest.sourceKey)throw new Error('LEGAL_SOURCE_RIGHTS_SOURCE_MISMATCH');
  assertLegalSourceCanIngest({rightsStatus:initialRights.rights.rightsStatus,sourceStatus:initialRights.rights.sourceStatus,ingestionEnabled:initialRights.rights.ingestionEnabled},initialRights.rightsEvidence);
  if(!options.normalisationProfile.trim()||options.normalisationProfile.length>120)throw new Error('LEGAL_NORMALISATION_PROFILE_INVALID');
  const concurrency=options.concurrency??3;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>10)throw new Error('LEGAL_INGESTION_CONCURRENCY_INVALID');
  const discovery=await options.adapter.listChangedAuthorities(options.cursor);
  if(!discovery.complete&&discovery.nextCursor===options.cursor)throw new Error('LEGAL_INGESTION_CURSOR_DID_NOT_ADVANCE');
  const completed=new Set(options.completedExternalIds??[]);
  const remainingIds=discovery.externalIds.filter(id=>!completed.has(id));
  const batch=planIngestionBatch({
    manifest:options.adapter.manifest,rights:initialRights.rights,cursor:options.cursor,
    externalIds:remainingIds,maxBatchSize:options.maxBatchSize,
  });
  const {runId}=await options.persistence.beginRun({
    sourceKey:batch.sourceKey,adapterKey:options.adapter.manifest.adapterKey,adapterVersion:batch.adapterVersion,batchKey:batch.batchKey,cursor:batch.cursor,
  });
  let created=0,unchanged=0,skipped=0;
  const failures:string[]=[];
  const outcomes=await mapBounded(batch.items,concurrency,async item=>{
    if(options.isCancelled?.())return {kind:'cancelled' as const};
    try{
      // Reload rights from the trusted registry immediately before every upstream record fetch.
      const currentRights=await options.loadRights();
      assertSourceIngestionAllowed(currentRights.rights);
      if(currentRights.rightsEvidence.sourceKey!==options.adapter.manifest.sourceKey)throw new Error('LEGAL_SOURCE_RIGHTS_SOURCE_MISMATCH');
      assertLegalSourceCanIngest({rightsStatus:currentRights.rights.rightsStatus,sourceStatus:currentRights.rights.sourceStatus,ingestionEnabled:currentRights.rights.ingestionEnabled},currentRights.rightsEvidence);
      const fetched=await options.adapter.fetchAuthority(item.externalId);
      const sourceUri=validateSourceUri(fetched.sourceUri,options.adapter.manifest.allowedHosts);
      const retrievedAt=new Date(fetched.retrievedAt);
      if(Number.isNaN(retrievedAt.getTime()))throw new Error('LEGAL_SOURCE_RETRIEVAL_TIME_INVALID');
      const authority=normaliseAuthority(fetched.authority,fetched.sourceText,options.adapter.manifest.allowedHosts);
      if(authority.externalId!==item.externalId)throw new Error('LEGAL_SOURCE_EXTERNAL_ID_MISMATCH');
      const result=await options.persistence.appendAuthority({
        sourceKey:batch.sourceKey,jurisdictionCode:options.adapter.manifest.jurisdictionCode,
        authority,sourceUri,retrievedAt:retrievedAt.toISOString(),normalisationProfile:options.normalisationProfile,
        passages:createPassages(authority.normalisedText),
      });
      return {kind:result};
    }catch(error){
      const code=errorCode(error);const classification:IngestionFailureClass=classifyIngestionFailure(code);
      return {kind:classification==='skip'?'skipped' as const:'failed' as const,code};
    }
  });
  for(const outcome of outcomes){
    if(outcome.kind==='created')created++;
    else if(outcome.kind==='unchanged')unchanged++;
    else if(outcome.kind==='skipped')skipped++;
    else if(outcome.kind==='failed')failures.push(outcome.code);
    else if(outcome.kind==='cancelled')failures.push('CANCELLED');
  }
  const cancelled=failures.includes('CANCELLED');
  const status=failures.length===0?'succeeded':
    (created+unchanged+skipped)>0||cancelled?'partial':'failed';
  await options.persistence.persistRunResult({
    runId,status,discovered:discovery.externalIds.length,created,unchanged,skipped,
    nextCursor:discovery.nextCursor,failureCodes:[...new Set(failures)],
  });
  return {
    runId,status,discovered:discovery.externalIds.length,created,unchanged,skipped,
    nextCursor:discovery.nextCursor,failureCodes:[...new Set(failures)],
  };
}
