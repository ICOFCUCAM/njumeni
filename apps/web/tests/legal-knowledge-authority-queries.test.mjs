import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getAuthorityVersionAsOf,
  traceAuthorityGraphInDatabase,
} from '../src/modules/legal-knowledge/supabase-authority-queries.ts';
import {
  LEGAL_AUTHORITY_RELATIONSHIP_TYPES,
  inverseRelationshipType,
} from '../src/modules/legal-knowledge/relationships.ts';

const ROOT = 'a1000000-0000-4000-8000-0000000000a0';
const A = 'a1000000-0000-4000-8000-0000000000a1';

test('relationship vocabulary matches the database check constraint exactly', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20261111130000_legal_authority_temporal_and_graph_queries.sql', import.meta.url),
    'utf8',
  );
  const block = sql.slice(sql.indexOf('check (relationship_type in ('), sql.indexOf('));'));
  const databaseTypes = [...block.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...databaseTypes].sort(), [...LEGAL_AUTHORITY_RELATIONSHIP_TYPES].sort());
  for (const type of ['replaces', 'supplements', 'conflicts_with']) {
    assert.ok(LEGAL_AUTHORITY_RELATIONSHIP_TYPES.includes(type), type);
  }
});

test('new relationship types have correct inverses; conflicts_with is symmetric', () => {
  assert.equal(inverseRelationshipType('replaces'), 'replaced_by');
  assert.equal(inverseRelationshipType('replaced_by'), 'replaces');
  assert.equal(inverseRelationshipType('supplements'), 'supplemented_by');
  assert.equal(inverseRelationshipType('conflicts_with'), 'conflicts_with');
  assert.equal(inverseRelationshipType('cites'), null);
});

test('as-of query maps the version row and passes knowledge time', async () => {
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, 'legal_authority_version_as_of');
      assert.deepEqual(args, { p_authority_id: ROOT, p_valid_on: '2023-06-01', p_known_at: '2026-11-10T00:00:00Z' });
      return {
        data: [{ authority_version_id: A, version_number: 1, valid_from: '2018-01-01', valid_until: null,
          recorded_at: '2026-11-09T00:00:00Z', source_uri: null, source_content_hash: '1'.repeat(64),
          normalised_content_hash: null }],
        error: null,
      };
    },
  };
  const version = await getAuthorityVersionAsOf(client, {
    authorityId: ROOT, validOn: '2023-06-01', knownAt: '2026-11-10T00:00:00Z',
  });
  assert.equal(version.authorityVersionId, A);
  assert.equal(version.versionNumber, 1);
  assert.equal(version.validUntil, null);
});

test('as-of query returns null when no version applies and rejects invalid input', async () => {
  const client = { rpc: async () => ({ data: [], error: null }) };
  assert.equal(await getAuthorityVersionAsOf(client, { authorityId: ROOT, validOn: '2017-01-01' }), null);
  await assert.rejects(getAuthorityVersionAsOf(client, { authorityId: 'x', validOn: '2017-01-01' }), /LEGAL_AS_OF_AUTHORITY_INVALID/);
  await assert.rejects(getAuthorityVersionAsOf(client, { authorityId: ROOT, validOn: '2017-02-30' }), /LEGAL_AS_OF_DATE_INVALID/);
  const failing = { rpc: async () => ({ data: null, error: { message: 'secret detail' } }) };
  await assert.rejects(getAuthorityVersionAsOf(failing, { authorityId: ROOT, validOn: '2020-01-01' }), /^Error: LEGAL_AS_OF_QUERY_FAILED$/);
});

test('database graph trace is validated and returned in the in-memory trace shape', async () => {
  const trace = {
    rootAuthorityId: ROOT, relatedAuthorityIds: [A],
    paths: [{ authorityIds: [ROOT, A], relationshipTypes: ['replaces'], provenanceUris: [null] }],
    truncated: false,
  };
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, 'legal_authority_graph');
      assert.deepEqual(args, { p_root_authority_id: ROOT, p_max_depth: 2, p_max_nodes: 10,
        p_as_of: '2024-01-01', p_relationship_types: ['replaces'] });
      return { data: trace, error: null };
    },
  };
  const result = await traceAuthorityGraphInDatabase(client, ROOT, {
    maxDepth: 2, maxNodes: 10, asOfDate: '2024-01-01', relationshipTypes: ['replaces'],
  });
  assert.deepEqual(result, trace);
});

test('database graph rejects malformed responses and invalid limits', async () => {
  const bad = { rpc: async () => ({ data: { rootAuthorityId: ROOT, relatedAuthorityIds: [], paths: [{ authorityIds: [ROOT, A], relationshipTypes: ['invented'], provenanceUris: [null] }], truncated: false }, error: null }) };
  await assert.rejects(traceAuthorityGraphInDatabase(bad, ROOT), /LEGAL_AUTHORITY_GRAPH_RESPONSE_INVALID/);
  await assert.rejects(traceAuthorityGraphInDatabase(bad, ROOT, { maxDepth: 50 }), /LEGAL_AUTHORITY_GRAPH_LIMIT_INVALID/);
  await assert.rejects(traceAuthorityGraphInDatabase(bad, ROOT, { asOfDate: '2024-13-01' }), /LEGAL_AUTHORITY_GRAPH_DATE_INVALID/);
});
