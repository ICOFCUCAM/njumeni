export type RetrievalMode='lexical'|'semantic'|'hybrid';
export interface RetrievalQuery {
  query:string;
  jurisdictionCode:string;
  asOfDate:string;
  languageCodes:readonly string[];
  authorityTypes?:readonly string[];
  mode:RetrievalMode;
  limit?:number;
  minimumScore?:number;
}
export interface RetrievalCandidate {
  passageId:string;
  authorityId:string;
  authorityVersionId:string;
  authorityTitle:string;
  citation:string|null;
  jurisdictionCode:string;
  authorityType:string;
  languageCode:string|null;
  legalStatus:'in_force'|'amended'|'repealed'|'expired'|'overruled'|'unknown';
  validFrom:string|null;
  validUntil:string|null;
  sourceUri:string|null;
  sourceKey:string;
  sourceContentHash:string;
  passageContent:string;
  pageNumber:number|null;
  sectionPath:readonly string[];
  lexicalScore:number|null;
  semanticScore:number|null;
}
export interface RankedLegalPassage extends RetrievalCandidate {
  score:number;
  rank:number;
  citationLabel:string;
}
export interface RetrievalPlan {
  jurisdictionCode:string;
  asOfDate:string;
  languageCodes:string[];
  authorityTypes:string[];
  mode:RetrievalMode;
  limit:number;
  minimumScore:number;
  queryText:string;
  requireEffectiveAtDate:true;
  excludeStatuses:readonly ['repealed','expired','overruled'];
}
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value:string):boolean {
  return DATE.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00.000Z'))&&
    new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
}
export function createRetrievalPlan(input:RetrievalQuery):RetrievalPlan {
  const queryText=input.query.trim().normalize('NFKC');
  if(!queryText||queryText.length>4000)throw new Error('LEGAL_RETRIEVAL_QUERY_INVALID');
  if(!/^[A-Z][A-Z0-9_-]{1,15}$/.test(input.jurisdictionCode))throw new Error('LEGAL_RETRIEVAL_JURISDICTION_INVALID');
  if(!validDate(input.asOfDate))throw new Error('LEGAL_RETRIEVAL_DATE_INVALID');
  if(!input.languageCodes.length||input.languageCodes.some(x=>!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(x))) {
    throw new Error('LEGAL_RETRIEVAL_LANGUAGE_INVALID');
  }
  if(!['lexical','semantic','hybrid'].includes(input.mode))throw new Error('LEGAL_RETRIEVAL_MODE_INVALID');
  const limit=input.limit??12;
  if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('LEGAL_RETRIEVAL_LIMIT_INVALID');
  const minimumScore=input.minimumScore??0.12;
  if(!Number.isFinite(minimumScore)||minimumScore<0||minimumScore>1)throw new Error('LEGAL_RETRIEVAL_SCORE_INVALID');
  return {
    jurisdictionCode:input.jurisdictionCode,asOfDate:input.asOfDate,
    languageCodes:[...new Set(input.languageCodes)].sort(),
    authorityTypes:[...new Set(input.authorityTypes??[])].sort(),
    mode:input.mode,limit,minimumScore,queryText,
    requireEffectiveAtDate:true,excludeStatuses:['repealed','expired','overruled'],
  };
}
function effectiveOn(candidate:RetrievalCandidate,date:string):boolean {
  return (!candidate.validFrom||candidate.validFrom<=date)&&(!candidate.validUntil||date<candidate.validUntil);
}
function clamp(value:number):number {return Math.max(0,Math.min(1,value));}
export function rankLegalPassages(
  plan:RetrievalPlan,
  candidates:readonly RetrievalCandidate[],
):RankedLegalPassage[] {
  const filtered=candidates.filter(candidate=>
    candidate.jurisdictionCode===plan.jurisdictionCode&&
    plan.languageCodes.includes(candidate.languageCode??'')&&
    (!plan.authorityTypes.length||plan.authorityTypes.includes(candidate.authorityType))&&
    candidate.legalStatus!=='repealed'&&candidate.legalStatus!=='expired'&&candidate.legalStatus!=='overruled'&&
    effectiveOn(candidate,plan.asOfDate)&&
    (plan.mode==='lexical'?candidate.lexicalScore!==null:
      plan.mode==='semantic'?candidate.semanticScore!==null:
      candidate.lexicalScore!==null||candidate.semanticScore!==null)
  );
  const ranked=filtered.map(candidate=>{
    const lexical=candidate.lexicalScore===null?null:clamp(candidate.lexicalScore);
    const semantic=candidate.semanticScore===null?null:clamp(candidate.semanticScore);
    const score=plan.mode==='lexical'?(lexical??0):
      plan.mode==='semantic'?(semantic??0):
      (lexical===null?semantic??0:semantic===null?lexical:0.45*lexical+0.55*semantic);
    return {...candidate,score};
  }).filter(candidate=>candidate.score>=plan.minimumScore)
    .sort((a,b)=>b.score-a.score||a.authorityId.localeCompare(b.authorityId)||a.passageId.localeCompare(b.passageId))
    .slice(0,plan.limit);
  return ranked.map((candidate,index)=>({
    ...candidate,rank:index+1,
    citationLabel:[candidate.citation??candidate.authorityTitle,
      candidate.sectionPath.length?candidate.sectionPath.join(' > '):null,
      candidate.pageNumber?('p. '+candidate.pageNumber):null].filter(Boolean).join(', '),
  }));
}
export interface LegalAnswerEvidence {
  answerText:string;
  citedPassageIds:readonly string[];
  retrievedPassages:readonly RankedLegalPassage[];
  coverageComplete:boolean;
  sourceRightsApproved:boolean;
}
export interface LegalAnswerAssessment {
  canPresentAsGrounded:boolean;
  citedSources:RankedLegalPassage[];
  uncitedPassageIds:string[];
  unsupportedCitations:string[];
  warnings:string[];
}
export function assessLegalAnswerEvidence(input:LegalAnswerEvidence):LegalAnswerAssessment {
  const byId=new Map(input.retrievedPassages.map(p=>[p.passageId,p]));
  const unsupportedCitations=input.citedPassageIds.filter(id=>!byId.has(id));
  const citedSources=[...new Set(input.citedPassageIds)].flatMap(id=>{
    const passage=byId.get(id);return passage?[passage]:[];
  });
  const citedSet=new Set(input.citedPassageIds);
  const uncitedPassageIds=input.retrievedPassages.filter(p=>!citedSet.has(p.passageId)).map(p=>p.passageId);
  const warnings:string[]=[];
  if(!input.answerText.trim())warnings.push('The answer is empty.');
  if(!citedSources.length)warnings.push('No retrieved legal passage supports the answer.');
  if(unsupportedCitations.length)warnings.push('The answer references passage identifiers that were not retrieved.');
  if(!input.coverageComplete)warnings.push('Jurisdiction or source coverage is incomplete; disclose this limitation.');
  if(!input.sourceRightsApproved)warnings.push('Source rights are not approved for this material.');
  const canPresentAsGrounded=input.answerText.trim().length>0&&citedSources.length>0&&
    unsupportedCitations.length===0&&input.coverageComplete&&input.sourceRightsApproved;
  return {canPresentAsGrounded,citedSources,uncitedPassageIds,unsupportedCitations,warnings};
}

export interface LegalPassageSearchProvider {
  searchLexical(plan:RetrievalPlan):Promise<readonly RetrievalCandidate[]>;
  searchSemantic(plan:RetrievalPlan):Promise<readonly RetrievalCandidate[]>;
}
function mergeRetrievalCandidates(
  lexical:readonly RetrievalCandidate[],
  semantic:readonly RetrievalCandidate[],
):RetrievalCandidate[] {
  const merged=new Map<string,RetrievalCandidate>();
  for(const candidate of lexical)merged.set(candidate.passageId,{...candidate,semanticScore:null});
  for(const candidate of semantic){
    const existing=merged.get(candidate.passageId);
    if(existing){
      if(existing.authorityVersionId!==candidate.authorityVersionId||existing.authorityId!==candidate.authorityId){
        throw new Error('LEGAL_RETRIEVAL_PASSAGE_ID_COLLISION');
      }
      merged.set(candidate.passageId,{...existing,semanticScore:candidate.semanticScore});
    }else merged.set(candidate.passageId,{...candidate,lexicalScore:null});
  }
  return [...merged.values()];
}
export async function executeLegalRetrieval(
  plan:RetrievalPlan,
  provider:LegalPassageSearchProvider,
):Promise<RankedLegalPassage[]> {
  let candidates:readonly RetrievalCandidate[];
  if(plan.mode==='lexical')candidates=await provider.searchLexical(plan);
  else if(plan.mode==='semantic')candidates=await provider.searchSemantic(plan);
  else {
    const [lexical,semantic]=await Promise.all([
      provider.searchLexical(plan),provider.searchSemantic(plan),
    ]);
    candidates=mergeRetrievalCandidates(lexical,semantic);
  }
  return rankLegalPassages(plan,candidates);
}
