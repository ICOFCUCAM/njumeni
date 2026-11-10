import assert from 'node:assert/strict';
import test from 'node:test';
import {traceAuthorityGraph} from '../src/modules/legal-knowledge/authority-graph.ts';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const c='33333333-3333-4333-8333-333333333333';
const d='44444444-4444-4444-8444-444444444444';
const edges=[
  {fromAuthorityId:a,toAuthorityId:b,relationshipType:'amends',effectiveFrom:'2020-01-01',provenanceUri:'https://example.org/a-b'},
  {fromAuthorityId:b,toAuthorityId:c,relationshipType:'implements',effectiveFrom:'2021-01-01',provenanceUri:'https://example.org/b-c'},
  {fromAuthorityId:c,toAuthorityId:a,relationshipType:'cites',effectiveFrom:'2022-01-01',provenanceUri:'https://example.org/c-a'},
  {fromAuthorityId:a,toAuthorityId:d,relationshipType:'repeals',effectiveFrom:'2025-01-01',provenanceUri:'https://example.org/a-d'},
];
test('traces related authorities with bounded breadth-first paths and provenance',()=>{
  const result=traceAuthorityGraph(a,edges);
  assert.deepEqual(result.relatedAuthorityIds.sort(),[b,c,d].sort());
  assert.ok(result.paths.some(path=>path.authorityIds.join(',')===[a,b,c].join(',')));
  assert.equal(result.truncated,false);
});
test('applies as-of date and relationship-type filters without inferring legal effect',()=>{
  const result=traceAuthorityGraph(a,edges,{asOfDate:'2023-01-01',relationshipTypes:['amends','implements']});
  assert.deepEqual(result.relatedAuthorityIds,[b,c]);
});
test('bounds graph expansion and reports truncation',()=>{
  const result=traceAuthorityGraph(a,edges,{maxNodes:1});
  assert.equal(result.relatedAuthorityIds.length,0);assert.equal(result.truncated,true);
});
test('rejects invalid roots, dates and traversal bounds',()=>{
  assert.throws(()=>traceAuthorityGraph('bad',edges),/LEGAL_AUTHORITY_GRAPH_ROOT_INVALID/);
  assert.throws(()=>traceAuthorityGraph(a,edges,{asOfDate:'2026-99-99'}),/LEGAL_AUTHORITY_GRAPH_DATE_INVALID/);
  assert.throws(()=>traceAuthorityGraph(a,edges,{maxDepth:0}),/LEGAL_AUTHORITY_GRAPH_LIMIT_INVALID/);
});
