-- Phase 5: AI reasoning and agent framework (Master Plan v2.0 §5, Module F, §8.1; upgrades U-13,
-- U-23). Provider-independent: the database knows providers, agents, workspace AI policy and
-- budgets, and authorises every model call before it happens. Agents can never act outside the
-- caller's permissions. Agent output is a *proposal* until an authorised human accepts it.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Providers and agents
-- ---------------------------------------------------------------------------------------------
create table private.ai_providers (
  provider_key text primary key check (provider_key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  kind text not null check (kind in ('mock', 'commercial_api', 'self_hosted')),
  display_name text not null,
  no_training_terms boolean not null,
  zero_data_retention boolean not null,
  status text not null default 'disabled' check (status in ('enabled', 'disabled')),
  cost_per_million_input_usd numeric(10, 4) not null default 0,
  cost_per_million_output_usd numeric(10, 4) not null default 0
);
insert into private.ai_providers (provider_key, kind, display_name, no_training_terms, zero_data_retention, status,
  cost_per_million_input_usd, cost_per_million_output_usd) values
  ('mock', 'mock', 'Deterministic mock (no network, no cost)', true, true, 'enabled', 0, 0),
  ('anthropic', 'commercial_api', 'Anthropic Claude API', true, false, 'disabled', 4, 20),
  ('self-hosted', 'self_hosted', 'Self-hosted model', true, true, 'disabled', 0, 0);

create table private.ai_agents (
  agent_key text primary key check (agent_key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  display_name text not null,
  responsibility text not null,
  autonomy text not null check (autonomy in ('A0', 'A1', 'A2')),
  required_permission text not null,
  allowed_tools text[] not null default '{}'::text[],
  delivery_phase integer not null,
  version text not null default '1.0.0'
);
insert into private.ai_agents (agent_key, display_name, responsibility, autonomy, required_permission, allowed_tools, delivery_phase) values
  ('intake', 'Intake Agent', 'Understand legal questions and collect facts', 'A1', 'research.create', '{}', 5),
  ('jurisdiction', 'Jurisdiction Agent', 'Determine applicable legal system', 'A1', 'research.create', '{research.search}', 4),
  ('research', 'Research Agent', 'Discover legal sources', 'A2', 'research.create', '{research.search}', 4),
  ('retrieval', 'Retrieval Agent', 'Retrieve relevant authorities', 'A2', 'research.create', '{research.search}', 4),
  ('case-law', 'Case Law Agent', 'Analyse judicial decisions', 'A1', 'research.create', '{research.search}', 5),
  ('legislation', 'Legislation Agent', 'Analyse statutory material', 'A1', 'research.create', '{research.search}', 5),
  ('evidence', 'Evidence Agent', 'Extract and organise evidence', 'A2', 'evidence.manage', '{evidence.read}', 3),
  ('chronology', 'Chronology Agent', 'Reconstruct events', 'A2', 'evidence.manage', '{evidence.read}', 3),
  ('contradiction', 'Contradiction Agent', 'Identify inconsistencies', 'A1', 'evidence.manage', '{evidence.read}', 3),
  ('issue', 'Issue Agent', 'Identify legal questions', 'A1', 'argument.manage', '{research.read,evidence.read}', 5),
  ('reasoning', 'Reasoning Agent', 'Build legal arguments', 'A1', 'argument.manage', '{research.read,evidence.read,argument.propose}', 5),
  ('counterargument', 'Counterargument Agent', 'Test opposing positions', 'A1', 'argument.manage', '{research.read,evidence.read,argument.propose}', 5),
  ('drafting', 'Drafting Agent', 'Prepare legal documents', 'A1', 'draft.create', '{research.read,evidence.read}', 7),
  ('citation', 'Citation Agent', 'Verify citations', 'A0', 'research.create', '{research.verify}', 4),
  ('currency', 'Currency Agent', 'Check whether authorities are current', 'A0', 'research.create', '{research.search}', 6),
  ('compliance', 'Compliance Agent', 'Map obligations and requirements', 'A1', 'research.create', '{research.search}', 10),
  ('translation', 'Translation Agent', 'Translate legal material', 'A1', 'research.read', '{}', 12),
  ('quality', 'Quality Agent', 'Review accuracy and completeness', 'A2', 'research.read', '{research.read}', 6),
  ('safety', 'Safety Agent', 'Enforce boundaries and identify inappropriate use', 'A0', 'research.read', '{}', 5);

-- ---------------------------------------------------------------------------------------------
-- 2. Workspace AI policy (most restrictive by default) and execution records
-- ---------------------------------------------------------------------------------------------
create table private.workspace_ai_settings (
  workspace_id uuid primary key,
  organization_id uuid not null,
  allowed_providers text[] not null default '{mock}'::text[],
  -- Data classes that may leave Njumeni for a provider. Confidential evidence and privileged
  -- material are never sent to a provider unless the workspace explicitly allows it.
  allowed_egress text[] not null default '{public_legal}'::text[] check (
    allowed_egress <@ array['public_legal', 'user_narrative', 'confidential_evidence', 'privileged']),
  monthly_token_budget bigint not null default 0 check (monthly_token_budget >= 0),
  updated_by uuid references private.principals (id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict
);
alter table private.workspace_ai_settings enable row level security;
revoke all on private.workspace_ai_settings from public, anon, authenticated;

create table private.ai_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  agent_key text not null references private.ai_agents (agent_key),
  agent_version text not null,
  provider_key text not null references private.ai_providers (provider_key),
  model_id text not null check (char_length(model_id) between 1 and 120),
  prompt_version text not null check (char_length(prompt_version) between 1 and 40),
  egress_classes text[] not null default '{}'::text[],
  input_refs jsonb not null default '{}'::jsonb check (jsonb_typeof(input_refs) = 'object'),
  retrieval_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(retrieval_refs) = 'array'),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  status text not null check (status in ('succeeded', 'refused', 'failed')),
  refusal_reason text check (refusal_reason is null or refusal_reason ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  safety_flags text[] not null default '{}'::text[],
  verification_outcome text,
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict
);
create index ai_executions_workspace_month_idx on private.ai_executions (workspace_id, created_at desc);
alter table private.ai_executions enable row level security;
revoke all on private.ai_executions from public, anon, authenticated;
create trigger ai_executions_immutable before update or delete on private.ai_executions
  for each row execute function private.reject_append_only_mutation();

revoke all on private.ai_providers, private.ai_agents from public, anon, authenticated;
alter table private.ai_providers enable row level security;
alter table private.ai_agents enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 3. Argument graph (Module F, §8.1): explicit data, never only prose
-- ---------------------------------------------------------------------------------------------
create table private.legal_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  research_run_id uuid references private.research_runs (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 500),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id) on delete restrict
);

create table private.argument_nodes (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references private.legal_issues (id) on delete restrict,
  node_type text not null check (node_type in ('legal_issue', 'legal_question', 'applicable_rule',
    'statutory_provision', 'judicial_interpretation', 'fact', 'evidence', 'claim', 'argument',
    'counterargument', 'exception', 'defence', 'procedural_requirement', 'remedy', 'conclusion')),
  label text not null check (char_length(btrim(label)) between 1 and 2000),
  authority_passage_id uuid references private.legal_authority_passages (id) on delete restrict,
  evidence_item_id uuid references private.evidence_items (id) on delete restrict,
  evidence_passage_id uuid references private.evidence_passages (id) on delete restrict,
  proposition_id uuid references private.factual_propositions (id) on delete restrict,
  is_assumption boolean not null default false,
  origin text not null check (origin in ('human', 'agent')),
  ai_execution_id uuid references private.ai_executions (id) on delete restrict,
  review_status text not null check (review_status in ('proposed', 'accepted', 'rejected')),
  reviewed_by uuid references private.principals (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Law nodes must cite an authority passage; fact/evidence nodes must cite evidence or be an assumption.
  check (node_type not in ('applicable_rule', 'statutory_provision', 'judicial_interpretation')
    or authority_passage_id is not null),
  check (node_type not in ('fact', 'evidence')
    or evidence_item_id is not null or proposition_id is not null or is_assumption),
  check ((origin = 'agent') = (ai_execution_id is not null)),
  check (origin = 'agent' or review_status = 'accepted')
);
create index argument_nodes_issue_idx on private.argument_nodes (issue_id);

create table private.argument_edges (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references private.legal_issues (id) on delete restrict,
  from_node_id uuid not null references private.argument_nodes (id) on delete restrict,
  to_node_id uuid not null references private.argument_nodes (id) on delete restrict,
  edge_type text not null check (edge_type in ('raises', 'governed_by', 'interpreted_by', 'supports',
    'contradicts', 'qualifies', 'argues_for', 'argues_against', 'rebuts', 'excepts', 'requires',
    'yields', 'distinguishes')),
  origin text not null check (origin in ('human', 'agent')),
  ai_execution_id uuid references private.ai_executions (id) on delete restrict,
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_node_id <> to_node_id),
  unique (from_node_id, to_node_id, edge_type)
);

do $tables$
declare v_table text;
begin
  foreach v_table in array array['legal_issues', 'argument_nodes', 'argument_edges'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
  end loop;
end;
$tables$;
create trigger legal_issues_immutable before update or delete on private.legal_issues
  for each row execute function private.reject_append_only_mutation();
create trigger argument_edges_immutable before update or delete on private.argument_edges
  for each row execute function private.reject_append_only_mutation();

-- Nodes are append-only except for the one human review decision on an agent proposal.
create or replace function private.guard_argument_node_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.review_status = 'proposed' and new.review_status in ('accepted', 'rejected')
    and new.reviewed_by is not null and new.reviewed_at is not null
    and (to_jsonb(new) - 'review_status' - 'reviewed_by' - 'reviewed_at')
      = (to_jsonb(old) - 'review_status' - 'reviewed_by' - 'reviewed_at') then
    return new;
  end if;
  raise exception 'Argument nodes are append-only; only a pending proposal can be reviewed' using errcode = '55000';
end;
$$;
revoke all on function private.guard_argument_node_mutation() from public, anon, authenticated;
create trigger argument_nodes_guard before update or delete on private.argument_nodes
  for each row execute function private.guard_argument_node_mutation();

-- ---------------------------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_ai_scope(p_organization_id uuid, p_workspace_id uuid, p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_organization_id is null or p_workspace_id is null
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or private.current_principal_id() is null
    or not private.has_permission(p_permission, p_organization_id, p_workspace_id) then
    raise exception 'AI_NOT_AUTHORISED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_ai_scope(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.ai_get_workspace_settings(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_settings private.workspace_ai_settings;
  v_used bigint;
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'workspace.read');
  select * into v_settings from private.workspace_ai_settings where workspace_id = p_workspace_id;
  select coalesce(sum(input_tokens + output_tokens), 0) into v_used from private.ai_executions
  where workspace_id = p_workspace_id and status = 'succeeded' and created_at >= date_trunc('month', now());
  return jsonb_build_object(
    'allowedProviders', to_jsonb(coalesce(v_settings.allowed_providers, '{mock}'::text[])),
    'allowedEgress', to_jsonb(coalesce(v_settings.allowed_egress, '{public_legal}'::text[])),
    'monthlyTokenBudget', coalesce(v_settings.monthly_token_budget, 0),
    'tokensUsedThisMonth', v_used,
    'providers', (select jsonb_agg(jsonb_build_object('key', provider_key, 'name', display_name, 'status', status,
      'noTrainingTerms', no_training_terms, 'zeroDataRetention', zero_data_retention) order by provider_key)
      from private.ai_providers));
end;
$$;

create or replace function public.ai_update_workspace_settings(
  p_organization_id uuid, p_workspace_id uuid, p_allowed_providers text[], p_allowed_egress text[],
  p_monthly_token_budget bigint
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'workspace.update');
  if exists (select 1 from unnest(coalesce(p_allowed_providers, '{}')) p
             where p not in (select provider_key from private.ai_providers)) then
    raise exception 'AI_PROVIDER_UNKNOWN' using errcode = '22023';
  end if;
  insert into private.workspace_ai_settings (workspace_id, organization_id, allowed_providers, allowed_egress,
    monthly_token_budget, updated_by, updated_at)
  values (p_workspace_id, p_organization_id, coalesce(p_allowed_providers, '{mock}'), coalesce(p_allowed_egress, '{public_legal}'),
    coalesce(p_monthly_token_budget, 0), private.current_principal_id(), now())
  on conflict (workspace_id) do update set allowed_providers = excluded.allowed_providers,
    allowed_egress = excluded.allowed_egress, monthly_token_budget = excluded.monthly_token_budget,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'ai.settings_updated', 'workspace',
    p_workspace_id, jsonb_build_object('providers', to_jsonb(p_allowed_providers), 'egress', to_jsonb(p_allowed_egress)));
end;
$$;

-- Authorises one model call. Returns {allowed, reason}. Never raises for policy refusals so the
-- caller can record the refusal; raises only for unauthorised callers.
create or replace function public.ai_authorise_execution(
  p_organization_id uuid, p_workspace_id uuid, p_agent_key text, p_provider_key text,
  p_egress_classes text[], p_estimated_tokens integer
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_agent private.ai_agents;
  v_provider private.ai_providers;
  v_settings private.workspace_ai_settings;
  v_allowed_providers text[];
  v_allowed_egress text[];
  v_budget bigint;
  v_used bigint;
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'research.read');
  select * into v_agent from private.ai_agents where agent_key = p_agent_key;
  if v_agent.agent_key is null then
    return jsonb_build_object('allowed', false, 'reason', 'AI_AGENT_UNKNOWN');
  end if;
  -- The agent can never do more than the caller: the caller must hold the agent's permission.
  if not private.has_permission(v_agent.required_permission, p_organization_id, p_workspace_id) then
    return jsonb_build_object('allowed', false, 'reason', 'AI_AGENT_EXCEEDS_CALLER_PERMISSION');
  end if;
  select * into v_provider from private.ai_providers where provider_key = p_provider_key;
  if v_provider.provider_key is null or v_provider.status <> 'enabled' then
    return jsonb_build_object('allowed', false, 'reason', 'AI_PROVIDER_NOT_ENABLED');
  end if;
  if not v_provider.no_training_terms then
    return jsonb_build_object('allowed', false, 'reason', 'AI_PROVIDER_TRAINS_ON_DATA');
  end if;
  select * into v_settings from private.workspace_ai_settings where workspace_id = p_workspace_id;
  v_allowed_providers := coalesce(v_settings.allowed_providers, '{mock}');
  v_allowed_egress := coalesce(v_settings.allowed_egress, '{public_legal}');
  v_budget := coalesce(v_settings.monthly_token_budget, 0);
  if not (p_provider_key = any(v_allowed_providers)) then
    return jsonb_build_object('allowed', false, 'reason', 'AI_PROVIDER_NOT_ALLOWED_FOR_WORKSPACE');
  end if;
  -- Egress applies to providers that leave Njumeni's infrastructure.
  if v_provider.kind = 'commercial_api' and not (coalesce(p_egress_classes, '{}') <@ v_allowed_egress) then
    return jsonb_build_object('allowed', false, 'reason', 'AI_EGRESS_NOT_PERMITTED');
  end if;
  if v_provider.kind <> 'mock' then
    select coalesce(sum(input_tokens + output_tokens), 0) into v_used from private.ai_executions
    where workspace_id = p_workspace_id and status = 'succeeded' and created_at >= date_trunc('month', now());
    if v_used + greatest(coalesce(p_estimated_tokens, 0), 0) > v_budget then
      return jsonb_build_object('allowed', false, 'reason', 'AI_BUDGET_EXCEEDED');
    end if;
  end if;
  return jsonb_build_object('allowed', true, 'reason', null, 'agentVersion', v_agent.version,
    'autonomy', v_agent.autonomy);
end;
$$;

create or replace function public.ai_record_execution(
  p_organization_id uuid, p_workspace_id uuid, p_agent_key text, p_provider_key text, p_model_id text,
  p_prompt_version text, p_egress_classes text[], p_input_refs jsonb, p_retrieval_refs jsonb,
  p_input_tokens integer, p_output_tokens integer, p_duration_ms integer, p_status text,
  p_refusal_reason text, p_safety_flags text[], p_verification_outcome text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_provider private.ai_providers;
  v_id uuid;
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'research.read');
  select * into v_provider from private.ai_providers where provider_key = p_provider_key;
  if v_provider.provider_key is null then
    raise exception 'AI_PROVIDER_UNKNOWN' using errcode = '22023';
  end if;
  insert into private.ai_executions (organization_id, workspace_id, agent_key, agent_version, provider_key, model_id,
    prompt_version, egress_classes, input_refs, retrieval_refs, input_tokens, output_tokens, estimated_cost_usd,
    duration_ms, status, refusal_reason, safety_flags, verification_outcome, created_by)
  select p_organization_id, p_workspace_id, a.agent_key, a.version, p_provider_key, p_model_id, p_prompt_version,
    coalesce(p_egress_classes, '{}'), coalesce(p_input_refs, '{}'), coalesce(p_retrieval_refs, '[]'),
    greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0),
    (greatest(coalesce(p_input_tokens, 0), 0) * v_provider.cost_per_million_input_usd
      + greatest(coalesce(p_output_tokens, 0), 0) * v_provider.cost_per_million_output_usd) / 1000000.0,
    greatest(coalesce(p_duration_ms, 0), 0), p_status, p_refusal_reason, coalesce(p_safety_flags, '{}'),
    p_verification_outcome, private.current_principal_id()
  from private.ai_agents a where a.agent_key = p_agent_key
  returning id into v_id;
  if v_id is null then
    raise exception 'AI_AGENT_UNKNOWN' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

create or replace function public.argument_create_issue(
  p_organization_id uuid, p_workspace_id uuid, p_title text, p_research_run_id uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'argument.manage');
  if p_research_run_id is not null and not exists (select 1 from private.research_runs
    where id = p_research_run_id and workspace_id = p_workspace_id and organization_id = p_organization_id) then
    raise exception 'AI_NOT_AUTHORISED' using errcode = '42501';
  end if;
  insert into private.legal_issues (organization_id, workspace_id, research_run_id, title, created_by)
  values (p_organization_id, p_workspace_id, p_research_run_id, btrim(p_title), private.current_principal_id())
  returning id into v_id;
  return v_id;
end;
$$;

-- Adds nodes and edges for one issue in one call. Nodes reference each other by client keys.
-- Agent proposals must carry the execution that produced them; they are stored as 'proposed'.
create or replace function public.argument_add_graph(p_issue_id uuid, p_nodes jsonb, p_edges jsonb, p_ai_execution_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_issue private.legal_issues;
  v_node jsonb;
  v_edge jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_id uuid;
  v_origin text := case when p_ai_execution_id is null then 'human' else 'agent' end;
  v_count_nodes integer := 0;
  v_count_edges integer := 0;
begin
  select * into v_issue from private.legal_issues where id = p_issue_id;
  if not found then raise exception 'AI_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_ai_scope(v_issue.organization_id, v_issue.workspace_id, 'argument.manage');
  if p_ai_execution_id is not null and not exists (select 1 from private.ai_executions
    where id = p_ai_execution_id and workspace_id = v_issue.workspace_id and status = 'succeeded') then
    raise exception 'AI_EXECUTION_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_nodes, '[]')) <> 'array' or jsonb_typeof(coalesce(p_edges, '[]')) <> 'array'
    or jsonb_array_length(coalesce(p_nodes, '[]')) > 200 or jsonb_array_length(coalesce(p_edges, '[]')) > 400 then
    raise exception 'ARGUMENT_PAYLOAD_INVALID' using errcode = '22023';
  end if;
  for v_node in select value from jsonb_array_elements(coalesce(p_nodes, '[]')) loop
    -- Referenced evidence must be in the same workspace; propositions likewise.
    if v_node ? 'evidence_item_id' and not exists (select 1 from private.evidence_items
      where id = (v_node ->> 'evidence_item_id')::uuid and workspace_id = v_issue.workspace_id and status = 'active') then
      raise exception 'ARGUMENT_EVIDENCE_OUT_OF_SCOPE' using errcode = '42501';
    end if;
    if v_node ? 'proposition_id' and not exists (select 1 from private.factual_propositions
      where id = (v_node ->> 'proposition_id')::uuid and workspace_id = v_issue.workspace_id) then
      raise exception 'ARGUMENT_EVIDENCE_OUT_OF_SCOPE' using errcode = '42501';
    end if;
    insert into private.argument_nodes (issue_id, node_type, label, authority_passage_id, evidence_item_id,
      evidence_passage_id, proposition_id, is_assumption, origin, ai_execution_id, review_status, created_by)
    values (p_issue_id, v_node ->> 'node_type', v_node ->> 'label', nullif(v_node ->> 'authority_passage_id', '')::uuid,
      nullif(v_node ->> 'evidence_item_id', '')::uuid, nullif(v_node ->> 'evidence_passage_id', '')::uuid,
      nullif(v_node ->> 'proposition_id', '')::uuid, coalesce((v_node ->> 'is_assumption')::boolean, false),
      v_origin, p_ai_execution_id, case when v_origin = 'agent' then 'proposed' else 'accepted' end,
      private.current_principal_id())
    returning id into v_id;
    v_ids := v_ids || jsonb_build_object(v_node ->> 'key', v_id);
    v_count_nodes := v_count_nodes + 1;
  end loop;
  for v_edge in select value from jsonb_array_elements(coalesce(p_edges, '[]')) loop
    insert into private.argument_edges (issue_id, from_node_id, to_node_id, edge_type, origin, ai_execution_id, created_by)
    select p_issue_id, f.id, t.id, v_edge ->> 'edge_type', v_origin, p_ai_execution_id, private.current_principal_id()
    from private.argument_nodes f, private.argument_nodes t
    where f.id = coalesce((v_ids ->> (v_edge ->> 'from'))::uuid, nullif(v_edge ->> 'from_node_id', '')::uuid)
      and t.id = coalesce((v_ids ->> (v_edge ->> 'to'))::uuid, nullif(v_edge ->> 'to_node_id', '')::uuid)
      and f.issue_id = p_issue_id and t.issue_id = p_issue_id
    on conflict do nothing;
    v_count_edges := v_count_edges + 1;
  end loop;
  return jsonb_build_object('nodes', v_count_nodes, 'edges', v_count_edges, 'keys', v_ids);
end;
$$;

create or replace function public.argument_review_node(p_node_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_issue private.legal_issues;
begin
  select i.* into v_issue from private.legal_issues i join private.argument_nodes n on n.issue_id = i.id where n.id = p_node_id;
  if v_issue.id is null then raise exception 'AI_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_ai_scope(v_issue.organization_id, v_issue.workspace_id, 'argument.manage');
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'ARGUMENT_DECISION_INVALID' using errcode = '22023';
  end if;
  update private.argument_nodes set review_status = p_decision, reviewed_by = private.current_principal_id(), reviewed_at = now()
  where id = p_node_id;
end;
$$;

create or replace function public.argument_get_graph(p_issue_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_issue private.legal_issues;
begin
  select * into v_issue from private.legal_issues where id = p_issue_id;
  if not found then raise exception 'AI_NOT_AUTHORISED' using errcode = '42501'; end if;
  perform private.require_ai_scope(v_issue.organization_id, v_issue.workspace_id, 'research.read');
  return jsonb_build_object(
    'id', v_issue.id, 'title', v_issue.title, 'researchRunId', v_issue.research_run_id, 'createdAt', v_issue.created_at,
    'nodes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nodeType', n.node_type, 'label', n.label,
      'origin', n.origin, 'reviewStatus', n.review_status, 'isAssumption', n.is_assumption,
      'authorityPassageId', n.authority_passage_id, 'authorityCitation', a.citation,
      'evidenceItemId', n.evidence_item_id, 'evidenceTitle', e.title, 'propositionId', n.proposition_id)
      order by n.created_at, n.id)
      from private.argument_nodes n
      left join private.legal_authority_passages p on p.id = n.authority_passage_id
      left join private.legal_authority_versions v on v.id = p.authority_version_id
      left join private.legal_authorities a on a.id = v.authority_id
      left join private.evidence_items e on e.id = n.evidence_item_id
      where n.issue_id = v_issue.id), '[]'::jsonb),
    'edges', coalesce((select jsonb_agg(jsonb_build_object('from', ed.from_node_id, 'to', ed.to_node_id,
      'edgeType', ed.edge_type, 'origin', ed.origin) order by ed.created_at, ed.id)
      from private.argument_edges ed where ed.issue_id = v_issue.id), '[]'::jsonb));
end;
$$;

create or replace function public.argument_list_issues(p_organization_id uuid, p_workspace_id uuid)
returns table (issue_id uuid, title text, research_run_id uuid, node_count bigint, proposed_count bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'research.read');
  return query
  select i.id, i.title, i.research_run_id,
    (select count(*) from private.argument_nodes n where n.issue_id = i.id),
    (select count(*) from private.argument_nodes n where n.issue_id = i.id and n.review_status = 'proposed'),
    i.created_at
  from private.legal_issues i
  where i.organization_id = p_organization_id and i.workspace_id = p_workspace_id
  order by i.created_at desc limit 100;
end;
$$;

-- Factual propositions with their evidence links, for reasoning over a workspace.
create or replace function public.evidence_list_propositions(p_organization_id uuid, p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'document.read');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'statement', p.statement, 'status', p.status,
      'links', coalesce((select jsonb_agg(jsonb_build_object('evidenceItemId', l.evidence_item_id,
        'evidenceTitle', i.title, 'passageId', l.passage_id, 'relation', l.relation) order by l.created_at)
        from private.evidence_proposition_links l join private.evidence_items i on i.id = l.evidence_item_id
        where l.proposition_id = p.id and i.status = 'active'), '[]'::jsonb)) order by p.created_at)
    from private.factual_propositions p
    where p.organization_id = p_organization_id and p.workspace_id = p_workspace_id and p.status <> 'withdrawn'),
    '[]'::jsonb);
end;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.ai_get_workspace_settings(uuid, uuid)',
    'public.evidence_list_propositions(uuid, uuid)',
    'public.ai_update_workspace_settings(uuid, uuid, text[], text[], bigint)',
    'public.ai_authorise_execution(uuid, uuid, text, text, text[], integer)',
    'public.ai_record_execution(uuid, uuid, text, text, text, text, text[], jsonb, jsonb, integer, integer, integer, text, text, text[], text)',
    'public.argument_create_issue(uuid, uuid, text, uuid)',
    'public.argument_add_graph(uuid, jsonb, jsonb, uuid)',
    'public.argument_review_node(uuid, text)',
    'public.argument_get_graph(uuid)',
    'public.argument_list_issues(uuid, uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
