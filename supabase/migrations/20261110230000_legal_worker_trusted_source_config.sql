-- Phase 2.5: trusted worker source/rights resolution.
-- This migration defines the gate only; it does not approve or activate any source.

create table if not exists private.legal_source_rights_evidence (
  source_id uuid primary key references private.legal_sources(id) on delete restrict,
  licence_version text,
  terms_uri text not null check (terms_uri ~ '^https://'),
  reviewed_by text not null check (length(btrim(reviewed_by)) between 1 and 200),
  reviewed_at timestamptz not null,
  review_expires_at timestamptz,
  permissions jsonb not null check (jsonb_typeof(permissions)='object'),
  restrictions text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  check (review_expires_at is null or review_expires_at > reviewed_at)
);
alter table private.legal_source_rights_evidence enable row level security;
revoke all on private.legal_source_rights_evidence from public,anon,authenticated;
grant select,insert,update on private.legal_source_rights_evidence to service_role;

create or replace function public.legal_worker_source_config(p_source_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'source_id',s.id,
    'source_key',s.source_key,
    'rights',jsonb_build_object(
      'rightsStatus',s.rights_status,
      'sourceStatus',s.status,
      'ingestionEnabled',s.ingestion_enabled,
      'licenceIdentifier',s.licence_identifier,
      'attributionText',s.attribution_text
    ),
    'evidence',jsonb_build_object(
      'sourceKey',s.source_key,
      'licenceIdentifier',s.licence_identifier,
      'licenceVersion',e.licence_version,
      'termsUri',e.terms_uri,
      'attributionText',s.attribution_text,
      'reviewedBy',e.reviewed_by,
      'reviewedAt',to_char(e.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reviewExpiresAt',case when e.review_expires_at is null then null
        else to_char(e.review_expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'permissions',e.permissions,
      'restrictions',to_jsonb(e.restrictions)
    )
  ) into v_result
  from private.legal_sources s
  join private.legal_source_rights_evidence e on e.source_id=s.id
  where s.id=p_source_id;
  if v_result is null then
    raise exception 'LEGAL_WORKER_SOURCE_CONFIG_NOT_FOUND' using errcode='P0002';
  end if;
  return v_result;
end;
$$;
revoke all on function public.legal_worker_source_config(uuid) from public,anon,authenticated;
grant execute on function public.legal_worker_source_config(uuid) to service_role;

comment on table private.legal_source_rights_evidence is
  'Auditable licence review evidence and explicit permissions required before source ingestion.';
comment on function public.legal_worker_source_config(uuid) is
  'Worker-only source/rights resolver. Missing evidence or source row returns no config and ingestion fails closed.';
