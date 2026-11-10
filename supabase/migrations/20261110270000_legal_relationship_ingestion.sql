-- Phase 2.6: source-provenanced, lease-bound relationship ingestion.
-- Relationship edges are immutable and can only be written by a live trusted worker lease.

create unique index if not exists legal_sources_source_key_unique_idx
  on private.legal_sources(source_key);

create or replace function public.legal_ingestion_append_relationship(
  p_source_key text,
  p_from_external_id text,
  p_to_external_id text,
  p_relationship_type text,
  p_effective_from date,
  p_source_note text,
  p_provenance_uri text,
  p_job_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_source private.legal_sources%rowtype;
  v_from_id uuid;
  v_to_id uuid;
  v_host text;
  v_base_host text;
  v_rows integer;
begin
  if p_source_key is null or p_from_external_id is null or p_to_external_id is null
    or p_from_external_id=p_to_external_id or p_relationship_type is null
    or p_relationship_type not in ('amends','amended_by','repeals','repealed_by','implements',
      'implemented_by','interprets','applies','distinguishes','overrules','overruled_by','cites','related')
    or p_provenance_uri is null or length(p_provenance_uri)>2048
    or p_provenance_uri !~ '^https://[^[:space:]]+$'
    or (p_source_note is not null and length(p_source_note)>2000)
    or p_job_id is null or p_lease_token is null then
    raise exception 'LEGAL_INGESTION_RELATIONSHIP_ARGUMENT_INVALID' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources
    where source_key=p_source_key for update;
  if not found or v_source.rights_status<>'approved' or v_source.status<>'active'
    or not v_source.ingestion_enabled or v_source.base_uri is null then
    raise exception 'LEGAL_INGESTION_SOURCE_NOT_READY' using errcode='42501';
  end if;
  if not exists(select 1 from private.legal_source_rights_evidence e
    where e.source_id=v_source.id
      and (e.review_expires_at is null or e.review_expires_at>now())
      and coalesce((e.permissions->>'retrieve')::boolean,false)
      and coalesce((e.permissions->>'store')::boolean,false)
      and coalesce((e.permissions->>'index')::boolean,false)) then
    raise exception 'LEGAL_INGESTION_SOURCE_RIGHTS_NOT_APPROVED' using errcode='42501';
  end if;
  if not exists(select 1 from private.legal_source_ingestion_jobs j
    where j.id=p_job_id and j.source_id=v_source.id and j.status='leased'
      and j.lease_token=p_lease_token and j.lease_expires_at>now()) then
    raise exception 'LEGAL_INGESTION_LEASE_LOST' using errcode='42501';
  end if;
  v_host:=lower(substring(p_provenance_uri from '^https://([^/:]+)'));
  v_base_host:=lower(substring(v_source.base_uri from '^https://([^/:]+)'));
  if v_host is null or v_base_host is null
    or (v_host<>v_base_host and right(v_host,length(v_base_host)+1)<>'.'||v_base_host) then
    raise exception 'LEGAL_INGESTION_RELATIONSHIP_PROVENANCE_HOST_NOT_ALLOWED' using errcode='42501';
  end if;
  select id into v_from_id from private.legal_authorities
    where source_id=v_source.id and external_id=p_from_external_id;
  select id into v_to_id from private.legal_authorities
    where source_id=v_source.id and external_id=p_to_external_id;
  if v_from_id is null or v_to_id is null then
    raise exception 'LEGAL_INGESTION_RELATIONSHIP_AUTHORITY_NOT_FOUND' using errcode='P0002';
  end if;
  insert into private.legal_authority_relationships(
    from_authority_id,to_authority_id,relationship_type,effective_from,source_note,provenance_uri
  ) values(v_from_id,v_to_id,p_relationship_type,p_effective_from,p_source_note,p_provenance_uri)
  on conflict(from_authority_id,to_authority_id,relationship_type) do nothing;
  get diagnostics v_rows=row_count;
  return v_rows=1;
end;
$$;
revoke all on function public.legal_ingestion_append_relationship(text,text,text,text,date,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.legal_ingestion_append_relationship(text,text,text,text,date,text,text,uuid,uuid) to service_role;
comment on function public.legal_ingestion_append_relationship(text,text,text,text,date,text,text,uuid,uuid) is
  'Lease-bound, rights-gated relationship persistence with same-source authority identity and provenance-host validation.';
