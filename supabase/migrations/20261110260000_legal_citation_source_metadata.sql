-- Phase 2.4: trusted source metadata lookup for rights-aware citation assembly.
-- No browser role can execute this function or read the underlying source registry.

create or replace function public.legal_citation_source_metadata(p_source_keys text[])
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if coalesce(cardinality(p_source_keys),0)>50
    or exists(select 1 from unnest(coalesce(p_source_keys,'{}'::text[])) k
      where k !~ '^[a-z][a-z0-9._-]{1,79}$') then
    raise exception 'LEGAL_CITATION_METADATA_SCOPE_INVALID' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceKey',s.source_key,
    'sourceName',s.name,
    'issuingAuthority',s.issuing_authority,
    'licenceIdentifier',coalesce(s.licence_identifier,''),
    'attributionText',coalesce(s.attribution_text,''),
    'rightsStatus',s.rights_status,
    'displayPermitted',coalesce((e.permissions->>'display')::boolean,false)
      and (e.review_expires_at is null or e.review_expires_at>now()),
    'quotePermitted',coalesce((e.permissions->>'quote')::boolean,false)
      and (e.review_expires_at is null or e.review_expires_at>now())
  ) order by s.source_key),'[]'::jsonb)
  into v_result
  from private.legal_sources s
  left join private.legal_source_rights_evidence e on e.source_id=s.id
  where s.source_key=any(coalesce(p_source_keys,'{}'::text[]));
  return v_result;
end;
$$;
revoke all on function public.legal_citation_source_metadata(text[]) from public,anon,authenticated;
grant execute on function public.legal_citation_source_metadata(text[]) to service_role;
comment on function public.legal_citation_source_metadata(text[]) is
  'Trusted server-only lookup for citation attribution and separate display/quotation permissions.';
