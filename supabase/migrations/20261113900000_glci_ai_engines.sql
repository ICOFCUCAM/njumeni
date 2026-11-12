-- GLCI-08: AI engines for the command centre, with an operator switch and fallback.
--
-- Engines (docs/GLCI_SPECIFICATION.md §5; owner decision 2026-11-12):
--   claude_code    the owner's Claude Code: a Claude Code routine on claude.ai, triggered through its
--                  documented API trigger. It runs on the owner's subscription with the repository and
--                  the Njumeni database. It answers asynchronously by calling glci_agent_reply.
--   anthropic_api  the Anthropic API with the server's API key (synchronous; budgeted).
--   rules          Njumeni's deterministic engine (always available; answers from live data only).
-- The switch (private.glci_ai_settings) selects the primary engine; with fallback on, an engine
-- that is not configured, over budget or failing hands over to the next one: claude_code →
-- anthropic_api → rules. Secrets are never stored here: the API key and the routine token live in
-- the server environment. AI output is advisory: it changes nothing without the approval flows.

create table private.glci_ai_settings (
  id boolean primary key default true check (id),
  primary_engine text not null default 'claude_code' check (primary_engine in ('claude_code', 'anthropic_api', 'rules')),
  fallback_enabled boolean not null default true,
  anthropic_model text not null default 'claude-opus-5-5' check (anthropic_model ~ '^claude-[a-z0-9-]{3,60}$'),
  monthly_budget_usd numeric(10, 2) not null default 25 check (monthly_budget_usd between 0 and 100000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into private.glci_ai_settings (id) values (true) on conflict do nothing;
alter table private.glci_ai_settings enable row level security;
revoke all on private.glci_ai_settings from public, anon, authenticated;
grant select on private.glci_ai_settings to service_role;

create table private.glci_ai_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  engine text not null check (engine in ('claude_code', 'anthropic_api', 'rules')),
  model text check (model is null or char_length(model) <= 80),
  outcome text not null check (outcome in ('succeeded', 'dispatched', 'failed', 'refused', 'skipped')),
  reason text check (reason is null or reason ~ '^[A-Z0-9_]{1,80}$'),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  requested_by uuid,
  created_at timestamptz not null default now()
);
create index glci_ai_calls_month_idx on private.glci_ai_calls(engine, created_at desc);
create index glci_ai_calls_conversation_idx on private.glci_ai_calls(conversation_id);
alter table private.glci_ai_calls enable row level security;
revoke all on private.glci_ai_calls from public, anon, authenticated;
grant select on private.glci_ai_calls to service_role;
create trigger glci_ai_calls_append_only before update or delete on private.glci_ai_calls
  for each row execute function private.reject_append_only_mutation();

create table private.glci_agent_dispatches (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  question_sequence integer not null check (question_sequence > 0),
  engine text not null default 'claude_code' check (engine = 'claude_code'),
  status text not null default 'dispatched' check (status in ('dispatched', 'answered', 'failed')),
  session_url text check (session_url is null or (session_url ~ '^https://' and char_length(session_url) <= 2048)),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$'),
  requested_by uuid,
  dispatched_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (conversation_id, question_sequence)
);
create index glci_agent_dispatches_status_idx on private.glci_agent_dispatches(status, dispatched_at);
alter table private.glci_agent_dispatches enable row level security;
revoke all on private.glci_agent_dispatches from public, anon, authenticated;
grant select on private.glci_agent_dispatches to service_role;

-- ------------------------------------------------------------------ settings (operators)
create or replace function public.glci_ai_settings_get()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v private.glci_ai_settings;
begin
  perform private.glci_require_operator();
  select * into v from private.glci_ai_settings;
  return jsonb_build_object('primaryEngine', v.primary_engine, 'fallbackEnabled', v.fallback_enabled, 'anthropicModel', v.anthropic_model,
    'monthlyBudgetUsd', v.monthly_budget_usd, 'updatedAt', v.updated_at,
    'spentThisMonthUsd', (select coalesce(sum(cost_usd), 0) from private.glci_ai_calls where created_at >= date_trunc('month', now())),
    'callsThisMonth', (select jsonb_object_agg(engine, n) from (select engine, count(*) as n from private.glci_ai_calls
      where created_at >= date_trunc('month', now()) group by engine) c));
end;
$$;

create or replace function public.glci_ai_settings_set(p_primary_engine text, p_fallback_enabled boolean, p_anthropic_model text,
  p_monthly_budget_usd numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform private.glci_require_operator();
  if p_reason is null or char_length(btrim(p_reason)) < 5 then raise exception 'GLCI_REASON_REQUIRED' using errcode = '22023'; end if;
  select to_jsonb(s) - 'updated_by' - 'updated_at' - 'id' into v_before from private.glci_ai_settings s;
  update private.glci_ai_settings set primary_engine = p_primary_engine, fallback_enabled = p_fallback_enabled,
    anthropic_model = coalesce(p_anthropic_model, anthropic_model), monthly_budget_usd = coalesce(p_monthly_budget_usd, monthly_budget_usd),
    updated_by = private.current_principal_id(), updated_at = now();
  perform private.glci_audit('ai.settings_changed', 'glci_ai_settings', 'singleton',
    jsonb_build_object('before', v_before, 'after', (select to_jsonb(s) - 'updated_by' - 'updated_at' - 'id' from private.glci_ai_settings s),
      'reason', btrim(p_reason)));
  return public.glci_ai_settings_get();
end;
$$;

-- ------------------------------------------------------------------ calls and dispatches
create or replace function public.glci_ai_record_call(p_conversation_id uuid, p_engine text, p_model text, p_outcome text, p_reason text,
  p_input_tokens integer, p_output_tokens integer, p_cost_usd numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  insert into private.glci_ai_calls (conversation_id, engine, model, outcome, reason, input_tokens, output_tokens, cost_usd, requested_by)
  values (p_conversation_id, p_engine, p_model, p_outcome, p_reason, coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0),
    coalesce(p_cost_usd, 0), private.current_principal_id());
  if p_engine <> 'rules' then
    perform private.glci_audit('ai.' || p_outcome, 'command_conversation', p_conversation_id::text,
      jsonb_build_object('engine', p_engine, 'model', p_model, 'reason', p_reason, 'costUsd', p_cost_usd), 'ai_agent');
  end if;
end;
$$;

-- Recorded after the routine accepted the question; the id is the one sent to the routine.
create or replace function public.glci_agent_dispatch_create(p_dispatch_id uuid, p_conversation_id uuid, p_question_sequence integer,
  p_session_url text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  insert into private.glci_agent_dispatches (id, conversation_id, question_sequence, session_url, requested_by)
  values (p_dispatch_id, p_conversation_id, p_question_sequence, p_session_url, private.current_principal_id());
  return p_dispatch_id;
end;
$$;

-- The Claude Code routine answers here (through the Supabase connector, as the service role or the
-- database owner): the answer joins the operator's conversation, attributed to Claude Code.
create or replace function public.glci_agent_reply(p_dispatch_id uuid, p_content text, p_data jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_dispatch private.glci_agent_dispatches;
  v_seq integer;
begin
  select * into v_dispatch from private.glci_agent_dispatches where id = p_dispatch_id for update;
  if v_dispatch.id is null or v_dispatch.status <> 'dispatched' then
    raise exception 'GLCI_DISPATCH_NOT_OPEN' using errcode = '22023';
  end if;
  if p_content is null or char_length(btrim(p_content)) not between 1 and 20000 then
    raise exception 'GLCI_COMMAND_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_dispatch.conversation_id::text));
  select coalesce(max(sequence_number), 0) + 1 into v_seq from private.glci_command_messages where conversation_id = v_dispatch.conversation_id;
  insert into private.glci_command_messages (conversation_id, sequence_number, author_kind, content, intent, engine, data)
  values (v_dispatch.conversation_id, v_seq, 'assistant', btrim(p_content), 'agent_answer', 'claude-code',
    jsonb_build_object('dispatchId', p_dispatch_id, 'inReplyTo', v_dispatch.question_sequence) || coalesce(p_data, '{}'::jsonb));
  update private.glci_agent_dispatches set status = 'answered', answered_at = now() where id = p_dispatch_id;
  perform private.glci_audit('ai.claude_code_answered', 'command_conversation', v_dispatch.conversation_id::text,
    jsonb_build_object('dispatchId', p_dispatch_id, 'sequence', v_seq), 'engineering_agent');
  return v_seq;
end;
$$;

create or replace function public.glci_conversation_dispatches(p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.glci_require_operator();
  if exists (select 1 from private.glci_command_messages m where m.conversation_id = p_conversation_id and m.author_kind = 'operator'
      and m.author_principal_id is distinct from private.current_principal_id()) then
    raise exception 'GLCI_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'questionSequence', d.question_sequence, 'status', d.status,
      'sessionUrl', d.session_url, 'errorCode', d.error_code, 'dispatchedAt', d.dispatched_at, 'answeredAt', d.answered_at)
      order by d.question_sequence)
    from private.glci_agent_dispatches d where d.conversation_id = p_conversation_id), '[]'::jsonb);
end;
$$;

revoke all on function public.glci_agent_reply(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.glci_agent_reply(uuid, text, jsonb) to service_role;
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.glci_ai_settings_get()', 'public.glci_ai_settings_set(text, boolean, text, numeric, text)',
    'public.glci_ai_record_call(uuid, text, text, text, text, integer, integer, numeric)',
    'public.glci_agent_dispatch_create(uuid, uuid, integer, text)',
    'public.glci_conversation_dispatches(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
