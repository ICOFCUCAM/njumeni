-- Phase 2.5: transactional source run and append-only authority persistence.
-- Only trusted service_role workers may invoke these RPCs.

-- Preserve immutable authority content while permitting only the current-version pointer to close.
create or replace function private.reject_legal_knowledge_mutation()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if TG_TABLE_NAME='legal_authority_versions' and TG_OP='UPDATE'
    and OLD.is_current_source_version
    and not NEW.is_current_source_version
    and (to_jsonb(NEW)-'is_current_source_version')=(to_jsonb(OLD)-'is_current_source_version') then
    return NEW;
  end if;
  raise exception 'Legal knowledge history is append-only; only the current-version pointer may be closed'
    using errcode='55000';
end;
$function$;

create or replace function public.legal_ingestion_begin_run(
  p_source_key text,p_adapter_key text,p_adapter_version text,p_cursor text,p_batch_key text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_source_id uuid; v_run_id uuid;
begin
  select id into v_source_id from private.legal_sources
    where source_key=p_source_key and rights_status='approved' and status='active' and ingestion_enabled
    for share;
  if v_source_id is null then raise exception 'LEGAL_SOURCE_RIGHTS_NOT_APPROVED'; end if;
  insert into private.legal_source_ingestion_runs(source_id,adapter_key,adapter_version,status,cursor_reference,started_at)
    values(v_source_id,p_adapter_key,p_adapter_version,'running',p_cursor,now())
    returning id into v_run_id;
  update private.legal_source_ingestion_runs set metadata=jsonb_build_object('batchKey',p_batch_key) where id=v_run_id;
  return v_run_id;
end;
$$;

create or replace function public.legal_ingestion_append_authority(
  p_source_key text,p_jurisdiction_code text,p_authority jsonb,p_source_uri text,
  p_retrieved_at timestamptz,p_normalisation_profile text,p_passages jsonb,
  p_job_id uuid,p_lease_token uuid
) returns text
language plpgsql security definer set search_path=''
as $$
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
    or p_retrieved_at is null then
    raise exception 'LEGAL_INGESTION_AUTHORITY_INVALID';
  end if;
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
    authority_id,version_number,retrieved_at,source_uri,source_content_hash,
    normalised_content_hash,normalised_text,normalisation_profile,is_current_source_version
  ) values(
    v_authority_id,v_next_version,p_retrieved_at,p_source_uri,v_content_hash,
    p_authority->>'normalisedContentHash',v_content,p_normalisation_profile,true
  ) returning id into v_version_id;
  for v_item in select value from jsonb_array_elements(p_passages) loop
    if (v_item->>'ordinal') is null or (v_item->>'content') is null
      or (v_item->>'contentHash') !~ '^[a-f0-9]{64}$'
      or (v_item->>'startOffset')::integer<0
      or (v_item->>'endOffset')::integer<(v_item->>'startOffset')::integer then
      raise exception 'LEGAL_INGESTION_PASSAGE_INVALID';
    end if;
    insert into private.legal_authority_passages(
      authority_version_id,ordinal,start_offset,end_offset,content,content_hash
    ) values(
      v_version_id,(v_item->>'ordinal')::integer,(v_item->>'startOffset')::integer,
      (v_item->>'endOffset')::integer,v_item->>'content',v_item->>'contentHash'
    );
    v_inserted:=v_inserted+1;
  end loop;
  if v_inserted=0 then raise exception 'LEGAL_INGESTION_PASSAGES_REQUIRED'; end if;
  return 'created';
end;
$$;

create or replace function public.legal_ingestion_persist_run_result(
  p_run_id uuid,p_status text,p_discovered integer,p_created integer,p_unchanged integer,
  p_skipped integer,p_next_cursor text,p_failure_codes text[]
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  if p_status not in ('succeeded','partial','failed') or
    least(p_discovered,p_created,p_unchanged,p_skipped)<0 then
    raise exception 'LEGAL_INGESTION_RUN_RESULT_INVALID';
  end if;
  update private.legal_source_ingestion_runs set status=p_status,finished_at=now(),
    discovered_count=p_discovered,created_count=p_created,updated_count=p_unchanged,
    skipped_count=p_skipped,cursor_reference=p_next_cursor,
    failure_code=case when coalesce(cardinality(p_failure_codes),0)>0 then p_failure_codes[1] else null end,
    metadata=metadata||jsonb_build_object('failureCodes',coalesce(to_jsonb(p_failure_codes),'[]'::jsonb))
    where id=p_run_id and status='running';
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;

revoke all on function public.legal_ingestion_begin_run(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb,uuid,uuid) from public,anon,authenticated;
revoke all on function public.legal_ingestion_persist_run_result(uuid,text,integer,integer,integer,integer,text,text[]) from public,anon,authenticated;
grant execute on function public.legal_ingestion_begin_run(text,text,text,text,text) to service_role;
grant execute on function public.legal_ingestion_append_authority(text,text,jsonb,text,timestamptz,text,jsonb,uuid,uuid) to service_role;
grant execute on function public.legal_ingestion_persist_run_result(uuid,text,integer,integer,integer,integer,text,text[]) to service_role;
