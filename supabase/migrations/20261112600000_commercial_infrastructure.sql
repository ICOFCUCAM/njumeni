-- Phase 11: commercial infrastructure (Master Plan v2.0 §17, U-23).
-- Builds on the Phase 1 billing identity (plans, subscriptions, entitlements, usage ledger):
-- plan pricing and allowances, automatic usage metering, quota enforcement in the database,
-- AI credits and top-ups, immutable invoices, provider webhooks verified by the database (HMAC with
-- a stored secret, so the web app never holds a service-role key), and commercial analytics.
-- Billing never grants access to legal resources (Phase 1 rule) and never reads matter content.
-- Prices are the master plan's hypotheses, not established prices.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Plan catalogue: prices and allowances
-- ---------------------------------------------------------------------------------------------
alter table private.subscription_plans add column monthly_price_minor integer check (monthly_price_minor is null or monthly_price_minor >= 0);
alter table private.subscription_plans add column currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$');
alter table private.subscription_plans add column allow_overage boolean not null default false;
alter table private.subscription_plans add column display_order integer not null default 0;

update private.subscription_plans set monthly_price_minor = p.price, allow_overage = p.overage, display_order = p.ord
from (values ('free', 0, false, 1), ('personal', 1900, true, 2), ('personal_plus', 3900, true, 3),
  ('professional', 7900, true, 4), ('professional_plus', 14900, true, 5), ('law_firm', 29900, true, 6),
  ('enterprise', null::integer, true, 7), ('institutional', null::integer, true, 8)) p(key, price, overage, ord)
where plan_key = p.key;

create table private.plan_entitlements (
  plan_key text not null references private.subscription_plans (plan_key) on delete restrict,
  entitlement_key text not null check (entitlement_key in ('ai.credits.monthly', 'research.runs.monthly',
    'documents.generated.monthly', 'api.requests.monthly', 'seats', 'storage.gb')),
  limit_value bigint check (limit_value is null or limit_value >= 0),
  overage_price_minor numeric(12, 4) check (overage_price_minor is null or overage_price_minor >= 0),
  primary key (plan_key, entitlement_key)
);
alter table private.plan_entitlements enable row level security;
revoke all on private.plan_entitlements from public, anon, authenticated;

-- Allowances (null = contracted). 1 AI credit = USD 0.01 of provider cost.
insert into private.plan_entitlements (plan_key, entitlement_key, limit_value, overage_price_minor)
select p.plan, e.key, e.limits[p.idx], e.overage
from (values ('free', 1), ('personal', 2), ('personal_plus', 3), ('professional', 4), ('professional_plus', 5),
  ('law_firm', 6), ('enterprise', 7), ('institutional', 8)) p(plan, idx)
cross join (values
  ('ai.credits.monthly', array[50, 500, 1500, 4000, 10000, 25000, null, null]::bigint[], 2.0000),
  ('research.runs.monthly', array[30, 200, 600, 2000, 6000, 20000, null, null]::bigint[], 10.0000),
  ('documents.generated.monthly', array[5, 50, 150, 500, 1500, 5000, null, null]::bigint[], 50.0000),
  ('api.requests.monthly', array[100, 0, 0, 1000, 10000, 50000, null, null]::bigint[], 0.1000),
  ('seats', array[1, 1, 1, 1, 1, 10, null, null]::bigint[], null),
  ('storage.gb', array[1, 5, 20, 50, 200, 1000, null, null]::bigint[], null)) e(key, limits, overage);

-- ---------------------------------------------------------------------------------------------
-- 2. Effective plan, period, limits and usage
-- ---------------------------------------------------------------------------------------------
create or replace function private.billing_current(p_organization_id uuid)
returns table (subscription_id uuid, plan_key text, status text, period_start timestamptz, period_end timestamptz, allow_overage boolean)
language sql stable security definer set search_path = '' as $$
  with sub as (
    select s.id, s.plan_key, s.status, s.current_period_start, s.current_period_end
    from private.subscriptions s
    where s.organization_id = p_organization_id and s.status in ('trialing', 'active', 'past_due', 'paused')
      and (s.current_period_end is null or s.current_period_end > now())
    order by case s.status when 'active' then 1 when 'trialing' then 2 when 'past_due' then 3 else 4 end, s.updated_at desc
    limit 1
  )
  select sub.id, coalesce(sub.plan_key, 'free'), coalesce(sub.status, 'free'),
    coalesce(sub.current_period_start, date_trunc('month', now())),
    coalesce(sub.current_period_end, date_trunc('month', now()) + interval '1 month'),
    -- Overage is billed only on paid plans in good standing; otherwise limits are hard stops.
    coalesce((select allow_overage from private.subscription_plans where plan_key = sub.plan_key), false)
      and coalesce(sub.status, 'free') in ('active', 'trialing')
  from (select 1) one left join sub on true;
$$;
revoke all on function private.billing_current(uuid) from public, anon, authenticated;

create table private.credit_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  credits bigint not null check (credits > 0),
  source text not null check (source in ('top_up', 'adjustment')),
  provider_event_id text,
  note text check (note is null or char_length(note) <= 500),
  granted_by uuid references private.principals (id) on delete set null,
  granted_at timestamptz not null default clock_timestamp(),
  unique (organization_id, provider_event_id)
);
alter table private.credit_grants enable row level security;
revoke all on private.credit_grants from public, anon, authenticated;
create trigger credit_grants_append_only before update or delete on private.credit_grants
  for each row execute function private.reject_append_only_mutation();

-- Contracted entitlements on the subscription override plan defaults; AI top-ups granted in the
-- current period add to the AI allowance. Null means unlimited (contracted).
create or replace function private.entitlement_limit(p_organization_id uuid, p_key text)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_current record; v_limit bigint; v_found boolean := false;
begin
  select * into v_current from private.billing_current(p_organization_id);
  if v_current.subscription_id is not null then
    select e.limit_value, true into v_limit, v_found from private.subscription_entitlements e
    where e.subscription_id = v_current.subscription_id and e.entitlement_key = p_key and e.enabled
      and e.effective_from <= now() and (e.effective_until is null or e.effective_until > now())
    order by e.effective_from desc limit 1;
  end if;
  if not v_found then
    select limit_value into v_limit from private.plan_entitlements where plan_key = v_current.plan_key and entitlement_key = p_key;
  end if;
  if v_limit is not null and p_key = 'ai.credits.monthly' then
    v_limit := v_limit + coalesce((select sum(credits) from private.credit_grants where organization_id = p_organization_id
      and granted_at >= v_current.period_start and granted_at < v_current.period_end), 0);
  end if;
  return v_limit;
end;
$$;
revoke all on function private.entitlement_limit(uuid, text) from public, anon, authenticated;

create or replace function private.usage_key_for(p_entitlement text)
returns text language sql immutable set search_path = '' as $$
  select case p_entitlement when 'ai.credits.monthly' then 'ai.credits' when 'research.runs.monthly' then 'research.runs'
    when 'documents.generated.monthly' then 'documents.generated' when 'api.requests.monthly' then 'api.requests' end;
$$;
revoke all on function private.usage_key_for(text) from public, anon, authenticated;

create or replace function private.usage_in_period(p_organization_id uuid, p_entitlement text)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(u.quantity), 0) from private.usage_records u, private.billing_current(p_organization_id) c
  where u.organization_id = p_organization_id and u.usage_key = private.usage_key_for(p_entitlement)
    and u.occurred_at >= c.period_start and u.occurred_at < c.period_end;
$$;
revoke all on function private.usage_in_period(uuid, text) from public, anon, authenticated;

-- True when the quantity fits the allowance, or the plan bills overage.
create or replace function private.quota_allows(p_organization_id uuid, p_entitlement text, p_quantity numeric)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_limit bigint;
begin
  v_limit := private.entitlement_limit(p_organization_id, p_entitlement);
  if v_limit is null then return true; end if;
  if (select allow_overage from private.billing_current(p_organization_id)) then return true; end if;
  return private.usage_in_period(p_organization_id, p_entitlement) + coalesce(p_quantity, 0) <= v_limit;
end;
$$;
revoke all on function private.quota_allows(uuid, text, numeric) from public, anon, authenticated;

create or replace function private.meter(p_organization_id uuid, p_workspace_id uuid, p_key text, p_quantity numeric, p_unit text, p_idempotency text)
returns void language sql security definer set search_path = '' as $$
  insert into private.usage_records (organization_id, workspace_id, principal_id, usage_key, quantity, unit, idempotency_key)
  select p_organization_id, p_workspace_id, private.current_principal_id(), p_key, p_quantity, p_unit, p_idempotency
  where p_quantity > 0
  on conflict (organization_id, usage_key, idempotency_key) do nothing;
$$;
revoke all on function private.meter(uuid, uuid, text, numeric, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Metering and enforcement on the operations themselves
-- ---------------------------------------------------------------------------------------------
create or replace function private.meter_research_run()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    if not private.quota_allows(new.organization_id, 'research.runs.monthly', 1) then
      raise exception 'QUOTA_EXCEEDED: research runs' using errcode = '53400';
    end if;
    return new;
  end if;
  perform private.meter(new.organization_id, new.workspace_id, 'research.runs', 1, 'run', 'research-run:' || new.id);
  return new;
end;
$$;
revoke all on function private.meter_research_run() from public, anon, authenticated;
create trigger research_runs_quota before insert on private.research_runs for each row execute function private.meter_research_run();
create trigger research_runs_meter after insert on private.research_runs for each row execute function private.meter_research_run();

-- AI credits from the recorded provider cost (mock executions cost nothing and use no credits).
create or replace function private.meter_ai_execution()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'succeeded' and new.estimated_cost_usd > 0 then
    perform private.meter(new.organization_id, new.workspace_id, 'ai.credits', ceil(new.estimated_cost_usd * 100), 'credit',
      'ai-execution:' || new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.meter_ai_execution() from public, anon, authenticated;
create trigger ai_executions_meter after insert on private.ai_executions for each row execute function private.meter_ai_execution();

create or replace function private.meter_document_export()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_doc private.legal_documents;
begin
  if not new.final then return new; end if;
  select * into v_doc from private.legal_documents where id = new.document_id;
  if tg_when = 'BEFORE' then
    -- Re-exporting a version already generated is free.
    if not exists (select 1 from private.document_exports where document_id = new.document_id and version_number = new.version_number and final)
      and not private.quota_allows(v_doc.organization_id, 'documents.generated.monthly', 1) then
      raise exception 'QUOTA_EXCEEDED: generated documents' using errcode = '53400';
    end if;
    return new;
  end if;
  perform private.meter(v_doc.organization_id, v_doc.workspace_id, 'documents.generated', 1, 'document',
    'document:' || new.document_id || ':v' || new.version_number);
  return new;
end;
$$;
revoke all on function private.meter_document_export() from public, anon, authenticated;
create trigger document_exports_quota before insert on private.document_exports for each row execute function private.meter_document_export();
create trigger document_exports_meter after insert on private.document_exports for each row execute function private.meter_document_export();

-- API keys: each request is metered and capped (Phase 10 function, now metered).
create or replace function private.api_key_act_as(p_key text, p_scope text)
returns private.api_keys language plpgsql security definer set search_path = '' as $$
declare v_key private.api_keys; v_user uuid;
begin
  if p_key !~ '^njk_[0-9a-f]{8}_[0-9a-f]{48}$' then raise exception 'API_KEY_INVALID' using errcode = '28000'; end if;
  select * into v_key from private.api_keys where key_prefix = substr(p_key, 5, 8);
  if not found or v_key.key_hash <> encode(extensions.digest(p_key, 'sha256'), 'hex')
    or v_key.revoked_at is not null or v_key.expires_at <= now() then
    raise exception 'API_KEY_INVALID' using errcode = '28000';
  end if;
  if not (p_scope = any (v_key.scopes)) then raise exception 'API_KEY_SCOPE' using errcode = '42501'; end if;
  if not private.quota_allows(v_key.organization_id, 'api.requests.monthly', 1) then
    raise exception 'QUOTA_EXCEEDED: API requests' using errcode = '53400';
  end if;
  select auth_user_id into v_user from private.principal_identities where principal_id = v_key.created_by and provider = 'supabase' limit 1;
  if v_user is null then raise exception 'API_KEY_INVALID' using errcode = '28000'; end if;
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  update private.api_keys set last_used_at = now() where id = v_key.id;
  perform private.meter(v_key.organization_id, v_key.workspace_id, 'api.requests', 1, 'request', 'api:' || gen_random_uuid());
  return v_key;
end;
$$;
revoke all on function private.api_key_act_as(text, text) from public, anon, authenticated;

-- AI authorisation gains the plan's credit allowance (U-23): paid providers stop at the cap
-- unless the plan bills overage.
create or replace function public.ai_authorise_execution(
  p_organization_id uuid, p_workspace_id uuid, p_agent_key text, p_provider_key text,
  p_egress_classes text[], p_estimated_tokens integer
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_settings private.workspace_ai_settings; v_provider private.ai_providers; v_credits numeric;
begin
  perform private.require_ai_scope(p_organization_id, p_workspace_id, 'research.read');
  select * into v_settings from private.workspace_ai_settings where workspace_id = p_workspace_id;
  if v_settings.ai_risk_class = 'high_risk_justice' and v_settings.conformity_reference is null then
    return jsonb_build_object('allowed', false, 'reason', 'AI_CONFORMITY_REQUIRED');
  end if;
  select * into v_provider from private.ai_providers where provider_key = p_provider_key;
  if v_provider.kind is distinct from 'mock' then
    v_credits := ceil(greatest(coalesce(p_estimated_tokens, 0), 0) / 1000000.0
      * greatest(coalesce(v_provider.cost_per_million_input_usd, 0), coalesce(v_provider.cost_per_million_output_usd, 0)) * 100);
    if not private.quota_allows(p_organization_id, 'ai.credits.monthly', v_credits) then
      return jsonb_build_object('allowed', false, 'reason', 'AI_PLAN_QUOTA_EXCEEDED');
    end if;
  end if;
  return private.ai_authorise_execution_base(p_organization_id, p_workspace_id, p_agent_key, p_provider_key,
    p_egress_classes, p_estimated_tokens);
end;
$$;
revoke all on function public.ai_authorise_execution(uuid, uuid, text, text, text[], integer) from public, anon;
grant execute on function public.ai_authorise_execution(uuid, uuid, text, text, text[], integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Invoices
-- ---------------------------------------------------------------------------------------------
create table private.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  invoice_number text not null unique check (invoice_number ~ '^INV-\d{4}-\d{6}$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  plan_key text not null references private.subscription_plans (plan_key) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  tax_rate_percent numeric(5, 2) not null default 0 check (tax_rate_percent between 0 and 100),
  tax_minor bigint not null check (tax_minor >= 0),
  total_minor bigint not null check (total_minor = subtotal_minor + tax_minor),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  provider_reference text,
  check (period_end > period_start),
  unique (organization_id, period_start)
);
alter table private.invoices enable row level security;
revoke all on private.invoices from public, anon, authenticated;

-- Issued invoices are immutable; only open → paid or open → void is possible.
create or replace function private.guard_invoice_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Invoices are retained' using errcode = '55000'; end if;
  if old.status <> 'open' or new.status not in ('paid', 'void')
    or (new.id, new.organization_id, new.invoice_number, new.period_start, new.period_end, new.plan_key, new.currency,
        new.lines, new.subtotal_minor, new.tax_rate_percent, new.tax_minor, new.total_minor, new.issued_at)
       is distinct from (old.id, old.organization_id, old.invoice_number, old.period_start, old.period_end, old.plan_key,
        old.currency, old.lines, old.subtotal_minor, old.tax_rate_percent, old.tax_minor, old.total_minor, old.issued_at) then
    raise exception 'Issued invoices are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_invoice_update() from public, anon, authenticated;
create trigger invoices_guard before update or delete on private.invoices for each row execute function private.guard_invoice_update();

-- Invoice for a closed period: the plan fee plus overage beyond each allowance. Issued by
-- platform administrators (or the billing integration); amounts are in minor units.
create or replace function public.billing_generate_invoice(p_organization_id uuid, p_period_start timestamptz, p_period_end timestamptz,
  p_tax_rate_percent numeric default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_plan private.subscription_plans; v_sub record; v_lines jsonb := '[]'::jsonb; v_subtotal numeric := 0;
  v_entitlement record; v_used numeric; v_over numeric; v_amount numeric; v_number text; v_id uuid; v_tax bigint;
begin
  if not private.is_platform_operator('platform_admin') and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'BILLING_NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_period_end <= p_period_start or p_period_end > now() then
    raise exception 'BILLING_PERIOD_INVALID' using errcode = '22023';
  end if;
  select s.* into v_sub from private.subscriptions s where s.organization_id = p_organization_id
    and s.status in ('active', 'trialing', 'past_due') order by s.updated_at desc limit 1;
  select * into v_plan from private.subscription_plans where plan_key = coalesce(v_sub.plan_key, 'free');
  if coalesce(v_plan.monthly_price_minor, 0) > 0 then
    v_lines := v_lines || jsonb_build_object('description', v_plan.display_name || ' plan', 'quantity', 1,
      'unitMinor', v_plan.monthly_price_minor, 'amountMinor', v_plan.monthly_price_minor);
    v_subtotal := v_subtotal + v_plan.monthly_price_minor;
  end if;
  if v_plan.allow_overage then
    for v_entitlement in select * from private.plan_entitlements where plan_key = v_plan.plan_key
      and overage_price_minor is not null and limit_value is not null order by entitlement_key loop
      select coalesce(sum(quantity), 0) into v_used from private.usage_records where organization_id = p_organization_id
        and usage_key = private.usage_key_for(v_entitlement.entitlement_key)
        and occurred_at >= p_period_start and occurred_at < p_period_end;
      v_over := greatest(v_used - v_entitlement.limit_value
        - case when v_entitlement.entitlement_key = 'ai.credits.monthly' then coalesce((select sum(credits) from private.credit_grants
            where organization_id = p_organization_id and granted_at >= p_period_start and granted_at < p_period_end), 0) else 0 end, 0);
      if v_over > 0 then
        v_amount := round(v_over * v_entitlement.overage_price_minor);
        v_lines := v_lines || jsonb_build_object('description', 'Overage: ' || replace(v_entitlement.entitlement_key, '.monthly', ''),
          'quantity', v_over, 'unitMinor', v_entitlement.overage_price_minor, 'amountMinor', v_amount);
        v_subtotal := v_subtotal + v_amount;
      end if;
    end loop;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invoice-number', 0));
  select format('INV-%s-%s', to_char(now(), 'YYYY'), lpad((count(*) + 1)::text, 6, '0')) into v_number
  from private.invoices where invoice_number like 'INV-' || to_char(now(), 'YYYY') || '-%';
  v_tax := round(v_subtotal * coalesce(p_tax_rate_percent, 0) / 100);
  insert into private.invoices (organization_id, invoice_number, period_start, period_end, plan_key, currency, lines,
    subtotal_minor, tax_rate_percent, tax_minor, total_minor, status, paid_at)
  values (p_organization_id, v_number, p_period_start, p_period_end, v_plan.plan_key, v_plan.currency, v_lines,
    v_subtotal::bigint, coalesce(p_tax_rate_percent, 0), v_tax, v_subtotal::bigint + v_tax,
    case when v_subtotal = 0 then 'paid' else 'open' end, case when v_subtotal = 0 then now() end)
  returning id into v_id;
  perform private.record_evidence_audit(p_organization_id, null, 'billing.invoice_issued', 'invoice', v_id,
    jsonb_build_object('number', v_number, 'totalMinor', v_subtotal::bigint + v_tax));
  return v_id;
end;
$$;

create or replace function public.billing_invoice_get(p_invoice_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_invoice private.invoices;
begin
  select * into v_invoice from private.invoices where id = p_invoice_id;
  if not found or private.current_principal_id() is null
    or not (private.has_permission_roles('billing.read', v_invoice.organization_id, null) or private.is_platform_operator('platform_admin')) then
    raise exception 'BILLING_NOT_AUTHORISED' using errcode = '42501';
  end if;
  return jsonb_build_object('id', v_invoice.id, 'number', v_invoice.invoice_number,
    'organization', (select name from public.organizations where id = v_invoice.organization_id),
    'periodStart', v_invoice.period_start, 'periodEnd', v_invoice.period_end, 'plan', v_invoice.plan_key,
    'currency', v_invoice.currency, 'lines', v_invoice.lines, 'subtotalMinor', v_invoice.subtotal_minor,
    'taxRatePercent', v_invoice.tax_rate_percent, 'taxMinor', v_invoice.tax_minor, 'totalMinor', v_invoice.total_minor,
    'status', v_invoice.status, 'issuedAt', v_invoice.issued_at, 'paidAt', v_invoice.paid_at);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Organisation billing overview and public catalogue
-- ---------------------------------------------------------------------------------------------
create or replace function public.billing_overview(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_current record; v_plan private.subscription_plans;
begin
  if private.current_principal_id() is null or not private.has_permission_roles('billing.read', p_organization_id, null) then
    raise exception 'BILLING_NOT_AUTHORISED' using errcode = '42501';
  end if;
  select * into v_current from private.billing_current(p_organization_id);
  select * into v_plan from private.subscription_plans where plan_key = v_current.plan_key;
  return jsonb_build_object(
    'plan', jsonb_build_object('key', v_plan.plan_key, 'name', v_plan.display_name, 'priceMinor', v_plan.monthly_price_minor,
      'currency', v_plan.currency, 'status', v_current.status, 'overage', v_current.allow_overage),
    'periodStart', v_current.period_start, 'periodEnd', v_current.period_end,
    'meters', (select jsonb_agg(jsonb_build_object('key', k.key, 'used', private.usage_in_period(p_organization_id, k.key),
      'limit', private.entitlement_limit(p_organization_id, k.key)) order by k.ord)
      from (values ('ai.credits.monthly', 1), ('research.runs.monthly', 2), ('documents.generated.monthly', 3), ('api.requests.monthly', 4)) k(key, ord)),
    'seats', jsonb_build_object('used', 1 + (select count(*) from public.organization_memberships where organization_id = p_organization_id and status = 'active'),
      'limit', private.entitlement_limit(p_organization_id, 'seats')),
    'topUps', coalesce((select jsonb_agg(jsonb_build_object('credits', credits, 'source', source, 'at', granted_at) order by granted_at desc)
      from private.credit_grants where organization_id = p_organization_id), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'number', invoice_number, 'periodStart', period_start,
      'totalMinor', total_minor, 'currency', currency, 'status', status) order by issued_at desc)
      from private.invoices where organization_id = p_organization_id), '[]'::jsonb));
end;
$$;

create or replace function public.billing_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_agg(jsonb_build_object('key', p.plan_key, 'name', p.display_name, 'priceMinor', p.monthly_price_minor,
    'currency', p.currency, 'interval', p.billing_interval, 'overage', p.allow_overage,
    'allowances', (select jsonb_object_agg(e.entitlement_key, e.limit_value) from private.plan_entitlements e where e.plan_key = p.plan_key))
    order by p.display_order)
  from private.subscription_plans p where p.is_active;
$$;

-- Manual credit adjustments by platform administrators (refunds, goodwill), audited.
create or replace function public.billing_grant_credits(p_organization_id uuid, p_credits bigint, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_operator('platform_admin') then raise exception 'BILLING_NOT_AUTHORISED' using errcode = '42501'; end if;
  insert into private.credit_grants (organization_id, credits, source, note, granted_by)
  values (p_organization_id, p_credits, 'adjustment', btrim(p_note), private.current_principal_id());
  perform private.record_evidence_audit(p_organization_id, null, 'billing.credits_granted', 'organization', p_organization_id,
    jsonb_build_object('credits', p_credits));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Payment provider webhooks, verified by the database
-- ---------------------------------------------------------------------------------------------
create table private.billing_provider_settings (
  provider text primary key check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  webhook_secret text not null check (char_length(webhook_secret) >= 32),
  enabled boolean not null default false,
  tolerance_seconds integer not null default 300 check (tolerance_seconds between 30 and 3600)
);
alter table private.billing_provider_settings enable row level security;
revoke all on private.billing_provider_settings from public, anon, authenticated;

create or replace function private.provider_status(p_status text)
returns text language sql immutable set search_path = '' as $$
  select case p_status when 'canceled' then 'cancelled' when 'incomplete_expired' then 'expired' else p_status end;
$$;
revoke all on function private.provider_status(text) from public, anon, authenticated;

-- Accepts the raw request body and the signature header ("t=<unix>,v1=<hex hmac-sha256>" over
-- "<t>.<body>"), as sent by Stripe-compatible providers. Verifies the signature and freshness with
-- the provider secret stored here, deduplicates by event id, then applies the event. The web route
-- only relays bytes; it holds no secret and no privileged key.
create or replace function public.billing_webhook(p_provider text, p_payload text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_settings private.billing_provider_settings; v_t text; v_sig text; v_expected text; v_event jsonb; v_object jsonb;
  v_org uuid; v_inserted integer; v_outcome text := 'processed';
begin
  select * into v_settings from private.billing_provider_settings where provider = p_provider and enabled;
  if not found then raise exception 'BILLING_WEBHOOK_DISABLED' using errcode = '42501'; end if;
  v_t := substring(p_signature from 't=(\d{9,12})');
  v_sig := substring(p_signature from 'v1=([0-9a-f]{64})');
  if v_t is null or v_sig is null then raise exception 'BILLING_SIGNATURE_INVALID' using errcode = '28000'; end if;
  v_expected := encode(extensions.hmac(v_t || '.' || p_payload, v_settings.webhook_secret, 'sha256'), 'hex');
  if v_expected <> v_sig then raise exception 'BILLING_SIGNATURE_INVALID' using errcode = '28000'; end if;
  if abs(extract(epoch from now()) - v_t::bigint) > v_settings.tolerance_seconds then
    raise exception 'BILLING_SIGNATURE_EXPIRED' using errcode = '28000';
  end if;
  begin
    v_event := p_payload::jsonb;
  exception when others then
    raise exception 'BILLING_PAYLOAD_INVALID' using errcode = '22023';
  end;
  v_object := v_event #> '{data,object}';
  if coalesce(v_event ->> 'id', '') = '' or coalesce(v_event ->> 'type', '') = '' then
    raise exception 'BILLING_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  if v_event ->> 'type' in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then
    v_org := nullif(v_object #>> '{metadata,organization_id}', '')::uuid;
    if v_org is null or not exists (select 1 from public.organizations where id = v_org) then
      raise exception 'BILLING_ORGANIZATION_UNKNOWN' using errcode = '22023';
    end if;
    -- The verified provider is the trusted billing integration for the snapshot function.
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
    perform private.apply_subscription_snapshot(p_provider, v_event ->> 'id', v_event ->> 'type',
      v_object ->> 'customer', v_object ->> 'id', v_org, coalesce(v_object #>> '{metadata,plan_key}', 'free'),
      case when v_event ->> 'type' = 'customer.subscription.deleted' then 'cancelled' else private.provider_status(v_object ->> 'status') end,
      to_timestamp((v_object ->> 'current_period_start')::bigint), to_timestamp((v_object ->> 'current_period_end')::bigint),
      coalesce((v_object ->> 'cancel_at_period_end')::boolean, false),
      coalesce((select jsonb_agg(jsonb_build_object('key', entitlement_key)
          || case when limit_value is null then '{}'::jsonb else jsonb_build_object('limit', limit_value) end)
        from private.plan_entitlements where plan_key = coalesce(v_object #>> '{metadata,plan_key}', 'free')), '[]'::jsonb));
    perform set_config('request.jwt.claim.role', '', true);
    perform set_config('request.jwt.claims', '', true);
    return jsonb_build_object('received', true, 'outcome', 'processed');
  end if;

  insert into private.billing_provider_events (provider, provider_event_id, event_type)
  values (p_provider, v_event ->> 'id', v_event ->> 'type') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('received', true, 'outcome', 'duplicate'); end if;

  if v_event ->> 'type' = 'invoice.paid' then
    update private.invoices set status = 'paid', paid_at = now(), provider_reference = v_object ->> 'id'
    where invoice_number = v_object #>> '{metadata,njumeni_invoice_number}' and status = 'open';
    if not found then v_outcome := 'ignored'; end if;
  elsif v_event ->> 'type' = 'checkout.session.completed' and v_object #>> '{metadata,kind}' = 'credits' then
    v_org := nullif(v_object #>> '{metadata,organization_id}', '')::uuid;
    if v_org is null or not exists (select 1 from public.organizations where id = v_org)
      or coalesce((v_object #>> '{metadata,credits}')::bigint, 0) <= 0 then
      v_outcome := 'ignored';
    else
      insert into private.credit_grants (organization_id, credits, source, provider_event_id, note)
      values (v_org, (v_object #>> '{metadata,credits}')::bigint, 'top_up', v_event ->> 'id', 'Purchased credits')
      on conflict (organization_id, provider_event_id) do nothing;
      perform private.record_evidence_audit(v_org, null, 'billing.credits_purchased', 'organization', v_org,
        jsonb_build_object('credits', (v_object #>> '{metadata,credits}')::bigint));
    end if;
  else
    v_outcome := 'ignored';
  end if;
  update private.billing_provider_events set processed_at = now(), outcome = v_outcome
  where provider = p_provider and provider_event_id = v_event ->> 'id';
  return jsonb_build_object('received', true, 'outcome', v_outcome);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Commercial analytics (platform operators)
-- ---------------------------------------------------------------------------------------------
create or replace function public.platform_commercial_analytics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'BILLING_NOT_AUTHORISED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mrrMinor', (select coalesce(sum(p.monthly_price_minor), 0) from private.subscriptions s
      join private.subscription_plans p on p.plan_key = s.plan_key where s.status in ('active', 'past_due')),
    'subscriptionsByPlan', coalesce((select jsonb_object_agg(plan_key, n) from (select plan_key, count(*) n from private.subscriptions
      where status in ('active', 'trialing', 'past_due') group by plan_key) s), '{}'::jsonb),
    'subscriptionsByStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from private.subscriptions group by status) s), '{}'::jsonb),
    'usageThisMonth', coalesce((select jsonb_object_agg(usage_key, total) from (select usage_key, sum(quantity) total from private.usage_records
      where occurred_at >= date_trunc('month', now()) group by usage_key) u), '{}'::jsonb),
    'aiCostUsdThisMonth', (select coalesce(sum(estimated_cost_usd), 0) from private.ai_executions where created_at >= date_trunc('month', now())),
    'invoicedMinorThisYear', (select coalesce(sum(total_minor), 0) from private.invoices where issued_at >= date_trunc('year', now()) and status <> 'void'),
    'outstandingMinor', (select coalesce(sum(total_minor), 0) from private.invoices where status = 'open'),
    'creditTopUpsThisMonth', (select coalesce(sum(credits), 0) from private.credit_grants where source = 'top_up' and granted_at >= date_trunc('month', now())),
    'webhookEvents', coalesce((select jsonb_object_agg(outcome, n) from (select outcome, count(*) n from private.billing_provider_events group by outcome) e), '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.billing_generate_invoice(uuid, timestamptz, timestamptz, numeric)',
    'public.billing_invoice_get(uuid)',
    'public.billing_overview(uuid)',
    'public.billing_grant_credits(uuid, bigint, text)',
    'public.platform_commercial_analytics()'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
  -- The catalogue is public; webhooks authenticate by signature, not by session.
  foreach v_signature in array array['public.billing_plans()', 'public.billing_webhook(text, text, text)'] loop
    execute format('revoke all on function %s from public', v_signature);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
