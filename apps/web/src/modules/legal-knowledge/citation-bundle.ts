import type {RankedLegalPassage} from './retrieval.ts';

export interface CitationSourceMetadata {
  sourceKey:string;
  sourceName:string;
  issuingAuthority:string;
  licenceIdentifier:string;
  attributionText:string;
  rightsStatus:'review_required'|'approved'|'restricted'|'prohibited';
  displayPermitted:boolean;
  quotePermitted:boolean;
}
export interface LegalCitationBundleInput {
  answerId:string;
  jurisdictionCode:string;
  asOfDate:string;
  passageIds:readonly string[];
  retrievedPassages:readonly RankedLegalPassage[];
  sources:Readonly<Record<string,CitationSourceMetadata>>;
}
export interface LegalCitationEntry {
  passageId:string;
  authorityId:string;
  authorityVersionId:string;
  jurisdictionCode:string;
  officialCitation:string|null;
  title:string;
  pinpoint:string|null;
  sourceUri:string|null;
  sourceContentHash:string;
  legalEffectivePeriod:{from:string|null;untilExclusive:string|null};
  sourceAttribution:string;
  licenceIdentifier:string;
  quotePermitted:boolean;
  displayPermitted:boolean;
}
export interface LegalCitationBundle {
  answerId:string;
  jurisdictionCode:string;
  asOfDate:string;
  entries:LegalCitationEntry[];
  warnings:string[];
  complete:boolean;
}
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function isDate(value:string):boolean {
  return DATE.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00.000Z'))&&
    new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
}
export function buildLegalCitationBundle(input:LegalCitationBundleInput):LegalCitationBundle {
  if(!input.answerId.trim()||input.answerId.length>128)throw new Error('LEGAL_CITATION_ANSWER_ID_INVALID');
  if(!/^[A-Z][A-Z0-9_-]{1,15}$/.test(input.jurisdictionCode))throw new Error('LEGAL_CITATION_JURISDICTION_INVALID');
  if(!isDate(input.asOfDate))throw new Error('LEGAL_CITATION_AS_OF_DATE_INVALID');
  const byId=new Map(input.retrievedPassages.map(p=>[p.passageId,p]));
  const warnings:string[]=[];
  const uniqueIds=[...new Set(input.passageIds)];
  const entries:LegalCitationEntry[]=[];
  for(const passageId of uniqueIds){
    const passage=byId.get(passageId);
    if(!passage){warnings.push('Citation passage was not part of the retrieval result: '+passageId);continue;}
    if(passage.jurisdictionCode!==input.jurisdictionCode){warnings.push('Citation passage belongs to a different jurisdiction: '+passageId);continue;}
    const source=input.sources[passage.sourceKey??''];
    if(!source){warnings.push('Source attribution metadata is missing for passage: '+passageId);continue;}
    if(source.rightsStatus!=='approved'||!source.displayPermitted){
      warnings.push('Source display is not approved for passage: '+passageId);continue;
    }
    if(!source.licenceIdentifier.trim()||!source.attributionText.trim()){
      warnings.push('Licence or attribution evidence is incomplete for passage: '+passageId);continue;
    }
    const pinpoint=[passage.sectionPath.length?passage.sectionPath.join(' > '):null,
      passage.pageNumber?('p. '+passage.pageNumber):null].filter(Boolean).join(', ')||null;
    entries.push({
      passageId,authorityId:passage.authorityId,authorityVersionId:passage.authorityVersionId,
      jurisdictionCode:passage.jurisdictionCode,officialCitation:passage.citation,
      title:passage.authorityTitle,pinpoint,sourceUri:passage.sourceUri,
      sourceContentHash:passage.sourceContentHash,
      legalEffectivePeriod:{from:passage.validFrom,untilExclusive:passage.validUntil},
      sourceAttribution:source.attributionText,licenceIdentifier:source.licenceIdentifier,
      quotePermitted:source.quotePermitted,displayPermitted:source.displayPermitted,
    });
    if(!passage.citation)warnings.push('Official citation is unavailable; title is shown without inventing a citation: '+passage.title);
    if(!source.quotePermitted)warnings.push('Quotation is not permitted; cite the authority without reproducing source text: '+passage.title);
  }
  if(entries.length===0)warnings.push('No verifiable citations could be assembled for this answer.');
  return {answerId:input.answerId,jurisdictionCode:input.jurisdictionCode,asOfDate:input.asOfDate,entries,warnings,complete:entries.length===uniqueIds.length&&uniqueIds.length>0&&warnings.length===0};
}
