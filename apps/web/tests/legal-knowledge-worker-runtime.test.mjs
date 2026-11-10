import test from 'node:test';
import assert from 'node:assert/strict';
import {processNextLegalIngestionJob,runLegalIngestionWorker} from '../src/modules/legal-knowledge/worker-runtime.ts';

const manifest={sourceKey:'lovdata-official',name:'Lovdata',issuingAuthority:'Lovdata',jurisdictionCode:'NO',sourceType:'legislation',baseUri:'https://lovdata.no/',allowedHosts:['lovdata.no'],accessMethod:'web',adapterKey:'lovdata',adapterVersion:'1.0.0'};
const rights={rightsStatus:'approved',sourceStatus:'active',ingestionEnabled:true,licenceIdentifier:'LIC',attributionText:'Attribution'};
const rightsEvidence={sourceKey:'lovdata-official',licenceIdentifier:'LIC',licenceVersion:'1',termsUri:'https://lovdata.no/terms',attributionText:'Attribution',reviewedBy:'reviewer',reviewedAt:'2026-11-01T10:00:00.000Z',permissions:{retrieve:true,store:true,normalise:true,index:true,quote:true,display:true,redistribute:false},restrictions:[],reviewExpiresAt:'2027-11-01T10:00:00.000Z'};
const lease={jobId:'job-1',sourceId:'source-1',adapterKey:'lovdata',adapterVersion:'1.0.0',cursor:null,checkpoint:{completedExternalIds:['NO:1'],created:1,unchanged:0,skipped:0,failures:0},leaseToken:'lease-token',attempt:2};
function setup(overrides={}){
 const calls={fetch:[],checkpoints:[],finishes:[],events:[]};
 const queue={
  claim:async()=>lease,heartbeat:async()=>true,
  saveCheckpoint:async(_lease,cp)=>{calls.checkpoints.push(cp);return true;},
  finish:async(_lease,status,code,delay)=>{calls.finishes.push({status,code,delay});return status==='failed'?(delay?'queued':'dead_letter'):status;},
 };
 const adapter={manifest,listChangedAuthorities:async()=>({externalIds:['NO:1','NO:2'],nextCursor:'cursor-2',complete:true}),
  fetchAuthority:async id=>{calls.fetch.push(id);if(id==='NO:2'&&overrides.rateLimit)throw new Error('RATE_LIMITED');return {authority:{externalId:id,title:'Example Act',authorityType:'act',languageCode:'no',canonicalUri:'https://lovdata.no/act/'+id},sourceText:'Legal text '+id,retrievedAt:'2026-11-10T10:00:00.000Z',sourceUri:'https://lovdata.no/act/'+id};}};
 const persistence={
  beginRun:async()=>({runId:'run-1'}),
  appendAuthority:async input=>{assert.equal(input.lease.jobId,'job-1');return 'created';},
  persistRunResult:async()=>{},
 };
 const deps={queue,persistence,resolveAdapter:async()=>adapter,
  resolveRights:async sourceId=>({sourceId,load:async()=>({rights,rightsEvidence})}),
  workerId:'worker-test',leaseSeconds:90,heartbeatIntervalMs:10000,normalisationProfile:'unicode-v1',
  onEvent:event=>calls.events.push(event)};
 return {deps,calls};
}
test('processes a claimed job and resumes from checkpointed external ids',async()=>{
 const h=setup();
 const result=await processNextLegalIngestionJob(h.deps);
 assert.equal(result.status,'succeeded');
 assert.deepEqual(h.calls.fetch,['NO:2']);
 assert.equal(h.calls.checkpoints.length,2);
 assert.deepEqual(h.calls.checkpoints.at(-1).completedExternalIds,['NO:1','NO:2']);
 assert.equal(h.calls.finishes[0].status,'succeeded');
});
test('retryable upstream failure returns job to queue with backoff',async()=>{
 const h=setup({rateLimit:true});
 const result=await processNextLegalIngestionJob(h.deps);
 assert.equal(result.status,'queued');
 assert.equal(h.calls.finishes[0].code,'RATE_LIMITED');
 assert.equal(h.calls.finishes[0].delay,2);
 assert.equal(h.calls.checkpoints.at(-1).cursor,null);
 assert.deepEqual(h.calls.checkpoints.at(-1).completedExternalIds,['NO:1']);
});
test('unregistered adapter is terminal and does not execute ingestion',async()=>{
 const h=setup();h.deps.resolveAdapter=async()=>null;
 const result=await processNextLegalIngestionJob(h.deps);
 assert.equal(result.status,'dead_letter');
 assert.equal(h.calls.fetch.length,0);
});
test('worker loop stops on abort and validates polling policy',async()=>{
 const h=setup();const controller=new AbortController();controller.abort();
 assert.deepEqual(await runLegalIngestionWorker(h.deps,{signal:controller.signal}),{processed:0,idlePolls:0});
 await assert.rejects(()=>runLegalIngestionWorker(h.deps,{maxJobs:0}),/LEGAL_INGESTION_MAX_JOBS_INVALID/);
});
