-- GLCI-10: jurisdiction and source onboarding register; generic monitors for official feeds.
--
-- 1. private.glci_monitor_adapters: the monitor adapters Njumeni has, and whether each one's format
--    has been verified against the live source. A target can only use a known adapter.
-- 2. Generic adapters for official listings: atom-feed, rss-feed and json-listing. They are
--    configured per target, so a new country or a format detail is data, not code. Feed URLs must
--    stay on the target's official host. A target still becomes active only with a lawful basis
--    (rights review or licence policy, GLCI-01).
-- 3. glci_onboarding_register(): for each jurisdiction, ten onboarding stages from "catalogued" to
--    "verified current", with the evidence for each stage and the single next step (and whether it
--    is the owner's action). The register is computed from live data, never maintained by hand.

create table private.glci_monitor_adapters (
  adapter_key text primary key check (adapter_key ~ '^[a-z][a-z0-9.-]{1,79}$'),
  kind text not null check (kind in ('source_specific', 'atom_feed', 'rss_feed', 'json_listing')),
  description text not null check (char_length(description) between 5 and 500),
  format_verified boolean not null default false,
  verified_note text check (verified_note is null or char_length(verified_note) <= 1000)
);
alter table private.glci_monitor_adapters enable row level security;
revoke all on private.glci_monitor_adapters from public, anon, authenticated;
grant select on private.glci_monitor_adapters to service_role;
insert into private.glci_monitor_adapters (adapter_key, kind, description, format_verified, verified_note) values
  ('lovdata-public-data-listing', 'source_specific', 'Lovdata public API dataset listing (api.lovdata.no/v1/publicData/list)', true,
    'Listing read live on 2026-11-12 by the Lovdata session (JSON array of filename, description, sizeBytes, lastModified).'),
  ('atom-feed', 'atom_feed', 'Generic Atom feed of an official publisher: fingerprints the newest entries (id, updated)', false,
    'Generic parser; each target''s feed must be confirmed against the live source before activation.'),
  ('rss-feed', 'rss_feed', 'Generic RSS 2.0 feed of an official publisher: fingerprints the newest items (guid or link, pubDate)', false,
    'Generic parser; each target''s feed must be confirmed against the live source before activation.'),
  ('json-listing', 'json_listing', 'Generic JSON listing (an official API): fingerprints the newest items by configured id and date fields', false,
    'Generic parser; each target''s field mapping must be confirmed against the live source before activation.')
on conflict (adapter_key) do nothing;

create index glci_monitoring_targets_adapter_idx on private.glci_monitoring_targets(monitor_adapter_key);
alter table private.glci_monitoring_targets add constraint glci_monitoring_targets_adapter_fkey
  foreign key (monitor_adapter_key) references private.glci_monitor_adapters(adapter_key) on delete restrict;

-- Feed and API URLs in a target's configuration must stay on the target's official host.
create or replace function private.glci_config_hosts_ok(p_official_uri text, p_config jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(lower(substring(u from '^https://([^/:?#]+)')) = lower(substring(p_official_uri from '^https://([^/:?#]+)'))), true)
  from (select value #>> '{}' as u from jsonb_each(coalesce(p_config, '{}'::jsonb)) where key ~* '(url|uri)$') x
$$;
revoke all on function private.glci_config_hosts_ok(text, jsonb) from public, anon, authenticated;
alter table private.glci_monitoring_targets add constraint glci_monitoring_targets_config_host_check
  check (private.glci_config_hosts_ok(official_uri, config));

-- Candidate configurations (formats to be confirmed against the live sources; targets stay inactive).
update private.glci_monitoring_targets set monitor_adapter_key = 'atom-feed',
  config = '{"feedUrl": "https://www.legislation.gov.uk/new/data.feed", "maxItems": 50}'::jsonb,
  notes = 'Atom feed of new UK legislation. Feed format to be confirmed against the live source; activation needs the rights review of legislation-gov-uk.'
  where target_key = 'gb-legislation' and monitor_adapter_key is null;
update private.glci_monitoring_targets set monitor_adapter_key = 'json-listing',
  config = '{"listUrl": "https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest", "itemsPath": "results",
    "idField": "document_number", "dateField": "publication_date", "titleField": "title", "linkField": "html_url", "maxItems": 20}'::jsonb,
  notes = 'Federal Register API. Field mapping to be confirmed against the live source; a source registration and rights review are required before activation.'
  where target_key = 'us-federal-register' and monitor_adapter_key is null;

-- Operators assign or correct a target's monitor (a new country or a format change is data).
create or replace function public.glci_set_target_monitor(p_target_key text, p_adapter_key text, p_config jsonb, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if p_reason is null or char_length(btrim(p_reason)) < 10 then raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then raise exception 'GLCI_TARGET_CONFIG_INVALID' using errcode = '22023'; end if;
  update private.glci_monitoring_targets set monitor_adapter_key = p_adapter_key, config = p_config where target_key = p_target_key;
  if not found then raise exception 'GLCI_TARGET_NOT_FOUND' using errcode = 'P0002'; end if;
  perform private.glci_audit('registry.target_monitor_set', 'monitoring_target', p_target_key,
    jsonb_build_object('adapter', p_adapter_key, 'config', p_config, 'reason', btrim(p_reason)));
end;
$$;

-- ------------------------------------------------------------------ onboarding register
create or replace function private.glci_jurisdiction_onboarding(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_j private.jurisdictions;
  v_steps jsonb := '[]';
  v_next jsonb;
  v_n integer;
  v_flag boolean;
  v_report private.glci_currency_reports;
begin
  select * into v_j from private.jurisdictions where code = p_code;
  if v_j.code is null then raise exception 'GLCI_JURISDICTION_NOT_FOUND' using errcode = 'P0002'; end if;

  v_steps := v_steps || jsonb_build_object('key', 'catalogued', 'label', 'Catalogued', 'done', true, 'evidence', v_j.name);
  v_flag := exists (select 1 from private.glci_jurisdiction_profiles where jurisdiction_code = p_code);
  v_steps := v_steps || jsonb_build_object('key', 'profile', 'label', 'Monitoring profile (languages, hierarchy, schedules, date rules, review)',
    'done', v_flag, 'action', 'Record the monitoring profile (glci_upsert_jurisdiction_profile).', 'owner', false);
  select count(*) into v_n from private.glci_monitoring_targets where jurisdiction_code = p_code and official_uri is not null;
  v_steps := v_steps || jsonb_build_object('key', 'sources', 'label', 'Official sources registered', 'done', v_n > 0, 'evidence', v_n || ' with an official address',
    'action', 'Register the official gazette, parliament and legal database (glci_register_target), with their official addresses.', 'owner', false);
  v_flag := exists (select 1 from private.glci_monitoring_targets t join private.legal_sources s on s.id = t.source_id
    where t.jurisdiction_code = p_code and (s.rights_status = 'approved' or (select lower(substring(t.official_uri from '^https://([^/:?#]+)')) = any (p.acquisition_hosts)
      from private.legal_source_licence_policies p where p.source_id = s.id order by p.policy_version desc limit 1)));
  v_steps := v_steps || jsonb_build_object('key', 'rights', 'label', 'Rights reviewed (rights approval or licence policy)', 'done', coalesce(v_flag, false),
    'action', 'Review the source terms and record the rights review or a licence policy for at least one source.', 'owner', true);
  select count(*) into v_n from private.glci_monitoring_targets t join private.glci_monitor_adapters a on a.adapter_key = t.monitor_adapter_key
    where t.jurisdiction_code = p_code;
  v_steps := v_steps || jsonb_build_object('key', 'monitor', 'label', 'Monitor assigned', 'done', v_n > 0, 'evidence', v_n || ' target(s) with a monitor',
    'formatVerified', exists (select 1 from private.glci_monitoring_targets t join private.glci_monitor_adapters a on a.adapter_key = t.monitor_adapter_key
      where t.jurisdiction_code = p_code and a.format_verified),
    'action', 'Assign a monitor to a target (glci_set_target_monitor) and confirm its format against the live source.', 'owner', false);
  select count(*) into v_n from private.glci_monitoring_targets where jurisdiction_code = p_code and status = 'active';
  v_steps := v_steps || jsonb_build_object('key', 'monitoring', 'label', 'Monitoring active', 'done', v_n > 0, 'evidence', v_n || ' active target(s)',
    'action', 'Activate a lawful target (glci_set_target_status) and run the monitoring worker.', 'owner', false);
  v_flag := exists (select 1 from private.glci_monitoring_targets t where t.jurisdiction_code = p_code and t.status = 'active'
    and private.glci_target_currency(t.id) in ('verified', 'changed'));
  v_steps := v_steps || jsonb_build_object('key', 'checked', 'label', 'Source checked successfully', 'done', v_flag,
    'action', 'Run the monitoring worker from a host that can reach the source (npm run worker:glci-monitor).', 'owner', true);
  select count(*) into v_n from private.legal_authorities a join private.legal_sources s on s.id = a.source_id
    where a.jurisdiction_code = p_code and s.ingestion_enabled;
  v_steps := v_steps || jsonb_build_object('key', 'ingestion', 'label', 'Legal texts ingested', 'done', v_n > 0, 'evidence', v_n || ' authorities from enabled sources',
    'action', 'Activate the source for ingestion with its pinned adapter and run the ingestion worker and embedding backfill.', 'owner', true);
  v_flag := exists (select 1 from private.legal_retrieval_evaluations e where e.jurisdiction_code = p_code and e.passed);
  v_steps := v_steps || jsonb_build_object('key', 'evaluation', 'label', 'Retrieval evaluation passed', 'done', v_flag,
    'action', 'Run and record the jurisdiction''s retrieval evaluation (every gate must pass; held-out set before coverage claims).', 'owner', false);
  select * into v_report from private.glci_currency_reports where jurisdiction_code = p_code order by measured_at desc limit 1;
  v_steps := v_steps || jsonb_build_object('key', 'current', 'label', 'Verified current', 'done', coalesce(v_report.verdict = 'current', false),
    'evidence', coalesce(v_report.verdict, 'not measured'),
    'action', 'Run the currency verification and resolve its reasons.', 'owner', false);

  select s into v_next from jsonb_array_elements(v_steps) s where not (s ->> 'done')::boolean limit 1;
  return jsonb_build_object('code', v_j.code, 'name', v_j.short_name, 'coverageLevel', v_j.status,
    'completed', (select count(*) from jsonb_array_elements(v_steps) s where (s ->> 'done')::boolean),
    'total', jsonb_array_length(v_steps), 'steps', v_steps,
    'nextStep', case when v_next is null then null else jsonb_build_object('key', v_next ->> 'key', 'action', v_next ->> 'action',
      'owner', coalesce((v_next ->> 'owner')::boolean, false)) end);
end;
$$;
revoke all on function private.glci_jurisdiction_onboarding(text) from public, anon, authenticated;

create or replace function public.glci_onboarding_register()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return jsonb_build_object(
    'jurisdictions', coalesce((select jsonb_agg(private.glci_jurisdiction_onboarding(j.code)
        order by (exists (select 1 from private.glci_jurisdiction_profiles p where p.jurisdiction_code = j.code)) desc, j.code)
      from private.jurisdictions j), '[]'::jsonb),
    'adapters', coalesce((select jsonb_agg(jsonb_build_object('adapterKey', a.adapter_key, 'kind', a.kind, 'description', a.description,
        'formatVerified', a.format_verified, 'note', a.verified_note) order by a.adapter_key) from private.glci_monitor_adapters a), '[]'::jsonb));
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_set_target_monitor(text, text, jsonb, text)', 'public.glci_onboarding_register()'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
