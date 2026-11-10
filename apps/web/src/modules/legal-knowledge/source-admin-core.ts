import type { SupabaseClient } from '@supabase/supabase-js';

type RpcClient = Pick<SupabaseClient,'rpc'>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADAPTER_KEY=/^[a-z][a-z0-9._-]{1,79}$/;
const PERMISSIONS=['retrieve','store','normalise','index','quote','display','redistribute'] as const;
export interface LegalSourceRightsReviewInput {
  sourceId:string; reviewer:string; licenceIdentifier:string; licenceVersion:string|null;
  termsUri:string; attributionText:string; reviewedAt:string; reviewExpiresAt:string|null;
  permissions:Record<(typeof PERMISSIONS)[number],boolean>; restrictions:readonly string[];
}
export interface LegalSourceActivationInput {
  sourceId:string; operator:string; reason:string;
  status:'planned'|'active'|'paused'|'retired'; ingestionEnabled:boolean;
  adapterKey:string|null; adapterVersion:string|null;
}
export interface LegalSourceEnqueueInput {
  sourceId:string; adapterKey:string; adapterVersion:string; idempotencyKey:string; maxAttempts?:number;
}
function isoTimestamp(value:string):boolean {
  return !Number.isNaN(Date.parse(value))&&new Date(value).toISOString()===value;
}
function validSourceId(value:string):boolean { return UUID.test(value); }
export async function recordLegalSourceRightsReview(client:RpcClient,input:LegalSourceRightsReviewInput,now=new Date()) {
  if(!validSourceId(input.sourceId)||!input.reviewer.trim()||input.reviewer.length>200||
    !input.licenceIdentifier.trim()||input.licenceIdentifier.length>200||
    !input.attributionText.trim()||input.attributionText.length>2000||
    !isoTimestamp(input.reviewedAt)||Date.parse(input.reviewedAt)>now.getTime()||
    (input.reviewExpiresAt!==null&&(!isoTimestamp(input.reviewExpiresAt)||Date.parse(input.reviewExpiresAt)<=now.getTime()))||
    input.restrictions.length>100||input.restrictions.some(x=>!x.trim()||x.length>500)||
    PERMISSIONS.some(key=>typeof input.permissions[key]!=='boolean')) {
    throw new Error('LEGAL_SOURCE_RIGHTS_REVIEW_INPUT_INVALID');
  }
  let terms:URL;
  try{terms=new URL(input.termsUri);}catch{throw new Error('LEGAL_SOURCE_TERMS_URI_INVALID');}
  if(terms.protocol!=='https:'||terms.username||terms.password)throw new Error('LEGAL_SOURCE_TERMS_URI_INVALID');
  const {data,error}=await client.rpc('legal_source_record_rights_review',{
    p_source_id:input.sourceId,p_reviewer:input.reviewer.trim(),
    p_licence_identifier:input.licenceIdentifier.trim(),p_licence_version:input.licenceVersion,
    p_terms_uri:terms.toString(),p_attribution_text:input.attributionText.trim(),
    p_reviewed_at:input.reviewedAt,p_review_expires_at:input.reviewExpiresAt,
    p_permissions:input.permissions,p_restrictions:[...input.restrictions],
  });
  if(error)throw new Error('LEGAL_SOURCE_RIGHTS_REVIEW_SAVE_FAILED');
  if(!data||typeof data!=='object')throw new Error('LEGAL_SOURCE_RIGHTS_REVIEW_RESPONSE_INVALID');
  return data as Record<string,unknown>;
}
export async function setLegalSourceActivation(client:RpcClient,input:LegalSourceActivationInput) {
  if(!validSourceId(input.sourceId)||!input.operator.trim()||input.operator.length>200||
    input.reason.trim().length<10||input.reason.length>1000||
    !['planned','active','paused','retired'].includes(input.status)||
    typeof input.ingestionEnabled!=='boolean'||
    (input.ingestionEnabled&&(input.status!=='active'||!input.adapterKey||!ADAPTER_KEY.test(input.adapterKey)||
      !input.adapterVersion?.trim()||input.adapterVersion.length>80))) {
    throw new Error('LEGAL_SOURCE_ACTIVATION_INPUT_INVALID');
  }
  const {data,error}=await client.rpc('legal_source_set_activation',{
    p_source_id:input.sourceId,p_operator:input.operator.trim(),p_reason:input.reason.trim(),
    p_status:input.status,p_ingestion_enabled:input.ingestionEnabled,
    p_adapter_key:input.adapterKey,p_adapter_version:input.adapterVersion,
  });
  if(error)throw new Error('LEGAL_SOURCE_ACTIVATION_FAILED');
  if(!data||typeof data!=='object')throw new Error('LEGAL_SOURCE_ACTIVATION_RESPONSE_INVALID');
  return data as Record<string,unknown>;
}
export async function enqueueLegalSourceIngestion(client:RpcClient,input:LegalSourceEnqueueInput):Promise<string> {
  if(!validSourceId(input.sourceId)||!ADAPTER_KEY.test(input.adapterKey)||
    !input.adapterVersion.trim()||input.adapterVersion.length>80||
    !input.idempotencyKey.trim()||input.idempotencyKey.length>200||
    (input.maxAttempts!==undefined&&(!Number.isInteger(input.maxAttempts)||input.maxAttempts<1||input.maxAttempts>30))) {
    throw new Error('LEGAL_SOURCE_ENQUEUE_INPUT_INVALID');
  }
  const {data,error}=await client.rpc('legal_ingestion_enqueue_job',{
    p_source_id:input.sourceId,p_adapter_key:input.adapterKey,
    p_adapter_version:input.adapterVersion,p_idempotency_key:input.idempotencyKey.trim(),
    p_max_attempts:input.maxAttempts??8,
  });
  if(error)throw new Error('LEGAL_SOURCE_ENQUEUE_FAILED');
  if(typeof data!=='string'||!UUID.test(data))throw new Error('LEGAL_SOURCE_ENQUEUE_RESPONSE_INVALID');
  return data;
}
