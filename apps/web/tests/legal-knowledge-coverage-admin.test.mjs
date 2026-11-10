import test from 'node:test';
import assert from 'node:assert/strict';
import { getJurisdictionCoverageSnapshot, recordSourceCoverageReview, recordJurisdictionCoverageScope } from '../src/modules/legal-knowledge/coverage-admin-core.ts';

const profile = { jurisdictionCode:'NO', requestedAuthorityTypes:['act'], requestedLanguages:['no'],
  reviewIntervalDays:90, sources:[{ sourceKey:'lovdata-official', rightsStatus:'review_required',
    sourceStatus:'planned', ingestionEnabled:false, authorityTypes:[], languages:['no'], lastVerifiedAt:null,
    coverageFrom:null, coverageUntil:null, knownGaps:['Rights review pending'] }] };

test('coverage admin returns a conservative planned assessment', async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'legal_jurisdiction_coverage_snapshot');
    assert.deepEqual(args, { p_jurisdiction_code:'NO' });
    return { data:profile, error:null };
  } };
  const result = await getJurisdictionCoverageSnapshot(client, 'NO', new Date('2026-11-10T00:00:00.000Z'));
  assert.equal(result.assessment.status, 'planned');
  assert.deepEqual(result.assessment.unsupportedAuthorityTypes, ['act']);
});

test('coverage RPC failures are sanitised', async () => {
  const client = { rpc: async () => ({ data:null, error:{ message:'database internals' } }) };
  await assert.rejects(getJurisdictionCoverageSnapshot(client, 'NO'), /LEGAL_COVERAGE_SNAPSHOT_LOAD_FAILED/);
});

test('invalid jurisdiction code is rejected before RPC', async () => {
  const client = { rpc: async () => { throw new Error('should not be called'); } };
  await assert.rejects(getJurisdictionCoverageSnapshot(client, 'bad'), /LEGAL_COVERAGE_JURISDICTION_INVALID/);
});

test('records a source coverage review through the trusted RPC', async()=>{
  const client={rpc:async(name,args)=>{
    assert.equal(name,'legal_source_record_coverage_review');
    assert.deepEqual(args.p_authority_types,['act','judgment']);
    assert.deepEqual(args.p_languages,['no']);
    return {data:{sourceId:'source-1',sourceKey:'lovdata-official',coverage:{authorityTypes:['act','judgment']}},error:null};
  }};
  const result=await recordSourceCoverageReview(client,{
    sourceId:'source-1',reviewer:'reviewer',reason:'Verified official coverage',
    authorityTypes:['act','judgment'],languages:['no'],coverageFrom:'1950-01-01',
    coverageUntil:null,lastVerifiedAt:'2026-11-01T00:00:00.000Z',knownGaps:['Historic records incomplete'],
  });
  assert.equal(result.sourceKey,'lovdata-official');
});

test('coverage review rejects future source verification timestamps', async()=>{
  await assert.rejects(recordSourceCoverageReview({rpc:async()=>({data:null,error:null})},{
    sourceId:'source-1',reviewer:'reviewer',reason:'Verified official coverage',
    authorityTypes:['act'],languages:['no'],coverageFrom:null,coverageUntil:null,
    lastVerifiedAt:'2099-01-01T00:00:00.000Z',knownGaps:[],
  }),/LEGAL_SOURCE_COVERAGE_REVIEW_TIMESTAMP_INVALID/);
});

test('records the jurisdiction-level authority coverage scope',async()=>{
  const client={rpc:async(name,args)=>{
    assert.equal(name,'legal_jurisdiction_record_coverage_scope');
    assert.equal(args.p_jurisdiction_code,'NO');
    assert.deepEqual(args.p_authority_types,['act','judgment']);
    return {data:{jurisdictionCode:'NO',requestedAuthorityTypes:['act','judgment']},error:null};
  }};
  const result=await recordJurisdictionCoverageScope(client,{
    jurisdictionCode:'NO',reviewer:'reviewer',reason:'Define legal coverage scope',
    authorityTypes:['act','judgment'],reviewIntervalDays:90,
  });
  assert.equal(result.jurisdictionCode,'NO');
});

test('coverage scope requires a non-empty authority class list',async()=>{
  await assert.rejects(recordJurisdictionCoverageScope({rpc:async()=>({data:{},error:null})},{
    jurisdictionCode:'NO',reviewer:'reviewer',reason:'Define legal coverage scope',
    authorityTypes:[],reviewIntervalDays:90,
  }),/LEGAL_JURISDICTION_COVERAGE_SCOPE_INVALID/);
});
