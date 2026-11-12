-- GLCI-05: Njumeni currency and coverage verification (docs/GLCI_SPECIFICATION.md §2 engine 4, §3 step 4).
--
-- For each jurisdiction, Njumeni measures whether its legal knowledge reflects the latest
-- authoritative position:
--   freshness         the currency state of each monitored target (GLCI-02);
--   knowledge lag     an upstream change detected after the last successful ingestion of that source;
--   completeness      authorities a source's latest complete dataset lists vs. present in Njumeni,
--                     and passages without an embedding (missing from semantic retrieval);
--   temporal validity authorities with unknown status (e.g. withdrawn), versions pending
--                     commencement, versions without an effective date;
--   citation accuracy research claims and findings that cite text that is no longer the current
--                     version, and high-severity impacts (GLCI-04) not yet resolved.
-- The verdict is one of:
--   current        every active target verified, no knowledge lag, complete, nothing outdated;
--   behind         a change is known but not yet reflected, or knowledge is incomplete or outdated;
--   unverified     a target was never checked, is stale, failing or broken, so currency cannot be
--                  claimed (spec §8: "not checked" is never "current");
--   not_monitored  no active monitoring target.
-- Verification runs are recorded append-only (glci_currency_reports), so the history of what
-- Njumeni knew, and when, is preserved.

create or replace function private.glci_jurisdiction_currency(p_jurisdiction_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_targets jsonb;
  v_active integer;
  v_unverified integer;
  v_lag jsonb;
  v_completeness jsonb;
  v_temporal jsonb;
  v_citations jsonb;
  v_missing integer;
  v_verdict text;
  v_reasons text[] := '{}';
begin
  select coalesce(jsonb_object_agg(c.currency, c.n), '{}'::jsonb), coalesce(sum(c.n) filter (where c.currency <> 'not_monitored'), 0),
    coalesce(sum(c.n) filter (where c.currency in ('not_checked', 'stale', 'check_failing', 'integration_failure')), 0)
  into v_targets, v_active, v_unverified
  from (select private.glci_target_currency(t.id) as currency, count(*) as n
    from private.glci_monitoring_targets t where t.jurisdiction_code = p_jurisdiction_code group by 1) c;

  -- Knowledge lag: the monitor saw a change after the source's last successful ingestion run.
  select coalesce(jsonb_agg(jsonb_build_object('targetKey', t.target_key, 'changedAt', s.last_changed_at, 'lastIngestedAt', ing.last_finished)), '[]'::jsonb)
  into v_lag
  from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
  left join lateral (select max(r.finished_at) as last_finished from private.legal_source_ingestion_runs r
    where r.source_id = t.source_id and r.status in ('succeeded', 'partial')) ing on true
  where t.jurisdiction_code = p_jurisdiction_code and t.status = 'active' and s.last_outcome in ('changed', 'first_seen')
    and (ing.last_finished is null or ing.last_finished < s.last_changed_at);

  -- Completeness against each source's latest complete dataset, and the semantic index.
  select coalesce(jsonb_agg(jsonb_build_object('sourceKey', x.source_key, 'dataset', x.dataset, 'listed', x.listed, 'present', x.present,
      'missing', greatest(x.listed - x.present, 0), 'passagesWithoutEmbedding', x.unembedded)), '[]'::jsonb),
    coalesce(sum(greatest(x.listed - x.present, 0) + x.unembedded), 0)
  into v_completeness, v_missing
  from (select src.source_key, d.dataset, d.authorities_listed as listed,
      (select count(*) from private.legal_authorities a where a.source_id = src.id and a.source_metadata ->> 'dataset' = d.dataset
        and not (a.source_metadata ? 'absentFromDatasetSince'))::integer as present,
      (select count(*) from private.legal_authority_passages p join private.legal_authority_versions v on v.id = p.authority_version_id
        join private.legal_authorities a on a.id = v.authority_id
        where a.source_id = src.id and v.is_current_source_version and p.embedding is null)::integer as unembedded
    from private.legal_sources src
    join lateral (select distinct on (ds.dataset) ds.* from private.legal_source_dataset_syncs ds where ds.source_id = src.id
      order by ds.dataset, ds.completed_at desc) d on true
    where src.jurisdiction_code = p_jurisdiction_code) x;

  select jsonb_build_object(
    'unknownStatus', (select count(*) from private.legal_authorities a where a.jurisdiction_code = p_jurisdiction_code and a.legal_status = 'unknown'),
    'withdrawnFromSource', (select count(*) from private.legal_authorities a where a.jurisdiction_code = p_jurisdiction_code
      and a.source_metadata ? 'absentFromDatasetSince'),
    'pendingCommencement', (select count(*) from private.legal_authority_versions v join private.legal_authorities a on a.id = v.authority_id
      where a.jurisdiction_code = p_jurisdiction_code and v.is_current_source_version and v.valid_from > current_date),
    'withoutEffectiveDate', (select count(*) from private.legal_authority_versions v join private.legal_authorities a on a.id = v.authority_id
      where a.jurisdiction_code = p_jurisdiction_code and v.is_current_source_version and v.valid_from is null))
  into v_temporal;

  select jsonb_build_object(
    'claimsCitingSupersededText', (select count(*) from private.research_claims k join private.legal_authority_passages p on p.id = k.cited_passage_id
      join private.legal_authority_versions v on v.id = p.authority_version_id join private.legal_authorities a on a.id = v.authority_id
      where a.jurisdiction_code = p_jurisdiction_code and not v.is_current_source_version),
    'findingsCitingSupersededText', (select count(*) from private.research_findings f join private.legal_authority_versions v on v.id = f.authority_version_id
      join private.legal_authorities a on a.id = v.authority_id where a.jurisdiction_code = p_jurisdiction_code and not v.is_current_source_version),
    'openHighImpacts', (select count(*) from private.glci_change_impacts i join private.glci_change_events e on e.id = i.event_id
      where e.jurisdiction_code = p_jurisdiction_code and i.severity = 'high' and e.review_status in ('detected', 'assessed')))
  into v_citations;

  if v_active = 0 then
    v_verdict := 'not_monitored';
    v_reasons := array['No active monitoring target: Njumeni cannot say whether its knowledge is current.'];
  elsif v_unverified > 0 then
    v_verdict := 'unverified';
    v_reasons := array[v_unverified || ' monitored source(s) not verified (never checked, stale, failing or broken).'];
  else
    if jsonb_array_length(v_lag) > 0 then v_reasons := v_reasons || (jsonb_array_length(v_lag) || ' upstream change(s) not yet ingested.'); end if;
    if v_missing > 0 then v_reasons := v_reasons || (v_missing || ' missing authorities or unindexed passages.'); end if;
    if (v_citations ->> 'openHighImpacts')::integer > 0 then
      v_reasons := v_reasons || ((v_citations ->> 'openHighImpacts') || ' high-severity impact(s) of legal changes not yet resolved.');
    end if;
    if (v_citations ->> 'claimsCitingSupersededText')::integer > 0 then
      v_reasons := v_reasons || ((v_citations ->> 'claimsCitingSupersededText') || ' research claim(s) cite superseded text.');
    end if;
    v_verdict := case when cardinality(v_reasons) = 0 then 'current' else 'behind' end;
  end if;

  return jsonb_build_object('jurisdictionCode', p_jurisdiction_code, 'verdict', v_verdict, 'reasons', to_jsonb(v_reasons),
    'measuredAt', now(), 'targets', v_targets, 'knowledgeLag', v_lag, 'completeness', v_completeness,
    'temporalValidity', v_temporal, 'citationAccuracy', v_citations);
end;
$$;
revoke all on function private.glci_jurisdiction_currency(text) from public, anon, authenticated;

create table private.glci_currency_reports (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references private.jurisdictions(code) on delete restrict,
  verdict text not null check (verdict in ('current', 'behind', 'unverified', 'not_monitored')),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  measured_at timestamptz not null default now(),
  requested_by uuid
);
create index glci_currency_reports_jurisdiction_idx on private.glci_currency_reports(jurisdiction_code, measured_at desc);
alter table private.glci_currency_reports enable row level security;
revoke all on private.glci_currency_reports from public, anon, authenticated;
grant select on private.glci_currency_reports to service_role;
create trigger glci_currency_reports_append_only before update or delete on private.glci_currency_reports
  for each row execute function private.reject_append_only_mutation();

-- Records a verification for one jurisdiction, or for every profiled jurisdiction. Operators or
-- the scheduled worker (service role) run it; a change of verdict is audited.
create or replace function public.glci_run_currency_verification(p_jurisdiction_code text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_report jsonb;
  v_previous text;
  v_results jsonb := '[]';
begin
  -- The scheduled worker calls with the service role; everyone else must be a GLCI operator.
  if coalesce(auth.role(), '') <> 'service_role' then
    perform private.glci_require_operator();
  end if;
  for v_code in select j.code from private.jurisdictions j
      where (p_jurisdiction_code is null and exists (select 1 from private.glci_jurisdiction_profiles p where p.jurisdiction_code = j.code))
        or j.code = p_jurisdiction_code
      order by j.code loop
    v_report := private.glci_jurisdiction_currency(v_code);
    select verdict into v_previous from private.glci_currency_reports where jurisdiction_code = v_code order by measured_at desc limit 1;
    insert into private.glci_currency_reports (jurisdiction_code, verdict, report, requested_by)
    values (v_code, v_report ->> 'verdict', v_report, private.current_principal_id());
    if v_previous is distinct from v_report ->> 'verdict' then
      perform private.glci_audit('currency.verdict_changed', 'jurisdiction', v_code,
        jsonb_build_object('from', v_previous, 'to', v_report ->> 'verdict', 'reasons', v_report -> 'reasons'));
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object('jurisdictionCode', v_code, 'verdict', v_report ->> 'verdict'));
  end loop;
  if jsonb_array_length(v_results) = 0 then raise exception 'GLCI_JURISDICTION_NOT_FOUND' using errcode = 'P0002'; end if;
  return v_results;
end;
$$;

-- Live measurement for one jurisdiction (not recorded) and the latest recorded verdict for all.
create or replace function public.glci_currency(p_jurisdiction_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if not exists (select 1 from private.jurisdictions where code = p_jurisdiction_code) then
    raise exception 'GLCI_JURISDICTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  return private.glci_jurisdiction_currency(p_jurisdiction_code);
end;
$$;

create or replace function public.glci_currency_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object('jurisdictionCode', j.code, 'name', j.short_name, 'coverageStatus', j.status,
      'verdict', coalesce(r.verdict, 'not_measured'), 'measuredAt', r.measured_at, 'reasons', r.report -> 'reasons') order by j.code)
    from private.jurisdictions j
    left join lateral (select * from private.glci_currency_reports c where c.jurisdiction_code = j.code order by c.measured_at desc limit 1) r on true), '[]'::jsonb);
end;
$$;

revoke all on function public.glci_run_currency_verification(text) from public, anon;
grant execute on function public.glci_run_currency_verification(text) to authenticated, service_role;
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_currency(text)', 'public.glci_currency_overview()'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
