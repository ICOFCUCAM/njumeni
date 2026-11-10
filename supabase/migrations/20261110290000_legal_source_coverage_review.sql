-- Phase 2.7: audited source coverage review and declaration management.
-- Coverage declarations do not activate sources or approve source licences.

create table if not exists private.legal_source_coverage_review_audit (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  reviewer text not null,
  reason text not null,
  previous_coverage jsonb not null check (jsonb_typeof(previous_coverage)='object'),
  new_coverage jsonb not null check (jsonb_typeof(new_coverage)='object'),
  recorded_at timestamptz not null default now()
);
alter table private.legal_source_coverage_review_audit enable row level security;
revoke all on private.legal_source_coverage_review_audit from public,anon,authenticated;
grant select,insert on private.legal_source_coverage_review_audit to service_role;

create or replace function private.reject_legal_source_coverage_audit_mutation()
returns trigger language plpgsql set search_path=''
as $$
begin
  raise exception 'Source coverage review audit is append-only' using errcode='55000';
end;
$$;
revoke all on function private.reject_legal_source_coverage_audit_mutation() from public,anon,authenticated;
create trigger legal_source_coverage_review_audit_immutable
  before update or delete on private.legal_source_coverage_review_audit
  for each row execute function private.reject_legal_source_coverage_audit_mutation();

create or replace function public.legal_source_record_coverage_review(
  p_source_id uuid,
  p_reviewer text,
  p_reason text,
  p_authority_types text[],
  p_languages text[],
  p_coverage_from date,
  p_coverage_until date,
  p_last_verified_at timestamptz,
  p_known_gaps text[] default '{}'::text[]
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_source private.legal_sources%rowtype;
  v_coverage jsonb;
  v_allowed_types text[]:=array[
    'constitution','act','statutory_instrument','regulation','judgment','decision',
    'treaty','directive','regulation_eu','official_guidance','order','other'
  ];
begin
  if p_source_id is null or p_reviewer is null or length(btrim(p_reviewer)) not between 1 and 200
    or p_reason is null or length(btrim(p_reason)) not between 10 and 1000
    or coalesce(cardinality(p_authority_types),0)<1 or cardinality(p_authority_types)>20
    or coalesce(cardinality(p_languages),0)<1 or cardinality(p_languages)>30
    or p_last_verified_at is null or p_last_verified_at>now()
    or (p_coverage_from is not null and p_coverage_until is not null and p_coverage_until<=p_coverage_from)
    or coalesce(cardinality(p_known_gaps),0)>100 then
    raise exception 'LEGAL_SOURCE_COVERAGE_REVIEW_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from unnest(p_authority_types) item where item is null or not item=any(v_allowed_types))
    or exists(select 1 from unnest(p_languages) item
      where item is null or item !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
    or exists(select 1 from unnest(coalesce(p_known_gaps,'{}'::text[])) item
      where item is null or length(btrim(item)) not between 1 and 500) then
    raise exception 'LEGAL_SOURCE_COVERAGE_SCOPE_INVALID' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources where id=p_source_id for update;
  if not found then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode='P0002'; end if;
  v_coverage:=coalesce(v_source.coverage,'{}'::jsonb)||jsonb_build_object(
    'authorityTypes',to_jsonb(p_authority_types),
    'languages',to_jsonb(p_languages),
    'coverageFrom',p_coverage_from,
    'coverageUntil',p_coverage_until,
    'lastVerifiedAt',p_last_verified_at,
    'knownGaps',to_jsonb(coalesce(p_known_gaps,'{}'::text[]))
  );
  insert into private.legal_source_coverage_review_audit(
    source_id,reviewer,reason,previous_coverage,new_coverage
  ) values(p_source_id,btrim(p_reviewer),btrim(p_reason),v_source.coverage,v_coverage);
  update private.legal_sources set coverage=v_coverage,updated_at=now() where id=p_source_id;
  return jsonb_build_object('sourceId',p_source_id,'sourceKey',v_source.source_key,'coverage',v_coverage);
end;
$$;
revoke all on function public.legal_source_record_coverage_review(uuid,text,text,text[],text[],date,date,timestamptz,text[]) from public,anon,authenticated;
grant execute on function public.legal_source_record_coverage_review(uuid,text,text,text[],text[],date,date,timestamptz,text[]) to service_role;
comment on function public.legal_source_record_coverage_review(uuid,text,text,text[],text[],date,date,timestamptz,text[]) is
  'Records a human-reviewed source coverage declaration with append-only audit; does not activate or enable the source.';
