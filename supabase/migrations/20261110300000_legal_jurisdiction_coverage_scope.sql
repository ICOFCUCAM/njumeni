-- Phase 2.7: jurisdiction-level coverage scope declarations and audit.

create table if not exists private.legal_jurisdiction_coverage_scope_audit (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references private.jurisdictions(code) on delete restrict,
  reviewer text not null,
  reason text not null,
  previous_authority_types text[] not null,
  new_authority_types text[] not null,
  previous_review_interval_days integer not null,
  new_review_interval_days integer not null,
  recorded_at timestamptz not null default now()
);
alter table private.legal_jurisdiction_coverage_scope_audit enable row level security;
revoke all on private.legal_jurisdiction_coverage_scope_audit from public,anon,authenticated;
grant select,insert on private.legal_jurisdiction_coverage_scope_audit to service_role;

create or replace function private.reject_legal_jurisdiction_coverage_scope_audit_mutation()
returns trigger language plpgsql set search_path=''
as $$
begin
  raise exception 'Jurisdiction coverage scope audit is append-only' using errcode='55000';
end;
$$;
revoke all on function private.reject_legal_jurisdiction_coverage_scope_audit_mutation() from public,anon,authenticated;
create trigger legal_jurisdiction_coverage_scope_audit_immutable
  before update or delete on private.legal_jurisdiction_coverage_scope_audit
  for each row execute function private.reject_legal_jurisdiction_coverage_scope_audit_mutation();

create or replace function public.legal_jurisdiction_record_coverage_scope(
  p_jurisdiction_code text,
  p_reviewer text,
  p_reason text,
  p_authority_types text[],
  p_review_interval_days integer
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_jurisdiction private.jurisdictions%rowtype;
  v_allowed_types text[]:=array[
    'constitution','act','statutory_instrument','regulation','judgment','decision',
    'treaty','directive','regulation_eu','official_guidance','order','other'
  ];
  v_previous_types text[];
  v_previous_interval integer;
begin
  if p_jurisdiction_code is null or p_jurisdiction_code !~ '^[A-Z][A-Z0-9_-]{1,15}$'
    or p_reviewer is null or length(btrim(p_reviewer)) not between 1 and 200
    or p_reason is null or length(btrim(p_reason)) not between 10 and 1000
    or coalesce(cardinality(p_authority_types),0)<1 or cardinality(p_authority_types)>20
    or p_review_interval_days is null or p_review_interval_days not between 1 and 365 then
    raise exception 'LEGAL_JURISDICTION_COVERAGE_SCOPE_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from unnest(p_authority_types) item
    where item is null or not item=any(v_allowed_types)) then
    raise exception 'LEGAL_JURISDICTION_COVERAGE_AUTHORITY_TYPES_INVALID' using errcode='22023';
  end if;
  select * into v_jurisdiction from private.jurisdictions
    where code=p_jurisdiction_code for update;
  if not found then raise exception 'LEGAL_JURISDICTION_NOT_FOUND' using errcode='P0002'; end if;
  select coalesce(array_agg(value), '{}'::text[]) into v_previous_types
    from jsonb_array_elements_text(coalesce(v_jurisdiction.metadata->'coverageAuthorityTypes','[]'::jsonb));
  v_previous_interval:=coalesce((v_jurisdiction.metadata->>'coverageReviewIntervalDays')::integer,90);
  insert into private.legal_jurisdiction_coverage_scope_audit(
    jurisdiction_code,reviewer,reason,previous_authority_types,new_authority_types,
    previous_review_interval_days,new_review_interval_days
  ) values(
    p_jurisdiction_code,btrim(p_reviewer),btrim(p_reason),v_previous_types,
    p_authority_types,v_previous_interval,p_review_interval_days
  );
  update private.jurisdictions set metadata=metadata||jsonb_build_object(
    'coverageAuthorityTypes',to_jsonb(p_authority_types),
    'coverageReviewIntervalDays',p_review_interval_days
  ),updated_at=now() where code=p_jurisdiction_code;
  return jsonb_build_object(
    'jurisdictionCode',p_jurisdiction_code,
    'requestedAuthorityTypes',to_jsonb(p_authority_types),
    'requestedLanguages',to_jsonb(v_jurisdiction.official_languages),
    'reviewIntervalDays',p_review_interval_days
  );
end;
$$;
revoke all on function public.legal_jurisdiction_record_coverage_scope(text,text,text,text[],integer) from public,anon,authenticated;
grant execute on function public.legal_jurisdiction_record_coverage_scope(text,text,text,text[],integer) to service_role;
comment on function public.legal_jurisdiction_record_coverage_scope(text,text,text,text[],integer) is
  'Declares reviewed authority classes and source freshness interval for a jurisdiction; does not mark it supported.';
