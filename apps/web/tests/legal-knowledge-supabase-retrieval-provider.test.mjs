import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseLegalPassageSearchProvider } from '../src/modules/legal-knowledge/supabase-retrieval-provider.ts';

const row = { passage_id:'p1', authority_id:'a1', authority_version_id:'v1',
  authority_title:'Example Act', citation:'Act 1/2020', jurisdiction_code:'NO',
  authority_type:'act', language_code:'no', legal_status:'in_force', valid_from:'2020-01-01',
  valid_until:null, source_uri:'https://example.test/act', source_content_hash:'a'.repeat(64),
  passage_content:'Section one', page_number:1, section_path:['§ 1'], source_key:'example',
  lexical_score:0.8, semantic_score:0.9 };
const plan = { queryText:'example', jurisdictionCode:'NO', asOfDate:'2026-01-01',
  languageCodes:['no'], authorityTypes:[], limit:10 };

test('lexical provider maps trusted RPC rows and keeps score provenance', async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'legal_search_passages_lexical');
    assert.equal(args.p_jurisdiction_code, 'NO');
    return { data:[row], error:null };
  } };
  const results = await createSupabaseLegalPassageSearchProvider(client).searchLexical(plan);
  assert.equal(results[0].passageId, 'p1');
  assert.equal(results[0].lexicalScore, 0.8);
  assert.equal(results[0].semanticScore, null);
  assert.equal(results[0].sourceKey, 'example');
});

test('semantic retrieval requires a 1536-dimensional embedding profile', async () => {
  const client = { rpc: async () => ({ data:[row], error:null }) };
  const provider = createSupabaseLegalPassageSearchProvider(client, async () => ({
    modelKey:'test-embedding-v1', values:Array(1536).fill(0.01),
  }));
  const results = await provider.searchSemantic(plan);
  assert.equal(results[0].semanticScore, 0.9);
  assert.equal(results[0].lexicalScore, null);
});

test('semantic retrieval fails closed without a configured embedder', async () => {
  const provider = createSupabaseLegalPassageSearchProvider({ rpc: async () => ({ data:[], error:null }) });
  await assert.rejects(provider.searchSemantic(plan), /LEGAL_RETRIEVAL_EMBEDDING_PROVIDER_NOT_CONFIGURED/);
});

test('provider does not leak database error details', async () => {
  const provider = createSupabaseLegalPassageSearchProvider({
    rpc: async () => ({ data:null, error:{ message:'sensitive database error' } }),
  });
  await assert.rejects(provider.searchLexical(plan), /LEGAL_RETRIEVAL_LEXICAL_PROVIDER_FAILED/);
});
