-- Phase 2.1 / 2.5: explicit source activation control and immutable operator audit.
-- Merely recording licence approval never activates or enables ingestion.

create table if not exists private.legal_source_activation_audit (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  operator text not null,
  reason text not null,
  previous_status text not null,
  new_status text not null,
  previous_ingestion_enabled boolean not null,
  new_ingestion_enabled boolean not null,
  adapter_key text,
  adapter_version text,
  recorded_at timestamptz not null default now()
);
alter table private.legal_source_activation_audit enable row level security;
revoke all on private.legal_source_activation_audit from public,anon,authenticated;
grant select,insert on private.legal_source_activation_audit to service_role;

create or replace function private.reject_legal_source_activation_audit_mutation()
returns trigger language plpgsql set search_path=''
as $$
begin
  raise exception 'Source activation audit is append-only' using errcode='55000';
end;
$$;
revoke all on function private.reject_legal_source_activation_audit_mutation() from public,anon,authenticated;
create trigger legal_source_activation_audit_immutable
  before update or delete on private.legal_source_activation_audit
  for each row execute function private.reject_legal_source_activation_audit_mutation();

create or replace function public.legal_source_set_activation(
  p_source_id uuid,
  p_operator text,
  p_reason text,
  p_status text,
  p_ingestion_enabled boolean,
  p_adapter_key text,
  p_adapter_version text
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_source private.legal_sources%rowtype;
  v_evidence private.legal_source_rights_evidence%rowtype;
begin
  if p_source_id is null or p_operator is null or length(btrim(p_operator)) not between 1 and 200
    or p_reason is null or length(btrim(p_reason)) not between 10 and 1000
    or p_status is null or p_status not in ('planned','active','paused','retired')
    or p_ingestion_enabled is null
    or (p_adapter_key is not null and p_adapter_key !~ '^[a-z][a-z0-9._-]{1,79}
    raise exception 'LEGAL_SOURCE_ACTIVATION_ARGUMENT_INVALID' using errcode='22023';
  end if;
  if p_ingestion_enabled and (p_status<>'active' or p_adapter_key is null
    or p_adapter_key !~ '^[a-z][a-z0-9._-]{1,79}$'
    or p_adapter_version is null or length(btrim(p_adapter_version)) not between 1 and 80) then
    raise exception 'LEGAL_SOURCE_ACTIVATION_ADAPTER_REQUIRED' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources where id=p_source_id for update;
  if not found then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_evidence from private.legal_source_rights_evidence where source_id=p_source_id;
  if p_status='active' and (v_source.rights_status<>'approved' or not found
    or (v_evidence.review_expires_at is not null and v_evidence.review_expires_at<=now())) then
    raise exception 'LEGAL_SOURCE_RIGHTS_NOT_APPROVED' using errcode='42501';
  end if;
  if p_ingestion_enabled and (
    v_evidence.review_expires_at is not null and v_evidence.review_expires_at<=now()
    or not coalesce((v_evidence.permissions->>'retrieve')::boolean,false)
    or not coalesce((v_evidence.permissions->>'store')::boolean,false)
    or not coalesce((v_evidence.permissions->>'normalise')::boolean,false)
    or not coalesce((v_evidence.permissions->>'index')::boolean,false)
  ) then
    raise exception 'LEGAL_SOURCE_INGESTION_PERMISSION_DENIED' using errcode='42501';
  end if;
  insert into private.legal_source_activation_audit(
    source_id,operator,reason,previous_status,new_status,
    previous_ingestion_enabled,new_ingestion_enabled,adapter_key,adapter_version
  ) values(
    p_source_id,btrim(p_operator),btrim(p_reason),v_source.status,p_status,
    v_source.ingestion_enabled,p_ingestion_enabled,p_adapter_key,p_adapter_version
  );
  update private.legal_sources set status=p_status,ingestion_enabled=p_ingestion_enabled,
    adapter_key=nullif(btrim(p_adapter_key),''),adapter_version=nullif(btrim(p_adapter_version),''),updated_at=now()
    where id=p_source_id;
  return jsonb_build_object(
    'sourceId',p_source_id,'sourceKey',v_source.source_key,
    'status',p_status,'ingestionEnabled',p_ingestion_enabled,
    'adapterKey',p_adapter_key,'adapterVersion',p_adapter_version
  );
end;
$$;
revoke all on function public.legal_source_set_activation(uuid,text,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.legal_source_set_activation(uuid,text,text,text,boolean,text,text) to service_role;
comment on function public.legal_source_set_activation(uuid,text,text,text,boolean,text,text) is
  'Explicit trusted operator activation. Requires approved rights and unexpired permissions; every change is audited.';
)
    or (p_adapter_version is not null and length(btrim(p_adapter_version)) not between 1 and 80) then
    raise exception 'LEGAL_SOURCE_ACTIVATION_ARGUMENT_INVALID' using errcode='22023';
  end if;
  if p_ingestion_enabled and (p_status<>'active' or p_adapter_key is null
    or p_adapter_key !~ '^[a-z][a-z0-9._-]{1,79}$'
    or p_adapter_version is null or length(btrim(p_adapter_version)) not between 1 and 80) then
    raise exception 'LEGAL_SOURCE_ACTIVATION_ADAPTER_REQUIRED' using errcode='22023';
  end if;
  select * into v_source from private.legal_sources where id=p_source_id for update;
  if not found then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_evidence from private.legal_source_rights_evidence where source_id=p_source_id;
  if p_status='active' and (v_source.rights_status<>'approved' or not found) then
    raise exception 'LEGAL_SOURCE_RIGHTS_NOT_APPROVED' using errcode='42501';
  end if;
  if p_ingestion_enabled and (
    v_evidence.review_expires_at is not null and v_evidence.review_expires_at<=now()
    or not coalesce((v_evidence.permissions->>'retrieve')::boolean,false)
    or not coalesce((v_evidence.permissions->>'store')::boolean,false)
    or not coalesce((v_evidence.permissions->>'normalise')::boolean,false)
    or not coalesce((v_evidence.permissions->>'index')::boolean,false)
  ) then
    raise exception 'LEGAL_SOURCE_INGESTION_PERMISSION_DENIED' using errcode='42501';
  end if;
  insert into private.legal_source_activation_audit(
    source_id,operator,reason,previous_status,new_status,
    previous_ingestion_enabled,new_ingestion_enabled,adapter_key,adapter_version
  ) values(
    p_source_id,btrim(p_operator),btrim(p_reason),v_source.status,p_status,
    v_source.ingestion_enabled,p_ingestion_enabled,p_adapter_key,p_adapter_version
  );
  update private.legal_sources set status=p_status,ingestion_enabled=p_ingestion_enabled,
    adapter_key=p_adapter_key,adapter_version=p_adapter_version,updated_at=now()
    where id=p_source_id;
  return jsonb_build_object(
    'sourceId',p_source_id,'sourceKey',v_source.source_key,
    'status',p_status,'ingestionEnabled',p_ingestion_enabled,
    'adapterKey',p_adapter_key,'adapterVersion',p_adapter_version
  );
end;
$$;
revoke all on function public.legal_source_set_activation(uuid,text,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.legal_source_set_activation(uuid,text,text,text,boolean,text,text) to service_role;
comment on function public.legal_source_set_activation(uuid,text,text,text,boolean,text,text) is
  'Explicit trusted operator activation. Requires approved rights and unexpired permissions; every change is audited.';
