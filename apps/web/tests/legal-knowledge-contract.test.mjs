import assert from 'node:assert/strict';
import test from 'node:test';
import {assertSourceIngestionAllowed,createPassages,normaliseAuthority,normaliseLegalText,sha256,validateSourceManifest,validateSourceUri} from '../src/modules/legal-knowledge/contracts.ts';
const approved={rightsStatus:'approved',sourceStatus:'active',ingestionEnabled:true,licenceIdentifier:'TEST-LICENCE-1',attributionText:'Source attribution required'};
const authority={externalId:'NO:LOV:1992:100',citation:'Act 1992-07-17-100',title:'Example Act',authorityType:'act',languageCode:'no',canonicalUri:'https://lovdata.no/dokument/NL/lov/1992-07-17-100',publicationDate:'1992-07-17'};

test('normalises Unicode and line endings without discarding paragraph structure',()=>assert.equal(normaliseLegalText('\uFEFFＡ\r\nB\n\n\nC  '),'A\nB\n\nC'));
test('hashes source text deterministically with SHA-256',()=>assert.equal(sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
test('blocks ingestion unless all source-rights gates are satisfied',()=>{
  assert.throws(()=>assertSourceIngestionAllowed({...approved,rightsStatus:'review_required'}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
  assert.throws(()=>assertSourceIngestionAllowed({...approved,sourceStatus:'paused'}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
  assert.throws(()=>assertSourceIngestionAllowed({...approved,ingestionEnabled:false}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
  assert.throws(()=>assertSourceIngestionAllowed({...approved,licenceIdentifier:null}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
  assert.throws(()=>assertSourceIngestionAllowed({...approved,attributionText:null}),/LEGAL_SOURCE_RIGHTS_NOT_APPROVED/);
  assert.doesNotThrow(()=>assertSourceIngestionAllowed(approved));
});
test('normalises source-backed authority and preserves source hash',()=>{
  const result=normaliseAuthority(authority,'Original\r\ntext',['lovdata.no']);
  assert.equal(result.title,'Example Act');assert.equal(result.sourceContentHash,sha256('Original\r\ntext'));
  assert.equal(result.canonicalUri,'https://lovdata.no/dokument/NL/lov/1992-07-17-100');assert.equal(result.legalStatus,'unknown');
  assert.equal(result.normalisedText,'Original\ntext');assert.equal(result.normalisedContentHash,sha256('Original\ntext'));
});
test('rejects malformed external authority identifiers',()=>assert.throws(()=>normaliseAuthority({...authority,externalId:'../private'},'text',['lovdata.no']),/LEGAL_AUTHORITY_EXTERNAL_ID_INVALID/));
test('rejects non-HTTPS or credential-bearing source URLs',()=>{
  assert.throws(()=>normaliseAuthority({...authority,canonicalUri:'http://lovdata.no/a'},'text',['lovdata.no']),/LEGAL_SOURCE_URI_NOT_ALLOWED/);
  assert.throws(()=>normaliseAuthority({...authority,canonicalUri:'https://user:pass@lovdata.no/a'},'text',['lovdata.no']),/LEGAL_SOURCE_URI_NOT_ALLOWED/);
});
test('rejects URLs outside adapter host allow-list',()=>assert.throws(()=>normaliseAuthority({...authority,canonicalUri:'https://example.org/a'},'text',['lovdata.no']),/LEGAL_SOURCE_HOST_NOT_ALLOWED/));
test('rejects invalid language tags, dates and oversized metadata',()=>{
  assert.throws(()=>normaliseAuthority({...authority,languageCode:'no/../../x'},'text',['lovdata.no']),/LEGAL_AUTHORITY_LANGUAGE_INVALID/);
  assert.throws(()=>normaliseAuthority({...authority,publicationDate:'2026-99-99'},'text',['lovdata.no']),/LEGAL_AUTHORITY_PUBLICATION_DATE_INVALID/);
  assert.throws(()=>normaliseAuthority({...authority,metadata:{payload:'x'.repeat(20000)}},'text',['lovdata.no']),/LEGAL_AUTHORITY_METADATA_TOO_LARGE/);
});
test('rejects empty source text',()=>assert.throws(()=>normaliseAuthority(authority,' \n ',['lovdata.no']),/LEGAL_AUTHORITY_SOURCE_TEXT_EMPTY/));
test('creates deterministic passages with stable offsets and hashes',()=>{
  const source=Array.from({length:40},(_,i)=>'Section '+(i+1)+'\n'+'legal text '.repeat(30)).join('\n\n');
  const passages=createPassages(source,700,100);
  assert.ok(passages.length>1);assert.equal(passages[0].ordinal,0);
  assert.equal(passages[0].contentHash,sha256(passages[0].content));
  assert.ok(passages.every(p=>p.endOffset>p.startOffset));
  assert.ok(passages.every((p,i)=>p.ordinal===i));
});
test('returns no passages for empty content',()=>assert.deepEqual(createPassages('  \n  '),[]));
test('rejects unsafe passage sizing',()=>{
  assert.throws(()=>createPassages('text',100,10),/PASSAGE_MAX_CHARACTERS_INVALID/);
  assert.throws(()=>createPassages('text',500,500),/PASSAGE_OVERLAP_INVALID/);
});

test('validates adapter identity and source host configuration',()=>{
  const manifest={sourceKey:'lovdata-official',name:'Lovdata',issuingAuthority:'Lovdata',jurisdictionCode:'NO',sourceType:'legislation',baseUri:'https://lovdata.no/',allowedHosts:['lovdata.no'],accessMethod:'web',adapterKey:'lovdata',adapterVersion:'1.0.0'};
  assert.doesNotThrow(()=>validateSourceManifest(manifest));
  assert.throws(()=>validateSourceManifest({...manifest,adapterKey:'../unsafe'}),/LEGAL_SOURCE_MANIFEST_INVALID/);
  assert.equal(validateSourceUri('https://api.lovdata.no/v1',['lovdata.no']),'https://api.lovdata.no/v1');
  assert.throws(()=>validateSourceUri('https://example.org/',['lovdata.no']),/LEGAL_SOURCE_HOST_NOT_ALLOWED/);
});
