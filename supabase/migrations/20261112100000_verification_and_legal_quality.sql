-- Phase 6: verification and legal quality (Master Plan v2.0 §8.3–§8.5, §18.3).
-- Re-verifies a recorded research run against the law as it now stands: currency since the run,
-- treatment (overruled, repealed, replaced, distinguished), conflicts between cited authorities,
-- jurisdiction fit, source rights still in force, and limitation disclosure. Reports and findings
-- are append-only. Findings that need a person open human review gates (§8.5), which are decided
-- by holders of quality.review under a four-eyes rule (self-review only in personal organisations).
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Permission
-- ---------------------------------------------------------------------------------------------
insert into private.permission_catalog (permission_key, scope, description) values
  ('quality.review', 'workspace', 'Decide human review gates for research and arguments')
on conflict (permission_key) do nothing;
insert into private.role_permissions (role_key, permission_key) values
  ('workspace_manager', 'quality.review'),
  ('workspace_reviewer', 'quality.review')
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Reports, findings and review requests
-- ---------------------------------------------------------------------------------------------
create table private.verification_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  research_run_id uuid not null references private.research_runs (id) on delete restrict,
  checked_as_of date not null,
  outcome text not null check (outcome in ('clear', 'review_required', 'blocked')),
  checker_version text not null check (char_length(checker_version) between 1 and 40),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id)
    on delete restrict
);
create index verification_reports_run_idx on private.verification_reports (research_run_id, created_at desc);

create table private.verification_findings (
  id uuid primary key default gen_random_uuid(),
  -- Deferred so that findings are written first and the report is inserted once, with its outcome.
  report_id uuid not null references private.verification_reports (id) on delete restrict deferrable initially deferred,
  claim_ordinal integer,
  check_type text not null check (check_type in ('currency', 'treatment', 'conflict', 'jurisdiction_fit',
    'source_rights', 'limitation')),
  severity text not null check (severity in ('info', 'warning', 'blocking')),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  detail text not null check (char_length(detail) between 1 and 1000),
  related_authority_id uuid references private.legal_authorities (id) on delete restrict
);
create index verification_findings_report_idx on private.verification_findings (report_id);

create table private.review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  subject_type text not null check (subject_type in ('research_run', 'argument_issue')),
  subject_id uuid not null,
  gate text not null check (gate in ('conflicting_authority', 'low_coverage', 'changed_law',
    'verification_failure', 'high_impact', 'sensitive_evidence', 'institutional_output')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  verification_report_id uuid references private.verification_reports (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  requested_by uuid references private.principals (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references private.principals (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  self_review boolean not null default false,
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id)
    on delete restrict,
  check ((status = 'pending') = (decided_at is null)),
  check (status in ('pending', 'approved') or char_length(btrim(coalesce(decision_note, ''))) >= 3)
);
create unique index review_requests_one_pending_per_gate
  on private.review_requests (subject_type, subject_id, gate) where status = 'pending';
create index review_requests_workspace_idx on private.review_requests (workspace_id, status, requested_at desc);

-- A decision is made once; nothing but the decision fields may change, and rows are never deleted.
create or replace function private.guard_review_request_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Review requests are append-only' using errcode = '55000';
  end if;
  if old.status <> 'pending'
    or (new.id, new.organization_id, new.workspace_id, new.subject_type, new.subject_id, new.gate, new.reason,
        new.verification_report_id, new.requested_by, new.requested_at)
       is distinct from
       (old.id, old.organization_id, old.workspace_id, old.subject_type, old.subject_id, old.gate, old.reason,
        old.verification_report_id, old.requested_by, old.requested_at) then
    raise exception 'A review request can be decided once and is otherwise immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_review_request_update() from public, anon, authenticated;
create trigger review_requests_guard before update or delete on private.review_requests
  for each row execute function private.guard_review_request_update();

do $tables$
declare v_table text;
begin
  foreach v_table in array array['verification_reports', 'verification_findings'] loop
    execute format('create trigger %I before update or delete on private.%I for each row execute function private.reject_append_only_mutation()',
      v_table || '_append_only', v_table);
  end loop;
  foreach v_table in array array['verification_reports', 'verification_findings', 'review_requests'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
  end loop;
end;
$tables$;

-- ---------------------------------------------------------------------------------------------
-- 3. Re-verification
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_quality_scope(p_organization_id uuid, p_workspace_id uuid, p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_organization_id is null or p_workspace_id is null
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or private.current_principal_id() is null
    or not private.has_permission(p_permission, p_organization_id, p_workspace_id) then
    raise exception 'QUALITY_NOT_AUTHORISED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_quality_scope(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.verification_check_research_run(p_run_id uuid, p_check_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run private.research_runs;
  v_check_date date := coalesce(p_check_date, current_date);
  v_report_id uuid;
  v_outcome text;
  v_claim record;
  v_rel record;
  v_findings integer;
  v_jurisdictions text[];
begin
  select * into v_run from private.research_runs where id = p_run_id;
  if not found then raise exception 'QUALITY_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_quality_scope(v_run.organization_id, v_run.workspace_id, 'research.create');
  if v_check_date < v_run.as_of_date then
    raise exception 'VERIFICATION_DATE_BEFORE_RESEARCH_DATE' using errcode = '22023';
  end if;

  v_report_id := gen_random_uuid();

  -- The run's jurisdiction and its ancestors (e.g. supranational law that applies there).
  with recursive chain(code, parent_code) as (
    select code, parent_code from private.jurisdictions where code = v_run.jurisdiction_code
    union all
    select j.code, j.parent_code from private.jurisdictions j join chain c on j.code = c.parent_code
  )
  select array_agg(code) into v_jurisdictions from chain;

  for v_claim in
    select c.ordinal, c.category, a.id as authority_id, a.citation, a.jurisdiction_code, a.legal_status,
      v.id as version_id, v.valid_from, v.valid_until, s.rights_status, s.status as source_status,
      s.ingestion_enabled, coalesce((re.permissions ->> 'display')::boolean, false) as display_permitted
    from private.research_claims c
    join private.legal_authority_passages p on p.id = c.cited_passage_id
    join private.legal_authority_versions v on v.id = p.authority_version_id
    join private.legal_authorities a on a.id = v.authority_id
    join private.legal_sources s on s.id = a.source_id
    left join private.legal_source_rights_evidence re on re.source_id = s.id
    where c.run_id = v_run.id and c.verification_status = 'verified'
    order by c.ordinal
  loop
    -- Source rights still in force.
    if v_claim.rights_status <> 'approved' or v_claim.source_status <> 'active' or not v_claim.display_permitted then
      insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
      values (v_report_id, v_claim.ordinal, 'source_rights', 'blocking', 'SOURCE_NO_LONGER_PERMITTED',
        format('The source of %s is no longer approved for display.', v_claim.citation), v_claim.authority_id);
    end if;

    -- Jurisdiction fit.
    if not (v_claim.jurisdiction_code = any (v_jurisdictions)) then
      insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
      values (v_report_id, v_claim.ordinal, 'jurisdiction_fit', 'blocking', 'JURISDICTION_MISMATCH',
        format('%s belongs to %s, which does not apply in %s.', v_claim.citation, v_claim.jurisdiction_code, v_run.jurisdiction_code),
        v_claim.authority_id);
    end if;

    -- Currency: the cited version must have been in force on the research date; changes since are disclosed.
    if v_claim.valid_from > v_run.as_of_date or (v_claim.valid_until is not null and v_claim.valid_until <= v_run.as_of_date) then
      insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
      values (v_report_id, v_claim.ordinal, 'currency', 'blocking', 'VERSION_NOT_IN_FORCE_ON_RESEARCH_DATE',
        format('The cited version of %s was not in force on %s.', v_claim.citation, v_run.as_of_date), v_claim.authority_id);
    elsif (v_claim.valid_until is not null and v_claim.valid_until <= v_check_date)
      or exists (select 1 from private.legal_authority_versions nv where nv.authority_id = v_claim.authority_id
        and nv.id <> v_claim.version_id and nv.valid_from > v_run.as_of_date and nv.valid_from <= v_check_date) then
      insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
      values (v_report_id, v_claim.ordinal, 'currency', 'warning', 'LAW_CHANGED_SINCE_RESEARCH',
        format('%s has changed between %s and %s; the research describes the earlier text.', v_claim.citation,
          v_run.as_of_date, v_check_date), v_claim.authority_id);
    elsif (v_claim.valid_until is not null and v_claim.valid_until > v_check_date)
      or exists (select 1 from private.legal_authority_versions nv where nv.authority_id = v_claim.authority_id
        and nv.valid_from > v_check_date) then
      insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
      values (v_report_id, v_claim.ordinal, 'currency', 'info', 'CHANGE_SCHEDULED',
        format('A change to %s is scheduled after %s.', v_claim.citation, v_check_date), v_claim.authority_id);
    end if;

    -- Treatment: adverse treatment recorded after the run was made.
    for v_rel in
      select r.relationship_type, r.effective_from, other.id as other_id, other.citation as other_citation
      from private.legal_authority_relationships r
      join private.legal_authorities other on other.id = case when r.from_authority_id = v_claim.authority_id
        then r.to_authority_id else r.from_authority_id end
      where (r.from_authority_id = v_claim.authority_id and r.relationship_type in ('overruled_by', 'repealed_by', 'replaced_by'))
         or (r.to_authority_id = v_claim.authority_id and r.relationship_type in ('overrules', 'repeals', 'replaces', 'distinguishes'))
    loop
      if v_rel.relationship_type = 'distinguishes' then
        insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
        values (v_report_id, v_claim.ordinal, 'treatment', 'info', 'DISTINGUISHED',
          format('%s has been distinguished by %s.', v_claim.citation, coalesce(v_rel.other_citation, 'a later authority')), v_rel.other_id);
      elsif v_rel.effective_from is null or v_rel.effective_from <= v_run.as_of_date then
        insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
        values (v_report_id, v_claim.ordinal, 'treatment', 'blocking', 'ADVERSE_TREATMENT_AT_RESEARCH_DATE',
          format('%s was %s %s by the research date.', v_claim.citation,
            case when v_rel.relationship_type like 'overrul%' then 'overruled'
              when v_rel.relationship_type like 'repeal%' then 'repealed' else 'replaced' end,
            coalesce('by ' || v_rel.other_citation, '')), v_rel.other_id);
      elsif v_rel.effective_from <= v_check_date then
        insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
        values (v_report_id, v_claim.ordinal, 'treatment', 'warning', 'ADVERSE_TREATMENT_SINCE_RESEARCH',
          format('%s has been affected (%s) since %s, effective %s.', v_claim.citation, v_rel.relationship_type,
            v_run.as_of_date, v_rel.effective_from), v_rel.other_id);
      else
        insert into private.verification_findings (report_id, claim_ordinal, check_type, severity, code, detail, related_authority_id)
        values (v_report_id, v_claim.ordinal, 'treatment', 'info', 'ADVERSE_TREATMENT_SCHEDULED',
          format('%s will be affected (%s) from %s.', v_claim.citation, v_rel.relationship_type, v_rel.effective_from), v_rel.other_id);
      end if;
    end loop;
  end loop;

  -- Conflict detection between the authorities the run relies on.
  insert into private.verification_findings (report_id, check_type, severity, code, detail, related_authority_id)
  select v_report_id, 'conflict', 'warning', 'CONFLICTING_AUTHORITIES',
    format('%s and %s are recorded as conflicting.', fa.citation, ta.citation), ta.id
  from private.legal_authority_relationships r
  join private.legal_authorities fa on fa.id = r.from_authority_id
  join private.legal_authorities ta on ta.id = r.to_authority_id
  where r.relationship_type = 'conflicts_with'
    and r.from_authority_id in (select v.authority_id from private.research_claims c
      join private.legal_authority_passages p on p.id = c.cited_passage_id
      join private.legal_authority_versions v on v.id = p.authority_version_id
      where c.run_id = v_run.id and c.verification_status = 'verified')
    and r.to_authority_id in (select v.authority_id from private.research_claims c
      join private.legal_authority_passages p on p.id = c.cited_passage_id
      join private.legal_authority_versions v on v.id = p.authority_version_id
      where c.run_id = v_run.id and c.verification_status = 'verified');
  if exists (select 1 from private.research_claims where run_id = v_run.id
      and category = 'conflicting_authority' and verification_status = 'verified') then
    insert into private.verification_findings (report_id, check_type, severity, code, detail)
    values (v_report_id, 'conflict', 'warning', 'CONFLICTING_AUTHORITY_DISCLOSED',
      'The research reports potentially conflicting authority; a person must weigh it.');
  end if;

  -- Uncertainty and limitation reporting.
  if v_run.coverage_level <> 'supported' then
    if jsonb_array_length(v_run.limitations) = 0 then
      insert into private.verification_findings (report_id, check_type, severity, code, detail)
      values (v_report_id, 'limitation', 'blocking', 'LIMITATION_NOT_DISCLOSED',
        format('Coverage for %s is %s, but the research discloses no limitation.', v_run.jurisdiction_code, v_run.coverage_level));
    else
      insert into private.verification_findings (report_id, check_type, severity, code, detail)
      values (v_report_id, 'limitation', 'warning', 'COVERAGE_LIMITED',
        format('Coverage for %s is %s; relevant law may be missing.', v_run.jurisdiction_code, v_run.coverage_level));
    end if;
  end if;
  if v_run.status = 'abstained' then
    insert into private.verification_findings (report_id, check_type, severity, code, detail)
    values (v_report_id, 'limitation', 'info', 'ABSTAINED', 'No verified authority was found; the research makes no legal statement.');
  end if;
  if exists (select 1 from private.research_claims where run_id = v_run.id and verification_status = 'failed') then
    insert into private.verification_findings (report_id, check_type, severity, code, detail)
    values (v_report_id, 'limitation', 'info', 'CLAIMS_WITHHELD', 'Some statements failed verification and were withheld.');
  end if;
  if exists (select 1 from private.research_claims where run_id = v_run.id and category = 'unresolved_question') then
    insert into private.verification_findings (report_id, check_type, severity, code, detail)
    values (v_report_id, 'limitation', 'info', 'UNRESOLVED_QUESTIONS', 'The research leaves questions unresolved.');
  end if;

  select case
      when bool_or(severity = 'blocking') then 'blocked'
      when bool_or(severity = 'warning') then 'review_required'
      else 'clear' end,
    count(*)
  into v_outcome, v_findings
  from private.verification_findings where report_id = v_report_id;
  v_outcome := coalesce(v_outcome, 'clear');
  insert into private.verification_reports (id, organization_id, workspace_id, research_run_id, checked_as_of,
    outcome, checker_version, created_by)
  values (v_report_id, v_run.organization_id, v_run.workspace_id, v_run.id, v_check_date, v_outcome,
    'verification-1.0.0', private.current_principal_id());

  -- Human review gates (§8.5).
  insert into private.review_requests (organization_id, workspace_id, subject_type, subject_id, gate, reason,
    verification_report_id, requested_by)
  select distinct v_run.organization_id, v_run.workspace_id, 'research_run', v_run.id, g.gate, g.reason, v_report_id,
    private.current_principal_id()
  from (
    select case
        when f.severity = 'blocking' then 'verification_failure'
        when f.check_type = 'conflict' then 'conflicting_authority'
        when f.code = 'COVERAGE_LIMITED' then 'low_coverage'
        else 'changed_law' end as gate,
      case
        when f.severity = 'blocking' then 'Verification found a blocking problem.'
        when f.check_type = 'conflict' then 'Conflicting authorities must be weighed by a person.'
        when f.code = 'COVERAGE_LIMITED' then 'Research in a jurisdiction with limited coverage.'
        else 'The law has changed since the research date.' end as reason
    from private.verification_findings f
    where f.report_id = v_report_id and f.severity in ('warning', 'blocking')
  ) g
  on conflict (subject_type, subject_id, gate) where status = 'pending' do nothing;

  perform private.record_evidence_audit(v_run.organization_id, v_run.workspace_id, 'quality.verification_checked',
    'research_run', v_run.id, jsonb_build_object('reportId', v_report_id, 'outcome', v_outcome, 'findings', v_findings));
  return jsonb_build_object('reportId', v_report_id, 'outcome', v_outcome, 'findings', v_findings);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Review gates
-- ---------------------------------------------------------------------------------------------
create or replace function public.review_request_create(
  p_organization_id uuid, p_workspace_id uuid, p_subject_type text, p_subject_id uuid, p_gate text, p_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_quality_scope(p_organization_id, p_workspace_id,
    case when p_subject_type = 'argument_issue' then 'argument.manage' else 'research.create' end);
  if p_subject_type = 'research_run' then
    perform 1 from private.research_runs where id = p_subject_id and workspace_id = p_workspace_id and organization_id = p_organization_id;
  elsif p_subject_type = 'argument_issue' then
    perform 1 from private.legal_issues where id = p_subject_id and workspace_id = p_workspace_id and organization_id = p_organization_id;
  else
    raise exception 'REVIEW_SUBJECT_INVALID' using errcode = '22023';
  end if;
  if not found then raise exception 'QUALITY_NOT_AUTHORISED' using errcode = '42501'; end if;
  if p_gate not in ('high_impact', 'sensitive_evidence', 'institutional_output') then
    raise exception 'REVIEW_GATE_NOT_MANUAL' using errcode = '22023';
  end if;
  insert into private.review_requests (organization_id, workspace_id, subject_type, subject_id, gate, reason, requested_by)
  values (p_organization_id, p_workspace_id, p_subject_type, p_subject_id, p_gate, btrim(p_reason), private.current_principal_id())
  on conflict (subject_type, subject_id, gate) where status = 'pending' do nothing
  returning id into v_id;
  if v_id is null then raise exception 'REVIEW_ALREADY_PENDING' using errcode = '23505'; end if;
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'quality.review_requested', 'review_request', v_id,
    jsonb_build_object('gate', p_gate, 'subjectType', p_subject_type));
  return v_id;
end;
$$;

create or replace function public.review_decide(p_request_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_request private.review_requests;
  v_principal uuid := private.current_principal_id();
  v_personal boolean;
begin
  select * into v_request from private.review_requests where id = p_request_id;
  if not found then raise exception 'QUALITY_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_quality_scope(v_request.organization_id, v_request.workspace_id, 'quality.review');
  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'REVIEW_DECISION_INVALID' using errcode = '22023';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'REVIEW_ALREADY_DECIDED' using errcode = '55000';
  end if;
  select kind = 'personal' into v_personal from public.organizations where id = v_request.organization_id;
  if v_request.requested_by = v_principal and not coalesce(v_personal, false) then
    raise exception 'REVIEW_FOUR_EYES_REQUIRED' using errcode = '42501';
  end if;
  update private.review_requests
  set status = p_decision, decided_by = v_principal, decided_at = now(), decision_note = nullif(btrim(p_note), ''),
    self_review = (v_request.requested_by = v_principal)
  where id = p_request_id;
  perform private.record_evidence_audit(v_request.organization_id, v_request.workspace_id, 'quality.review_decided',
    'review_request', v_request.id, jsonb_build_object('decision', p_decision, 'gate', v_request.gate));
end;
$$;

create or replace function public.review_list(p_organization_id uuid, p_workspace_id uuid, p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_quality_scope(p_organization_id, p_workspace_id, 'research.read');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'subjectType', r.subject_type, 'subjectId', r.subject_id,
      'subjectTitle', coalesce(rr.question, li.title), 'gate', r.gate, 'reason', r.reason, 'status', r.status,
      'requestedAt', r.requested_at, 'decidedAt', r.decided_at, 'decisionNote', r.decision_note,
      'selfReview', r.self_review, 'requestedByMe', r.requested_by = private.current_principal_id())
      order by (r.status = 'pending') desc, r.requested_at desc)
    from private.review_requests r
    left join private.research_runs rr on r.subject_type = 'research_run' and rr.id = r.subject_id
    left join private.legal_issues li on r.subject_type = 'argument_issue' and li.id = r.subject_id
    where r.organization_id = p_organization_id and r.workspace_id = p_workspace_id
      and (p_status is null or r.status = p_status)), '[]'::jsonb);
end;
$$;

create or replace function public.verification_get_run_quality(p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_run private.research_runs; v_report private.verification_reports;
begin
  select * into v_run from private.research_runs where id = p_run_id;
  if not found then raise exception 'QUALITY_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_quality_scope(v_run.organization_id, v_run.workspace_id, 'research.read');
  select * into v_report from private.verification_reports where research_run_id = p_run_id
  order by created_at desc, id desc limit 1;
  return jsonb_build_object(
    'organizationId', v_run.organization_id, 'workspaceId', v_run.workspace_id,
    'latestReport', case when v_report.id is null then null else jsonb_build_object(
      'id', v_report.id, 'checkedAsOf', v_report.checked_as_of, 'outcome', v_report.outcome,
      'checkerVersion', v_report.checker_version, 'createdAt', v_report.created_at,
      'findings', coalesce((select jsonb_agg(jsonb_build_object('claimOrdinal', f.claim_ordinal, 'checkType', f.check_type,
        'severity', f.severity, 'code', f.code, 'detail', f.detail)
        order by case f.severity when 'blocking' then 0 when 'warning' then 1 else 2 end, f.claim_ordinal nulls last, f.code)
        from private.verification_findings f where f.report_id = v_report.id), '[]'::jsonb)) end,
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'gate', r.gate, 'reason', r.reason,
      'status', r.status, 'decidedAt', r.decided_at, 'decisionNote', r.decision_note, 'selfReview', r.self_review)
      order by r.requested_at desc)
      from private.review_requests r where r.subject_type = 'research_run' and r.subject_id = p_run_id), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.verification_check_research_run(uuid, date)',
    'public.review_request_create(uuid, uuid, text, uuid, text, text)',
    'public.review_decide(uuid, text, text)',
    'public.review_list(uuid, uuid, text)',
    'public.verification_get_run_quality(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
