import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseDurableIngestionQueue} from '../src/modules/legal-knowledge/durable-queue.ts';

function fakeClient(responses){
  const calls=[];
  return {calls,rpc:async(name,args)=>{calls.push({name,args});const value=responses.shift();return value??{data:null,error:null};}};
}
test('claim maps a durable lease and empty queue to null',async()=>{
  const client=fakeClient([{data:[{job_id:'job-1',source_id:'source-1',adapter_key:'adapter',adapter_version:'1.0',cursor_reference:'cursor-2',checkpoint:{done:2},lease_token:'token',attempt_count:3}],error:null},{data:[],error:null}]);
  const queue=createSupabaseDurableIngestionQueue(client);
  const lease=await queue.claim('worker-a');
  assert.equal(lease?.jobId,'job-1');assert.equal(lease?.attempt,3);assert.equal(lease?.cursor,'cursor-2');
  assert.equal(await queue.claim('worker-a'),null);
  assert.equal(client.calls[0].name,'legal_ingestion_claim_job');
});
test('heartbeat and checkpoint return false after lease loss',async()=>{
  const client=fakeClient([{data:false,error:null},{data:false,error:null}]);
  const queue=createSupabaseDurableIngestionQueue(client);
  const lease={jobId:'job',sourceId:'source',adapterKey:'adapter',adapterVersion:'1',cursor:null,checkpoint:{},leaseToken:'token',attempt:1};
  assert.equal(await queue.heartbeat(lease),false);
  assert.equal(await queue.saveCheckpoint(lease,{cursor:'next',completedExternalIds:['a'],discovered:1,created:1,unchanged:0,skipped:0,failures:0}),false);
});
test('queue surfaces RPC errors without pretending success',async()=>{
  const client=fakeClient([{data:null,error:{message:'denied'}}]);
  const queue=createSupabaseDurableIngestionQueue(client);
  await assert.rejects(()=>queue.claim('worker-a'),/LEGAL_INGESTION_CLAIM_FAILED/);
});
test('finish validates server response',async()=>{
  const client=fakeClient([{data:'queued',error:null},{data:'unexpected',error:null}]);
  const queue=createSupabaseDurableIngestionQueue(client);
  const lease={jobId:'job',sourceId:'source',adapterKey:'adapter',adapterVersion:'1',cursor:null,checkpoint:{},leaseToken:'token',attempt:1};
  assert.equal(await queue.finish(lease,'failed','UPSTREAM_TIMEOUT',30),'queued');
  await assert.rejects(()=>queue.finish(lease,'succeeded'),/LEGAL_INGESTION_FINISH_RESPONSE_INVALID/);
});
