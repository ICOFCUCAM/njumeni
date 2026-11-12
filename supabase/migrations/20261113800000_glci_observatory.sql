-- GLCI-07: Super Admin Global Legal Observatory and command centre (docs/GLCI_SPECIFICATION.md §5, §6).
--
-- 1. glci_observatory(): one operator snapshot for the dashboard. It contains:
--    - headline figures, all measured, never illustrative;
--    - per-jurisdiction currency and source health;
--    - newly detected legislation, amendments and withdrawals;
--    - changes awaiting review and outdated knowledge;
--    - failed ingestion and synchronisation;
--    - remediation tasks and the approval queue;
--    - engineering (Claude Code) task history (GLCI-09) and recent audit history.
-- 2. The command centre conversation log (private.glci_command_messages): every operator question
--    and every answer, with the intent, the data consulted and the actions proposed. It is
--    append-only, so what an operator asked and what Njumeni told them is preserved.
-- 3. glci_audit_feed() and glci_verify_audit_chain(): the GLCI audit history and its integrity.

create table private.glci_command_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  author_kind text not null check (author_kind in ('operator', 'assistant')),
  author_principal_id uuid,
  content text not null check (char_length(content) between 1 and 20000),
  intent text check (intent is null or intent ~ '^[a-z_]{2,60}$'),
  engine text check (engine is null or char_length(engine) <= 120),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  created_at timestamptz not null default now(),
  unique (conversation_id, sequence_number)
);
create index glci_command_messages_conversation_idx on private.glci_command_messages(conversation_id, sequence_number);
alter table private.glci_command_messages enable row level security;
revoke all on private.glci_command_messages from public, anon, authenticated;
grant select on private.glci_command_messages to service_role;
create trigger glci_command_messages_append_only before update or delete on private.glci_command_messages
  for each row execute function private.reject_append_only_mutation();

create or replace function public.glci_command_record(p_conversation_id uuid, p_author_kind text, p_content text, p_intent text,
  p_engine text, p_data jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_seq integer;
begin
  perform private.glci_require_operator();
  if p_conversation_id is null then raise exception 'GLCI_COMMAND_INVALID' using errcode = '22023'; end if;
  -- An operator may only continue their own conversation.
  if exists (select 1 from private.glci_command_messages m where m.conversation_id = p_conversation_id and m.author_kind = 'operator'
      and m.author_principal_id is distinct from private.current_principal_id()) then
    raise exception 'GLCI_NOT_AUTHORISED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_conversation_id::text));
  select coalesce(max(sequence_number), 0) + 1 into v_seq from private.glci_command_messages where conversation_id = p_conversation_id;
  insert into private.glci_command_messages (conversation_id, sequence_number, author_kind, author_principal_id, content, intent, engine, data)
  values (p_conversation_id, v_seq, p_author_kind, private.current_principal_id(), p_content, p_intent, p_engine, coalesce(p_data, '{}'));
  if p_author_kind = 'operator' then
    perform private.glci_audit('command.asked', 'command_conversation', p_conversation_id::text,
      jsonb_build_object('sequence', v_seq, 'intent', p_intent, 'question', left(p_content, 500)));
  end if;
  return v_seq;
end;
$$;

create or replace function public.glci_command_conversation(p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if exists (select 1 from private.glci_command_messages m where m.conversation_id = p_conversation_id and m.author_kind = 'operator'
      and m.author_principal_id is distinct from private.current_principal_id()) then
    raise exception 'GLCI_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('sequence', m.sequence_number, 'authorKind', m.author_kind, 'content', m.content,
      'intent', m.intent, 'engine', m.engine, 'data', m.data, 'createdAt', m.created_at) order by m.sequence_number)
    from private.glci_command_messages m where m.conversation_id = p_conversation_id), '[]'::jsonb);
end;
$$;

create or replace function public.glci_verify_audit_chain()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_broken bigint;
begin
  perform private.glci_require_operator();
  select count(*) into v_broken from (
    select e.*, lag(e.record_hash) over (order by e.sequence_number) as expected_previous from private.glci_audit_events e) x
  where x.previous_hash is distinct from x.expected_previous
    or x.record_hash <> private.glci_audit_digest(x.occurred_at, x.actor_principal_id, x.actor_kind, x.event_type,
      x.subject_type, x.subject_id, x.details, x.previous_hash);
  return jsonb_build_object('valid', v_broken = 0, 'brokenLinks', v_broken,
    'events', (select count(*) from private.glci_audit_events));
end;
$$;

create or replace function public.glci_audit_feed(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  return coalesce((select jsonb_agg(jsonb_build_object('sequence', e.sequence_number, 'occurredAt', e.occurred_at, 'actorKind', e.actor_kind,
      'eventType', e.event_type, 'subjectType', e.subject_type, 'subjectId', e.subject_id, 'details', e.details) order by e.sequence_number desc)
    from (select * from private.glci_audit_events order by sequence_number desc limit greatest(1, least(coalesce(p_limit, 50), 500))) e), '[]'::jsonb);
end;
$$;

create or replace function public.glci_observatory()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_currency jsonb;
begin
  perform private.glci_require_operator();
  select coalesce(jsonb_agg(c order by c ->> 'jurisdictionCode'), '[]'::jsonb) into v_currency
  from (select private.glci_jurisdiction_currency(p.jurisdiction_code) as c from private.glci_jurisdiction_profiles p) x;
  return jsonb_build_object(
    'generatedAt', now(),
    'headline', jsonb_build_object(
      'jurisdictionsCatalogued', (select count(*) from private.jurisdictions),
      'jurisdictionsProfiled', (select count(*) from private.glci_jurisdiction_profiles),
      'monitoringTargets', (select count(*) from private.glci_monitoring_targets),
      'activeTargets', (select count(*) from private.glci_monitoring_targets where status = 'active'),
      'verifiedCurrent', (select count(*) from jsonb_array_elements(v_currency) c where c ->> 'verdict' = 'current'),
      'unresolvedChanges', (select count(*) from private.glci_change_events where not is_baseline
        and change_type in ('amended', 'withdrawn', 'new_authority') and review_status in ('detected', 'assessed')),
      'openIssues', (select count(*) from private.glci_issues where status in ('open', 'in_progress')),
      'awaitingApproval', (select count(*) from private.glci_remediation_proposals where status = 'proposed')),
    'currency', v_currency,
    'sources', coalesce((select jsonb_agg(jsonb_build_object('targetKey', t.target_key, 'jurisdictionCode', t.jurisdiction_code, 'name', t.name,
        'targetType', t.target_type, 'status', t.status, 'currency', private.glci_target_currency(t.id), 'lastCheckedAt', s.last_checked_at,
        'lastSuccessAt', s.last_success_at, 'consecutiveFailures', s.consecutive_failures, 'activationBasis', private.glci_target_activation_basis(t))
        order by t.jurisdiction_code, t.target_key)
      from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id), '[]'::jsonb),
    'recentChanges', coalesce((select jsonb_agg(row_to_json(x)::jsonb) from (
        select e.id, e.change_type as "changeType", e.jurisdiction_code as "jurisdictionCode", a.citation, a.title, e.detected_at as "detectedAt",
          e.effective_date as "effectiveDate", e.commencement_status as "commencementStatus", e.review_status as "reviewStatus",
          e.sections_amended + e.sections_added + e.sections_removed + e.sections_renumbered as "sectionsChanged",
          (select count(*) from private.glci_change_impacts i where i.event_id = e.id and i.severity = 'high') as "highImpacts"
        from private.glci_change_events e join private.legal_authorities a on a.id = e.authority_id
        where not e.is_baseline and e.change_type <> 'unchanged_text' order by e.detected_at desc limit 50) x), '[]'::jsonb),
    'failedIngestion', coalesce((select jsonb_agg(row_to_json(x)::jsonb) from (
        select s.source_key as "sourceKey", r.status, r.failure_code as "failureCode", r.finished_at as "finishedAt"
        from private.legal_source_ingestion_runs r join private.legal_sources s on s.id = r.source_id
        where r.status in ('failed', 'partial') order by r.requested_at desc limit 20) x), '[]'::jsonb),
    'itemFailures', (select count(*) from private.legal_ingestion_item_failures where status in ('pending', 'abandoned')),
    'issues', public.glci_issues_list('open') || public.glci_issues_list('in_progress'),
    'engineeringTasks', '[]'::jsonb,
    'audit', public.glci_audit_feed(30),
    'auditChain', public.glci_verify_audit_chain());
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_command_record(uuid, text, text, text, text, jsonb)',
    'public.glci_command_conversation(uuid)', 'public.glci_verify_audit_chain()', 'public.glci_audit_feed(integer)',
    'public.glci_observatory()'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;

-- ------------------------------------------------------------------ command centre data access
-- Authorities of a jurisdiction matching topic terms, with their currency state (spec §5 example 1).
create or replace function public.glci_examine_authorities(p_jurisdiction_code text, p_terms text[], p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if p_terms is null or cardinality(p_terms) = 0 or cardinality(p_terms) > 20
    or exists (select 1 from unnest(p_terms) t where char_length(t) not between 3 and 60) then
    raise exception 'GLCI_COMMAND_INVALID' using errcode = '22023';
  end if;
  return coalesce((select jsonb_agg(row_to_json(x)::jsonb) from (
    select a.id, a.external_id as "externalId", a.citation, a.title, a.legal_status as "legalStatus", s.source_key as "sourceKey",
      v.version_number as "currentVersion", v.valid_from as "effectiveFrom", v.retrieved_at as "retrievedAt",
      a.source_metadata ? 'absentFromDatasetSince' as "withdrawnFromSource",
      (v.valid_from > current_date) as "pendingCommencement",
      (select count(*) from private.glci_change_events e where e.authority_id = a.id and not e.is_baseline
        and e.change_type in ('amended', 'withdrawn') and e.review_status in ('detected', 'assessed')) as "unreviewedChanges",
      (select count(*) from private.research_claims k join private.legal_authority_passages p on p.id = k.cited_passage_id
        join private.legal_authority_versions ov on ov.id = p.authority_version_id
        where ov.authority_id = a.id and not ov.is_current_source_version) as "claimsCitingSupersededText"
    from private.legal_authorities a join private.legal_sources s on s.id = a.source_id
    left join private.legal_authority_versions v on v.authority_id = a.id and v.is_current_source_version
    where a.jurisdiction_code = p_jurisdiction_code
      and exists (select 1 from unnest(p_terms) t where a.title ilike '%' || t || '%' or coalesce(a.citation, '') ilike '%' || t || '%'
        or coalesce(a.source_metadata ->> 'shortTitle', '') ilike '%' || t || '%')
    order by a.title limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

-- Engineering requests from the command centre (spec §5 example 3). The request is an issue with an
-- operator-proposed engineering task: another operator must approve it (four eyes), and execution
-- runs through the controlled Claude Code integration (GLCI-09).
alter table private.glci_issues drop constraint glci_issues_kind_check;
alter table private.glci_issues add constraint glci_issues_kind_check
  check (kind in ('integration_failure', 'source_unreachable', 'knowledge_lag', 'legal_change_review', 'engineering_request'));

create or replace function public.glci_request_engineering_task(p_jurisdiction_code text, p_target_key text, p_instruction text,
  p_conversation_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_issue uuid;
  v_proposal uuid;
begin
  perform private.glci_require_operator();
  if p_instruction is null or char_length(btrim(p_instruction)) not between 20 and 4000 then
    raise exception 'GLCI_COMMAND_INVALID' using errcode = '22023';
  end if;
  if p_target_key is not null and not exists (select 1 from private.glci_monitoring_targets where target_key = p_target_key) then
    raise exception 'GLCI_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into private.glci_issues (issue_key, jurisdiction_code, kind, severity, title, detail, subject_type, subject_id)
  values ('engineering:' || gen_random_uuid(), p_jurisdiction_code, 'engineering_request', 'medium',
    left('Engineering request: ' || btrim(p_instruction), 300),
    jsonb_build_object('targetKey', p_target_key, 'conversationId', p_conversation_id), 'monitoring_target', coalesce(p_target_key, p_jurisdiction_code))
  returning id into v_issue;
  perform private.glci_audit('issue.opened', 'glci_issue', v_issue::text, jsonb_build_object('kind', 'engineering_request'));
  v_proposal := private.glci_propose(v_issue, 'engineering_task',
    jsonb_build_object('targetKey', p_target_key, 'jurisdictionCode', p_jurisdiction_code, 'instruction', btrim(p_instruction),
      'conversationId', p_conversation_id),
    'Requested from the command centre: ' || left(btrim(p_instruction), 500), 'operator');
  return jsonb_build_object('issueId', v_issue, 'proposalId', v_proposal);
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_examine_authorities(text, text[], integer)',
    'public.glci_request_engineering_task(text, text, text, uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;

-- Reconciliation must not auto-resolve operator engineering requests: they have no signal that
-- clears; they close when their task is done or dismissed. Carried forward from 20261113700000
-- with only that condition added.
create or replace function public.glci_reconcile_issues()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_issue uuid;
  v_open text[] := '{}';
  v_resolved integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform private.glci_require_operator(); end if;

  -- Monitoring: integration failures and repeatedly unreachable sources.
  for v_row in select t.target_key, t.jurisdiction_code, t.name, t.source_id, s.last_outcome, s.consecutive_failures,
      (select o.failure_code from private.glci_observations o where o.target_id = t.id order by o.checked_at desc limit 1) as failure_code
    from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
    where t.status = 'active' and (s.last_outcome = 'integration_failure' or (s.last_outcome in ('unreachable', 'failed') and s.consecutive_failures >= 3)) loop
    if v_row.last_outcome = 'integration_failure' then
      v_issue := private.glci_open_issue('integration:' || v_row.target_key, v_row.jurisdiction_code, 'integration_failure', 'critical',
        'Njumeni no longer understands ' || v_row.name, jsonb_build_object('failureCode', v_row.failure_code), 'monitoring_target', v_row.target_key);
      perform private.glci_propose(v_issue, 'engineering_task',
        jsonb_build_object('targetKey', v_row.target_key, 'failureCode', v_row.failure_code,
          'instruction', 'Investigate the change in the official source format or API and update its monitor and ingestion adapter, with tests.'),
        'The source answered in a form the monitor no longer recognises (' || coalesce(v_row.failure_code, 'unknown') || '). The adapter needs an engineering change.');
      v_open := v_open || ('integration:' || v_row.target_key);
    else
      v_issue := private.glci_open_issue('unreachable:' || v_row.target_key, v_row.jurisdiction_code, 'source_unreachable', 'high',
        v_row.name || ' has not answered ' || v_row.consecutive_failures || ' checks in a row',
        jsonb_build_object('failureCode', v_row.failure_code, 'consecutiveFailures', v_row.consecutive_failures), 'monitoring_target', v_row.target_key);
      v_open := v_open || ('unreachable:' || v_row.target_key);
    end if;
  end loop;

  -- Knowledge lag: an upstream change after the source's last successful ingestion.
  for v_row in select t.target_key, t.jurisdiction_code, t.name, src.source_key, src.id as source_id, s.last_changed_at
    from private.glci_monitoring_targets t join private.glci_target_state s on s.target_id = t.id
    join private.legal_sources src on src.id = t.source_id
    where t.status = 'active' and s.last_changed_at is not null
      and coalesce((select max(r.finished_at) from private.legal_source_ingestion_runs r where r.source_id = t.source_id
        and r.status in ('succeeded', 'partial')), '-infinity') < s.last_changed_at loop
    v_issue := private.glci_open_issue('lag:' || v_row.target_key, v_row.jurisdiction_code, 'knowledge_lag', 'high',
      v_row.name || ' changed and Njumeni has not ingested it yet', jsonb_build_object('changedAt', v_row.last_changed_at, 'sourceKey', v_row.source_key),
      'monitoring_target', v_row.target_key);
    perform private.glci_propose(v_issue, 'resync_source', jsonb_build_object('sourceKey', v_row.source_key),
      'The official source changed on ' || v_row.last_changed_at::date || '. Re-synchronise it so research uses the current text.');
    v_open := v_open || ('lag:' || v_row.target_key);
  end loop;

  -- Legal changes awaiting review, with their impact.
  for v_row in select e.id, e.jurisdiction_code, e.change_type, a.citation, a.title, e.effective_date, e.commencement_status,
      (select count(*) from private.glci_change_impacts i where i.event_id = e.id and i.severity = 'high') as high_impacts,
      (select count(*) from private.glci_change_impacts i where i.event_id = e.id and i.impact_type = 'research_run') as runs
    from private.glci_change_events e join private.legal_authorities a on a.id = e.authority_id
    where not e.is_baseline and e.change_type in ('amended', 'withdrawn') and e.review_status in ('detected', 'assessed') loop
    v_issue := private.glci_open_issue('change:' || v_row.id, v_row.jurisdiction_code, 'legal_change_review',
      case when v_row.high_impacts > 0 then 'high' else 'medium' end,
      initcap(v_row.change_type) || ': ' || coalesce(v_row.citation, v_row.title),
      jsonb_build_object('changeEventId', v_row.id, 'effectiveDate', v_row.effective_date, 'commencementStatus', v_row.commencement_status,
        'highImpacts', v_row.high_impacts, 'researchRuns', v_row.runs), 'change_event', v_row.id::text);
    perform private.glci_propose(v_issue, 'review_change', jsonb_build_object('changeEventId', v_row.id),
      'A ' || v_row.change_type || ' change was detected. An operator confirms it (or dismisses a false positive).');
    if v_row.runs > 0 then
      perform private.glci_propose(v_issue, 'notify_affected', jsonb_build_object('changeEventId', v_row.id),
        v_row.runs || ' research run(s) relied on the changed text. Notify the affected workspaces so they re-verify.');
    end if;
    v_open := v_open || ('change:' || v_row.id);
  end loop;

  -- Conditions that cleared resolve their issues.
  with cleared as (
    update private.glci_issues set status = 'resolved', resolved_at = now(), updated_at = now(),
      resolution_note = coalesce(resolution_note, 'The condition cleared.')
    where status in ('open', 'in_progress') and kind <> 'engineering_request' and not (issue_key = any (v_open)) returning id)
  select count(*) into v_resolved from cleared;
  if v_resolved > 0 then
    perform private.glci_audit('issue.auto_resolved', 'glci_issue', null, jsonb_build_object('count', v_resolved), 'system');
  end if;
  return jsonb_build_object('openConditions', cardinality(v_open), 'resolved', v_resolved);
end;
$$;

