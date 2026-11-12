import type { LegalReranker, RerankedLegalPassage } from './reranker.ts';

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
  /** Jurisdictions whose law also applies (OHADA for CM, EU via EEA for NO). Off unless given. */
  relatedJurisdictionCodes?:readonly string[];
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
  relatedJurisdictionCodes?:string[];
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
  const related=[...new Set(input.relatedJurisdictionCodes??[])].filter(code=>code!==input.jurisdictionCode).sort();
  if(related.some(code=>!/^[A-Z][A-Z0-9_-]{1,15}$/.test(code)))throw new Error('LEGAL_RETRIEVAL_JURISDICTION_INVALID');
  return {
    ...(related.length?{relatedJurisdictionCodes:related}:{}),
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
    (candidate.jurisdictionCode===plan.jurisdictionCode||(plan.relatedJurisdictionCodes??[]).includes(candidate.jurisdictionCode))&&
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

export interface RoutedAuthority { authorityId:string; routeScore:number }
export interface LegalPassageSearchProvider {
  searchLexical(plan:RetrievalPlan):Promise<readonly RetrievalCandidate[]>;
  searchSemantic(plan:RetrievalPlan):Promise<readonly RetrievalCandidate[]>;
  /** Authority routing (legal-route-1.0.0): the acts closest to the question, by centroid. */
  routeAuthorities?(plan:RetrievalPlan,limit:number):Promise<readonly RoutedAuthority[]>;
  /** Semantic search restricted to the given authorities. */
  searchSemanticWithin?(plan:RetrievalPlan,authorityIds:readonly string[]):Promise<readonly RetrievalCandidate[]>;
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
/**
 * Why retrieval abstained (returned nothing although candidates existed):
 *   version_not_held  the authority that answers the question today has no version in force on the
 *                     as-of date in the corpus, so answering from other texts would mislead;
 *   out_of_scope      no passage is close enough in meaning to the question.
 */
export type RetrievalAbstentionReason='version_not_held'|'out_of_scope';
export interface RetrievalObservation {
  poolSize:number;
  bestLexicalScore:number|null;
  bestSemanticScore:number|null;
  abstention:RetrievalAbstentionReason|null;
  /** With routing: the routed acts and their centroid similarity, best first. */
  routed:readonly RoutedAuthority[];
  /** With the temporal check: the authority that answers the question under current law. */
  currentTopAuthorityId:string|null;
}
// Abstention policy, applied after reranking (legal-abstain-1.0.0).
export const LEGAL_ABSTENTION_VERSION='legal-abstain-1.0.0';
/**
 * The production abstention policy (decided 2026-11-12 from pre-registered runs).
 * - Temporal coverage ON. lovdata-no-v1: abstention 1/2 → its temporal case fixed, recall unchanged
 *   (0.974). Held-out lovdata-no-holdout-v1: all 3 temporal cases abstain; cost: one past-dated
 *   question whose first-stage answer is wrong today now abstains instead of answering (recall
 *   0.778 → 0.741). Declining is preferred to answering a past-date question from other law.
 * - Semantic floor OFF: not separable. Out-of-scope questions score 0.81–0.87, answerable ones from
 *   0.845 (held-out) and 0.860 (v1); the lunar-mining case scores 0.870. No threshold separates them.
 */
export interface LegalAbstentionPolicy {
  temporalCoverage:boolean;
  minSemanticScore:number|null;
}
export const CALIBRATED_ABSTENTION:Readonly<LegalAbstentionPolicy>=Object.freeze({
  temporalCoverage:true,
  minSemanticScore:null,
});
/**
 * Production routing policy (legal-route-1.0.0). Off until measured: enabled only if the
 * development sets improve and a fresh held-out set confirms it.
 */
export const LEGAL_ROUTING_VERSION='legal-route-1.0.0';
export const CALIBRATED_ROUTING:Readonly<{authorities:number;passagesPerAuthority:number;minRouteScore:number|null}>|null=null;
/** Retrieval options for an abstention policy; currentDate is today (UTC) unless given. */
export function abstentionOptions(policy:Readonly<LegalAbstentionPolicy>,currentDate=new Date().toISOString().slice(0,10)):
  Pick<LegalRetrievalOptions,'temporalCoverage'|'minSemanticScore'> {
  return {
    ...(policy.temporalCoverage?{temporalCoverage:{currentDate}}:{}),
    ...(policy.minSemanticScore===null?{}:{minSemanticScore:policy.minSemanticScore}),
  };
}
export interface LegalRetrievalOptions {
  /** Second stage. The first stage then searches a wider pool (3 × limit, 30 to 50 passages). */
  reranker?:LegalReranker;
  /** The question as asked (for provision and citation matching); defaults to the query text. */
  question?:string;
  /**
   * Temporal coverage check (needs the reranker): for a question about a date before currentDate,
   * the same question is also answered under current law. If its top authority is absent from the
   * dated answer, the corpus does not hold the version in force on that date: abstain.
   */
  temporalCoverage?:{currentDate:string};
  /** Abstain (out_of_scope) when no candidate's semantic score reaches this. Semantic/hybrid only. */
  minSemanticScore?:number;
  /**
   * Authority routing (semantic and hybrid only): also search within the `authorities` acts whose
   * passage centroid is closest to the question, taking up to `passagesPerAuthority` passages
   * from each into the first-stage pool.
   */
  routing?:{authorities:number;passagesPerAuthority?:number};
  /** Abstain (out_of_scope) when no act's centroid similarity reaches this. Needs routing. */
  minRouteScore?:number;
  /** Receives what retrieval saw and why it abstained (for limitations and evaluation diagnostics). */
  observe?:(observation:RetrievalObservation)=>void;
}
// Routed passages join the pool; a passage found both ways keeps its lexical score and gets the
// semantic score. At most perAuthority routed passages per act.
function mergeRoutedCandidates(pool:readonly RetrievalCandidate[],within:readonly RetrievalCandidate[],perAuthority:number):RetrievalCandidate[] {
  const merged=new Map(pool.map(c=>[c.passageId,c]));
  const count=new Map<string,number>();
  for(const candidate of within){
    const n=count.get(candidate.authorityId)??0;
    if(n>=perAuthority)continue;
    count.set(candidate.authorityId,n+1);
    const existing=merged.get(candidate.passageId);
    if(existing)merged.set(candidate.passageId,{...existing,semanticScore:existing.semanticScore??candidate.semanticScore});
    else merged.set(candidate.passageId,{...candidate,lexicalScore:null});
  }
  return [...merged.values()];
}
async function searchCandidates(plan:RetrievalPlan,provider:LegalPassageSearchProvider):Promise<readonly RetrievalCandidate[]> {
  if(plan.mode==='lexical')return provider.searchLexical(plan);
  if(plan.mode==='semantic')return provider.searchSemantic(plan);
  const [lexical,semantic]=await Promise.all([
    provider.searchLexical(plan),provider.searchSemantic(plan),
  ]);
  return mergeRetrievalCandidates(lexical,semantic);
}
export async function executeLegalRetrieval(
  plan:RetrievalPlan,
  provider:LegalPassageSearchProvider,
):Promise<RankedLegalPassage[]>;
export async function executeLegalRetrieval(
  plan:RetrievalPlan,
  provider:LegalPassageSearchProvider,
  options:LegalRetrievalOptions&{reranker:LegalReranker},
):Promise<RerankedLegalPassage[]>;
export async function executeLegalRetrieval(
  plan:RetrievalPlan,
  provider:LegalPassageSearchProvider,
  options?:LegalRetrievalOptions,
):Promise<RankedLegalPassage[]>;
export async function executeLegalRetrieval(
  plan:RetrievalPlan,
  provider:LegalPassageSearchProvider,
  options:LegalRetrievalOptions={},
):Promise<RankedLegalPassage[]> {
  if(!options.reranker){
    if(options.temporalCoverage||options.minSemanticScore!==undefined)throw new Error('LEGAL_RETRIEVAL_ABSTENTION_NEEDS_RERANKER');
    return rankLegalPassages(plan,await searchCandidates(plan,provider));
  }
  const reranker=options.reranker;
  const question=options.question??plan.queryText;
  const routing=options.routing;
  if(routing&&(!Number.isInteger(routing.authorities)||routing.authorities<1||routing.authorities>20||
    (routing.passagesPerAuthority!==undefined&&(!Number.isInteger(routing.passagesPerAuthority)||routing.passagesPerAuthority<1||routing.passagesPerAuthority>10))))
    throw new Error('LEGAL_RETRIEVAL_OPTIONS_INVALID');
  if(options.minRouteScore!==undefined&&(!routing||!(options.minRouteScore>=0&&options.minRouteScore<1)))
    throw new Error('LEGAL_RETRIEVAL_OPTIONS_INVALID');
  const rerankAt=async(target:RetrievalPlan)=>{
    const poolPlan:RetrievalPlan={...target,limit:Math.min(50,Math.max(target.limit*3,30))};
    let candidates=await searchCandidates(poolPlan,provider);
    let routed:readonly RoutedAuthority[]=[];
    if(routing&&target.mode!=='lexical'){
      if(!provider.routeAuthorities||!provider.searchSemanticWithin)throw new Error('LEGAL_RETRIEVAL_ROUTING_NOT_SUPPORTED');
      routed=await provider.routeAuthorities(target,routing.authorities);
      if(routed.length){
        const within=await provider.searchSemanticWithin(
          {...target,limit:Math.min(50,routed.length*(routing.passagesPerAuthority??3))},routed.map(r=>r.authorityId));
        candidates=mergeRoutedCandidates(candidates,within,routing.passagesPerAuthority??3);
      }
    }
    const pool=rankLegalPassages(poolPlan,candidates);
    return {pool,routed,result:reranker.rerank(target,question,pool)};
  };
  const {pool,routed,result:reranked}=await rerankAt(plan);
  let result=reranked;
  const best=(key:'lexicalScore'|'semanticScore')=>pool.reduce<number|null>(
    (max,p)=>p[key]===null?max:max===null?p[key]:Math.max(max,p[key]),null);
  let abstention:RetrievalAbstentionReason|null=null;
  let currentTopAuthorityId:string|null=null;
  if(options.minRouteScore!==undefined&&plan.mode!=='lexical'&&result.length&&
    (routed[0]?.routeScore??0)<options.minRouteScore){
    abstention='out_of_scope';
    result=[];
  }
  if(options.minSemanticScore!==undefined){
    if(!(options.minSemanticScore>=0&&options.minSemanticScore<1))throw new Error('LEGAL_RETRIEVAL_OPTIONS_INVALID');
    const semantic=best('semanticScore');
    if(!abstention&&plan.mode!=='lexical'&&result.length&&(semantic===null||semantic<options.minSemanticScore)){
      abstention='out_of_scope';
      result=[];
    }
  }
  if(!abstention&&result.length&&options.temporalCoverage){
    const currentDate=options.temporalCoverage.currentDate;
    if(!validDate(currentDate))throw new Error('LEGAL_RETRIEVAL_OPTIONS_INVALID');
    if(plan.asOfDate<currentDate){
      const current=(await rerankAt({...plan,asOfDate:currentDate})).result;
      currentTopAuthorityId=current[0]?.authorityId??null;
      if(currentTopAuthorityId&&!result.some(p=>p.authorityId===currentTopAuthorityId)){
        abstention='version_not_held';
        result=[];
      }
    }
  }
  options.observe?.({poolSize:pool.length,bestLexicalScore:best('lexicalScore'),bestSemanticScore:best('semanticScore'),
    abstention,currentTopAuthorityId,routed});
  return result;
}
