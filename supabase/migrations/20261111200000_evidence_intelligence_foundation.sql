-- Phase 3: Evidence intelligence foundation (Master Plan v2.0 §7, Module C; upgrades U-11, U-12).
-- Evidence is tenant data: every table is private, reachable only through permission-checked
-- security-definer functions. Scan and extraction results are written only by the trusted worker
-- (service role), so a user can never mark their own upload as clean.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------------------------
create or replace function private.request_correlation_id()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_value text;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    v_value := coalesce(v_headers ->> 'x-request-id', v_headers ->> 'x-correlation-id',
      v_headers ->> 'traceparent');
  exception when others then
    v_value := null;
  end;
  if v_value is null then
    return null;
  end if;
  return left(regexp_replace(v_value, '[^a-zA-Z0-9._:-]', '', 'g'), 128);
end;
$$;
revoke all on function private.request_correlation_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 1. Tamper-evident security audit (U-12): every row is hash-chained in insertion order.
-- ---------------------------------------------------------------------------------------------
alter table private.security_audit_events add column chain_position bigint;
alter table private.security_audit_events add column previous_hash text;
alter table private.security_audit_events add column record_hash text;
create unique index security_audit_chain_position_unique
  on private.security_audit_events (chain_position);

create or replace function private.security_audit_record_digest(
  p_event private.security_audit_events, p_previous_hash text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(concat_ws('|',
    coalesce(p_previous_hash, 'genesis'), p_event.chain_position, p_event.event_id,
    to_char(p_event.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    p_event.actor_principal_id, p_event.organization_id, p_event.workspace_id, p_event.event_key,
    p_event.outcome, p_event.resource_type, p_event.resource_id, p_event.correlation_id,
    p_event.metadata::text, p_event.source_event_id), 'sha256'), 'hex');
$$;
revoke all on function private.security_audit_record_digest(private.security_audit_events, text)
  from public, anon, authenticated;

create or replace function private.chain_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous record;
begin
  -- Serialise chain extension so concurrent writers cannot fork the chain.
  perform pg_advisory_xact_lock(hashtext('njumeni.security_audit_chain'));
  select chain_position, record_hash into v_previous
  from private.security_audit_events
  where chain_position is not null
  order by chain_position desc
  limit 1;
  new.chain_position := coalesce(v_previous.chain_position, 0) + 1;
  new.previous_hash := v_previous.record_hash;
  new.record_hash := private.security_audit_record_digest(new, v_previous.record_hash);
  return new;
end;
$$;
revoke all on function private.chain_security_audit_event() from public, anon, authenticated;
create trigger security_audit_events_chain
  before insert on private.security_audit_events
  for each row execute function private.chain_security_audit_event();

create or replace function public.verify_security_audit_chain()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event private.security_audit_events;
  v_expected_previous text := null;
  v_position bigint := 0;
  v_count bigint := 0;
begin
  for v_event in
    select * from private.security_audit_events where chain_position is not null order by chain_position
  loop
    v_position := v_position + 1;
    v_count := v_count + 1;
    if v_event.chain_position <> v_position
      or v_event.previous_hash is distinct from v_expected_previous
      or v_event.record_hash <> private.security_audit_record_digest(v_event, v_expected_previous) then
      return jsonb_build_object('valid', false, 'checked', v_count, 'brokenAtPosition', v_position);
    end if;
    v_expected_previous := v_event.record_hash;
  end loop;
  return jsonb_build_object('valid', true, 'checked', v_count, 'brokenAtPosition', null);
end;
$$;
revoke all on function public.verify_security_audit_chain() from public, anon, authenticated;
grant execute on function public.verify_security_audit_chain() to service_role;

create or replace function private.record_evidence_audit(
  p_organization_id uuid, p_workspace_id uuid, p_event_key text, p_resource_type text,
  p_resource_id uuid, p_metadata jsonb default '{}'::jsonb, p_outcome text default 'success'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.security_audit_events (
    actor_principal_id, organization_id, workspace_id, event_key, outcome, resource_type,
    resource_id, correlation_id, metadata
  ) values (
    private.current_principal_id(), p_organization_id, p_workspace_id, p_event_key, p_outcome,
    p_resource_type, p_resource_id, private.request_correlation_id(), coalesce(p_metadata, '{}'::jsonb)
  );
$$;
revoke all on function private.record_evidence_audit(uuid, uuid, text, text, uuid, jsonb, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Evidence tables
-- ---------------------------------------------------------------------------------------------
create table private.evidence_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  evidence_type text not null default 'document' check (evidence_type in (
    'document', 'email', 'spreadsheet', 'image', 'correspondence', 'contract',
    'witness_statement', 'medical', 'employment', 'other')),
  sensitivity text not null default 'confidential'
    check (sensitivity in ('standard', 'confidential', 'special_category')),
  privilege text not null default 'none'
    check (privilege in ('none', 'legal_advice', 'litigation', 'work_product')),
  legal_hold boolean not null default false,
  status text not null default 'quarantined'
    check (status in ('quarantined', 'active', 'rejected', 'deleted')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id)
    on delete restrict
);
create index evidence_items_workspace_idx on private.evidence_items (workspace_id, created_at desc);

create table private.evidence_files (
  id uuid primary key default gen_random_uuid(),
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  version_number integer not null check (version_number > 0),
  storage_bucket text not null default 'njumeni-workspace-files',
  storage_object_key text not null unique check (char_length(storage_object_key) <= 1024),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 104857600),
  mime_type text not null check (char_length(mime_type) between 3 and 255),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'infected', 'rejected')),
  scan_detail text check (scan_detail is null or char_length(scan_detail) <= 500),
  scanned_at timestamptz,
  uploaded_by uuid references private.principals (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (evidence_item_id, version_number),
  unique (evidence_item_id, content_sha256)
);

create table private.evidence_extractions (
  id uuid primary key default gen_random_uuid(),
  evidence_file_id uuid not null references private.evidence_files (id) on delete restrict,
  extractor text not null check (extractor ~ '^[a-z][a-z0-9._-]{1,63}$'),
  extractor_version text not null check (char_length(extractor_version) between 1 and 40),
  status text not null check (status in ('succeeded', 'failed', 'unsupported')),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  text_sha256 text check (text_sha256 is null or text_sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer check (page_count is null or page_count >= 0),
  passage_count integer not null default 0 check (passage_count >= 0),
  created_at timestamptz not null default now(),
  check ((status = 'succeeded') = (text_sha256 is not null))
);

create table private.evidence_passages (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references private.evidence_extractions (id) on delete restrict,
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  ordinal integer not null check (ordinal >= 0),
  page_number integer check (page_number is null or page_number > 0),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  content text not null check (char_length(content) between 1 and 20000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  search_vector tsvector generated always as (to_tsvector('pg_catalog.simple'::regconfig, content)) stored,
  unique (extraction_id, ordinal)
);
create index evidence_passages_item_idx on private.evidence_passages (evidence_item_id, ordinal);
create index evidence_passages_search_idx on private.evidence_passages using gin (search_vector);

create table private.evidence_entities (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references private.evidence_passages (id) on delete restrict,
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  entity_type text not null check (entity_type in ('date', 'amount', 'email', 'phone', 'reference', 'organisation', 'url')),
  raw_value text not null check (char_length(raw_value) between 1 and 300),
  normalised_value text not null check (char_length(normalised_value) between 1 and 300),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  extractor text not null check (extractor ~ '^[a-z][a-z0-9._-]{1,63}$')
);
create index evidence_entities_item_idx on private.evidence_entities (evidence_item_id, entity_type);

create table private.evidence_events (
  id uuid primary key default gen_random_uuid(),
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  passage_id uuid references private.evidence_passages (id) on delete restrict,
  event_date date not null,
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'year')),
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  origin text not null check (origin in ('extracted', 'manual')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now()
);
create index evidence_events_item_date_idx on private.evidence_events (evidence_item_id, event_date);

create table private.factual_propositions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  statement text not null check (char_length(btrim(statement)) between 1 and 2000),
  status text not null default 'alleged' check (status in ('alleged', 'established', 'disputed', 'withdrawn')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id)
    on delete restrict
);

create table private.evidence_proposition_links (
  id uuid primary key default gen_random_uuid(),
  proposition_id uuid not null references private.factual_propositions (id) on delete restrict,
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  passage_id uuid references private.evidence_passages (id) on delete restrict,
  relation text not null check (relation in ('supports', 'contradicts', 'qualifies')),
  note text check (note is null or char_length(note) <= 1000),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index evidence_proposition_links_unique
  on private.evidence_proposition_links (proposition_id, evidence_item_id,
    coalesce(passage_id, '00000000-0000-0000-0000-000000000000'::uuid), relation);

create table private.evidence_redactions (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references private.evidence_passages (id) on delete restrict,
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  reason text not null check (reason in ('privilege', 'personal_data', 'third_party', 'other')),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Hash-chained chain of custody per evidence item (U-11).
create table private.evidence_custody_events (
  id uuid primary key default gen_random_uuid(),
  evidence_item_id uuid not null references private.evidence_items (id) on delete restrict,
  item_sequence integer not null check (item_sequence > 0),
  event_type text not null check (event_type in (
    'created', 'file_registered', 'scan_completed', 'extraction_recorded', 'accessed',
    'classified', 'legal_hold_set', 'legal_hold_released', 'linked', 'event_added',
    'redacted', 'deletion_requested')),
  actor_principal_id uuid references private.principals (id) on delete set null,
  actor_kind text not null check (actor_kind in ('user', 'worker')),
  occurred_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2048),
  previous_hash text,
  record_hash text not null,
  unique (evidence_item_id, item_sequence)
);

-- All evidence tables: private, append-only unless an RPC below performs a guarded state change.
do $tables$
declare
  v_table text;
begin
  foreach v_table in array array['evidence_items', 'evidence_files', 'evidence_extractions',
    'evidence_passages', 'evidence_entities', 'evidence_events', 'factual_propositions',
    'evidence_proposition_links', 'evidence_redactions', 'evidence_custody_events'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
  end loop;
  foreach v_table in array array['evidence_extractions', 'evidence_passages', 'evidence_entities',
    'evidence_events', 'evidence_proposition_links', 'evidence_redactions', 'evidence_custody_events'] loop
    execute format('create trigger %I before update or delete on private.%I for each row execute function private.reject_append_only_mutation()',
      v_table || '_immutable', v_table);
  end loop;
end;
$tables$;

-- Items and files may change only in the guarded fields that the RPCs below manage.
create or replace function private.guard_evidence_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Evidence items are never hard-deleted' using errcode = '55000';
  end if;
  if (new.id, new.organization_id, new.workspace_id, new.created_by, new.created_at)
     is distinct from (old.id, old.organization_id, old.workspace_id, old.created_by, old.created_at) then
    raise exception 'Evidence identity and ownership are immutable' using errcode = '55000';
  end if;
  if old.status = 'deleted' then
    raise exception 'Deleted evidence cannot be changed' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger evidence_items_guard before update or delete on private.evidence_items
  for each row execute function private.guard_evidence_item_mutation();

create or replace function private.guard_evidence_file_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Evidence files are never hard-deleted' using errcode = '55000';
  end if;
  if (to_jsonb(new) - 'scan_status' - 'scan_detail' - 'scanned_at')
     is distinct from (to_jsonb(old) - 'scan_status' - 'scan_detail' - 'scanned_at')
    or old.scan_status <> 'pending' then
    raise exception 'Original evidence files are immutable; only a pending scan may be resolved'
      using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger evidence_files_guard before update or delete on private.evidence_files
  for each row execute function private.guard_evidence_file_mutation();

-- ---------------------------------------------------------------------------------------------
-- 3. Custody chain
-- ---------------------------------------------------------------------------------------------
create or replace function private.evidence_custody_digest(
  p_item_id uuid, p_sequence integer, p_event_type text, p_actor uuid, p_actor_kind text,
  p_occurred_at timestamptz, p_details jsonb, p_previous_hash text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(concat_ws('|',
    coalesce(p_previous_hash, 'genesis'), p_item_id, p_sequence, p_event_type, p_actor, p_actor_kind,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), p_details::text), 'sha256'), 'hex');
$$;
revoke all on function private.evidence_custody_digest(uuid, integer, text, uuid, text, timestamptz, jsonb, text)
  from public, anon, authenticated;

create or replace function private.append_evidence_custody(
  p_item_id uuid, p_event_type text, p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous record;
  v_actor uuid := private.current_principal_id();
  v_kind text := case when v_actor is null then 'worker' else 'user' end;
  v_sequence integer;
  v_at timestamptz := clock_timestamp();
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  -- Lock the item row so custody events for one item are strictly ordered.
  perform 1 from private.evidence_items where id = p_item_id for update;
  select item_sequence, record_hash into v_previous
  from private.evidence_custody_events
  where evidence_item_id = p_item_id
  order by item_sequence desc
  limit 1;
  v_sequence := coalesce(v_previous.item_sequence, 0) + 1;
  insert into private.evidence_custody_events (
    evidence_item_id, item_sequence, event_type, actor_principal_id, actor_kind, occurred_at,
    details, previous_hash, record_hash
  ) values (
    p_item_id, v_sequence, p_event_type, v_actor, v_kind, v_at, v_details, v_previous.record_hash,
    private.evidence_custody_digest(p_item_id, v_sequence, p_event_type, v_actor, v_kind, v_at,
      v_details, v_previous.record_hash)
  );
end;
$$;
revoke all on function private.append_evidence_custody(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Authorisation helpers
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_evidence_scope(
  p_organization_id uuid, p_workspace_id uuid, p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null or p_workspace_id is null
    or not exists (select 1 from public.workspaces
                   where id = p_workspace_id and organization_id = p_organization_id)
    or private.current_principal_id() is null
    or not private.has_permission(p_permission, p_organization_id, p_workspace_id) then
    raise exception 'EVIDENCE_NOT_AUTHORISED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_evidence_scope(uuid, uuid, text) from public, anon, authenticated;

create or replace function private.require_evidence_item(p_item_id uuid, p_permission text)
returns private.evidence_items
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
begin
  select * into v_item from private.evidence_items where id = p_item_id;
  -- Unknown and unauthorised items are indistinguishable to the caller.
  if not found then
    raise exception 'EVIDENCE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  perform private.require_evidence_scope(v_item.organization_id, v_item.workspace_id, p_permission);
  return v_item;
end;
$$;
revoke all on function private.require_evidence_item(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. User-facing RPCs (authenticated; permission-checked)
-- ---------------------------------------------------------------------------------------------
create or replace function public.evidence_create_item(
  p_organization_id uuid, p_workspace_id uuid, p_title text,
  p_evidence_type text default 'document', p_sensitivity text default 'confidential',
  p_privilege text default 'none'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_evidence_scope(p_organization_id, p_workspace_id, 'evidence.manage');
  insert into private.evidence_items (organization_id, workspace_id, title, evidence_type, sensitivity, privilege, created_by)
  values (p_organization_id, p_workspace_id, btrim(p_title), p_evidence_type, p_sensitivity, p_privilege,
    private.current_principal_id())
  returning id into v_id;
  perform private.append_evidence_custody(v_id, 'created',
    jsonb_build_object('evidence_type', p_evidence_type, 'sensitivity', p_sensitivity, 'privilege', p_privilege));
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'evidence.created', 'evidence_item', v_id);
  return v_id;
end;
$$;

create or replace function public.evidence_register_file(
  p_evidence_item_id uuid, p_storage_object_key text, p_content_sha256 text, p_byte_size bigint,
  p_mime_type text, p_original_filename text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
  v_id uuid;
  v_version integer;
begin
  v_item := private.require_evidence_item(p_evidence_item_id, 'document.upload');
  if v_item.status in ('deleted', 'rejected') then
    raise exception 'EVIDENCE_ITEM_CLOSED' using errcode = '55000';
  end if;
  -- The object must sit inside this item's tenant/workspace path and must already be uploaded.
  if split_part(p_storage_object_key, '/', 1) <> v_item.organization_id::text
    or split_part(p_storage_object_key, '/', 2) <> v_item.workspace_id::text
    or not exists (select 1 from storage.objects
                   where bucket_id = 'njumeni-workspace-files' and name = p_storage_object_key) then
    raise exception 'EVIDENCE_OBJECT_NOT_FOUND' using errcode = '22023';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_version
  from private.evidence_files where evidence_item_id = p_evidence_item_id;
  insert into private.evidence_files (evidence_item_id, version_number, storage_object_key, content_sha256,
    byte_size, mime_type, original_filename, uploaded_by)
  values (p_evidence_item_id, v_version, p_storage_object_key, lower(p_content_sha256), p_byte_size,
    p_mime_type, p_original_filename, private.current_principal_id())
  returning id into v_id;
  perform private.append_evidence_custody(p_evidence_item_id, 'file_registered', jsonb_build_object(
    'file_id', v_id, 'version', v_version, 'sha256', lower(p_content_sha256), 'byte_size', p_byte_size));
  perform private.record_evidence_audit(v_item.organization_id, v_item.workspace_id, 'evidence.file_registered',
    'evidence_file', v_id, jsonb_build_object('version', v_version));
  return v_id;
end;
$$;

create or replace function public.evidence_list_items(p_organization_id uuid, p_workspace_id uuid)
returns table (
  evidence_item_id uuid, title text, evidence_type text, sensitivity text, privilege text,
  legal_hold boolean, status text, created_at timestamptz, latest_version integer,
  latest_scan_status text, latest_filename text, passage_count bigint, event_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_evidence_scope(p_organization_id, p_workspace_id, 'document.read');
  return query
  select item.id, item.title, item.evidence_type, item.sensitivity, item.privilege, item.legal_hold,
    item.status, item.created_at, latest.version_number, latest.scan_status, latest.original_filename,
    (select count(*) from private.evidence_passages p where p.evidence_item_id = item.id),
    (select count(*) from private.evidence_events e where e.evidence_item_id = item.id)
  from private.evidence_items item
  left join lateral (
    select f.version_number, f.scan_status, f.original_filename
    from private.evidence_files f where f.evidence_item_id = item.id
    order by f.version_number desc limit 1
  ) latest on true
  where item.organization_id = p_organization_id and item.workspace_id = p_workspace_id
    and item.status <> 'deleted'
  order by item.created_at desc, item.id;
end;
$$;

-- Passages with redactions applied. Records an 'accessed' custody event.
create or replace function public.evidence_read_passages(p_evidence_item_id uuid)
returns table (
  passage_id uuid, ordinal integer, page_number integer, content text, redaction_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
begin
  v_item := private.require_evidence_item(p_evidence_item_id, 'document.read');
  if v_item.status <> 'active' then
    raise exception 'EVIDENCE_NOT_AVAILABLE' using errcode = '55000';
  end if;
  perform private.append_evidence_custody(p_evidence_item_id, 'accessed', '{"view": "passages"}'::jsonb);
  return query
  select passage.id, passage.ordinal, passage.page_number,
    private.apply_evidence_redactions(passage.id, passage.content),
    (select count(*)::integer from private.evidence_redactions r where r.passage_id = passage.id)
  from private.evidence_passages passage
  where passage.evidence_item_id = p_evidence_item_id
  order by passage.ordinal;
end;
$$;

create or replace function private.apply_evidence_redactions(p_passage_id uuid, p_content text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result text := p_content;
  v_redaction record;
begin
  -- Apply right-to-left so earlier offsets stay valid; overlapping ranges are both blanked.
  for v_redaction in
    select start_offset, least(end_offset, char_length(p_content)) as end_offset
    from private.evidence_redactions where passage_id = p_passage_id and start_offset < char_length(p_content)
    order by start_offset desc
  loop
    v_result := overlay(v_result placing repeat('█', v_redaction.end_offset - v_redaction.start_offset)
      from v_redaction.start_offset + 1 for v_redaction.end_offset - v_redaction.start_offset);
  end loop;
  return v_result;
end;
$$;
revoke all on function private.apply_evidence_redactions(uuid, text) from public, anon, authenticated;

create or replace function public.evidence_list_entities(p_evidence_item_id uuid)
returns table (entity_type text, raw_value text, normalised_value text, passage_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_evidence_item(p_evidence_item_id, 'document.read');
  return query
  select entity.entity_type, entity.raw_value, entity.normalised_value, entity.passage_id
  from private.evidence_entities entity
  where entity.evidence_item_id = p_evidence_item_id
    -- Entities inside redacted ranges are withheld.
    and not exists (select 1 from private.evidence_redactions r
                    where r.passage_id = entity.passage_id
                      and r.start_offset < entity.end_offset and entity.start_offset < r.end_offset)
  order by entity.entity_type, entity.normalised_value;
end;
$$;

create or replace function public.evidence_chronology(p_organization_id uuid, p_workspace_id uuid)
returns table (
  event_id uuid, event_date date, date_precision text, description text, origin text,
  evidence_item_id uuid, evidence_title text, passage_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_evidence_scope(p_organization_id, p_workspace_id, 'document.read');
  return query
  select event.id, event.event_date, event.date_precision, event.description, event.origin,
    item.id, item.title, event.passage_id
  from private.evidence_events event
  join private.evidence_items item on item.id = event.evidence_item_id
  where item.organization_id = p_organization_id and item.workspace_id = p_workspace_id
    and item.status = 'active'
  order by event.event_date, event.created_at, event.id;
end;
$$;

create or replace function public.evidence_add_event(
  p_evidence_item_id uuid, p_event_date date, p_date_precision text, p_description text,
  p_passage_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
  v_id uuid;
begin
  v_item := private.require_evidence_item(p_evidence_item_id, 'evidence.manage');
  if p_passage_id is not null and not exists (
    select 1 from private.evidence_passages where id = p_passage_id and evidence_item_id = p_evidence_item_id) then
    raise exception 'EVIDENCE_PASSAGE_MISMATCH' using errcode = '22023';
  end if;
  insert into private.evidence_events (evidence_item_id, passage_id, event_date, date_precision, description, origin, created_by)
  values (p_evidence_item_id, p_passage_id, p_event_date, coalesce(p_date_precision, 'day'), btrim(p_description), 'manual',
    private.current_principal_id())
  returning id into v_id;
  perform private.append_evidence_custody(p_evidence_item_id, 'event_added', jsonb_build_object('event_id', v_id));
  return v_id;
end;
$$;

create or replace function public.evidence_create_proposition(
  p_organization_id uuid, p_workspace_id uuid, p_statement text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_evidence_scope(p_organization_id, p_workspace_id, 'evidence.manage');
  insert into private.factual_propositions (organization_id, workspace_id, statement, created_by)
  values (p_organization_id, p_workspace_id, btrim(p_statement), private.current_principal_id())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.evidence_link_proposition(
  p_proposition_id uuid, p_evidence_item_id uuid, p_relation text,
  p_passage_id uuid default null, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
  v_id uuid;
begin
  v_item := private.require_evidence_item(p_evidence_item_id, 'evidence.manage');
  -- Evidence and proposition must belong to the same workspace (no cross-tenant links).
  if not exists (select 1 from private.factual_propositions
                 where id = p_proposition_id and workspace_id = v_item.workspace_id
                   and organization_id = v_item.organization_id) then
    raise exception 'EVIDENCE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_passage_id is not null and not exists (
    select 1 from private.evidence_passages where id = p_passage_id and evidence_item_id = p_evidence_item_id) then
    raise exception 'EVIDENCE_PASSAGE_MISMATCH' using errcode = '22023';
  end if;
  insert into private.evidence_proposition_links (proposition_id, evidence_item_id, passage_id, relation, note, created_by)
  values (p_proposition_id, p_evidence_item_id, p_passage_id, p_relation, p_note, private.current_principal_id())
  returning id into v_id;
  perform private.append_evidence_custody(p_evidence_item_id, 'linked',
    jsonb_build_object('proposition_id', p_proposition_id, 'relation', p_relation));
  return v_id;
end;
$$;

-- Propositions with both supporting and contradicting evidence (Module C contradiction analysis).
create or replace function public.evidence_proposition_conflicts(p_organization_id uuid, p_workspace_id uuid)
returns table (
  proposition_id uuid, statement text, status text, supporting_items bigint, contradicting_items bigint,
  qualifying_items bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_evidence_scope(p_organization_id, p_workspace_id, 'document.read');
  return query
  select proposition.id, proposition.statement, proposition.status,
    count(distinct link.evidence_item_id) filter (where link.relation = 'supports'),
    count(distinct link.evidence_item_id) filter (where link.relation = 'contradicts'),
    count(distinct link.evidence_item_id) filter (where link.relation = 'qualifies')
  from private.factual_propositions proposition
  join private.evidence_proposition_links link on link.proposition_id = proposition.id
  where proposition.organization_id = p_organization_id and proposition.workspace_id = p_workspace_id
    and proposition.status <> 'withdrawn'
  group by proposition.id
  having count(*) filter (where link.relation = 'supports') > 0
     and count(*) filter (where link.relation = 'contradicts') > 0
  order by proposition.created_at, proposition.id;
end;
$$;

create or replace function public.evidence_add_redaction(
  p_passage_id uuid, p_start_offset integer, p_end_offset integer, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_passage private.evidence_passages;
  v_id uuid;
begin
  select * into v_passage from private.evidence_passages where id = p_passage_id;
  if not found then
    raise exception 'EVIDENCE_NOT_AUTHORISED' using errcode = '42501';
  end if;
  perform private.require_evidence_item(v_passage.evidence_item_id, 'evidence.manage');
  if p_start_offset is null or p_end_offset is null or p_start_offset < 0
    or p_end_offset <= p_start_offset or p_end_offset > char_length(v_passage.content) then
    raise exception 'EVIDENCE_REDACTION_RANGE_INVALID' using errcode = '22023';
  end if;
  insert into private.evidence_redactions (passage_id, evidence_item_id, start_offset, end_offset, reason, created_by)
  values (p_passage_id, v_passage.evidence_item_id, p_start_offset, p_end_offset, p_reason, private.current_principal_id())
  returning id into v_id;
  perform private.append_evidence_custody(v_passage.evidence_item_id, 'redacted',
    jsonb_build_object('passage_id', p_passage_id, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.evidence_set_legal_hold(p_evidence_item_id uuid, p_hold boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
begin
  v_item := private.require_evidence_item(p_evidence_item_id, 'document.delete');
  if p_hold is null or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'EVIDENCE_LEGAL_HOLD_REASON_REQUIRED' using errcode = '22023';
  end if;
  update private.evidence_items set legal_hold = p_hold where id = p_evidence_item_id;
  perform private.append_evidence_custody(p_evidence_item_id,
    case when p_hold then 'legal_hold_set' else 'legal_hold_released' end,
    jsonb_build_object('reason', left(btrim(p_reason), 500)));
  perform private.record_evidence_audit(v_item.organization_id, v_item.workspace_id,
    case when p_hold then 'evidence.legal_hold_set' else 'evidence.legal_hold_released' end,
    'evidence_item', p_evidence_item_id);
end;
$$;

create or replace function public.evidence_request_deletion(p_evidence_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.evidence_items;
begin
  v_item := private.require_evidence_item(p_evidence_item_id, 'document.delete');
  if v_item.legal_hold then
    perform private.record_evidence_audit(v_item.organization_id, v_item.workspace_id,
      'evidence.deletion_blocked', 'evidence_item', p_evidence_item_id, '{}'::jsonb, 'denied');
    raise exception 'EVIDENCE_UNDER_LEGAL_HOLD' using errcode = '55000';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'EVIDENCE_DELETION_REASON_REQUIRED' using errcode = '22023';
  end if;
  perform private.append_evidence_custody(p_evidence_item_id, 'deletion_requested',
    jsonb_build_object('reason', left(btrim(p_reason), 500)));
  update private.evidence_items set status = 'deleted' where id = p_evidence_item_id;
  perform private.record_evidence_audit(v_item.organization_id, v_item.workspace_id, 'evidence.deleted',
    'evidence_item', p_evidence_item_id);
end;
$$;

create or replace function public.evidence_verify_custody(p_evidence_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event private.evidence_custody_events;
  v_expected text := null;
  v_sequence integer := 0;
begin
  perform private.require_evidence_item(p_evidence_item_id, 'document.read');
  for v_event in
    select * from private.evidence_custody_events where evidence_item_id = p_evidence_item_id order by item_sequence
  loop
    v_sequence := v_sequence + 1;
    if v_event.item_sequence <> v_sequence
      or v_event.previous_hash is distinct from v_expected
      or v_event.record_hash <> private.evidence_custody_digest(v_event.evidence_item_id, v_event.item_sequence,
           v_event.event_type, v_event.actor_principal_id, v_event.actor_kind, v_event.occurred_at,
           v_event.details, v_event.previous_hash) then
      return jsonb_build_object('valid', false, 'events', v_sequence, 'brokenAtSequence', v_sequence);
    end if;
    v_expected := v_event.record_hash;
  end loop;
  return jsonb_build_object('valid', true, 'events', v_sequence, 'brokenAtSequence', null,
    'headHash', v_expected);
end;
$$;

create or replace function public.evidence_custody_log(p_evidence_item_id uuid)
returns table (item_sequence integer, event_type text, actor_kind text, occurred_at timestamptz, record_hash text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_evidence_item(p_evidence_item_id, 'document.read');
  return query
  select e.item_sequence, e.event_type, e.actor_kind, e.occurred_at, e.record_hash
  from private.evidence_custody_events e where e.evidence_item_id = p_evidence_item_id
  order by e.item_sequence;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Worker-only RPCs (service role): scanning and extraction
-- ---------------------------------------------------------------------------------------------
create or replace function public.evidence_worker_pending_files(p_limit integer default 10)
returns table (
  evidence_file_id uuid, evidence_item_id uuid, organization_id uuid, workspace_id uuid,
  storage_object_key text, content_sha256 text, byte_size bigint, mime_type text,
  original_filename text, scan_status text, needs_extraction boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.evidence_item_id, i.organization_id, i.workspace_id, f.storage_object_key,
    f.content_sha256, f.byte_size, f.mime_type, f.original_filename, f.scan_status,
    (f.scan_status = 'clean' and not exists (select 1 from private.evidence_extractions x where x.evidence_file_id = f.id))
  from private.evidence_files f
  join private.evidence_items i on i.id = f.evidence_item_id
  where i.status <> 'deleted'
    and (f.scan_status = 'pending'
      or (f.scan_status = 'clean' and not exists (select 1 from private.evidence_extractions x where x.evidence_file_id = f.id)))
  order by f.uploaded_at, f.id
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

create or replace function public.evidence_worker_record_scan(
  p_evidence_file_id uuid, p_verdict text, p_detail text, p_observed_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file private.evidence_files;
  v_item private.evidence_items;
  v_verdict text := p_verdict;
  v_detail text := p_detail;
begin
  select * into v_file from private.evidence_files where id = p_evidence_file_id for update;
  if not found or v_file.scan_status <> 'pending' then
    raise exception 'EVIDENCE_SCAN_NOT_PENDING' using errcode = '55000';
  end if;
  if v_verdict not in ('clean', 'infected', 'rejected') then
    raise exception 'EVIDENCE_SCAN_VERDICT_INVALID' using errcode = '22023';
  end if;
  -- The bytes the worker scanned must be the bytes the uploader declared (content addressing).
  if v_verdict = 'clean' and lower(coalesce(p_observed_sha256, '')) <> v_file.content_sha256 then
    v_verdict := 'rejected';
    v_detail := 'Stored bytes do not match the declared SHA-256';
  end if;
  update private.evidence_files
  set scan_status = v_verdict, scan_detail = left(v_detail, 500), scanned_at = now()
  where id = p_evidence_file_id;
  select * into v_item from private.evidence_items where id = v_file.evidence_item_id;
  if v_verdict = 'clean' and v_item.status = 'quarantined' then
    update private.evidence_items set status = 'active' where id = v_item.id;
  elsif v_verdict <> 'clean' and v_item.status = 'quarantined' and not exists (
    select 1 from private.evidence_files where evidence_item_id = v_item.id and scan_status in ('clean', 'pending')) then
    update private.evidence_items set status = 'rejected' where id = v_item.id;
  end if;
  perform private.append_evidence_custody(v_item.id, 'scan_completed', jsonb_build_object(
    'file_id', p_evidence_file_id, 'verdict', v_verdict));
  perform private.record_evidence_audit(v_item.organization_id, v_item.workspace_id, 'evidence.scan_completed',
    'evidence_file', p_evidence_file_id, jsonb_build_object('verdict', v_verdict),
    case when v_verdict = 'clean' then 'success' else 'failure' end);
end;
$$;

create or replace function public.evidence_worker_record_extraction(
  p_evidence_file_id uuid, p_extractor text, p_extractor_version text, p_status text,
  p_failure_code text, p_text_sha256 text, p_page_count integer, p_passages jsonb,
  p_entities jsonb, p_events jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file private.evidence_files;
  v_item_id uuid;
  v_extraction_id uuid;
  v_passage jsonb;
  v_entity jsonb;
  v_event jsonb;
  v_passage_ids uuid[] := '{}';
  v_passage_id uuid;
  v_count integer := 0;
begin
  select * into v_file from private.evidence_files where id = p_evidence_file_id;
  if not found or v_file.scan_status <> 'clean' then
    raise exception 'EVIDENCE_FILE_NOT_CLEAN' using errcode = '55000';
  end if;
  if exists (select 1 from private.evidence_extractions where evidence_file_id = p_evidence_file_id) then
    raise exception 'EVIDENCE_ALREADY_EXTRACTED' using errcode = '55000';
  end if;
  if jsonb_typeof(coalesce(p_passages, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_entities, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_passages, '[]'::jsonb)) > 5000 then
    raise exception 'EVIDENCE_EXTRACTION_PAYLOAD_INVALID' using errcode = '22023';
  end if;
  v_item_id := v_file.evidence_item_id;
  insert into private.evidence_extractions (evidence_file_id, extractor, extractor_version, status, failure_code,
    text_sha256, page_count, passage_count)
  values (p_evidence_file_id, p_extractor, p_extractor_version, p_status, p_failure_code, p_text_sha256,
    p_page_count, jsonb_array_length(coalesce(p_passages, '[]'::jsonb)))
  returning id into v_extraction_id;

  for v_passage in select value from jsonb_array_elements(coalesce(p_passages, '[]'::jsonb)) loop
    insert into private.evidence_passages (extraction_id, evidence_item_id, ordinal, page_number, start_offset,
      end_offset, content, content_hash)
    values (v_extraction_id, v_item_id, (v_passage ->> 'ordinal')::integer, (v_passage ->> 'page_number')::integer,
      (v_passage ->> 'start_offset')::integer, (v_passage ->> 'end_offset')::integer, v_passage ->> 'content',
      v_passage ->> 'content_hash')
    returning id into v_passage_id;
    v_passage_ids := v_passage_ids || v_passage_id;
    v_count := v_count + 1;
  end loop;

  -- Entities and events reference passages by ordinal (index into p_passages).
  for v_entity in select value from jsonb_array_elements(coalesce(p_entities, '[]'::jsonb)) loop
    insert into private.evidence_entities (passage_id, evidence_item_id, entity_type, raw_value, normalised_value,
      start_offset, end_offset, extractor)
    values (v_passage_ids[(v_entity ->> 'passage_ordinal')::integer + 1], v_item_id, v_entity ->> 'entity_type',
      v_entity ->> 'raw_value', v_entity ->> 'normalised_value', (v_entity ->> 'start_offset')::integer,
      (v_entity ->> 'end_offset')::integer, p_extractor);
  end loop;
  for v_event in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into private.evidence_events (evidence_item_id, passage_id, event_date, date_precision, description, origin)
    values (v_item_id, v_passage_ids[(v_event ->> 'passage_ordinal')::integer + 1], (v_event ->> 'event_date')::date,
      v_event ->> 'date_precision', v_event ->> 'description', 'extracted');
  end loop;

  perform private.append_evidence_custody(v_item_id, 'extraction_recorded', jsonb_build_object(
    'file_id', p_evidence_file_id, 'extraction_id', v_extraction_id, 'status', p_status,
    'extractor', p_extractor || '@' || p_extractor_version, 'passages', v_count));
  return v_extraction_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.evidence_create_item(uuid, uuid, text, text, text, text)',
    'public.evidence_register_file(uuid, text, text, bigint, text, text)',
    'public.evidence_list_items(uuid, uuid)',
    'public.evidence_read_passages(uuid)',
    'public.evidence_list_entities(uuid)',
    'public.evidence_chronology(uuid, uuid)',
    'public.evidence_add_event(uuid, date, text, text, uuid)',
    'public.evidence_create_proposition(uuid, uuid, text)',
    'public.evidence_link_proposition(uuid, uuid, text, uuid, text)',
    'public.evidence_proposition_conflicts(uuid, uuid)',
    'public.evidence_add_redaction(uuid, integer, integer, text)',
    'public.evidence_set_legal_hold(uuid, boolean, text)',
    'public.evidence_request_deletion(uuid, text)',
    'public.evidence_verify_custody(uuid)',
    'public.evidence_custody_log(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
  foreach v_signature in array array[
    'public.evidence_worker_pending_files(integer)',
    'public.evidence_worker_record_scan(uuid, text, text, text)',
    'public.evidence_worker_record_extraction(uuid, text, text, text, text, text, integer, jsonb, jsonb, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$grants$;

-- Phase 3 permission: evidence.read is covered by document.read; evidence.manage already exists.
comment on table private.evidence_items is
  'Phase 3 evidence items. Tenant-scoped; reachable only through permission-checked RPCs.';
