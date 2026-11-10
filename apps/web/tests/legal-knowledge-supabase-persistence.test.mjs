import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseLegalIngestionPersistence} from '../src/modules/legal-knowledge/supabase-persistence.ts';

function client(responses){const calls=[];return {calls,rpc:async(name,args)=>{calls.push({name,args});return responses.shift()??{data:null,error:null};}};}
test('begins a source run through the trusted RPC and validates its id',async()=>{
  const db=client([{data:'run-1',error:null},{data:null,error:null}]);
  const persistence=createSupabaseLegalIngestionPersistence(db);
  assert.deepEqual(await persistence.beginRun({sourceKey:'source',adapterKey:'adapter',adapterVersion:'1.0',batchKey:'batch',cursor:null}),{runId:'run-1'});
  assert.equal(db.calls[0].name,'legal_ingestion_begin_run');
  await assert.rejects(()=>persistence.persistRunResult({runId:'run-1',status:'succeeded',discovered:1,created:1,unchanged:0,skipped:0,nextCursor:null,failureCodes:[]}),/LEGAL_INGESTION_PERSIST_RUN_RESULT_REJECTED/);
});
test('appends passage payload and accepts only explicit persistence outcomes',async()=>{
  const db=client([{data:'created',error:null},{data:'duplicate',error:null}]);
  const persistence=createSupabaseLegalIngestionPersistence(db);
  const input={sourceKey:'source',jurisdictionCode:'NO',authority:{externalId:'NO:1',title:'Act',sourceContentHash:'a'.repeat(64),normalisedText:'text'},sourceUri:'https://official.example/act',retrievedAt:'2026-11-10T10:00:00.000Z',normalisationProfile:'unicode-v1',lease:{jobId:'job-1',leaseToken:'lease-1'},passages:[{ordinal:0,startOffset:0,endOffset:4,content:'text',contentHash:'b'.repeat(64)}]};
  assert.equal(await persistence.appendAuthority(input),'created');
  assert.equal(db.calls[0].args.p_passages.length,1);
  assert.equal(db.calls[0].args.p_job_id,'job-1');
  await assert.rejects(()=>persistence.appendAuthority(input),/LEGAL_INGESTION_APPEND_AUTHORITY_RESPONSE_INVALID/);
});
test('propagates database errors with stable error codes',async()=>{
  const db=client([{data:null,error:{message:'forbidden'}}]);
  const persistence=createSupabaseLegalIngestionPersistence(db);
  await assert.rejects(()=>persistence.beginRun({sourceKey:'source',adapterKey:'adapter',adapterVersion:'1',batchKey:'batch',cursor:null}),/LEGAL_INGESTION_BEGIN_RUN_FAILED/);
});
