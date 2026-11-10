import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseAuthority } from '../src/modules/legal-knowledge/contracts.ts';
import { createSupabaseLegalIngestionPersistence } from '../src/modules/legal-knowledge/supabase-persistence.ts';

const makeAuthority = () => normaliseAuthority({
  externalId:'act-1', title:'Example Act', authorityType:'act', languageCode:'en',
  relationships:[{ targetExternalId:'act-2', relationshipType:'amends',
    effectiveFrom:'2024-01-01', sourceNote:'Amends section 2',
    provenanceUri:'https://laws.example.test/act-1' }],
}, 'Example legal text', ['example.test']);

test('authority normalisation validates and retains source-provenanced relationships', () => {
  const result = makeAuthority();
  assert.equal(result.relationships.length, 1);
  assert.equal(result.relationships[0].targetExternalId, 'act-2');
  assert.equal(result.relationships[0].provenanceUri, 'https://laws.example.test/act-1');
});

test('authority relationship targets must use allow-listed HTTPS provenance', () => {
  assert.throws(() => normaliseAuthority({
    externalId:'act-1', title:'Example Act', authorityType:'act',
    relationships:[{ targetExternalId:'act-2', relationshipType:'amends',
      provenanceUri:'https://evil.example/act-1' }],
  }, 'Example legal text', ['example.test']), /LEGAL_SOURCE_HOST_NOT_ALLOWED/);
});

test('Supabase persistence appends relationships under the same worker lease', async () => {
  const calls = [];
  const client = { rpc: async (name,args) => {
    calls.push({name,args});
    if (name === 'legal_ingestion_append_authority') return {data:'created',error:null};
    if (name === 'legal_ingestion_append_relationship') return {data:true,error:null};
    throw new Error('unexpected RPC');
  } };
  const persistence = createSupabaseLegalIngestionPersistence(client);
  const authority = makeAuthority();
  await persistence.appendAuthority({
    sourceKey:'source-key', jurisdictionCode:'NO', authority,
    sourceUri:'https://laws.example.test/act-1',
    retrievedAt:'2026-11-10T12:00:00.000Z', normalisationProfile:'normalise-v1',
    passages:[{ordinal:0,startOffset:0,endOffset:19,content:'Example legal text',contentHash:'a'.repeat(64)}],
    lease:{jobId:'job-1',leaseToken:'lease-1'},
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].name, 'legal_ingestion_append_relationship');
  assert.equal(calls[1].args.p_job_id, 'job-1');
  assert.equal(calls[1].args.p_lease_token, 'lease-1');
  assert.equal(calls[1].args.p_to_external_id, 'act-2');
});
