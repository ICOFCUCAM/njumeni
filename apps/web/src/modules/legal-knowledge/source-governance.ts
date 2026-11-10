export interface LegalSourceRightsEvidence {
  sourceKey:string;
  licenceIdentifier:string;
  licenceVersion:string|null;
  termsUri:string;
  attributionText:string;
  reviewedBy:string;
  reviewedAt:string;
  permissions:{
    retrieve:boolean;
    store:boolean;
    normalise:boolean;
    index:boolean;
    quote:boolean;
    display:boolean;
    redistribute:boolean;
  };
  restrictions:readonly string[];
  reviewExpiresAt:string|null;
}
export interface LegalSourceActivation {
  rightsStatus:'review_required'|'approved'|'restricted'|'prohibited';
  sourceStatus:'planned'|'active'|'paused'|'retired';
  ingestionEnabled:boolean;
}
const KEY=/^[a-z][a-z0-9._-]{1,79}$/;
function validTimestamp(value:string):boolean {
  return !Number.isNaN(Date.parse(value))&&new Date(value).toISOString()===value;
}
export function validateLegalSourceRightsEvidence(evidence:LegalSourceRightsEvidence,now=new Date()):void {
  if(!KEY.test(evidence.sourceKey)||!evidence.licenceIdentifier.trim()||
    (evidence.licenceVersion!==null&&!evidence.licenceVersion.trim())||
    !evidence.attributionText.trim()||!evidence.reviewedBy.trim()||
    !validTimestamp(evidence.reviewedAt))throw new Error('LEGAL_SOURCE_RIGHTS_EVIDENCE_INVALID');
  let terms:URL;
  try{terms=new URL(evidence.termsUri);}catch{throw new Error('LEGAL_SOURCE_TERMS_URI_INVALID');}
  if(terms.protocol!=='https:'||terms.username||terms.password)throw new Error('LEGAL_SOURCE_TERMS_URI_INVALID');
  if(evidence.reviewExpiresAt!==null){
    if(!validTimestamp(evidence.reviewExpiresAt)||Date.parse(evidence.reviewExpiresAt)<=now.getTime()) {
      throw new Error('LEGAL_SOURCE_RIGHTS_REVIEW_EXPIRED');
    }
  }
  if(evidence.restrictions.some(item=>!item.trim()||item.length>500))throw new Error('LEGAL_SOURCE_RESTRICTION_INVALID');
}
export function assertLegalSourceCanIngest(
  activation:LegalSourceActivation,
  evidence:LegalSourceRightsEvidence,
  now=new Date(),
):void {
  validateLegalSourceRightsEvidence(evidence,now);
  const required:readonly (keyof LegalSourceRightsEvidence['permissions'])[]=['retrieve','store','normalise','index'];
  if(activation.rightsStatus!=='approved'||activation.sourceStatus!=='active'||!activation.ingestionEnabled||
    required.some(permission=>!evidence.permissions[permission])) {
    throw new Error('LEGAL_SOURCE_INGESTION_PERMISSION_DENIED');
  }
}
export function assertLegalSourceCanDisplay(evidence:LegalSourceRightsEvidence,now=new Date()):void {
  validateLegalSourceRightsEvidence(evidence,now);
  if(!evidence.permissions.display) {
    throw new Error('LEGAL_SOURCE_DISPLAY_PERMISSION_DENIED');
  }
}
export function assertLegalSourceCanQuote(evidence:LegalSourceRightsEvidence,now=new Date()):void {
  validateLegalSourceRightsEvidence(evidence,now);
  if(!evidence.permissions.quote)throw new Error('LEGAL_SOURCE_QUOTATION_PERMISSION_DENIED');
}
export function assertLegalSourceCanRedistribute(evidence:LegalSourceRightsEvidence,now=new Date()):void {
  validateLegalSourceRightsEvidence(evidence,now);
  if(!evidence.permissions.redistribute)throw new Error('LEGAL_SOURCE_REDISTRIBUTION_DENIED');
}
