import { createHash } from 'node:crypto';
import { LEGAL_AUTHORITY_RELATIONSHIP_TYPES, type LegalAuthorityRelationshipType } from './relationships.ts';

export type LegalSourceType = 'legislation'|'case_law'|'regulation'|'treaty'|'official_guidance'|'court_portal'|'gazette'|'other';
export interface LegalSourceManifest {
  sourceKey:string; name:string; issuingAuthority:string; jurisdictionCode:string|null;
  sourceType:LegalSourceType; baseUri:string|null; allowedHosts:readonly string[];
  accessMethod:'manual'|'api'|'bulk_download'|'feed'|'mcp'|'web'; adapterKey:string; adapterVersion:string;
}
export interface LegalSourceRights {
  rightsStatus:'review_required'|'approved'|'restricted'|'prohibited';
  sourceStatus:'planned'|'active'|'paused'|'retired'; ingestionEnabled:boolean;
  licenceIdentifier:string|null; attributionText:string|null;
}
export interface LegalAuthorityInput {
  externalId:string; citation?:string|null; title:string;
  authorityType:'constitution'|'act'|'statutory_instrument'|'regulation'|'judgment'|'decision'|'treaty'|'directive'|'regulation_eu'|'official_guidance'|'order'|'other';
  issuingBody?:string|null; languageCode?:string|null; canonicalUri?:string|null;
  publicationDate?:string|null; legalStatus?:'in_force'|'amended'|'repealed'|'expired'|'overruled'|'unknown';
  metadata?:Record<string,unknown>;
  relationships?:readonly {targetExternalId:string;relationshipType:LegalAuthorityRelationshipType;effectiveFrom?:string|null;sourceNote?:string|null;provenanceUri?:string|null}[];
}
export interface NormalisedAuthority {
  externalId:string; citation:string|null; title:string; authorityType:LegalAuthorityInput['authorityType'];
  issuingBody:string|null; languageCode:string|null; canonicalUri:string|null; publicationDate:string|null;
  legalStatus:NonNullable<LegalAuthorityInput['legalStatus']>; metadata:Record<string,unknown>; sourceContentHash:string;
  normalisedText:string; normalisedContentHash:string;
  relationships:readonly {targetExternalId:string;relationshipType:LegalAuthorityRelationshipType;effectiveFrom:string|null;sourceNote:string|null;provenanceUri:string|null}[];
}
export interface LegalSourceAdapter {
  readonly manifest:LegalSourceManifest;
  listChangedAuthorities(cursor:string|null):Promise<{externalIds:string[];nextCursor:string|null;complete:boolean}>;
  fetchAuthority(externalId:string):Promise<{authority:LegalAuthorityInput;sourceText:string;retrievedAt:string;sourceUri:string}>;
}
export interface PassageDraft { ordinal:number; startOffset:number; endOffset:number; content:string; contentHash:string; }

const MAX_METADATA_BYTES=16_384;
const EXTERNAL_ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/;
const LANGUAGE_PATTERN=/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function sha256(value:string):string {
  return createHash('sha256').update(value,'utf8').digest('hex');
}
export function normaliseLegalText(value:string):string {
  return value.normalize('NFKC').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')
    .split('\n').map(line=>line.replace(/[\t ]+$/g,'')).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function validateSourceManifest(manifest:LegalSourceManifest):void {
  if(!/^[a-z][a-z0-9._-]{1,79}$/.test(manifest.sourceKey)||
    !/^[a-z][a-z0-9._-]{1,79}$/.test(manifest.adapterKey)||
    !manifest.adapterVersion.trim()||manifest.adapterVersion.length>80||
    !manifest.name.trim()||!manifest.issuingAuthority.trim()||
    !Array.isArray(manifest.allowedHosts)||manifest.allowedHosts.length===0||
    manifest.allowedHosts.some(host=>typeof host!=='string'||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host))) {
    throw new Error('LEGAL_SOURCE_MANIFEST_INVALID');
  }
  if(manifest.baseUri) {
    const base=validateCanonicalUri(manifest.baseUri,manifest.allowedHosts);
    if(!base)throw new Error('LEGAL_SOURCE_MANIFEST_INVALID');
  }
}
export function validateSourceUri(uri:string,allowedHosts:readonly string[]):string {
  const validated=validateCanonicalUri(uri,allowedHosts);
  if(!validated)throw new Error('LEGAL_SOURCE_URI_REQUIRED');
  return validated;
}
export function assertSourceIngestionAllowed(rights:LegalSourceRights):void {
  if(rights.rightsStatus!=='approved'||rights.sourceStatus!=='active'||!rights.ingestionEnabled||
    !rights.licenceIdentifier?.trim()||!rights.attributionText?.trim()) {
    throw new Error('LEGAL_SOURCE_RIGHTS_NOT_APPROVED');
  }
}
function validateCanonicalUri(uri:string|undefined|null,allowedHosts:readonly string[]):string|null {
  if(!uri)return null;
  let parsed:URL;
  try{parsed=new URL(uri);}catch{throw new Error('LEGAL_SOURCE_URI_INVALID');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('LEGAL_SOURCE_URI_NOT_ALLOWED');
  const hostname=parsed.hostname.toLowerCase();
  const allowed=allowedHosts.some(host=>hostname===host.toLowerCase()||hostname.endsWith('.'+host.toLowerCase()));
  if(!allowed)throw new Error('LEGAL_SOURCE_HOST_NOT_ALLOWED');
  return parsed.toString();
}
export function normaliseAuthority(input:LegalAuthorityInput,sourceText:string,allowedHosts:readonly string[]):NormalisedAuthority {
  if(!EXTERNAL_ID_PATTERN.test(input.externalId))throw new Error('LEGAL_AUTHORITY_EXTERNAL_ID_INVALID');
  const title=input.title.trim().normalize('NFKC');
  if(!title||title.length>2000)throw new Error('LEGAL_AUTHORITY_TITLE_INVALID');
  const citation=input.citation?.trim().normalize('NFKC')||null;
  if(citation&&citation.length>512)throw new Error('LEGAL_AUTHORITY_CITATION_INVALID');
  const languageCode=input.languageCode?.trim()||null;
  if(languageCode&&!LANGUAGE_PATTERN.test(languageCode))throw new Error('LEGAL_AUTHORITY_LANGUAGE_INVALID');
  const publicationDate=input.publicationDate??null;
  if(publicationDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)||Number.isNaN(Date.parse(publicationDate+'T00:00:00.000Z'))||new Date(publicationDate+'T00:00:00.000Z').toISOString().slice(0,10)!==publicationDate)) {
    throw new Error('LEGAL_AUTHORITY_PUBLICATION_DATE_INVALID');
  }
  const metadata=input.metadata??{};
  if(Array.isArray(metadata)||typeof metadata!=='object'||metadata===null)throw new Error('LEGAL_AUTHORITY_METADATA_INVALID');
  const serialisedMetadata=JSON.stringify(metadata);
  if(serialisedMetadata===undefined||Buffer.byteLength(serialisedMetadata,'utf8')>MAX_METADATA_BYTES)throw new Error('LEGAL_AUTHORITY_METADATA_TOO_LARGE');
  const normalisedText=normaliseLegalText(sourceText);
  if(!normalisedText)throw new Error('LEGAL_AUTHORITY_SOURCE_TEXT_EMPTY');
  const relationshipTypes=LEGAL_AUTHORITY_RELATIONSHIP_TYPES;
  const relationships=input.relationships??[];
  if(!Array.isArray(relationships)||relationships.length>100)throw new Error('LEGAL_AUTHORITY_RELATIONSHIPS_INVALID');
  const normalisedRelationships=relationships.map(relationship=>{
    if(!relationship||typeof relationship.targetExternalId!=='string'||
      !EXTERNAL_ID_PATTERN.test(relationship.targetExternalId)||
      !relationshipTypes.includes(relationship.relationshipType))throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_INVALID');
    const effectiveFrom=relationship.effectiveFrom??null;
    if(effectiveFrom&&(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)||
      Number.isNaN(Date.parse(effectiveFrom+'T00:00:00.000Z'))||
      new Date(effectiveFrom+'T00:00:00.000Z').toISOString().slice(0,10)!==effectiveFrom)) {
      throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_DATE_INVALID');
    }
    const sourceNote=relationship.sourceNote?.trim()||null;
    if(sourceNote&&sourceNote.length>2000)throw new Error('LEGAL_AUTHORITY_RELATIONSHIP_NOTE_INVALID');
    return {
      targetExternalId:relationship.targetExternalId,relationshipType:relationship.relationshipType,
      effectiveFrom,sourceNote,
      provenanceUri:validateCanonicalUri(relationship.provenanceUri,allowedHosts),
    };
  });
  return {
    externalId:input.externalId,citation,title,authorityType:input.authorityType,
    issuingBody:input.issuingBody?.trim()||null,languageCode,
    canonicalUri:validateCanonicalUri(input.canonicalUri,allowedHosts),publicationDate,
    legalStatus:input.legalStatus??'unknown',metadata,sourceContentHash:sha256(sourceText),
    normalisedText,normalisedContentHash:sha256(normalisedText),relationships:normalisedRelationships,
  };
}
export function createPassages(text:string,maxCharacters=6000,overlap=500):PassageDraft[] {
  const normalised=normaliseLegalText(text);
  if(!normalised)return [];
  if(!Number.isInteger(maxCharacters)||maxCharacters<256)throw new Error('PASSAGE_MAX_CHARACTERS_INVALID');
  if(!Number.isInteger(overlap)||overlap<0||overlap>=maxCharacters)throw new Error('PASSAGE_OVERLAP_INVALID');
  const passages:PassageDraft[]=[];
  let start=0;
  while(start<normalised.length){
    let end=Math.min(start+maxCharacters,normalised.length);
    if(end<normalised.length){
      const boundary=normalised.lastIndexOf('\n',end);
      if(boundary>start+Math.floor(maxCharacters*0.6))end=boundary;
    }
    if(end<=start)end=Math.min(start+maxCharacters,normalised.length);
    const content=normalised.slice(start,end).trim();
    if(content){
      const leadingTrim=normalised.slice(start,end).indexOf(content);
      const actualStart=start+Math.max(0,leadingTrim);
      passages.push({ordinal:passages.length,startOffset:actualStart,endOffset:actualStart+content.length,content,contentHash:sha256(content)});
    }
    if(end>=normalised.length)break;
    start=Math.max(start+1,end-overlap);
  }
  return passages;
}
