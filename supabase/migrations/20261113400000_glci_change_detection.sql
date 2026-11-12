-- GLCI-03: legislation version comparison (docs/GLCI_SPECIFICATION.md §2 engine 2, §3 step 2).
--
-- Every new authority version is compared with the previous version of the same authority,
-- section by section, when its transaction commits (a deferred trigger, so all passages exist).
-- One change event is recorded per new version (the first version: new_authority). Each changed
-- section is recorded as added, amended, removed or renumbered (same text, new label).
-- An authority that a complete dataset no longer lists becomes a withdrawn event (a repeal
-- candidate: a human confirms whether it was repealed). Reappearance becomes reinstated.
--
-- Dates are kept apart (spec §3): publication, enactment, effective (commencement), repeal, and
-- transitional provisions. A version whose effective date is after its detection is pending
-- commencement, not in force (J-GLCI-6). The first ingestion of a source (no completed dataset
-- synchronisation yet) is marked baseline, so it is not reported as news.

create table private.glci_change_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.legal_sources(id) on delete restrict,
  authority_id uuid not null references private.legal_authorities(id) on delete restrict,
  jurisdiction_code text references private.jurisdictions(code) on delete restrict,
  change_type text not null check (change_type in ('new_authority', 'amended', 'unchanged_text', 'withdrawn', 'reinstated')),
  from_version_id uuid references private.legal_authority_versions(id) on delete restrict,
  to_version_id uuid references private.legal_authority_versions(id) on delete restrict,
  is_baseline boolean not null default false,
  detected_at timestamptz not null default now(),
  publication_date date,
  enactment_date date,
  effective_date date,
  repeal_date date,
  commencement_status text not null check (commencement_status in ('in_force', 'pending_commencement', 'unknown', 'not_applicable')),
  transitional_sections text[] not null default '{}',
  sections_added integer not null default 0 check (sections_added >= 0),
  sections_amended integer not null default 0 check (sections_amended >= 0),
  sections_removed integer not null default 0 check (sections_removed >= 0),
  sections_renumbered integer not null default 0 check (sections_renumbered >= 0),
  review_status text not null default 'detected' check (review_status in ('detected', 'assessed', 'confirmed', 'dismissed')),
  check (change_type in ('withdrawn', 'reinstated') or to_version_id is not null),
  check (change_type <> 'amended' or from_version_id is not null)
);
create index glci_change_events_source_idx on private.glci_change_events(source_id, detected_at desc);
create index glci_change_events_authority_idx on private.glci_change_events(authority_id, detected_at desc);
create index glci_change_events_jurisdiction_idx on private.glci_change_events(jurisdiction_code, detected_at desc);
create index glci_change_events_from_idx on private.glci_change_events(from_version_id);
create index glci_change_events_to_idx on private.glci_change_events(to_version_id);
create index glci_change_events_review_idx on private.glci_change_events(review_status, is_baseline);
alter table private.glci_change_events enable row level security;
revoke all on private.glci_change_events from public, anon, authenticated;
grant select on private.glci_change_events to service_role;

create table private.glci_change_sections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.glci_change_events(id) on delete restrict,
  section_key text not null check (char_length(section_key) between 1 and 2000),
  previous_section_key text check (previous_section_key is null or char_length(previous_section_key) <= 2000),
  change text not null check (change in ('added', 'amended', 'removed', 'renumbered')),
  old_text_hash text check (old_text_hash is null or old_text_hash ~ '^[a-f0-9]{32}$'),
  new_text_hash text check (new_text_hash is null or new_text_hash ~ '^[a-f0-9]{32}$'),
  old_passage_ids uuid[] not null default '{}',
  new_passage_ids uuid[] not null default '{}',
  is_transitional boolean not null default false
);
create index glci_change_sections_event_idx on private.glci_change_sections(event_id, change);
alter table private.glci_change_sections enable row level security;
revoke all on private.glci_change_sections from public, anon, authenticated;
grant select on private.glci_change_sections to service_role;

-- Detection records are evidence: the change itself is immutable; only the review status moves.
create or replace function private.glci_change_event_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (to_jsonb(new) - 'review_status') is distinct from (to_jsonb(old) - 'review_status') then
    raise exception 'This record is append-only; record a new entry instead' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.glci_change_event_guard() from public, anon, authenticated;
create trigger glci_change_events_guard before update or delete on private.glci_change_events
  for each row execute function private.glci_change_event_guard();
create trigger glci_change_sections_append_only before update or delete on private.glci_change_sections
  for each row execute function private.reject_append_only_mutation();

-- Section text of one version: one row per section key (the section path, else the passage
-- ordinal), with the passages that make it up and a hash of its text.
create or replace function private.glci_version_sections(p_version_id uuid)
returns table (section_key text, text_hash text, passage_ids uuid[], is_transitional boolean)
language sql stable security definer set search_path = '' as $$
  select k.section_key, md5(string_agg(k.content_hash, '|' order by k.ordinal)), array_agg(k.id order by k.ordinal),
    bool_or(k.section_key ~* '(overgang|transitional|övergång|overgangs|siirtymä|dispositions? transitoires?|savings)'
      or k.content ~* '^\s*(§\s*[0-9a-z -]+\.\s*)?(overgangsregler|overgangsbestemmelser|transitional provisions?|övergångsbestämmelser|dispositions transitoires)')
  from (select p.id, p.ordinal, p.content_hash, p.content,
      coalesce(nullif(array_to_string(p.section_path, ' > '), ''), 'ordinal:' || p.ordinal) as section_key
    from private.legal_authority_passages p where p.authority_version_id = p_version_id) k
  group by k.section_key
$$;
revoke all on function private.glci_version_sections(uuid) from public, anon, authenticated;

-- Section differences between two versions of one authority. A removed section whose exact text
-- reappears under a new label is renumbered, not removed plus added.
create or replace function private.glci_version_diff(p_old_version_id uuid, p_new_version_id uuid)
returns table (section_key text, previous_section_key text, change text, old_text_hash text, new_text_hash text,
  old_passage_ids uuid[], new_passage_ids uuid[], is_transitional boolean)
language sql stable security definer set search_path = '' as $$
  with n as (select * from private.glci_version_sections(p_new_version_id)),
  o as (select * from private.glci_version_sections(p_old_version_id)),
  renumbered as (
    select n.section_key, o.section_key as previous_section_key, o.text_hash as old_hash, n.text_hash as new_hash,
      o.passage_ids as old_ids, n.passage_ids as new_ids, n.is_transitional
    from n join o on o.text_hash = n.text_hash and o.section_key <> n.section_key
    where not exists (select 1 from o x where x.section_key = n.section_key)
      and not exists (select 1 from n y where y.section_key = o.section_key))
  select r.section_key, r.previous_section_key, 'renumbered', r.old_hash, r.new_hash, r.old_ids, r.new_ids, r.is_transitional
  from renumbered r
  union all
  select coalesce(n.section_key, o.section_key), null,
    case when o.section_key is null then 'added' when n.section_key is null then 'removed' else 'amended' end,
    o.text_hash, n.text_hash, coalesce(o.passage_ids, '{}'), coalesce(n.passage_ids, '{}'),
    coalesce(n.is_transitional, o.is_transitional, false)
  from n full join o using (section_key)
  where n.text_hash is distinct from o.text_hash
    and not exists (select 1 from renumbered r where r.section_key = coalesce(n.section_key, '') or r.previous_section_key = coalesce(o.section_key, ''))
$$;
revoke all on function private.glci_version_diff(uuid, uuid) from public, anon, authenticated;

create or replace function private.glci_detect_version_change(p_version_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_new private.legal_authority_versions;
  v_old private.legal_authority_versions;
  v_authority private.legal_authorities;
  v_event uuid;
  v_type text;
  v_baseline boolean;
  v_commencement text;
begin
  if exists (select 1 from private.glci_change_events where to_version_id = p_version_id) then return null; end if;
  select * into v_new from private.legal_authority_versions where id = p_version_id;
  select * into v_authority from private.legal_authorities where id = v_new.authority_id;
  select * into v_old from private.legal_authority_versions
    where authority_id = v_new.authority_id and version_number < v_new.version_number order by version_number desc limit 1;
  v_baseline := v_old.id is null and not exists (select 1 from private.legal_source_dataset_syncs d where d.source_id = v_authority.source_id);
  v_commencement := case
    when v_new.valid_from is null then 'unknown'
    when v_new.valid_from > current_date then 'pending_commencement'
    when v_new.valid_until is not null and v_new.valid_until <= current_date then 'not_applicable'
    else 'in_force' end;

  v_type := case when v_old.id is null then 'new_authority'
    when exists (select 1 from private.glci_version_diff(v_old.id, v_new.id)) then 'amended'
    else 'unchanged_text' end;

  insert into private.glci_change_events (source_id, authority_id, jurisdiction_code, change_type, from_version_id, to_version_id,
    is_baseline, publication_date, enactment_date, effective_date, repeal_date, commencement_status, transitional_sections,
    sections_added, sections_amended, sections_removed, sections_renumbered)
  select v_authority.source_id, v_authority.id, v_authority.jurisdiction_code, v_type, v_old.id, v_new.id, v_baseline,
    v_authority.publication_date, nullif(v_authority.source_metadata ->> 'enactmentDate', '')::date, v_new.valid_from,
    v_new.valid_until, v_commencement,
    coalesce(array_agg(d.section_key order by d.section_key) filter (where d.is_transitional), '{}'),
    count(*) filter (where d.change = 'added'), count(*) filter (where d.change = 'amended'),
    count(*) filter (where d.change = 'removed'), count(*) filter (where d.change = 'renumbered')
  from (
    -- A new authority: every section is added. An amendment: the section differences.
    select s.section_key, 'added' as change, s.is_transitional from private.glci_version_sections(v_new.id) s where v_old.id is null
    union all
    select d.section_key, d.change, d.is_transitional from private.glci_version_diff(v_old.id, v_new.id) d where v_old.id is not null
  ) d
  returning id into v_event;

  if v_type = 'amended' then
    insert into private.glci_change_sections (event_id, section_key, previous_section_key, change, old_text_hash, new_text_hash,
      old_passage_ids, new_passage_ids, is_transitional)
    select v_event, d.section_key, d.previous_section_key, d.change, d.old_text_hash, d.new_text_hash, d.old_passage_ids,
      d.new_passage_ids, d.is_transitional
    from private.glci_version_diff(v_old.id, v_new.id) d;
  end if;

  if not v_baseline and v_type <> 'unchanged_text' then
    perform private.glci_audit('change.' || v_type, 'legal_authority', v_authority.id::text,
      jsonb_build_object('eventId', v_event, 'externalId', v_authority.external_id, 'fromVersion', v_old.version_number,
        'toVersion', v_new.version_number, 'effectiveDate', v_new.valid_from, 'commencement', v_commencement), 'system');
  end if;
  return v_event;
end;
$$;
revoke all on function private.glci_detect_version_change(uuid) from public, anon, authenticated;

create or replace function private.glci_on_version_committed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_detect_version_change(new.id);
  return null;
end;
$$;
revoke all on function private.glci_on_version_committed() from public, anon, authenticated;
create constraint trigger legal_authority_versions_glci_detect
  after insert on private.legal_authority_versions deferrable initially deferred
  for each row execute function private.glci_on_version_committed();

-- Withdrawal and reinstatement follow the dataset synchronisation flags (Task 2.8b).
create or replace function private.glci_on_authority_presence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type text;
begin
  if (new.source_metadata ? 'absentFromDatasetSince') and not (old.source_metadata ? 'absentFromDatasetSince') then v_type := 'withdrawn';
  elsif (old.source_metadata ? 'absentFromDatasetSince') and not (new.source_metadata ? 'absentFromDatasetSince') then v_type := 'reinstated';
  else return new; end if;
  insert into private.glci_change_events (source_id, authority_id, jurisdiction_code, change_type, from_version_id, commencement_status,
    publication_date, repeal_date)
  values (new.source_id, new.id, new.jurisdiction_code, v_type,
    (select id from private.legal_authority_versions where authority_id = new.id order by version_number desc limit 1),
    'unknown', new.publication_date, null);
  perform private.glci_audit('change.' || v_type, 'legal_authority', new.id::text,
    jsonb_build_object('externalId', new.external_id, 'since', new.source_metadata ->> 'absentFromDatasetSince'), 'system');
  return new;
end;
$$;
revoke all on function private.glci_on_authority_presence() from public, anon, authenticated;
create trigger legal_authorities_glci_presence after update of source_metadata on private.legal_authorities
  for each row execute function private.glci_on_authority_presence();

-- ------------------------------------------------------------------ operator API
create or replace function public.glci_change_events(p_jurisdiction_code text default null, p_include_baseline boolean default false,
  p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x."detectedAt" desc) from (
    select e.id, e.change_type as "changeType", e.jurisdiction_code as "jurisdictionCode", s.source_key as "sourceKey",
      a.external_id as "externalId", a.citation, a.title, e.detected_at as "detectedAt", e.is_baseline as "isBaseline",
      e.publication_date as "publicationDate", e.enactment_date as "enactmentDate", e.effective_date as "effectiveDate",
      e.repeal_date as "repealDate", e.commencement_status as "commencementStatus", e.transitional_sections as "transitionalSections",
      e.sections_added as "sectionsAdded", e.sections_amended as "sectionsAmended", e.sections_removed as "sectionsRemoved",
      e.sections_renumbered as "sectionsRenumbered", e.review_status as "reviewStatus"
    from private.glci_change_events e join private.legal_authorities a on a.id = e.authority_id join private.legal_sources s on s.id = e.source_id
    where (p_jurisdiction_code is null or e.jurisdiction_code = p_jurisdiction_code) and (p_include_baseline or not e.is_baseline)
      and e.change_type <> 'unchanged_text'
    order by e.detected_at desc limit greatest(1, least(coalesce(p_limit, 100), 1000))) x), '[]'::jsonb);
end;
$$;

create or replace function public.glci_change_event_sections(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object('sectionKey', s.section_key, 'previousSectionKey', s.previous_section_key,
      'change', s.change, 'isTransitional', s.is_transitional,
      'oldText', (select string_agg(p.content, E'\n' order by p.ordinal) from private.legal_authority_passages p where p.id = any (s.old_passage_ids)),
      'newText', (select string_agg(p.content, E'\n' order by p.ordinal) from private.legal_authority_passages p where p.id = any (s.new_passage_ids)))
    order by s.change, s.section_key)
    from private.glci_change_sections s where s.event_id = p_event_id), '[]'::jsonb);
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_change_events(text, boolean, integer)', 'public.glci_change_event_sections(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
