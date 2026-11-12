-- Phase 2 Task 2.8: support for the first live source (Lovdata public data).
-- 1. legal_ingestion_append_authority also records the version's valid-time start (U-07) and each
--    passage's section path (for example {"Kapittel 2. …","§ 2-1"}). Both are optional, so earlier
--    callers keep working; the signature and grants are unchanged.
-- 2. legal_ingestion_enqueue_continuation queues the next page of a source after a finished job,
--    from the cursor that job saved. A source larger than one batch is ingested page by page.
-- Nothing here approves, activates or enables a source.

create or replace function public.legal_ingestion_append_authority(
  p_source_key text,p_jurisdiction_code text,p_authority jsonb,p_source_uri text,
  p_retrieved_at timestamptz,p_normalisation_profile text,p_passages jsonb,
  p_job_id uuid,p_lease_token uuid
) returns text
language plpgsql security definer set search_path=''
as $function$
declare
  v_source private.legal_sources%rowtype;
  v_authority_id uuid;
  v_version_id uuid;
  v_current_hash text;
  v_next_version integer;
  v_external_id text;
  v_title text;
  v_content text;
  v_content_hash text;
  v_valid_from date;
  v_section_path text[];
  v_item jsonb;
  v_inserted integer:=0;
begin
  if jsonb_typeof(p_authority)<>'object' or jsonb_typeof(p_passages)<>'array'
    or jsonb_array_length(p_passages)>20000 then
    raise exception 'LEGAL_INGESTION_PAYLOAD_INVALID';
  end if;
  v_external_id:=p_authority->>'externalId';
  v_title:=p_authority->>'title';
  v_content:=p_authority->>'normalisedText';
  v_content_hash:=p_authority->>'sourceContentHash';
  if v_external_id is null or length(v_external_id) not between 1 and 512
    or v_title is null or length(v_title) not between 1 and 2000
    or v_content is null or length(v_content)=0 or length(v_content)>50000000
    or v_content_hash !~ '^[a-f0-9]{64}$'
    or p_authority->>'normalisedContentHash' !~ '^[a-f0-9]{64}$'
    or p_normalisation_profile is null or length(trim(p_normalisation_profile)) not between 1 and 120
    or p_source_uri is null or p_source_uri !~ '^https://'
    or p_retrieved_at is null
    or (jsonb_typeof(p_authority->'validFrom') not in ('null','string'))
    or (jsonb_typeof(p_authority->'validFrom')='string'
      and p_authority->>'validFrom' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    raise exception 'LEGAL_INGESTION_AUTHORITY_INVALID';
  end if;
  v_valid_from:=nullif(p_authority->>'validFrom','')::date;
  if p_job_id is null or p_lease_token is null or not exists(
    select 1 from private.legal_source_ingestion_jobs job
      join private.legal_sources src on src.id=job.source_id
      where job.id=p_job_id and job.status='leased' and src.source_key=p_source_key
      and job.lease_token=p_lease_token and job.lease_expires_at>now() for share of job
  ) then raise exception 'LEGAL_INGESTION_LEASE_LOST'; end if;
  select * into v_source from private.legal_sources
    where source_key=p_source_key and rights_status='approved' and status='active' and ingestion_enabled
    for share;
  if not found then raise exception 'LEGAL_SOURCE_RIGHTS_NOT_APPROVED'; end if;
  if v_source.jurisdiction_code is distinct from p_jurisdiction_code then
    raise exception 'LEGAL_INGESTION_JURISDICTION_MISMATCH';
  end if;
  insert into private.legal_authorities(
    source_id,jurisdiction_code,external_id,citation,title,authority_type,issuing_body,
    language_code,canonical_uri,publication_date,legal_status,source_metadata,last_seen_at
  ) values(
    v_source.id,p_jurisdiction_code,v_external_id,p_authority->>'citation',v_title,
    p_authority->>'authorityType',p_authority->>'issuingBody',p_authority->>'languageCode',
    p_authority->>'canonicalUri',nullif(p_authority->>'publicationDate','')::date,
    coalesce(p_authority->>'legalStatus','unknown'),coalesce(p_authority->'metadata','{}'::jsonb),p_retrieved_at
  )
  on conflict(source_id,external_id) do update set
    citation=excluded.citation,title=excluded.title,authority_type=excluded.authority_type,
    issuing_body=excluded.issuing_body,language_code=excluded.language_code,
    canonical_uri=excluded.canonical_uri,publication_date=excluded.publication_date,
    legal_status=excluded.legal_status,source_metadata=excluded.source_metadata,last_seen_at=excluded.last_seen_at
  returning id into v_authority_id;
  select source_content_hash into v_current_hash from private.legal_authority_versions
    where authority_id=v_authority_id and is_current_source_version
    order by version_number desc limit 1 for update;
  if v_current_hash=v_content_hash then return 'unchanged'; end if;
  select coalesce(max(version_number),0)+1 into v_next_version
    from private.legal_authority_versions where authority_id=v_authority_id;
  update private.legal_authority_versions set is_current_source_version=false
    where authority_id=v_authority_id and is_current_source_version;
  insert into private.legal_authority_versions(
    authority_id,version_number,valid_from,retrieved_at,source_uri,source_content_hash,
    normalised_content_hash,normalised_text,normalisation_profile,is_current_source_version
  ) values(
    v_authority_id,v_next_version,v_valid_from,p_retrieved_at,p_source_uri,v_content_hash,
    p_authority->>'normalisedContentHash',v_content,p_normalisation_profile,true
  ) returning id into v_version_id;
  for v_item in select value from jsonb_array_elements(p_passages) loop
    if (v_item->>'ordinal') is null or (v_item->>'content') is null
      or (v_item->>'contentHash') !~ '^[a-f0-9]{64}$'
      or (v_item->>'startOffset')::integer<0
      or (v_item->>'endOffset')::integer<(v_item->>'startOffset')::integer
      or (v_item ? 'sectionPath' and jsonb_typeof(v_item->'sectionPath') not in ('array','null')) then
      raise exception 'LEGAL_INGESTION_PASSAGE_INVALID';
    end if;
    v_section_path:='{}'::text[];
    if jsonb_typeof(v_item->'sectionPath')='array' then
      if jsonb_array_length(v_item->'sectionPath')>12 or exists(
        select 1 from jsonb_array_elements(v_item->'sectionPath') as part
        where jsonb_typeof(part)<>'string' or length(btrim(part #>> '{}')) not between 1 and 300
      ) then
        raise exception 'LEGAL_INGESTION_PASSAGE_INVALID';
      end if;
      select coalesce(array_agg(part order by position),'{}'::text[]) into v_section_path
        from jsonb_array_elements_text(v_item->'sectionPath') with ordinality as t(part,position);
    end if;
    insert into private.legal_authority_passages(
      authority_version_id,ordinal,section_path,start_offset,end_offset,content,content_hash
    ) values(
      v_version_id,(v_item->>'ordinal')::integer,v_section_path,(v_item->>'startOffset')::integer,
      (v_item->>'endOffset')::integer,v_item->>'content',v_item->>'contentHash'
    );
    v_inserted:=v_inserted+1;
  end loop;
  if v_inserted=0 then raise exception 'LEGAL_INGESTION_PASSAGES_REQUIRED'; end if;
  return 'created';
end;
$function$;
revoke all on function public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb,uuid,uuid) to service_role;

create or replace function public.legal_ingestion_enqueue_continuation(
  p_previous_job_id uuid,
  p_idempotency_key text,
  p_max_attempts integer default 8
)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_previous private.legal_source_ingestion_jobs%rowtype;
  v_source private.legal_sources%rowtype;
  v_evidence private.legal_source_rights_evidence%rowtype;
  v_job_id uuid;
begin
  if p_previous_job_id is null
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
    or p_max_attempts is null or p_max_attempts not between 1 and 30 then
    raise exception 'LEGAL_INGESTION_ENQUEUE_ARGUMENT_INVALID' using errcode='22023';
  end if;
  select * into v_previous from private.legal_source_ingestion_jobs where id=p_previous_job_id;
  if not found then raise exception 'LEGAL_INGESTION_JOB_NOT_FOUND' using errcode='P0002'; end if;
  if v_previous.status not in ('succeeded','partial') or v_previous.cursor_reference is null then
    raise exception 'LEGAL_INGESTION_NO_CONTINUATION' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources where id=v_previous.source_id for update;
  select * into v_evidence from private.legal_source_rights_evidence where source_id=v_source.id;
  -- The same readiness rules as legal_ingestion_enqueue_job: every gate is re-checked.
  if not found or v_source.rights_status<>'approved' or v_source.status<>'active'
    or not v_source.ingestion_enabled
    or v_source.adapter_key is distinct from v_previous.adapter_key
    or v_source.adapter_version is distinct from v_previous.adapter_version
    or (v_evidence.review_expires_at is not null and v_evidence.review_expires_at<=now())
    or not coalesce((v_evidence.permissions->>'retrieve')::boolean,false)
    or not coalesce((v_evidence.permissions->>'store')::boolean,false)
    or not coalesce((v_evidence.permissions->>'normalise')::boolean,false)
    or not coalesce((v_evidence.permissions->>'index')::boolean,false) then
    raise exception 'LEGAL_INGESTION_SOURCE_NOT_READY' using errcode='42501';
  end if;
  insert into private.legal_source_ingestion_jobs(
    source_id,adapter_key,adapter_version,idempotency_key,max_attempts,status,cursor_reference
  ) values(
    v_source.id,v_previous.adapter_key,v_previous.adapter_version,btrim(p_idempotency_key),
    p_max_attempts,'queued',v_previous.cursor_reference
  )
  on conflict(idempotency_key) where idempotency_key is not null do nothing
  returning id into v_job_id;
  if v_job_id is null then
    select id into v_job_id from private.legal_source_ingestion_jobs
      where idempotency_key=btrim(p_idempotency_key)
        and source_id=v_source.id and adapter_key=v_previous.adapter_key
        and adapter_version=v_previous.adapter_version;
    if v_job_id is null then
      raise exception 'LEGAL_INGESTION_IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
  end if;
  return v_job_id;
end;
$function$;
revoke all on function public.legal_ingestion_enqueue_continuation(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.legal_ingestion_enqueue_continuation(uuid,text,integer) to service_role;
comment on function public.legal_ingestion_enqueue_continuation(uuid,text,integer) is
  'Queues the next page of a source from the cursor a finished job saved, re-checking every rights and activation gate.';
