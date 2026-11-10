import assert from 'node:assert/strict';
import test from 'node:test';
import {buildLegalCitationBundle} from '../src/modules/legal-knowledge/citation-bundle.ts';

const passage={passageId:'p1',authorityId:'a1',authorityVersionId:'v1',authorityTitle:'Working Environment Act',citation:'Act 2005-06-17-62 § 15-7',jurisdictionCode:'NO',authorityType:'act',languageCode:'no',legalStatus:'in_force',validFrom:'2024-01-01',validUntil:null,sourceUri:'https://lovdata.no/act/1',sourceKey:'lovdata',sourceContentHash:'a'.repeat(64),passageContent:'text',pageNumber:4,sectionPath:['Chapter 15','Section 15-7'],lexicalScore:0.8,semanticScore:0.9,score:0.85,rank:1,citationLabel:'Act § 15-7'};
const source={sourceKey:'lovdata',sourceName:'Lovdata',issuingAuthority:'Lovdata',licenceIdentifier:'LICENCE-1',attributionText:'Source: Lovdata',rightsStatus:'approved',displayPermitted:true,quotePermitted:true};
const base={answerId:'answer-1',jurisdictionCode:'NO',asOfDate:'2026-11-10',passageIds:['p1'],retrievedPassages:[passage],sources:{lovdata:source}};
test('builds reproducible citation entries with version, hash, pinpoint and source attribution',()=>{
  const bundle=buildLegalCitationBundle(base);
  assert.equal(bundle.complete,true);assert.equal(bundle.entries[0].authorityVersionId,'v1');
  assert.equal(bundle.entries[0].sourceContentHash,'a'.repeat(64));
  assert.equal(bundle.entries[0].pinpoint,'Chapter 15 > Section 15-7, p. 4');
  assert.equal(bundle.entries[0].sourceAttribution,'Source: Lovdata');
});
test('never invents official citation when source citation is absent',()=>{
  const bundle=buildLegalCitationBundle({...base,retrievedPassages:[{...passage,citation:null}]});
  assert.equal(bundle.entries[0].officialCitation,null);assert.equal(bundle.complete,false);
  assert.ok(bundle.warnings.some(x=>x.includes('Official citation is unavailable')));
});
test('blocks citations without display rights or approved source rights',()=>{
  const bundle=buildLegalCitationBundle({...base,sources:{lovdata:{...source,displayPermitted:false}}});
  assert.equal(bundle.entries.length,0);assert.equal(bundle.complete,false);
});
test('does not include a passage that was not retrieved or belongs to another jurisdiction',()=>{
  const bundle=buildLegalCitationBundle({...base,passageIds:['p1','not-retrieved'],retrievedPassages:[{...passage,jurisdictionCode:'GB'}]});
  assert.equal(bundle.entries.length,0);assert.equal(bundle.complete,false);
  assert.ok(bundle.warnings.length>=2);
});
test('discloses quote restrictions separately from citation display rights',()=>{
  const bundle=buildLegalCitationBundle({...base,sources:{lovdata:{...source,quotePermitted:false}}});
  assert.equal(bundle.entries.length,1);assert.equal(bundle.entries[0].quotePermitted,false);
  assert.equal(bundle.complete,false);assert.ok(bundle.warnings.some(x=>x.includes('Quotation is not permitted')));
});
test('rejects invalid jurisdiction, as-of date and answer identity',()=>{
  assert.throws(()=>buildLegalCitationBundle({...base,answerId:' '}),/LEGAL_CITATION_ANSWER_ID_INVALID/);
  assert.throws(()=>buildLegalCitationBundle({...base,jurisdictionCode:'bad'}),/LEGAL_CITATION_JURISDICTION_INVALID/);
  assert.throws(()=>buildLegalCitationBundle({...base,asOfDate:'2026-99-99'}),/LEGAL_CITATION_AS_OF_DATE_INVALID/);
});

test('rejects citation display when licence or attribution metadata is incomplete',()=>{
  const bundle=buildLegalCitationBundle({...base,sources:{lovdata:{...source,attributionText:' '}}});
  assert.equal(bundle.entries.length,0);assert.equal(bundle.complete,false);
  assert.ok(bundle.warnings.some(x=>x.includes('Licence or attribution evidence is incomplete')));
});
