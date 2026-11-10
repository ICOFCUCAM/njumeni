import assert from 'node:assert/strict';
import test from 'node:test';
import {inverseRelationshipType,normaliseAuthorityRelationship} from '../src/modules/legal-knowledge/relationships.ts';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';

test('normalises a source-provenanced legal authority relationship',()=>{
  const relation=normaliseAuthorityRelationship({fromAuthorityId:a,toAuthorityId:b,relationshipType:'amends',effectiveFrom:'2024-01-01',sourceNote:'Article 4 amended',provenanceUri:'https://lovdata.no/source/1'});
  assert.equal(relation.relationshipType,'amends');assert.equal(relation.effectiveFrom,'2024-01-01');
});
test('rejects self-links and malformed authority identifiers',()=>{
  assert.throws(()=>normaliseAuthorityRelationship({fromAuthorityId:a,toAuthorityId:a,relationshipType:'cites'}),/LEGAL_AUTHORITY_RELATIONSHIP_SELF_LINK/);
  assert.throws(()=>normaliseAuthorityRelationship({fromAuthorityId:'bad',toAuthorityId:b,relationshipType:'cites'}),/LEGAL_AUTHORITY_RELATIONSHIP_ID_INVALID/);
});
test('rejects invalid effective dates and unsafe provenance URIs',()=>{
  assert.throws(()=>normaliseAuthorityRelationship({fromAuthorityId:a,toAuthorityId:b,relationshipType:'amends',effectiveFrom:'2026-99-99'}),/LEGAL_AUTHORITY_RELATIONSHIP_DATE_INVALID/);
  assert.throws(()=>normaliseAuthorityRelationship({fromAuthorityId:a,toAuthorityId:b,relationshipType:'cites',provenanceUri:'http://example.org'}),/LEGAL_AUTHORITY_RELATIONSHIP_URI_INVALID/);
});
test('returns inverse types only where the relationship is directional and paired',()=>{
  assert.equal(inverseRelationshipType('amends'),'amended_by');
  assert.equal(inverseRelationshipType('repeals'),'repealed_by');
  assert.equal(inverseRelationshipType('implements'),'implemented_by');
  assert.equal(inverseRelationshipType('overrules'),'overruled_by');
  assert.equal(inverseRelationshipType('cites'),null);
  assert.equal(inverseRelationshipType('related'),null);
});
