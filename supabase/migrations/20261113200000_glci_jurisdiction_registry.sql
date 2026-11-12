-- GLCI-01: global jurisdiction and authority registry (docs/GLCI_SPECIFICATION.md §4).
--
-- 1. private.glci_audit_events: an append-only, hash-chained audit log for the whole GLCI
--    programme. Every registry change, check, detection, assessment and decision is recorded
--    (GLCI-11 adds verification views and four-eyes rules on top of it).
-- 2. private.glci_jurisdiction_profiles: one monitoring configuration per jurisdiction:
--    - official languages;
--    - legal hierarchy and authority classification;
--    - publication and update schedule;
--    - effective-date rules;
--    - review procedure.
--    Countries are data, not code.
-- 3. private.glci_monitoring_targets: the official sources watched for each jurisdiction (gazettes,
--    parliaments, governments, legal databases, courts). A target becomes active only if a
--    monitor adapter is set and its linked source permits acquisition from the target's host:
--    either through an approved rights review, or through a licence policy naming that host.
--    Monitoring never authorises ingestion.
-- 4. Sweden, Denmark, Finland and Uganda are catalogued (spec §4); everything is seeded inactive.
-- Operator functions require the platform role knowledge_admin (or platform_admin).

-- ------------------------------------------------------------------ audit
create table private.glci_audit_events (
  sequence_number bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_principal_id uuid,
  actor_kind text not null check (actor_kind in ('operator', 'system', 'worker', 'ai_agent', 'engineering_agent')),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.]{2,80}$'),
  subject_type text not null check (char_length(subject_type) between 1 and 80),
  subject_id text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384),
  previous_hash text check (previous_hash is null or previous_hash ~ '^[a-f0-9]{64}$'),
  record_hash text not null check (record_hash ~ '^[a-f0-9]{64}$')
);
create index glci_audit_events_subject_idx on private.glci_audit_events(subject_type, subject_id);
create index glci_audit_events_type_idx on private.glci_audit_events(event_type, occurred_at desc);
alter table private.glci_audit_events enable row level security;
revoke all on private.glci_audit_events from public, anon, authenticated;
grant select on private.glci_audit_events to service_role;
create trigger glci_audit_events_append_only
  before update or delete on private.glci_audit_events
  for each row execute function private.reject_append_only_mutation();

create or replace function private.glci_audit_digest(p_occurred_at timestamptz, p_actor uuid, p_actor_kind text, p_event_type text,
  p_subject_type text, p_subject_id text, p_details jsonb, p_previous_hash text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(concat_ws(E'\x1f', to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    coalesce(p_actor::text, ''), p_actor_kind, p_event_type, p_subject_type, coalesce(p_subject_id, ''), p_details::text,
    coalesce(p_previous_hash, '')), 'UTF8'), 'sha256'), 'hex')
$$;
revoke all on function private.glci_audit_digest(timestamptz, uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;

create or replace function private.glci_audit(p_event_type text, p_subject_type text, p_subject_id text,
  p_details jsonb default '{}'::jsonb, p_actor_kind text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_previous text;
  v_at timestamptz := clock_timestamp();
  v_actor uuid := private.current_principal_id();
  v_kind text := coalesce(p_actor_kind, case when private.current_principal_id() is null then 'system' else 'operator' end);
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
  v_seq bigint;
begin
  -- Serialise appends so the chain has exactly one successor per record.
  perform pg_advisory_xact_lock(hashtext('private.glci_audit_events'));
  select record_hash into v_previous from private.glci_audit_events order by sequence_number desc limit 1;
  insert into private.glci_audit_events (occurred_at, actor_principal_id, actor_kind, event_type, subject_type, subject_id, details, previous_hash, record_hash)
  values (v_at, v_actor, v_kind, p_event_type, p_subject_type, p_subject_id, v_details, v_previous,
    private.glci_audit_digest(v_at, v_actor, v_kind, p_event_type, p_subject_type, p_subject_id, v_details, v_previous))
  returning sequence_number into v_seq;
  return v_seq;
end;
$$;
revoke all on function private.glci_audit(text, text, text, jsonb, text) from public, anon, authenticated;

create or replace function private.glci_require_operator()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_principal_id() is null or not private.is_platform_operator('knowledge_admin') then
    raise exception 'GLCI_NOT_AUTHORISED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.glci_require_operator() from public, anon, authenticated;

-- ------------------------------------------------------------------ jurisdictions (spec §4)
insert into private.jurisdictions (code, parent_code, name, short_name, legal_system, status, official_languages, metadata) values
  ('SE', null, 'Kingdom of Sweden', 'Sweden', 'civil_law', 'catalogued', array['sv'], '{"priority": 3}'),
  ('DK', null, 'Kingdom of Denmark', 'Denmark', 'civil_law', 'catalogued', array['da'], '{"priority": 3}'),
  ('FI', null, 'Republic of Finland', 'Finland', 'civil_law', 'catalogued', array['fi', 'sv'], '{"priority": 3}'),
  ('UG', null, 'Republic of Uganda', 'Uganda', 'common_law', 'catalogued', array['en', 'sw'], '{"priority": 7}')
on conflict (code) do nothing;

-- ------------------------------------------------------------------ jurisdiction profiles
create table private.glci_jurisdiction_profiles (
  jurisdiction_code text primary key references private.jurisdictions(code) on delete restrict,
  monitoring_languages text[] not null check (cardinality(monitoring_languages) between 1 and 30),
  authority_hierarchy jsonb not null check (jsonb_typeof(authority_hierarchy) = 'array' and jsonb_array_length(authority_hierarchy) between 1 and 30),
  publication_schedule jsonb not null check (jsonb_typeof(publication_schedule) = 'object'),
  effective_date_rules jsonb not null check (jsonb_typeof(effective_date_rules) = 'object'),
  review_procedure jsonb not null check (jsonb_typeof(review_procedure) = 'object'),
  check_interval_minutes integer not null default 1440 check (check_interval_minutes between 15 and 43200),
  stale_after_hours integer not null default 48 check (stale_after_hours between 1 and 2160),
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);
alter table private.glci_jurisdiction_profiles enable row level security;
revoke all on private.glci_jurisdiction_profiles from public, anon, authenticated;
grant select on private.glci_jurisdiction_profiles to service_role;

create or replace function private.glci_validate_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from jsonb_array_elements(new.authority_hierarchy) e
      where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'rank') <> 'number' or coalesce(e ->> 'authorityType', '') = '') then
    raise exception 'GLCI_PROFILE_INVALID' using errcode = '22023', detail = 'authority_hierarchy entries need authorityType and rank';
  end if;
  if coalesce(new.effective_date_rules ->> 'publicationIsNotCommencement', '') <> 'true' then
    raise exception 'GLCI_PROFILE_INVALID' using errcode = '22023', detail = 'publication must never be treated as commencement';
  end if;
  if coalesce(new.review_procedure ->> 'reviewerRole', '') not in ('knowledge_admin', 'platform_admin') then
    raise exception 'GLCI_PROFILE_INVALID' using errcode = '22023', detail = 'review_procedure.reviewerRole';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.glci_validate_profile() from public, anon, authenticated;
create trigger glci_jurisdiction_profiles_validate before insert or update on private.glci_jurisdiction_profiles
  for each row execute function private.glci_validate_profile();

-- Common hierarchy templates; a jurisdiction may override any of them.
insert into private.glci_jurisdiction_profiles (jurisdiction_code, monitoring_languages, authority_hierarchy, publication_schedule,
  effective_date_rules, review_procedure, check_interval_minutes, stale_after_hours, notes)
select v.code, v.languages, v.hierarchy::jsonb, v.schedule::jsonb,
  '{"publicationIsNotCommencement": true, "dateKinds": ["publication", "enactment", "effective", "repeal", "transitional"]}'::jsonb
    || v.date_rules::jsonb,
  '{"reviewerRole": "knowledge_admin", "fourEyesForActivation": true, "aiOutputAdvisory": true}'::jsonb,
  v.interval_minutes, v.stale_hours, v.notes
from (values
  ('NO', array['nb', 'nn'],
    '[{"authorityType":"constitution","rank":1,"label":"Grunnloven"},{"authorityType":"act","rank":2,"label":"lov"},{"authorityType":"regulation","rank":3,"label":"forskrift"},{"authorityType":"judgment","rank":4,"label":"Høyesterett"},{"authorityType":"official_guidance","rank":5,"label":"forarbeider / rundskriv"}]',
    '{"cadence": "daily", "timezone": "Europe/Oslo", "note": "Lovdata API datasets are rebuilt nightly; Norsk Lovtidend publishes continuously"}',
    '{"commencementSource": "ikrafttredelse (Lovdata key information and the enacting act)", "transitionalProvisions": "overgangsregler"}',
    1440, 48, 'Reference jurisdiction (spec §3).'),
  ('SE', array['sv'],
    '[{"authorityType":"constitution","rank":1,"label":"grundlag"},{"authorityType":"act","rank":2,"label":"lag"},{"authorityType":"regulation","rank":3,"label":"förordning"},{"authorityType":"official_guidance","rank":4,"label":"föreskrifter / förarbeten"}]',
    '{"cadence": "daily", "timezone": "Europe/Stockholm"}', '{"commencementSource": "ikraftträdande"}', 1440, 48, null),
  ('DK', array['da'],
    '[{"authorityType":"constitution","rank":1,"label":"grundlov"},{"authorityType":"act","rank":2,"label":"lov"},{"authorityType":"regulation","rank":3,"label":"bekendtgørelse"},{"authorityType":"official_guidance","rank":4,"label":"vejledning"}]',
    '{"cadence": "daily", "timezone": "Europe/Copenhagen"}', '{"commencementSource": "ikrafttræden"}', 1440, 48, null),
  ('FI', array['fi', 'sv'],
    '[{"authorityType":"constitution","rank":1,"label":"perustuslaki"},{"authorityType":"act","rank":2,"label":"laki"},{"authorityType":"regulation","rank":3,"label":"asetus"},{"authorityType":"official_guidance","rank":4,"label":"ohje"}]',
    '{"cadence": "daily", "timezone": "Europe/Helsinki"}', '{"commencementSource": "voimaantulo"}', 1440, 48, null),
  ('GB', array['en'],
    '[{"authorityType":"act","rank":1,"label":"Act of Parliament"},{"authorityType":"statutory_instrument","rank":2,"label":"statutory instrument"},{"authorityType":"judgment","rank":3,"label":"Supreme Court / Court of Appeal"},{"authorityType":"official_guidance","rank":4,"label":"guidance"}]',
    '{"cadence": "daily", "timezone": "Europe/London"}', '{"commencementSource": "commencement orders and section 1 extent/commencement provisions"}', 1440, 48,
    'Uncodified constitution: Acts of Parliament rank first.'),
  ('US', array['en'],
    '[{"authorityType":"constitution","rank":1,"label":"U.S. Constitution"},{"authorityType":"act","rank":2,"label":"federal statute"},{"authorityType":"regulation","rank":3,"label":"federal regulation (CFR)"},{"authorityType":"judgment","rank":4,"label":"federal courts"}]',
    '{"cadence": "daily", "timezone": "America/New_York", "note": "Federal Register publishes each business day"}', '{"commencementSource": "effective date stated in the rule or statute"}', 1440, 48,
    'Federal level first; state legislatures are added as sub-profiles.'),
  ('EU', array['en', 'fr', 'de'],
    '[{"authorityType":"treaty","rank":1,"label":"Treaties and Charter"},{"authorityType":"regulation_eu","rank":2,"label":"regulation"},{"authorityType":"directive","rank":3,"label":"directive"},{"authorityType":"decision","rank":4,"label":"decision"},{"authorityType":"judgment","rank":5,"label":"CJEU"}]',
    '{"cadence": "daily", "timezone": "Europe/Brussels", "note": "Official Journal L and C series, each working day"}',
    '{"commencementSource": "entry into force and date of application stated in the act", "applicationDistinct": true}', 1440, 48,
    'Entry into force and date of application are distinct.'),
  ('CM', array['fr', 'en'],
    '[{"authorityType":"constitution","rank":1,"label":"Constitution"},{"authorityType":"treaty","rank":2,"label":"OHADA Uniform Acts and treaties"},{"authorityType":"act","rank":3,"label":"loi"},{"authorityType":"order","rank":4,"label":"ordonnance"},{"authorityType":"regulation","rank":5,"label":"décret / arrêté"}]',
    '{"cadence": "irregular", "timezone": "Africa/Douala"}', '{"commencementSource": "promulgation and publication in the Journal officiel"}', 10080, 336,
    'Bijural (civil law / common law) and OHADA.'),
  ('UG', array['en'],
    '[{"authorityType":"constitution","rank":1,"label":"Constitution"},{"authorityType":"act","rank":2,"label":"Act of Parliament"},{"authorityType":"statutory_instrument","rank":3,"label":"statutory instrument"},{"authorityType":"judgment","rank":4,"label":"Supreme Court / Court of Appeal"}]',
    '{"cadence": "weekly", "timezone": "Africa/Kampala", "note": "Uganda Gazette, generally weekly"}', '{"commencementSource": "commencement date stated in the Act or by statutory instrument"}', 10080, 336, null)
) as v(code, languages, hierarchy, schedule, date_rules, interval_minutes, stale_hours, notes)
on conflict (jurisdiction_code) do nothing;

-- ------------------------------------------------------------------ monitoring targets
create table private.glci_monitoring_targets (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references private.jurisdictions(code) on delete restrict,
  target_key text not null unique check (target_key ~ '^[a-z][a-z0-9-]{2,79}$'),
  name text not null check (char_length(name) between 1 and 200),
  target_type text not null check (target_type in ('legal_database', 'gazette', 'parliament', 'government', 'regulator', 'court')),
  official_uri text check (official_uri is null or (official_uri ~ '^https://[^[:space:]]+$' and char_length(official_uri) <= 2048)),
  source_id uuid references private.legal_sources(id) on delete restrict,
  monitor_adapter_key text check (monitor_adapter_key is null or monitor_adapter_key ~ '^[a-z][a-z0-9.-]{1,79}$'),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 4096),
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'retired')),
  check_interval_minutes integer check (check_interval_minutes is null or check_interval_minutes between 15 and 43200),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index glci_monitoring_targets_jurisdiction_idx on private.glci_monitoring_targets(jurisdiction_code, status);
create index glci_monitoring_targets_source_idx on private.glci_monitoring_targets(source_id);
alter table private.glci_monitoring_targets enable row level security;
revoke all on private.glci_monitoring_targets from public, anon, authenticated;
grant select on private.glci_monitoring_targets to service_role;

-- A target may be active only with an adapter and a lawful basis to read its official host.
create or replace function private.glci_target_activation_basis(p_target private.glci_monitoring_targets)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_source private.legal_sources;
  v_policy private.legal_source_licence_policies;
  v_host text := lower(substring(p_target.official_uri from '^https://([^/:?#]+)'));
begin
  if p_target.monitor_adapter_key is null then return null; end if;
  if p_target.source_id is null or v_host is null then return null; end if;
  select * into v_source from private.legal_sources where id = p_target.source_id;
  if v_source.rights_status = 'approved' then return 'rights_review'; end if;
  v_policy := private.legal_source_licence_policy(v_source.id);
  if v_policy.id is not null and v_host = any (v_policy.acquisition_hosts) then return 'licence_policy_v' || v_policy.policy_version; end if;
  return null;
end;
$$;
revoke all on function private.glci_target_activation_basis(private.glci_monitoring_targets) from public, anon, authenticated;

create or replace function private.glci_guard_target()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and private.glci_target_activation_basis(new) is null then
    raise exception 'GLCI_TARGET_ACTIVATION_NOT_PERMITTED' using errcode = '42501',
      detail = 'An active target needs a monitor adapter and a linked source whose rights review or licence policy covers its host.';
  end if;
  if new.source_id is not null and (select jurisdiction_code from private.legal_sources where id = new.source_id) is distinct from new.jurisdiction_code
    and not exists (select 1 from private.jurisdictions j where j.code = new.jurisdiction_code
      and j.parent_code = (select jurisdiction_code from private.legal_sources where id = new.source_id)) then
    raise exception 'GLCI_TARGET_JURISDICTION_MISMATCH' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.glci_guard_target() from public, anon, authenticated;
create trigger glci_monitoring_targets_guard before insert or update on private.glci_monitoring_targets
  for each row execute function private.glci_guard_target();

insert into private.glci_monitoring_targets (jurisdiction_code, target_key, name, target_type, official_uri, source_id, monitor_adapter_key, config, notes)
select v.jurisdiction_code, v.target_key, v.name, v.target_type, v.official_uri,
  (select id from private.legal_sources where source_key = v.source_key), v.adapter, v.config::jsonb, v.notes
from (values
  ('NO', 'no-lovdata-current-laws', 'Lovdata API — current laws (gjeldende lover)', 'legal_database',
    'https://api.lovdata.no/v1/publicData/list', 'lovdata-official', 'lovdata-public-data-listing', '{"dataset": "gjeldende-lover.tar.bz2"}', 'NLOD 2.0 dataset; licence policy covers api.lovdata.no'),
  ('NO', 'no-lovdata-central-regulations', 'Lovdata API — current central regulations (gjeldende sentrale forskrifter)', 'legal_database',
    'https://api.lovdata.no/v1/publicData/list', 'lovdata-official', 'lovdata-public-data-listing', '{"dataset": "gjeldende-sentrale-forskrifter.tar.bz2"}', 'NLOD 2.0 dataset'),
  ('NO', 'no-lovtidend', 'Norsk Lovtidend (official gazette)', 'gazette', null, null, null, '{}', 'Lovtidend archives are outside the Lovdata licence policy; rights review required'),
  ('NO', 'no-stortinget', 'Stortinget (Parliament)', 'parliament', 'https://www.stortinget.no/', null, null, '{}', 'Bills, resolutions and enacted laws; rights review required'),
  ('NO', 'no-regjeringen', 'Government of Norway (regjeringen.no)', 'government', 'https://www.regjeringen.no/', null, null, '{}', 'Consultations and preparatory works; rights review required'),
  ('SE', 'se-riksdagen', 'Sveriges riksdag', 'parliament', 'https://www.riksdagen.se/', null, null, '{}', null),
  ('SE', 'se-sfs', 'Svensk författningssamling (SFS)', 'gazette', 'https://www.svenskforfattningssamling.se/', null, null, '{}', null),
  ('DK', 'dk-retsinformation', 'Retsinformation', 'legal_database', 'https://www.retsinformation.dk/', null, null, '{}', null),
  ('DK', 'dk-folketinget', 'Folketinget', 'parliament', 'https://www.ft.dk/', null, null, '{}', null),
  ('FI', 'fi-finlex', 'Finlex', 'legal_database', 'https://www.finlex.fi/', null, null, '{}', null),
  ('FI', 'fi-eduskunta', 'Eduskunta (Parliament of Finland)', 'parliament', 'https://www.eduskunta.fi/', null, null, '{}', null),
  ('GB', 'gb-legislation', 'legislation.gov.uk', 'legal_database', 'https://www.legislation.gov.uk/', 'legislation-gov-uk', null, '{}', null),
  ('GB', 'gb-parliament', 'UK Parliament', 'parliament', 'https://www.parliament.uk/', null, null, '{}', null),
  ('US', 'us-federal-register', 'Federal Register', 'gazette', 'https://www.federalregister.gov/', null, null, '{}', null),
  ('US', 'us-congress', 'Congress.gov', 'parliament', 'https://www.congress.gov/', 'congress-gov', null, '{}', 'State legislatures are added per state'),
  ('US', 'us-govinfo', 'GovInfo', 'legal_database', 'https://www.govinfo.gov/', 'govinfo', null, '{}', null),
  ('EU', 'eu-eur-lex', 'EUR-Lex', 'legal_database', 'https://eur-lex.europa.eu/', 'eur-lex', null, '{}', null),
  ('EU', 'eu-official-journal', 'Official Journal of the European Union', 'gazette', 'https://eur-lex.europa.eu/oj/direct-access.html', 'eur-lex', null, '{}', null),
  ('CM', 'cm-official-gazette', 'Journal officiel de la République du Cameroun', 'gazette', null, 'cameroon-official-gazette', null, '{}', 'Official address to be confirmed during rights review'),
  ('CM', 'cm-assemblee-nationale', 'Assemblée nationale du Cameroun', 'parliament', 'https://www.assnat.cm/', null, null, '{}', null),
  ('UG', 'ug-gazette', 'Uganda Gazette', 'gazette', null, null, null, '{}', 'Official address to be confirmed during rights review'),
  ('UG', 'ug-parliament', 'Parliament of Uganda', 'parliament', 'https://www.parliament.go.ug/', null, null, '{}', null)
) as v(jurisdiction_code, target_key, name, target_type, official_uri, source_key, adapter, config, notes)
on conflict (target_key) do nothing;

-- ------------------------------------------------------------------ operator API
create or replace function public.glci_registry()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', j.code, 'name', j.short_name, 'status', j.status, 'officialLanguages', to_jsonb(j.official_languages),
      'profile', case when p.jurisdiction_code is null then null else jsonb_build_object(
        'monitoringLanguages', to_jsonb(p.monitoring_languages), 'authorityHierarchy', p.authority_hierarchy,
        'publicationSchedule', p.publication_schedule, 'effectiveDateRules', p.effective_date_rules,
        'reviewProcedure', p.review_procedure, 'checkIntervalMinutes', p.check_interval_minutes,
        'staleAfterHours', p.stale_after_hours, 'notes', p.notes) end,
      'targets', coalesce((select jsonb_agg(jsonb_build_object(
          'targetKey', t.target_key, 'name', t.name, 'targetType', t.target_type, 'officialUri', t.official_uri,
          'sourceKey', s.source_key, 'sourceRights', s.rights_status, 'monitorAdapter', t.monitor_adapter_key,
          'status', t.status, 'activationBasis', private.glci_target_activation_basis(t), 'notes', t.notes)
          order by t.target_key)
        from private.glci_monitoring_targets t left join private.legal_sources s on s.id = t.source_id
        where t.jurisdiction_code = j.code), '[]'::jsonb))
      order by (p.jurisdiction_code is null), j.code)
    from private.jurisdictions j left join private.glci_jurisdiction_profiles p on p.jurisdiction_code = j.code), '[]'::jsonb);
end;
$$;

create or replace function public.glci_upsert_jurisdiction_profile(p_jurisdiction_code text, p_profile jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'GLCI_PROFILE_INVALID' using errcode = '22023'; end if;
  insert into private.glci_jurisdiction_profiles (jurisdiction_code, monitoring_languages, authority_hierarchy, publication_schedule,
    effective_date_rules, review_procedure, check_interval_minutes, stale_after_hours, notes)
  values (p_jurisdiction_code,
    array(select jsonb_array_elements_text(p_profile -> 'monitoringLanguages')),
    p_profile -> 'authorityHierarchy', p_profile -> 'publicationSchedule', p_profile -> 'effectiveDateRules',
    p_profile -> 'reviewProcedure', coalesce((p_profile ->> 'checkIntervalMinutes')::integer, 1440),
    coalesce((p_profile ->> 'staleAfterHours')::integer, 48), p_profile ->> 'notes')
  on conflict (jurisdiction_code) do update set monitoring_languages = excluded.monitoring_languages,
    authority_hierarchy = excluded.authority_hierarchy, publication_schedule = excluded.publication_schedule,
    effective_date_rules = excluded.effective_date_rules, review_procedure = excluded.review_procedure,
    check_interval_minutes = excluded.check_interval_minutes, stale_after_hours = excluded.stale_after_hours, notes = excluded.notes;
  perform private.glci_audit('registry.profile_saved', 'jurisdiction', p_jurisdiction_code, jsonb_build_object('profile', p_profile));
end;
$$;

create or replace function public.glci_register_target(p_jurisdiction_code text, p_target_key text, p_name text, p_target_type text,
  p_official_uri text, p_source_key text, p_monitor_adapter_key text, p_config jsonb default '{}'::jsonb, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_source_id uuid;
begin
  perform private.glci_require_operator();
  if p_source_key is not null then
    select id into v_source_id from private.legal_sources where source_key = p_source_key;
    if v_source_id is null then raise exception 'LEGAL_SOURCE_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  insert into private.glci_monitoring_targets (jurisdiction_code, target_key, name, target_type, official_uri, source_id, monitor_adapter_key, config, notes)
  values (p_jurisdiction_code, p_target_key, btrim(p_name), p_target_type, p_official_uri, v_source_id, p_monitor_adapter_key, coalesce(p_config, '{}'), p_notes)
  returning id into v_id;
  perform private.glci_audit('registry.target_registered', 'monitoring_target', p_target_key,
    jsonb_build_object('jurisdiction', p_jurisdiction_code, 'targetType', p_target_type, 'officialUri', p_official_uri, 'sourceKey', p_source_key));
  return v_id;
end;
$$;

create or replace function public.glci_set_target_status(p_target_key text, p_status text, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_target private.glci_monitoring_targets;
begin
  perform private.glci_require_operator();
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023';
  end if;
  update private.glci_monitoring_targets set status = p_status where target_key = p_target_key returning * into v_target;
  if v_target.id is null then raise exception 'GLCI_TARGET_NOT_FOUND' using errcode = 'P0002'; end if;
  perform private.glci_audit('registry.target_status', 'monitoring_target', p_target_key,
    jsonb_build_object('status', p_status, 'reason', btrim(p_reason), 'basis', private.glci_target_activation_basis(v_target)));
  return p_status;
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.glci_registry()',
    'public.glci_upsert_jurisdiction_profile(text, jsonb)',
    'public.glci_register_target(text, text, text, text, text, text, text, jsonb, text)',
    'public.glci_set_target_status(text, text, text)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
