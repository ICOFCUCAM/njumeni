import assert from 'node:assert/strict';
import test from 'node:test';
import {planIngestionBatch,retryDelayMs,classifyIngestionFailure,transitionIngestionRun} from '../src/modules/legal-knowledge/ingestion.ts';

const manifest={sourceKey:'lovdata-official',name:'Lovdata',issuingAuthority:'Lovdata',jurisdictionCode:'NO',sourceType:'legislation',baseUri:'https://lovdata.no/',allowedHosts:['lovdata.no'],accessMethod:'web',adapterKey:'lovdata',adapterVersion:'1.0.0'};
const rights={rightsStatus:'approved',sourceStatus:'active',ingestionEnabled:true,licenceIdentifier:'TEST-LICENCE-1',attributionText:'Attribution'};
const input={manifest,rights,cursor:'cursor-1',externalIds:['NO:3','NO:1','NO:2','NO:1']};

test('plans deterministic, sorted and de-duplicated ingestion batches',()=>{
  const first=planIngestionBatch(input);const second=planIngestionBatch({...input,externalIds:['NO:2','NO:3','NO:1']});
  assert.equal(first.batchKey,second.batchKey);assert.deepEqual(first.items.map(x=>x.externalId),['NO:1','NO:2','NO:3']);
  assert.equal(first.items[0].idempotencyKey,second.items[0].idempotencyKey);
});
test('batch plan changes when source cursor or adapter version changes',()=>{
  const first=planIngestionBatch(input);
  assert.notEqual(first.batchKey,planIngestionBatch({...input,cursor:'cursor-2'}).batchKey);
  assert.notEqual(first.batchKey,planIngestionBatch({...input,manifest:{...manifest,adapterVersion:'1.1.0'}}).batchKey);
});
test('requires source rights approval before creating ingestion plan',()=>{
  assert.throws(()=>planIngestionBatch({...input,rights:{...rights,rightsStatus:'review_required'}}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
});
test('rejects oversized batches and unsafe external identifiers',()=>{
  assert.throws(()=>planIngestionBatch({...input,maxBatchSize:2}),/LEGAL_INGESTION_BATCH_TOO_LARGE/);
  assert.throws(()=>planIngestionBatch({...input,externalIds:['bad\nidentifier']}),/LEGAL_INGESTION_EXTERNAL_ID_INVALID/);
});
test('enforces legal ingestion state transitions and terminal states',()=>{
  assert.equal(transitionIngestionRun('queued','running'),'running');
  assert.equal(transitionIngestionRun('running','partial'),'partial');
  assert.throws(()=>transitionIngestionRun('queued','succeeded'),/LEGAL_INGESTION_STATE_TRANSITION_INVALID/);
  assert.throws(()=>transitionIngestionRun('succeeded','running'),/LEGAL_INGESTION_STATE_TRANSITION_INVALID/);
});
test('classifies transient, skippable and terminal ingestion failures',()=>{
  assert.equal(classifyIngestionFailure('RATE_LIMITED'),'retryable');
  assert.equal(classifyIngestionFailure('SOURCE_RECORD_NOT_FOUND'),'skip');
  assert.equal(classifyIngestionFailure('SCHEMA_VALIDATION_FAILED'),'terminal');
});
test('calculates bounded exponential retry delays',()=>{
  assert.equal(retryDelayMs(1),1000);assert.equal(retryDelayMs(3),4000);assert.equal(retryDelayMs(9),60000);
  assert.throws(()=>retryDelayMs(0),/LEGAL_INGESTION_ATTEMPT_INVALID/);
});
