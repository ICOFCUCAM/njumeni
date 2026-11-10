import assert from 'node:assert/strict';
import test from 'node:test';
import {executeLegalIngestionBatch} from '../src/modules/legal-knowledge/worker.ts';

const manifest={sourceKey:'lovdata-official',name:'Lovdata',issuingAuthority:'Lovdata',jurisdictionCode:'NO',sourceType:'legislation',baseUri:'https://lovdata.no/',allowedHosts:['lovdata.no'],accessMethod:'web',adapterKey:'lovdata',adapterVersion:'1.0.0'};
const rights={rightsStatus:'approved',sourceStatus:'active',ingestionEnabled:true,licenceIdentifier:'TEST-LICENCE',attributionText:'Attribution'};
const rightsEvidence={sourceKey:'lovdata-official',licenceIdentifier:'TEST-LICENCE',licenceVersion:'1',termsUri:'https://lovdata.no/terms',attributionText:'Attribution',reviewedBy:'reviewer',reviewedAt:'2026-11-01T10:00:00.000Z',permissions:{retrieve:true,store:true,normalise:true,index:true,quote:true,display:true,redistribute:false},restrictions:[],reviewExpiresAt:'2027-11-01T10:00:00.000Z'};

const authority=id=>({externalId:id,title:'Example Act',authorityType:'act',languageCode:'no',canonicalUri:'https://lovdata.no/act/'+encodeURIComponent(id)});
function harness({ids=['NO:1','NO:2'],failId=null,cancel=false}={}){
  const writes=[];const runs=[];
  const adapter={manifest,listChangedAuthorities:async cursor=>({externalIds:ids,nextCursor:'next-1',complete:true}),fetchAuthority:async id=>{
    if(id===failId)throw new Error('RATE_LIMITED');
    return {authority:authority(id),sourceText:'Legal text '+id,retrievedAt:'2026-11-10T10:00:00.000Z',sourceUri:'https://lovdata.no/act/'+encodeURIComponent(id)};
  }};
  const persistence={
    beginRun:async value=>{runs.push(value);return {runId:'run-1'};},
    appendAuthority:async value=>{writes.push(value);return 'created';},
    persistRunResult:async value=>{runs.push(value);},
  };
  return {adapter,persistence,writes,runs,rights,loadRights:async()=>({rights,rightsEvidence}),cancel};
}
test('executes bounded ingestion, persists provenance and run counts',async()=>{
  const h=harness();
  const result=await executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1',concurrency:2});
  assert.equal(result.status,'succeeded');assert.equal(result.created,2);assert.equal(h.writes.length,2);
  assert.equal(h.writes[0].normalisationProfile,'unicode-v1');assert.equal(h.runs.length,2);
});
test('records partial results and classified retryable failures',async()=>{
  const h=harness({failId:'NO:2'});
  const result=await executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1'});
  assert.equal(result.status,'partial');assert.equal(result.created,1);assert.deepEqual(result.failureCodes,['RATE_LIMITED']);
});
test('does not begin ingestion if source rights are not approved',async()=>{
  const h=harness();
  await assert.rejects(()=>executeLegalIngestionBatch({adapter:h.adapter,loadRights:async()=>({rights:{...h.rights,rightsStatus:'review_required'},rightsEvidence}),persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1'}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
  assert.equal(h.runs.length,0);
});
test('rejects upstream URLs outside the registered source host allow-list',async()=>{
  const h=harness();
  h.adapter.fetchAuthority=async id=>({authority:authority(id),sourceText:'Legal text',retrievedAt:'2026-11-10T10:00:00Z',sourceUri:'https://attacker.example/fake'});
  const result=await executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1'});
  assert.equal(result.status,'failed');assert.equal(result.created,0);assert.deepEqual(result.failureCodes,['LEGAL_SOURCE_HOST_NOT_ALLOWED']);
});
test('rejects cursor loops and unsafe concurrency',async()=>{
  const h=harness();h.adapter.listChangedAuthorities=async cursor=>({externalIds:['NO:1'],nextCursor:cursor,complete:false});
  await assert.rejects(()=>executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:'same',normalisationProfile:'unicode-v1'}),/LEGAL_INGESTION_CURSOR_DID_NOT_ADVANCE/);
  await assert.rejects(()=>executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1',concurrency:99}),/LEGAL_INGESTION_CONCURRENCY_INVALID/);
});
test('captures cancellation without marking the entire batch successful',async()=>{
  const h=harness();
  const result=await executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1',isCancelled:()=>true});
  assert.equal(result.status,'partial');assert.deepEqual(result.failureCodes,['CANCELLED']);
});

test('requires rights evidence to belong to the exact registered source',async()=>{
  const h=harness();
  await assert.rejects(()=>executeLegalIngestionBatch({adapter:h.adapter,loadRights:async()=>({rights:h.rights,rightsEvidence:{...rightsEvidence,sourceKey:'other-source'}}),persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1'}),/LEGAL_SOURCE_RIGHTS_SOURCE_MISMATCH/);
  assert.equal(h.runs.length,0);
});

test('reloads source rights for each record and stops when rights are revoked mid-batch',async()=>{
  const h=harness();let calls=0;
  h.loadRights=async()=>({rights:calls++<2?h.rights:{...h.rights,sourceStatus:'paused'},rightsEvidence});
  const result=await executeLegalIngestionBatch({adapter:h.adapter,loadRights:h.loadRights,persistence:h.persistence,cursor:null,normalisationProfile:'unicode-v1',concurrency:1});
  assert.equal(result.status,'partial');assert.equal(result.created,1);
  assert.deepEqual(result.failureCodes,['LEGAL_SOURCE_RIGHTS_NOT_APPROVED']);
});
