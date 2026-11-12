-- GLCI-10 follow-up: feed formats verified against the live sources (2026-11-12, about 20:15 UTC,
-- read by the Lovdata session after the owner allowed the hosts; read-only).
--
-- Findings:
--   UK: legislation.gov.uk /new/data.feed is Atom (entries carry id, title, updated, published).
--       The prepared Atom monitor matches. Licence: Open Government Licence v3.0 (legislation.gov.uk/help).
--   US: Federal Register /api/v1/documents.json; results at $.results with document_number,
--       publication_date, title and html_url. The prepared mapping matches. Licence page not readable
--       (bot gate).
--   DK: Retsinformation "høsteservice" API, GET /v1/Documents?date=YYYY-MM-DD, a JSON array of
--       {documentId, accessionsnummer, reasonForChange, changeDate, documentType, href}, meant to be
--       called once a day. Terms not readable without a browser.
--   EU: no EUR-Lex RSS feed found (candidate URLs 404). Reuse terms read (Decision 2011/833/EU; CC BY
--       4.0 for editorial content).
--   FI: opendata.finlex.fi requires a token; no public documentation found.
-- Verification is recorded per target (format_verified_at, format_evidence). The register's
-- "monitor" stage reports a confirmed format when the target's own format is verified, or when it
-- uses a verified source-specific adapter. Every target stays inactive: activation still needs the
-- rights review (GLCI-01).

alter table private.glci_monitoring_targets
  add column format_verified_at timestamptz,
  add column format_evidence text check (format_evidence is null or char_length(format_evidence) <= 2000),
  add constraint glci_monitoring_targets_format_verified_pair check ((format_verified_at is null) = (format_evidence is null));

update private.glci_monitoring_targets set format_verified_at = '2026-11-12T20:15:00Z',
  format_evidence = 'Live read 2026-11-12: Atom feed (id, title, updated, published), first entries http://www.legislation.gov.uk/id/uksi/2026/1147 and /1183. Licence: Open Government Licence v3.0 (legislation.gov.uk/help).'
  where target_key = 'gb-legislation';
update private.glci_monitoring_targets set format_verified_at = '2026-11-12T20:15:00Z',
  format_evidence = 'Live read 2026-11-12: $.results with document_number, title, html_url, publication_date (e.g. C1-2026-22802). Licence page not readable (bot gate): to confirm in the rights review.'
  where target_key = 'us-federal-register';

-- Denmark: the harvesting API is the official machine interface; it lives on its own host.
update private.glci_monitoring_targets set official_uri = 'https://api.retsinformation.dk/', monitor_adapter_key = 'json-listing',
  config = '{"listUrl": "https://api.retsinformation.dk/v1/Documents?date={yesterday}", "itemsPath": "", "idField": "documentId",
    "dateField": "changeDate", "linkField": "href", "allowEmpty": true, "maxItems": 100}'::jsonb,
  format_verified_at = '2026-11-12T20:15:00Z',
  format_evidence = 'Live read 2026-11-12: GET /v1/Documents?date=YYYY-MM-DD returns a JSON array of {documentId, accessionsnummer, reasonForChange, changeDate, documentType, href}; to be called once a day. Terms (retsinformation.dk/api) not readable without a browser: to confirm in the rights review.',
  notes = 'Retsinformation harvesting service (høsteservice): daily change list of the previous day. An empty day means no change.'
  where target_key = 'dk-retsinformation';

update private.glci_monitoring_targets set notes = 'No EUR-Lex RSS feed found on 2026-11-12 (candidate URLs 404). Monitoring needs another official interface (for example the Publications Office notification or SPARQL services), to be assessed. Reuse terms read: Decision 2011/833/EU; editorial content CC BY 4.0.'
  where target_key = 'eu-official-journal';
update private.glci_monitoring_targets set notes = 'opendata.finlex.fi requires an authentication token; no public documentation found on 2026-11-12. Obtain the API documentation and access terms during the rights review.'
  where target_key = 'fi-finlex';

-- The register's monitor stage: a confirmed format is per target (or a verified source-specific adapter).
create or replace function private.glci_target_format_confirmed(p_target private.glci_monitoring_targets)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_target.format_verified_at is not null
    or exists (select 1 from private.glci_monitor_adapters a where a.adapter_key = p_target.monitor_adapter_key
      and a.kind = 'source_specific' and a.format_verified)
$$;
revoke all on function private.glci_target_format_confirmed(private.glci_monitoring_targets) from public, anon, authenticated;

-- The register's monitor stage now reads the per-target confirmation: the stage computation is kept
-- (renamed to *_base) and wrapped, so only the formatVerified evidence changes.
alter function private.glci_jurisdiction_onboarding(text) rename to glci_jurisdiction_onboarding_base;
create or replace function private.glci_jurisdiction_onboarding(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_steps jsonb;
begin
  v_result := private.glci_jurisdiction_onboarding_base(p_code);
  select jsonb_agg(case when s ->> 'key' = 'monitor' then s || jsonb_build_object('formatVerified',
      exists (select 1 from private.glci_monitoring_targets t where t.jurisdiction_code = p_code and t.monitor_adapter_key is not null
        and private.glci_target_format_confirmed(t))) else s end order by ord)
  into v_steps from jsonb_array_elements(v_result -> 'steps') with ordinality as x(s, ord);
  return v_result || jsonb_build_object('steps', v_steps);
end;
$$;
revoke all on function private.glci_jurisdiction_onboarding(text) from public, anon, authenticated;
