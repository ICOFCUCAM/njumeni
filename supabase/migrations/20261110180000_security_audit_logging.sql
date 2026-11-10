-- Phase 1.9: central append-only security audit stream.
-- Only allow-listed metadata is copied; invitation addresses, token hashes,
-- document content and arbitrary row payloads are deliberately excluded.

create table private.security_audit_events (
  sequence_id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_principal_id uuid references private.principals(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  event_key text not null check (event_key ~ '^[a-z][a-z0-9_.-]{2,119}$'),
  outcome text not null default 'success'
    check (outcome in ('success', 'denied', 'failure')),
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  resource_id uuid,
  correlation_id text check (correlation_id is null or char_length(correlation_id) <= 128),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  source_event_id uuid,
  constraint security_audit_metadata_size
    check (octet_length(metadata::text) <= 2048)
);

create index security_audit_org_sequence_idx
  on private.security_audit_events (organization_id, sequence_id desc);
create index security_audit_workspace_sequence_idx
  on private.security_audit_events (workspace_id, sequence_id desc);
create index security_audit_actor_sequence_idx
  on private.security_audit_events (actor_principal_id, sequence_id desc);
create unique index security_audit_source_event_unique
  on private.security_audit_events (source_event_id)
  where source_event_id is not null;

alter table private.security_audit_events enable row level security;
revoke all on private.security_audit_events from public, anon, authenticated;

create or replace function private.reject_security_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Security audit events are append-only'
    using errcode = '55000';
end;
$$;

revoke all on function private.reject_security_audit_mutation() from public, anon, authenticated;

create trigger security_audit_events_immutable
  before update or delete on private.security_audit_events
  for each row execute function private.reject_security_audit_mutation();

create or replace function private.capture_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  event_actor uuid;
  event_org uuid;
  event_workspace uuid;
  event_resource uuid;
  event_key_value text;
  event_resource_type text;
  event_metadata jsonb := '{}'::jsonb;
  request_headers jsonb;
  correlation text;
  status_value text;
  kind_value text;
  role_value text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  event_actor := private.current_principal_id();

  if tg_table_name = 'organizations' then
    event_org := (row_data ->> 'id')::uuid;
    event_resource := event_org;
    event_resource_type := 'organization';
  elsif tg_table_name = 'workspaces' then
    event_workspace := (row_data ->> 'id')::uuid;
    event_org := (row_data ->> 'organization_id')::uuid;
    event_resource := event_workspace;
    event_resource_type := 'workspace';
  elsif tg_table_name = 'role_audit_events' then
    event_org := nullif(row_data ->> 'organization_id', '')::uuid;
    event_workspace := nullif(row_data ->> 'workspace_id', '')::uuid;
    event_actor := coalesce(nullif(row_data ->> 'actor_principal_id', '')::uuid, event_actor);
    event_resource := nullif(row_data ->> 'target_principal_id', '')::uuid;
    event_resource_type := 'principal_role_binding';
  elsif tg_table_name = 'membership_events' then
    event_org := nullif(row_data ->> 'organization_id', '')::uuid;
    event_workspace := nullif(row_data ->> 'workspace_id', '')::uuid;
    event_actor := coalesce(nullif(row_data ->> 'actor_principal_id', '')::uuid, event_actor);
    event_resource := coalesce(
      nullif(row_data ->> 'invitation_id', '')::uuid,
      nullif(row_data ->> 'target_principal_id', '')::uuid
    );
    event_resource_type := case
      when nullif(row_data ->> 'invitation_id', '') is not null then 'organization_invitation'
      when event_workspace is not null then 'workspace_membership'
      else 'organization_membership'
    end;
  else
    return null;
  end if;

  if tg_table_name in ('role_audit_events', 'membership_events') then
    event_key_value := coalesce(nullif(row_data ->> 'action', ''), nullif(row_data ->> 'event_type', ''));
    if event_key_value is null then
      event_key_value := tg_table_name || '.changed';
    end if;
    event_key_value := lower(regexp_replace(event_key_value, '[^a-zA-Z0-9_.-]+', '.', 'g'));
  else
    event_key_value := lower(tg_table_name || '.' || lower(tg_op));
  end if;

  status_value := nullif(row_data ->> 'status', '');
  kind_value := nullif(row_data ->> 'kind', '');
  role_value := nullif(row_data ->> 'role_key', '');
  if status_value is not null then
    event_metadata := event_metadata || jsonb_build_object('status', left(status_value, 40));
  end if;
  if kind_value is not null then
    event_metadata := event_metadata || jsonb_build_object('kind', left(kind_value, 40));
  end if;
  if role_value is not null then
    event_metadata := event_metadata || jsonb_build_object('role_key', left(role_value, 80));
  end if;
  if tg_op = 'UPDATE' then
    event_metadata := event_metadata || jsonb_build_object('operation', 'update');
  else
    event_metadata := event_metadata || jsonb_build_object('operation', lower(tg_op));
  end if;

  begin
    request_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    correlation := coalesce(
      request_headers ->> 'x-request-id',
      request_headers ->> 'x-correlation-id',
      request_headers ->> 'traceparent'
    );
  exception when others then
    correlation := null;
  end;
  if correlation is not null then
    correlation := left(regexp_replace(correlation, '[^a-zA-Z0-9._:-]', '', 'g'), 128);
  end if;

  insert into private.security_audit_events (
    actor_principal_id, organization_id, workspace_id, event_key,
    outcome, resource_type, resource_id, correlation_id, metadata
  ) values (
    event_actor, event_org, event_workspace, left(event_key_value, 120),
    'success', event_resource_type, event_resource, correlation, event_metadata
  );

  return null;
end;
$$;

revoke all on function private.capture_security_audit_event() from public, anon, authenticated;

create trigger organizations_security_audit
  after insert or update or delete on public.organizations
  for each row execute function private.capture_security_audit_event();
create trigger workspaces_security_audit
  after insert or update or delete on public.workspaces
  for each row execute function private.capture_security_audit_event();
create trigger role_audit_events_security_audit
  after insert on private.role_audit_events
  for each row execute function private.capture_security_audit_event();
create trigger membership_events_security_audit
  after insert on private.membership_events
  for each row execute function private.capture_security_audit_event();

create or replace function public.list_security_audit_events(
  p_organization_id uuid,
  p_workspace_id uuid default null,
  p_before_sequence bigint default null,
  p_limit integer default 100
)
returns table (
  sequence_id bigint,
  event_id uuid,
  occurred_at timestamptz,
  actor_principal_id uuid,
  organization_id uuid,
  workspace_id uuid,
  event_key text,
  outcome text,
  resource_type text,
  resource_id uuid,
  correlation_id text,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null
     or p_limit < 1 or p_limit > 200
     or (p_workspace_id is not null and not exists (
       select 1 from public.workspaces workspace
       where workspace.id = p_workspace_id
         and workspace.organization_id = p_organization_id
     )) then
    raise exception 'Invalid audit query scope'
      using errcode = '22023';
  end if;

  if not private.has_permission('audit.read', p_organization_id, null) then
    raise exception 'Audit access denied'
      using errcode = '42501';
  end if;

  return query
  select event.sequence_id, event.event_id, event.occurred_at,
         event.actor_principal_id, event.organization_id, event.workspace_id,
         event.event_key, event.outcome, event.resource_type, event.resource_id,
         event.correlation_id, event.metadata
  from private.security_audit_events event
  where event.organization_id = p_organization_id
    and (p_workspace_id is null or event.workspace_id = p_workspace_id)
    and (p_before_sequence is null or event.sequence_id < p_before_sequence)
  order by event.sequence_id desc
  limit p_limit;
end;
$$;

revoke all on function public.list_security_audit_events(uuid, uuid, bigint, integer) from public, anon;
grant execute on function public.list_security_audit_events(uuid, uuid, bigint, integer) to authenticated;

comment on table private.security_audit_events is
  'Central append-only audit stream. Metadata is allow-listed and excludes sensitive payloads.';
comment on function public.list_security_audit_events(uuid, uuid, bigint, integer) is
  'Returns a bounded, tenant-scoped audit page to principals with organisation audit.read permission.';
