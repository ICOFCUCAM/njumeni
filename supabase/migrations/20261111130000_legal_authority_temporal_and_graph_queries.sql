-- Phase 2 Tasks 2.2 and 2.6: bitemporal as-of version selection (Master Plan v2.0 U-07),
-- a database-backed authority graph query, and the full relationship vocabulary of
-- Master Plan v2.0 §6.5 (adds replaces, supplements and conflicts_with).
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- 1. Relationship vocabulary.
alter table private.legal_authority_relationships
  drop constraint if exists legal_authority_relationships_relationship_type_check;
alter table private.legal_authority_relationships
  add constraint legal_authority_relationships_relationship_type_check
  check (relationship_type in (
    'amends', 'amended_by', 'repeals', 'repealed_by', 'replaces', 'replaced_by',
    'implements', 'implemented_by', 'interprets', 'applies', 'distinguishes',
    'overrules', 'overruled_by', 'supplements', 'supplemented_by', 'conflicts_with',
    'cites', 'related'
  ));

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
    or p_relationship_type not in ('amends','amended_by','repeals','repealed_by','replaces',
      'replaced_by','implements','implemented_by','interprets','applies','distinguishes',
      'overrules','overruled_by','supplements','supplemented_by','conflicts_with','cites','related')
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

-- 2. Bitemporal as-of version selection.
--    Valid time:  the version in force on p_valid_on (valid_from <= date < valid_until).
--    System time: only versions Njumeni had recorded by p_known_at (default: now), so that a
--                 past answer can be reproduced exactly even after later corrections.
create or replace function private.legal_authority_version_as_of(
  p_authority_id uuid,
  p_valid_on date,
  p_known_at timestamptz default null
)
returns table(
  authority_version_id uuid, version_number integer, valid_from date, valid_until date,
  recorded_at timestamptz, source_uri text, source_content_hash text,
  normalised_content_hash text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_authority_id is null or p_valid_on is null then
    raise exception 'LEGAL_AS_OF_ARGUMENT_INVALID' using errcode = '22023';
  end if;
  if p_known_at is not null and p_known_at > now() then
    raise exception 'LEGAL_AS_OF_KNOWN_AT_IN_FUTURE' using errcode = '22023';
  end if;
  return query
  select version.id, version.version_number, version.valid_from, version.valid_until,
    version.created_at, version.source_uri, version.source_content_hash,
    version.normalised_content_hash
  from private.legal_authority_versions as version
  where version.authority_id = p_authority_id
    and (version.valid_from is null or version.valid_from <= p_valid_on)
    and (version.valid_until is null or p_valid_on < version.valid_until)
    and version.created_at <= coalesce(p_known_at, now())
  order by version.version_number desc
  limit 1;
end;
$function$;
revoke all on function private.legal_authority_version_as_of(uuid, date, timestamptz)
  from public, anon, authenticated;

create or replace function public.legal_authority_version_as_of(
  p_authority_id uuid,
  p_valid_on date,
  p_known_at timestamptz default null
)
returns table(
  authority_version_id uuid, version_number integer, valid_from date, valid_until date,
  recorded_at timestamptz, source_uri text, source_content_hash text,
  normalised_content_hash text
)
language sql stable security definer set search_path = ''
as $$
  select * from private.legal_authority_version_as_of(p_authority_id, p_valid_on, p_known_at);
$$;
revoke all on function public.legal_authority_version_as_of(uuid, date, timestamptz)
  from public, anon, authenticated;
grant execute on function public.legal_authority_version_as_of(uuid, date, timestamptz) to service_role;

-- 3. Database-backed authority graph. Mirrors traceAuthorityGraph in authority-graph.ts:
--    breadth-first over outgoing edges, deterministic edge order, per-path cycle protection,
--    depth and node limits with an explicit truncation flag, optional as-of and type filters.
create or replace function private.legal_authority_graph(
  p_root_authority_id uuid,
  p_as_of date default null,
  p_max_depth integer default 4,
  p_max_nodes integer default 100,
  p_relationship_types text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_queue jsonb;
  v_head integer := 0;
  v_path jsonb;
  v_next jsonb;
  v_current uuid;
  v_edge record;
  v_paths jsonb := '[]'::jsonb;
  v_visited uuid[];
  v_truncated boolean := false;
begin
  if p_root_authority_id is null then
    raise exception 'LEGAL_AUTHORITY_GRAPH_ROOT_INVALID' using errcode = '22023';
  end if;
  if p_max_depth is null or p_max_depth < 1 or p_max_depth > 12
    or p_max_nodes is null or p_max_nodes < 1 or p_max_nodes > 500 then
    raise exception 'LEGAL_AUTHORITY_GRAPH_LIMIT_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from private.legal_authorities where id = p_root_authority_id) then
    raise exception 'LEGAL_AUTHORITY_GRAPH_ROOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_visited := array[p_root_authority_id];
  v_queue := jsonb_build_array(jsonb_build_object(
    'authorityIds', jsonb_build_array(p_root_authority_id::text),
    'relationshipTypes', '[]'::jsonb,
    'provenanceUris', '[]'::jsonb));

  while v_head < jsonb_array_length(v_queue) loop
    v_path := v_queue -> v_head;
    v_head := v_head + 1;
    if jsonb_array_length(v_path -> 'relationshipTypes') >= p_max_depth then
      continue;
    end if;
    v_current := (v_path -> 'authorityIds' ->> (jsonb_array_length(v_path -> 'authorityIds') - 1))::uuid;

    for v_edge in
      select relationship.to_authority_id, relationship.relationship_type, relationship.provenance_uri
      from private.legal_authority_relationships as relationship
      where relationship.from_authority_id = v_current
        and relationship.from_authority_id <> relationship.to_authority_id
        and (p_relationship_types is null or relationship.relationship_type = any(p_relationship_types))
        and (p_as_of is null or relationship.effective_from is null or relationship.effective_from <= p_as_of)
      order by relationship.to_authority_id::text collate "C", relationship.relationship_type collate "C"
    loop
      if (v_path -> 'authorityIds') ? v_edge.to_authority_id::text then
        continue;
      end if;
      if not (v_edge.to_authority_id = any(v_visited)) then
        if cardinality(v_visited) >= p_max_nodes then
          v_truncated := true;
          continue;
        end if;
        v_visited := v_visited || v_edge.to_authority_id;
      end if;
      v_next := jsonb_build_object(
        'authorityIds', (v_path -> 'authorityIds') || to_jsonb(v_edge.to_authority_id::text),
        'relationshipTypes', (v_path -> 'relationshipTypes') || to_jsonb(v_edge.relationship_type),
        'provenanceUris', (v_path -> 'provenanceUris')
          || coalesce(to_jsonb(v_edge.provenance_uri), 'null'::jsonb));
      v_paths := v_paths || jsonb_build_array(v_next);
      v_queue := v_queue || jsonb_build_array(v_next);
    end loop;
  end loop;

  return jsonb_build_object(
    'rootAuthorityId', p_root_authority_id::text,
    'relatedAuthorityIds', coalesce(
      (select jsonb_agg(id::text order by ordinality)
       from unnest(v_visited) with ordinality as visited(id, ordinality)
       where id <> p_root_authority_id),
      '[]'::jsonb),
    'paths', v_paths,
    'truncated', v_truncated);
end;
$function$;
revoke all on function private.legal_authority_graph(uuid, date, integer, integer, text[])
  from public, anon, authenticated;

create or replace function public.legal_authority_graph(
  p_root_authority_id uuid,
  p_as_of date default null,
  p_max_depth integer default 4,
  p_max_nodes integer default 100,
  p_relationship_types text[] default null
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select private.legal_authority_graph(
    p_root_authority_id, p_as_of, p_max_depth, p_max_nodes, p_relationship_types);
$$;
revoke all on function public.legal_authority_graph(uuid, date, integer, integer, text[])
  from public, anon, authenticated;
grant execute on function public.legal_authority_graph(uuid, date, integer, integer, text[]) to service_role;
