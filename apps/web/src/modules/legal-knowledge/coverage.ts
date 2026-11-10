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
export interface JurisdictionCoverageProfile {
  jurisdictionCode:string;
  requestedAuthorityTypes:readonly string[];
  requestedLanguages:readonly string[];
  sources:readonly JurisdictionSourceCoverage[];
  reviewIntervalDays:number;
}
export interface JurisdictionCoverageAssessment {
  status:'planned'|'pilot'|'supported';
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
  return {
    status:complete?'supported':eligibleSources.length>0?'pilot':'planned',
    supportedAuthorityTypes,unsupportedAuthorityTypes,supportedLanguages,unsupportedLanguages,
    staleSources,disabledSources,knownGaps,reasons,
  };
}
