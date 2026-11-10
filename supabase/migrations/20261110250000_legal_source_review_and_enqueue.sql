-- Phase 2.3 / 2.5: auditable source-rights review and controlled ingestion enqueue.
-- Review approval does not activate a source or enable ingestion. Activation remains a separate operation.

alter table private.legal_sources
  add column if not exists adapter_version text
  check (adapter_version is null or length(btrim(adapter_version)) between 1 and 80);

alter table private.legal_source_ingestion_jobs
  add column if not exists idempotency_key text;
create unique index if not exists legal_ingestion_jobs_idempotency_idx
  on private.legal_source_ingestion_jobs(idempotency_key)
  where idempotency_key is not null;

create table if not exists private.legal_source_rights_review_audit (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  reviewer text not null,
  previous_rights_status text not null,
  new_rights_status text not null,
  evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot)='object'),
  recorded_at timestamptz not null default now()
);
alter table private.legal_source_rights_review_audit enable row level security;
revoke all on private.legal_source_rights_review_audit from public,anon,authenticated;
grant select,insert on private.legal_source_rights_review_audit to service_role;

create or replace function private.reject_legal_source_review_audit_mutation()
returns trigger language plpgsql set search_path=''
as $$
begin
  raise exception 'Source rights review audit is append-only' using errcode='55000';
end;
$$;
revoke all on function private.reject_legal_source_review_audit_mutation() from public,anon,authenticated;
create trigger legal_source_rights_review_audit_immutable
  before update or delete on private.legal_source_rights_review_audit
  for each row execute function private.reject_legal_source_review_audit_mutation();

create or replace function public.legal_source_record_rights_review(
  p_source_id uuid,
  p_reviewer text,
  p_licence_identifier text,
  p_licence_version text,
  p_terms_uri text,
  p_attribution_text text,
  p_reviewed_at timestamptz,
  p_review_expires_at timestamptz,
  p_permissions jsonb,
  p_restrictions text[] default '{}'::text[]
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_source private.legal_sources%rowtype;
  v_previous text;
  v_new_status text;
  v_evidence jsonb;
begin
  if p_source_id is null or p_reviewer is null or length(btrim(p_reviewer)) not between 1 and 200
    or p_licence_identifier is null or length(btrim(p_licence_identifier)) not between 1 and 200
    or p_terms_uri is null or p_terms_uri !~ '^https://[^[:space:]]+$'
    or p_attribution_text is null or length(btrim(p_attribution_text)) not between 1 and 2000
    or p_reviewed_at is null or p_reviewed_at>now()
    or (p_review_expires_at is not null and p_review_expires_at<=now())
    or p_permissions is null or jsonb_typeof(p_permissions)<>'object' then
    raise exception 'LEGAL_SOURCE_RIGHTS_REVIEW_INVALID' using errcode='22023';
  end if;
  if not (p_permissions ?& array['retrieve','store','normalise','index','quote','display','redistribute'])
    or exists(select 1 from jsonb_each(p_permissions) e where jsonb_typeof(e.value)<>'boolean') then
    raise exception 'LEGAL_SOURCE_RIGHTS_PERMISSIONS_INVALID' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources where id=p_source_id for update;
  if not found then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode='P0002'; end if;
  v_previous:=v_source.rights_status;
  if (p_permissions->>'retrieve')::boolean and (p_permissions->>'store')::boolean
    and (p_permissions->>'normalise')::boolean and (p_permissions->>'index')::boolean then
    v_new_status:='approved';
  else
    v_new_status:='restricted';
  end if;
  if v_new_status='restricted' and v_source.ingestion_enabled then
    raise exception 'LEGAL_SOURCE_DEACTIVATION_REQUIRED' using errcode='42501';
  end if;
  insert into private.legal_source_rights_evidence(
    source_id,licence_version,terms_uri,reviewed_by,reviewed_at,review_expires_at,permissions,restrictions,updated_at
  ) values(
    p_source_id,nullif(btrim(p_licence_version),''),p_terms_uri,btrim(p_reviewer),p_reviewed_at,
    p_review_expires_at,p_permissions,coalesce(p_restrictions,'{}'::text[]),now()
  )
  on conflict(source_id) do update set
    licence_version=excluded.licence_version,terms_uri=excluded.terms_uri,
    reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,
    review_expires_at=excluded.review_expires_at,permissions=excluded.permissions,
    restrictions=excluded.restrictions,updated_at=now();
  update private.legal_sources set rights_status=v_new_status,
    licence_identifier=btrim(p_licence_identifier),attribution_text=btrim(p_attribution_text),updated_at=now()
    where id=p_source_id;
  v_evidence:=jsonb_build_object(
    'licenceIdentifier',btrim(p_licence_identifier),'licenceVersion',nullif(btrim(p_licence_version),''),
    'termsUri',p_terms_uri,'attributionText',btrim(p_attribution_text),
    'reviewedBy',btrim(p_reviewer),'reviewedAt',p_reviewed_at,
    'reviewExpiresAt',p_review_expires_at,'permissions',p_permissions,
    'restrictions',to_jsonb(coalesce(p_restrictions,'{}'::text[]))
  );
  insert into private.legal_source_rights_review_audit(
    source_id,reviewer,previous_rights_status,new_rights_status,evidence_snapshot
  ) values(p_source_id,btrim(p_reviewer),v_previous,v_new_status,v_evidence);
  return jsonb_build_object(
    'sourceId',v_source.id,'sourceKey',v_source.source_key,
    'rightsStatus',v_new_status,'sourceStatus',v_source.status,
    'ingestionEnabled',v_source.ingestion_enabled
  );
end;
$$;

create or replace function public.legal_ingestion_enqueue_job(
  p_source_id uuid,
  p_adapter_key text,
  p_adapter_version text,
  p_idempotency_key text,
  p_max_attempts integer default 8
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_source private.legal_sources%rowtype;
  v_evidence private.legal_source_rights_evidence%rowtype;
  v_job_id uuid;
begin
  if p_source_id is null or p_adapter_key is null or p_adapter_key !~ '^[a-z][a-z0-9._-]{1,79}$'
    or p_adapter_version is null or length(btrim(p_adapter_version)) not between 1 and 80
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
    or p_max_attempts is null or p_max_attempts not between 1 and 30 then
    raise exception 'LEGAL_INGESTION_ENQUEUE_ARGUMENT_INVALID' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources where id=p_source_id for update;
  if not found then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_evidence from private.legal_source_rights_evidence where source_id=p_source_id;
  if not found or v_source.rights_status<>'approved' or v_source.status<>'active'
    or not v_source.ingestion_enabled or v_source.adapter_key<>p_adapter_key
    or v_source.adapter_version<>p_adapter_version
    or (v_evidence.review_expires_at is not null and v_evidence.review_expires_at<=now())
    or not coalesce((v_evidence.permissions->>'retrieve')::boolean,false)
    or not coalesce((v_evidence.permissions->>'store')::boolean,false)
    or not coalesce((v_evidence.permissions->>'normalise')::boolean,false)
    or not coalesce((v_evidence.permissions->>'index')::boolean,false) then
    raise exception 'LEGAL_INGESTION_SOURCE_NOT_READY' using errcode='42501';
  end if;
  insert into private.legal_source_ingestion_jobs(
    source_id,adapter_key,adapter_version,idempotency_key,max_attempts,status
  ) values(p_source_id,p_adapter_key,p_adapter_version,btrim(p_idempotency_key),p_max_attempts,'queued')
  on conflict(idempotency_key) where idempotency_key is not null do nothing
  returning id into v_job_id;
  if v_job_id is null then
    select id into v_job_id from private.legal_source_ingestion_jobs
      where idempotency_key=btrim(p_idempotency_key);
    if not exists(select 1 from private.legal_source_ingestion_jobs
      where id=v_job_id and source_id=p_source_id and adapter_key=p_adapter_key and adapter_version=p_adapter_version) then
      raise exception 'LEGAL_INGESTION_IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
  end if;
  return v_job_id;
end;
$$;

revoke all on function public.legal_source_record_rights_review(uuid,text,text,text,text,text,timestamptz,timestamptz,jsonb,text[]) from public,anon,authenticated;
revoke all on function public.legal_ingestion_enqueue_job(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.legal_source_record_rights_review(uuid,text,text,text,text,text,timestamptz,timestamptz,jsonb,text[]) to service_role;
grant execute on function public.legal_ingestion_enqueue_job(uuid,text,text,text,integer) to service_role;

comment on table private.legal_source_rights_review_audit is
  'Append-only audit of human rights reviews. Review approval never activates or enables ingestion.';
comment on function public.legal_ingestion_enqueue_job(uuid,text,text,text,integer) is
  'Creates an idempotent durable job only when source activation, rights evidence and exact adapter version are approved.';
