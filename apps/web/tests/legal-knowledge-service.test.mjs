import assert from 'node:assert/strict';
import test from 'node:test';
import {searchLegalKnowledge} from '../src/modules/legal-knowledge/service.ts';

const passage={passageId:'p1',authorityId:'a1',authorityVersionId:'v1',authorityTitle:'Working Environment Act',citation:'Act § 15-7',jurisdictionCode:'NO',authorityType:'act',languageCode:'no',legalStatus:'in_force',validFrom:'2024-01-01',validUntil:null,sourceUri:'https://lovdata.no/act/1',sourceKey:'lovdata',sourceContentHash:'a'.repeat(64),passageContent:'Legal text',pageNumber:null,sectionPath:['Section 15-7'],lexicalScore:0.8,semanticScore:0.9};
const source={sourceKey:'lovdata',sourceName:'Lovdata',issuingAuthority:'Lovdata',licenceIdentifier:'LICENCE-1',attributionText:'Source: Lovdata',rightsStatus:'approved',displayPermitted:true,quotePermitted:true};
const provider={searchLexical:async()=>[passage],searchSemantic:async()=>[passage]};
const input={requestId:'search-1',query:'dismissal',jurisdictionCode:'NO',asOfDate:'2026-11-10',languageCodes:['no'],mode:'hybrid',provider,sourceMetadata:{lovdata:source}};
test('composes scoped retrieval and rights-aware citation bundle',async()=>{
  const result=await searchLegalKnowledge(input);
  assert.equal(result.resultCount,1);assert.equal(result.passages[0].passageId,'p1');
  assert.equal(result.citations.entries[0].sourceAttribution,'Source: Lovdata');
  assert.equal(result.citations.complete,true);
});
test('returns an explicit empty-result warning instead of fabricating sources',async()=>{
  const result=await searchLegalKnowledge({...input,provider:{searchLexical:async()=>[],searchSemantic:async()=>[]}});
  assert.equal(result.resultCount,0);assert.ok(result.warnings.some(x=>x.includes('No matching authority passages')));
  assert.equal(result.citations.entries.length,0);
});
test('rejects missing request identity',async()=>{
  await assert.rejects(()=>searchLegalKnowledge({...input,requestId:' '}),/LEGAL_SEARCH_REQUEST_ID_INVALID/);
});
