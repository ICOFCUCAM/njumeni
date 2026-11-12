import type { LegalSourceAdapter, LegalSourceRights } from './contracts.ts';
import type { LegalSourceRightsEvidence } from './source-governance.ts';
import { classifyIngestionFailure, retryDelayMs } from './ingestion.ts';
import { executeLegalIngestionBatch, type LegalIngestionPersistence } from './worker.ts';
import type { DurableIngestionLease, DurableQueue } from './durable-queue.ts';

export interface WorkerSourceRights {
  sourceId:string;
  load:()=>Promise<{rights:LegalSourceRights;rightsEvidence:LegalSourceRightsEvidence}>;
}
export interface LegalIngestionWorkerDependencies {
  queue:DurableQueue;
  persistence:LegalIngestionPersistence;
  resolveAdapter:(adapterKey:string,adapterVersion:string)=>Promise<LegalSourceAdapter|null>;
  resolveRights:(sourceId:string,sourceKey:string)=>Promise<WorkerSourceRights|null>;
  workerId:string;
  leaseSeconds?:number;
  heartbeatIntervalMs?:number;
  normalisationProfile:string;
  maxBatchSize?:number;
  concurrency?:number;
  onEvent?:(event:WorkerEvent)=>void;
}
export type WorkerEvent =
  | {type:'claimed';jobId:string;attempt:number}
  | {type:'heartbeat_lost';jobId:string}
  | {type:'checkpoint_saved';jobId:string;completed:number}
  | {type:'finished';jobId:string;status:string;created:number;unchanged:number}
  | {type:'failed';jobId:string;code:string;queueStatus:string};
export interface WorkerStepResult {
  claimed:boolean;
  jobId?:string;
  status?:string;
  created?:number;
  unchanged?:number;
}
function checkpointNumber(value:unknown):number {
  return Number.isSafeInteger(value)&&Number(value)>=0?Number(value):0;
}
function checkpointIds(value:unknown):string[] {
  return Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&x.length>0):[];
}
function errorCode(error:unknown):string {
  if(error instanceof Error&&/^[A-Z0-9_]{1,80}$/.test(error.message))return error.message;
  return 'INGESTION_WORKER_UNEXPECTED_ERROR';
}
async function failClaimedJob(
  deps:LegalIngestionWorkerDependencies,lease:DurableIngestionLease,error:unknown,
):Promise<WorkerStepResult> {
  const code=errorCode(error);
  const retryable=classifyIngestionFailure(code)==='retryable';
  const status=await deps.queue.finish(lease,'failed',code,retryable?Math.ceil(retryDelayMs(lease.attempt)/1000):null);
  deps.onEvent?.({type:'failed',jobId:lease.jobId,code,queueStatus:status});
  return {claimed:true,jobId:lease.jobId,status};
}
async function wait(ms:number,signal?:AbortSignal):Promise<void> {
  if(signal?.aborted)return;
  await new Promise<void>(resolve=>{
    const timer=setTimeout(done,ms);
    function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}
    signal?.addEventListener('abort',done,{once:true});
  });
}
export async function processNextLegalIngestionJob(
  deps:LegalIngestionWorkerDependencies,
):Promise<WorkerStepResult> {
  const lease=await deps.queue.claim(deps.workerId,deps.leaseSeconds??90);
  if(!lease)return {claimed:false};
  deps.onEvent?.({type:'claimed',jobId:lease.jobId,attempt:lease.attempt});
  return processClaimedLease(deps,lease);
}
async function processClaimedLease(
  deps:LegalIngestionWorkerDependencies,lease:DurableIngestionLease,
):Promise<WorkerStepResult> {
  let leaseLost=false;
  let heartbeatBusy=false;
  const leaseSeconds=deps.leaseSeconds??90;
  if(!Number.isInteger(leaseSeconds)||leaseSeconds<15||leaseSeconds>900)
    throw new Error('LEGAL_INGESTION_LEASE_DURATION_INVALID');
  const heartbeatMs=deps.heartbeatIntervalMs??Math.max(5000,Math.floor(leaseSeconds*1000/3));
  if(!Number.isInteger(heartbeatMs)||heartbeatMs<1000||heartbeatMs>=leaseSeconds*1000)
    throw new Error('LEGAL_INGESTION_HEARTBEAT_INTERVAL_INVALID');
  // Renew immediately after claim, including while adapter and rights registries are resolving.
  const heartbeat=setInterval(async()=>{
    if(heartbeatBusy||leaseLost)return;
    heartbeatBusy=true;
    try{
      if(!await deps.queue.heartbeat(lease,leaseSeconds)){
        leaseLost=true;deps.onEvent?.({type:'heartbeat_lost',jobId:lease.jobId});
      }
    }catch{
      leaseLost=true;deps.onEvent?.({type:'heartbeat_lost',jobId:lease.jobId});
    }finally{heartbeatBusy=false;}
  },heartbeatMs);
  try{
    let adapter:LegalSourceAdapter|null;
    try{adapter=await deps.resolveAdapter(lease.adapterKey,lease.adapterVersion);}
    catch(error){return failClaimedJob(deps,lease,error);}
    if(leaseLost)return {claimed:true,jobId:lease.jobId,status:'lease_lost'};
    if(!adapter) {
      const code='LEGAL_INGESTION_ADAPTER_NOT_REGISTERED';
      const status=await deps.queue.finish(lease,'failed',code);
      deps.onEvent?.({type:'failed',jobId:lease.jobId,code,queueStatus:status});
      return {claimed:true,jobId:lease.jobId,status};
    }
    if(adapter.manifest.adapterKey!==lease.adapterKey||adapter.manifest.adapterVersion!==lease.adapterVersion)
      return failClaimedJob(deps,lease,new Error('LEGAL_INGESTION_ADAPTER_VERSION_MISMATCH'));
    let rights:WorkerSourceRights|null;
    try{rights=await deps.resolveRights(lease.sourceId,adapter.manifest.sourceKey);}
    catch(error){return failClaimedJob(deps,lease,error);}
    if(leaseLost)return {claimed:true,jobId:lease.jobId,status:'lease_lost'};
    if(!rights||rights.sourceId!==lease.sourceId) {
      const code='LEGAL_INGESTION_SOURCE_REGISTRY_MISMATCH';
      const status=await deps.queue.finish(lease,'failed',code);
      deps.onEvent?.({type:'failed',jobId:lease.jobId,code,queueStatus:status});
      return {claimed:true,jobId:lease.jobId,status};
    }
    const completed=new Set(checkpointIds(lease.checkpoint.completedExternalIds));
    const counts={
      discovered:checkpointNumber(lease.checkpoint.discovered),
      created:checkpointNumber(lease.checkpoint.created),
      unchanged:checkpointNumber(lease.checkpoint.unchanged),
      skipped:checkpointNumber(lease.checkpoint.skipped),
      failures:checkpointNumber(lease.checkpoint.failures),
    };
    const base=deps.persistence;
    const leaseRef={jobId:lease.jobId,leaseToken:lease.leaseToken};
    const persistence:LegalIngestionPersistence={
      beginRun:input=>base.beginRun(input),
      persistRunResult:input=>base.persistRunResult(input),
      ...(base.dueItemRetries?{dueItemRetries:(sourceKey:string)=>base.dueItemRetries!(sourceKey)}:{}),
      ...(base.lastDatasetSync?{lastDatasetSync:(sourceKey:string,dataset:string)=>base.lastDatasetSync!(sourceKey,dataset)}:{}),
      ...(base.recordItemOutcome?{recordItemOutcome:(input:Parameters<NonNullable<LegalIngestionPersistence['recordItemOutcome']>>[0])=>
        base.recordItemOutcome!({...input,lease:leaseRef})}:{}),
      ...(base.completeDatasetSync?{completeDatasetSync:(input:Parameters<NonNullable<LegalIngestionPersistence['completeDatasetSync']>>[0])=>{
        if(leaseLost)throw new Error('LEGAL_INGESTION_LEASE_LOST');
        return base.completeDatasetSync!({...input,lease:leaseRef});
      }}:{}),
      appendAuthority:async input=>{
        if(leaseLost)throw new Error('LEGAL_INGESTION_LEASE_LOST');
        const outcome=await base.appendAuthority({...input,lease:{jobId:lease.jobId,leaseToken:lease.leaseToken}});
        completed.add(input.authority.externalId);
        if(outcome==='created')counts.created++;else counts.unchanged++;
        const saved=await deps.queue.saveCheckpoint(lease,{
          cursor:lease.cursor,completedExternalIds:[...completed].sort(),
          discovered:counts.discovered,created:counts.created,unchanged:counts.unchanged,
          skipped:counts.skipped,failures:counts.failures,
        });
        if(!saved){leaseLost=true;throw new Error('LEGAL_INGESTION_LEASE_LOST');}
        deps.onEvent?.({type:'checkpoint_saved',jobId:lease.jobId,completed:completed.size});
        return outcome;
      },
    };
    try{
      const result=await executeLegalIngestionBatch({
        adapter,loadRights:rights.load,persistence,cursor:lease.cursor,
        normalisationProfile:deps.normalisationProfile,
        completedExternalIds:[...completed],isCancelled:()=>leaseLost,
        ...(deps.maxBatchSize===undefined?{}:{maxBatchSize:deps.maxBatchSize}),
        ...(deps.concurrency===undefined?{}:{concurrency:deps.concurrency}),
      });
      if(leaseLost)return {claimed:true,jobId:lease.jobId,status:'lease_lost'};
      counts.discovered=result.discovered;counts.skipped=result.skipped;counts.failures=result.failureCodes.length;
      const retryable=result.failureCodes.some(code=>classifyIngestionFailure(code)==='retryable');
      const checkpointSaved=await deps.queue.saveCheckpoint(lease,{
        cursor:retryable?lease.cursor:result.nextCursor,completedExternalIds:[...completed].sort(),
        discovered:counts.discovered,created:counts.created,unchanged:counts.unchanged,
        skipped:counts.skipped,failures:counts.failures,
      });
      if(!checkpointSaved)return {claimed:true,jobId:lease.jobId,status:'lease_lost'};
      const queueStatus=await deps.queue.finish(
        lease,
        result.status==='succeeded'?'succeeded':
          result.status==='partial'&&!retryable?'partial':
          result.failureCodes.includes('CANCELLED')?'cancelled':'failed',
        result.failureCodes[0]??null,
        retryable?Math.ceil(retryDelayMs(lease.attempt)/1000):null,
      );
      deps.onEvent?.({type:'finished',jobId:lease.jobId,status:queueStatus,created:result.created,unchanged:result.unchanged});
      return {claimed:true,jobId:lease.jobId,status:queueStatus,created:result.created,unchanged:result.unchanged};
    }catch(error){
      const code=errorCode(error);
      if(leaseLost)return {claimed:true,jobId:lease.jobId,status:'lease_lost'};
      const retryable=classifyIngestionFailure(code)==='retryable';
      const queueStatus=await deps.queue.finish(lease,'failed',code,retryable?Math.ceil(retryDelayMs(lease.attempt)/1000):null);
      deps.onEvent?.({type:'failed',jobId:lease.jobId,code,queueStatus});
      return {claimed:true,jobId:lease.jobId,status:queueStatus};
    }
  }finally{
    clearInterval(heartbeat);
  }
}
export async function runLegalIngestionWorker(
  deps:LegalIngestionWorkerDependencies,
  options:{signal?:AbortSignal;maxJobs?:number;idleDelayMs?:number}={},
):Promise<{processed:number;idlePolls:number}> {
  const maxJobs=options.maxJobs??Number.POSITIVE_INFINITY;
  if(!(maxJobs===Number.POSITIVE_INFINITY||(Number.isInteger(maxJobs)&&maxJobs>=1)))throw new Error('LEGAL_INGESTION_MAX_JOBS_INVALID');
  const idleDelay=options.idleDelayMs??2000;
  if(!Number.isInteger(idleDelay)||idleDelay<100||idleDelay>60000)throw new Error('LEGAL_INGESTION_IDLE_DELAY_INVALID');
  let processed=0,idlePolls=0;
  while(!options.signal?.aborted&&processed<maxJobs){
    const result=await processNextLegalIngestionJob(deps);
    if(result.claimed)processed++;
    else {idlePolls++;await wait(idleDelay,options.signal);}
  }
  return {processed,idlePolls};
}
