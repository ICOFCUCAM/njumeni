export interface JurisdictionSourceCoverage {
  sourceKey:string;
  rightsStatus:'review_required'|'approved'|'restricted'|'prohibited';
  sourceStatus:'planned'|'active'|'paused'|'retired';
  ingestionEnabled:boolean;
  authorityTypes:readonly string[];
  languages:readonly string[];
  lastVerifiedAt:string|null;
  coverageFrom?:string|null;
  coverageUntil?:string|null;
  knownGaps:readonly string[];
}
/** Master Plan v2.0 §6.7 coverage levels, lowest to highest. */
export type JurisdictionCoverageLevel='catalogued'|'planned'|'pilot'|'partial'|'supported';
export const JURISDICTION_COVERAGE_LEVELS:readonly JurisdictionCoverageLevel[]=Object.freeze([
  'catalogued','planned','pilot','partial','supported',
]);
export interface JurisdictionCoverageEvaluation {
  datasetKey:string;
  datasetVersion:number;
  passed:boolean;
  evaluatedAt:string;
}
export interface JurisdictionCoverageProfile {
  jurisdictionCode:string;
  requestedAuthorityTypes:readonly string[];
  requestedLanguages:readonly string[];
  sources:readonly JurisdictionSourceCoverage[];
  reviewIntervalDays:number;
  /** False only for jurisdictions that are merely catalogued and not scheduled for work. */
  onRoadmap?:boolean;
  /** Latest recorded retrieval evaluation (required for 'partial'). */
  latestEvaluation?:JurisdictionCoverageEvaluation|null;
  /** Evidence required for 'supported' (Phases 4 and 6). */
  citationVerificationPassed?:boolean;
  updateMonitoringSlaMet?:boolean;
}
export interface JurisdictionCoverageAssessment {
  status:JurisdictionCoverageLevel;
  supportedAuthorityTypes:string[];
  unsupportedAuthorityTypes:string[];
  supportedLanguages:string[];
  unsupportedLanguages:string[];
  staleSources:string[];
  disabledSources:string[];
  knownGaps:string[];
  reasons:string[];
}

function isIsoDate(value:string):boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)&&
    !Number.isNaN(Date.parse(value+'T00:00:00.000Z'))&&
    new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
}
function isRecent(date:string|null,now:Date,intervalDays:number):boolean {
  if(!date||Number.isNaN(Date.parse(date)))return false;
  const age=now.getTime()-Date.parse(date);
  return age>=0&&age<=intervalDays*24*60*60*1000;
}

export function assessJurisdictionCoverage(
  profile:JurisdictionCoverageProfile,
  now=new Date(),
):JurisdictionCoverageAssessment {
  if(!/^[A-Z][A-Z0-9_-]{1,15}$/.test(profile.jurisdictionCode))throw new Error('JURISDICTION_CODE_INVALID');
  if(!Number.isInteger(profile.reviewIntervalDays)||profile.reviewIntervalDays<1||profile.reviewIntervalDays>365) {
    throw new Error('JURISDICTION_COVERAGE_REVIEW_INTERVAL_INVALID');
  }
  for(const source of profile.sources){
    if((source.coverageFrom&&!isIsoDate(source.coverageFrom))||
      (source.coverageUntil&&!isIsoDate(source.coverageUntil))||
      (source.coverageFrom&&source.coverageUntil&&source.coverageFrom>=source.coverageUntil)) {
      throw new Error('JURISDICTION_SOURCE_COVERAGE_DATES_INVALID');
    }
  }
  const today=now.toISOString().slice(0,10);
  const eligibleSources=profile.sources.filter(source=>
    source.rightsStatus==='approved'&&source.sourceStatus==='active'&&source.ingestionEnabled&&
    (!source.coverageFrom||source.coverageFrom<=today)&&
    (!source.coverageUntil||today<source.coverageUntil)
  );
  const usable=eligibleSources.filter(source=>
    isRecent(source.lastVerifiedAt,now,profile.reviewIntervalDays)
  );
  const staleSources=profile.sources.filter(source=>
    source.rightsStatus==='approved'&&source.sourceStatus==='active'&&source.ingestionEnabled&&
    (!isRecent(source.lastVerifiedAt,now,profile.reviewIntervalDays)||
      (source.coverageFrom!==undefined&&source.coverageFrom!==null&&source.coverageFrom>now.toISOString().slice(0,10))||
      (source.coverageUntil!==undefined&&source.coverageUntil!==null&&now.toISOString().slice(0,10)>=source.coverageUntil))
  ).map(source=>source.sourceKey);
  const disabledSources=profile.sources.filter(source=>
    source.rightsStatus==='approved'&&source.sourceStatus==='active'&&!source.ingestionEnabled
  ).map(source=>source.sourceKey);
  const supportedAuthorityTypes=profile.requestedAuthorityTypes.filter(type=>
    usable.some(source=>source.authorityTypes.includes(type))
  );
  const unsupportedAuthorityTypes=profile.requestedAuthorityTypes.filter(type=>!supportedAuthorityTypes.includes(type));
  const supportedLanguages=profile.requestedLanguages.filter(language=>
    usable.some(source=>source.languages.includes(language))
  );
  const unsupportedLanguages=profile.requestedLanguages.filter(language=>!supportedLanguages.includes(language));
  const knownGaps=[...new Set(profile.sources.flatMap(source=>source.knownGaps))];
  const reasons:string[]=[];
  if(profile.requestedAuthorityTypes.length===0)reasons.push('No authority classes have been declared for coverage.');
  if(profile.requestedLanguages.length===0)reasons.push('No supported languages have been declared for coverage.');
  if(unsupportedAuthorityTypes.length)reasons.push('One or more requested authority classes lack a current, rights-approved source.');
  if(unsupportedLanguages.length)reasons.push('One or more requested languages lack a current, rights-approved source.');
  if(staleSources.length)reasons.push('One or more active sources have stale coverage verification.');
  if(disabledSources.length)reasons.push('One or more approved sources are not enabled for ingestion and cannot support live retrieval.');
  if(knownGaps.length)reasons.push('Known source or coverage gaps must be disclosed to users.');
  const complete=profile.requestedAuthorityTypes.length>0&&profile.requestedLanguages.length>0&&unsupportedAuthorityTypes.length===0&&
    unsupportedLanguages.length===0&&staleSources.length===0;
  const evaluation=profile.latestEvaluation??null;
  const evaluationPassing=evaluation!==null&&evaluation.passed&&
    isRecent(evaluation.evaluatedAt,now,profile.reviewIntervalDays);
  if(eligibleSources.length>0&&complete){
    if(!evaluation)reasons.push('No retrieval evaluation has been recorded for this jurisdiction.');
    else if(!evaluation.passed)reasons.push('The latest retrieval evaluation did not pass its gates.');
    else if(!evaluationPassing)reasons.push('The latest retrieval evaluation is older than the review interval.');
  }
  const verified=profile.citationVerificationPassed===true&&profile.updateMonitoringSlaMet===true;
  if(eligibleSources.length>0&&complete&&evaluationPassing&&!verified) {
    reasons.push('Citation verification and update-monitoring evidence are required for full support.');
  }
  // Each level requires all evidence of the levels below it; coverage never exceeds evidence.
  const status:JurisdictionCoverageLevel=
    eligibleSources.length===0?(profile.onRoadmap===false?'catalogued':'planned'):
    !complete||!evaluationPassing?'pilot':
    verified?'supported':'partial';
  return {
    status,
    supportedAuthorityTypes,unsupportedAuthorityTypes,supportedLanguages,unsupportedLanguages,
    staleSources,disabledSources,knownGaps,reasons,
  };
}
