import {
  createRetrievalPlan,
  executeLegalRetrieval,
  type LegalPassageSearchProvider,
  type RetrievalQuery,
  type RankedLegalPassage,
} from './retrieval.ts';
import {
  buildLegalCitationBundle,
  type CitationSourceMetadata,
  type LegalCitationBundle,
} from './citation-bundle.ts';

export interface LegalKnowledgeSearchInput extends RetrievalQuery {
  requestId:string;
  provider:LegalPassageSearchProvider;
  sourceMetadata:Readonly<Record<string,CitationSourceMetadata>>;
}
export interface LegalKnowledgeSearchResult {
  requestId:string;
  jurisdictionCode:string;
  asOfDate:string;
  queryMode:'lexical'|'semantic'|'hybrid';
  passages:RankedLegalPassage[];
  citations:LegalCitationBundle;
  resultCount:number;
  warnings:string[];
}
export async function searchLegalKnowledge(input:LegalKnowledgeSearchInput):Promise<LegalKnowledgeSearchResult> {
  if(!input.requestId.trim()||input.requestId.length>128)throw new Error('LEGAL_SEARCH_REQUEST_ID_INVALID');
  const plan=createRetrievalPlan(input);
  const passages=await executeLegalRetrieval(plan,input.provider);
  const citations=buildLegalCitationBundle({
    answerId:input.requestId,jurisdictionCode:plan.jurisdictionCode,asOfDate:plan.asOfDate,
    passageIds:passages.map(passage=>passage.passageId),retrievedPassages:passages,sources:input.sourceMetadata,
  });
  const warnings=[...citations.warnings];
  if(passages.length===0)warnings.push('No matching authority passages were found for this jurisdiction, date and language scope.');
  return {
    requestId:input.requestId,jurisdictionCode:plan.jurisdictionCode,asOfDate:plan.asOfDate,
    queryMode:plan.mode,passages,citations,resultCount:passages.length,warnings,
  };
}
