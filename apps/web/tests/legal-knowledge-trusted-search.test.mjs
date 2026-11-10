import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLegalCitationSourceMetadata } from '../src/modules/legal-knowledge/citation-metadata.ts';

test('citation metadata loader deduplicates and sorts source keys', async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'legal_citation_source_metadata');
    assert.deepEqual(args, { p_source_keys:['a-source','z-source'] });
    return { data:[{ sourceKey:'a-source',sourceName:'A',issuingAuthority:'Authority',
      licenceIdentifier:'LIC',attributionText:'Attribution',rightsStatus:'approved',
      displayPermitted:true,quotePermitted:false }], error:null };
  } };
  const result = await loadLegalCitationSourceMetadata(client, ['z-source','a-source','a-source']);
  assert.equal(result['a-source'].quotePermitted, false);
});

test('empty retrieval does not issue an unnecessary metadata RPC', async () => {
  let calls = 0;
  const result = await loadLegalCitationSourceMetadata({ rpc: async () => {
    calls++; return { data:[], error:null };
  } }, []);
  assert.equal(calls, 0);
  assert.deepEqual(Object.keys(result), []);
});

test('metadata RPC errors are sanitised', async () => {
  await assert.rejects(loadLegalCitationSourceMetadata({
    rpc: async () => ({ data:null, error:{ message:'sensitive internal error' } }),
  }, ['source']), /LEGAL_CITATION_METADATA_LOAD_FAILED/);
});
