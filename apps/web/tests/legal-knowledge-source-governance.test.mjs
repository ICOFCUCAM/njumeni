import assert from 'node:assert/strict';
import test from 'node:test';
import {assertLegalSourceCanDisplay,assertLegalSourceCanIngest,assertLegalSourceCanRedistribute,assertLegalSourceCanQuote,validateLegalSourceRightsEvidence} from '../src/modules/legal-knowledge/source-governance.ts';

const evidence={
  sourceKey:'lovdata-official',licenceIdentifier:'LICENCE-1',licenceVersion:'2026-01',
  termsUri:'https://lovdata.no/info/information-in-english',attributionText:'Attribution required',
  reviewedBy:'legal-reviewer-1',reviewedAt:'2026-11-01T10:00:00.000Z',
  permissions:{retrieve:true,store:true,normalise:true,index:true,quote:true,display:true,redistribute:false},
  restrictions:['No bulk redistribution'],reviewExpiresAt:'2027-11-01T10:00:00.000Z',
};
const activation={rightsStatus:'approved',sourceStatus:'active',ingestionEnabled:true};
const now=new Date('2026-11-10T10:00:00.000Z');

test('accepts complete source rights evidence and a permitted ingestion activation',()=>{
  assert.doesNotThrow(()=>validateLegalSourceRightsEvidence(evidence,now));
  assert.doesNotThrow(()=>assertLegalSourceCanIngest(activation,evidence,now));
});
test('requires explicit retrieval, storage, normalisation and indexing rights',()=>{
  for(const key of ['retrieve','store','normalise','index']){
    assert.throws(()=>assertLegalSourceCanIngest(activation,{...evidence,permissions:{...evidence.permissions,[key]:false}},now),/LEGAL_SOURCE_INGESTION_PERMISSION_DENIED/);
  }
});
test('does not equate ingestion rights with permission to display or redistribute',()=>{
  assert.throws(()=>assertLegalSourceCanDisplay({...evidence,permissions:{...evidence.permissions,display:false}},now),/LEGAL_SOURCE_DISPLAY_PERMISSION_DENIED/);
  assert.throws(()=>assertLegalSourceCanRedistribute(evidence,now),/LEGAL_SOURCE_REDISTRIBUTION_DENIED/);
});
test('rejects missing evidence, unsafe terms URLs and expired reviews',()=>{
  assert.throws(()=>validateLegalSourceRightsEvidence({...evidence,licenceIdentifier:'  '},now),/LEGAL_SOURCE_RIGHTS_EVIDENCE_INVALID/);
  assert.throws(()=>validateLegalSourceRightsEvidence({...evidence,termsUri:'http://lovdata.no'},now),/LEGAL_SOURCE_TERMS_URI_INVALID/);
  assert.throws(()=>validateLegalSourceRightsEvidence({...evidence,reviewExpiresAt:'2026-11-09T10:00:00.000Z'},now),/LEGAL_SOURCE_RIGHTS_REVIEW_EXPIRED/);
});
test('requires active, approved and explicitly enabled source status',()=>{
  assert.throws(()=>assertLegalSourceCanIngest({...activation,sourceStatus:'paused'},evidence,now),/LEGAL_SOURCE_INGESTION_PERMISSION_DENIED/);
  assert.throws(()=>assertLegalSourceCanIngest({...activation,rightsStatus:'review_required'},evidence,now),/LEGAL_SOURCE_INGESTION_PERMISSION_DENIED/);
});

test('display and quotation permissions are evaluated independently',()=>{
  assert.doesNotThrow(()=>assertLegalSourceCanDisplay({...evidence,permissions:{...evidence.permissions,quote:false}},now));
  assert.throws(()=>assertLegalSourceCanQuote({...evidence,permissions:{...evidence.permissions,quote:false}},now),/LEGAL_SOURCE_QUOTATION_PERMISSION_DENIED/);
});
