import test from 'node:test';
import assert from 'node:assert/strict';
import { recordLegalSourceRightsReview, setLegalSourceActivation, enqueueLegalSourceIngestion } from '../src/modules/legal-knowledge/source-admin-core.ts';

const sourceId='11111111-1111-4111-8111-111111111111';
const permissions={retrieve:true,store:true,normalise:true,index:true,quote:false,display:true,redistribute:false};

test('rights review submits explicit permission evidence without activation arguments',async()=>{
  const client={rpc:async(name,args)=>{
    assert.equal(name,'legal_source_record_rights_review');
    assert.equal(args.p_source_id,sourceId);
    assert.equal(args.p_permissions.quote,false);
    return {data:{rightsStatus:'approved',sourceStatus:'planned',ingestionEnabled:false},error:null};
  }};
  const result=await recordLegalSourceRightsReview(client,{
    sourceId,reviewer:'reviewer',licenceIdentifier:'LIC-1',licenceVersion:'1',
    termsUri:'https://example.test/terms',attributionText:'Attribution',
    reviewedAt:'2026-11-01T00:00:00.000Z',reviewExpiresAt:null,
    permissions,restrictions:[],
  },new Date('2026-11-10T00:00:00.000Z'));
  assert.equal(result.ingestionEnabled,false);
});

test('activation requires an exact adapter pin when enabling ingestion',async()=>{
  await assert.rejects(setLegalSourceActivation({rpc:async()=>({data:{},error:null})},{
    sourceId,operator:'operator',reason:'Approved after source review',
    status:'active',ingestionEnabled:true,adapterKey:null,adapterVersion:null,
  }),/LEGAL_SOURCE_ACTIVATION_INPUT_INVALID/);
});

test('activation RPC is distinct from rights review',async()=>{
  const client={rpc:async(name,args)=>{
    assert.equal(name,'legal_source_set_activation');
    assert.equal(args.p_status,'paused');
    assert.equal(args.p_ingestion_enabled,false);
    return {data:{status:'paused',ingestionEnabled:false},error:null};
  }};
  const result=await setLegalSourceActivation(client,{
    sourceId,operator:'operator',reason:'Pause pending source review',
    status:'paused',ingestionEnabled:false,adapterKey:null,adapterVersion:null,
  });
  assert.equal(result.status,'paused');
});

test('enqueue uses an idempotency key and validates the returned job id',async()=>{
  const client={rpc:async(name,args)=>{
    assert.equal(name,'legal_ingestion_enqueue_job');
    assert.equal(args.p_idempotency_key,'batch-001');
    assert.equal(args.p_max_attempts,8);
    return {data:'22222222-2222-4222-8222-222222222222',error:null};
  }};
  const id=await enqueueLegalSourceIngestion(client,{
    sourceId,adapterKey:'lovdata-adapter',adapterVersion:'1.0.0',idempotencyKey:'batch-001',
  });
  assert.equal(id,'22222222-2222-4222-8222-222222222222');
});
