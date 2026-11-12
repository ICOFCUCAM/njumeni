export type LegalAuthorityRelationshipType =
  | 'amends'|'amended_by'|'repeals'|'repealed_by'|'replaces'|'replaced_by'
  | 'implements'|'implemented_by'|'interprets'|'applies'|'distinguishes'
  | 'overrules'|'overruled_by'|'supplements'|'supplemented_by'|'conflicts_with'
  | 'cites'|'related';

// Canonical vocabulary (Master Plan v2.0 §6.5); must match the database check constraint.
export const LEGAL_AUTHORITY_RELATIONSHIP_TYPES:readonly LegalAuthorityRelationshipType[]=Object.freeze([
  'amends','amended_by','repeals','repealed_by','replaces','replaced_by',
  'implements','implemented_by','interprets','applies','distinguishes',
  'overrules','overruled_by','supplements','supplemented_by','conflicts_with',
  'cites','related',
]);

export interface LegalAuthorityRelationshipInput {
  fromAuthorityId:string;
  toAuthorityId:string;
  relationshipType:LegalAuthorityRelationshipType;
  effectiveFrom?:string|null;
  sourceNote?:string|null;
  provenanceUri?:string|null;
}

export interface LegalAuthorityRelationship {
  fromAuthorityId:string;
  toAuthorityId:string;
  relationshipType:LegalAuthorityRelationshipType;
  effectiveFrom:string|null;
  sourceNote:string|null;
  provenanceUri:string|null;
}

const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inverseRelationshipType(type:LegalAuthorityRelationshipType):LegalAuthorityRelationshipType|null {
  const inverse:Partial<Record<LegalAuthorityRelationshipType,LegalAuthorityRelationshipType>>={
    amends:'amended_by',amended_by:'amends',
    repeals:'repealed_by',repealed_by:'repeals',
    implements:'implemented_by',implemented_by:'implements',
    overrules:'overruled_by',overruled_by:'overrules',
    replaces:'replaced_by',replaced_by:'replaces',
    supplements:'supplemented_by',supplemented_by:'supplements',
    conflicts_with:'conflicts_with',
  };
  return inverse[type]??null;
}

export function normaliseAuthorityRelationship(input:LegalAuthorityRelationshipInput):LegalAuthorityRelationship {
  if(!UUID_PATTERN.test(input.fromAuthorityId)||!UUID_PATTERN.test(input.toAuthorityId)) {
    throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_ID_INVALID');
  }
  if(input.fromAuthorityId===input.toAuthorityId)throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_SELF_LINK');
  const effectiveFrom=input.effectiveFrom??null;
  if(effectiveFrom&&(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)||
    Number.isNaN(Date.parse(effectiveFrom+'T00:00:00.000Z'))||
    new Date(effectiveFrom+'T00:00:00.000Z').toISOString().slice(0,10)!==effectiveFrom)) {
    throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_DATE_INVALID');
  }
  const sourceNote=input.sourceNote?.trim()||null;
  if(sourceNote&&sourceNote.length>2000)throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_NOTE_INVALID');
  let provenanceUri:string|null=null;
  if(input.provenanceUri) {
    let parsed:URL;
    try{parsed=new URL(input.provenanceUri);}catch{throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_URI_INVALID');}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.toString().length>2048) {
      throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_URI_INVALID');
    }
    provenanceUri=parsed.toString();
  }
  return {
    fromAuthorityId:input.fromAuthorityId,
    toAuthorityId:input.toAuthorityId,
    relationshipType:input.relationshipType,
    effectiveFrom,
    sourceNote,
    provenanceUri,
  };
}
