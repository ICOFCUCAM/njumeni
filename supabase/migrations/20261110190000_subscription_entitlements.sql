-- Phase 1.10: provider-neutral subscription identity and entitlement boundary.
-- Billing state describes commercial access only; it is never consulted by
-- private.has_permission() and cannot grant access to legal resources.

create table private.subscription_plans (
  plan_key text primary key check (plan_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  display_name text not null,
  billing_interval text not null check (billing_interval in ('monthly', 'annual', 'contract', 'none')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  provider_customer_id text not null check (char_length(provider_customer_id) between 1 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id),
  unique (organization_id, provider),
  unique (id, organization_id)
);

create index billing_customers_org_idx on private.billing_customers (organization_id);

create table private.subscriptions (
  id uuid primary key default gen_random_uuid(),
  billing_customer_id uuid not null references private.billing_customers(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_key text not null references private.subscription_plans(plan_key) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  provider_subscription_id text not null check (char_length(provider_subscription_id) between 1 and 255),
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'unpaid', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id),
  unique (id, organization_id),
  constraint subscription_period_order check (
    current_period_start is null or current_period_end is null
    or current_period_end > current_period_start
  ),
  constraint subscription_customer_org_match
    foreign key (billing_customer_id, organization_id)
    references private.billing_customers(id, organization_id)
    on delete restrict
);

create index subscriptions_org_status_idx
  on private.subscriptions (organization_id, status, updated_at desc);
create index subscriptions_customer_idx
  on private.subscriptions (billing_customer_id);

create table private.subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null,
  organization_id uuid not null,
  entitlement_key text not null check (entitlement_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  limit_value bigint check (limit_value is null or limit_value >= 0),
  enabled boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  source_version text,
  created_at timestamptz not null default now(),
  constraint entitlement_period_order check (effective_until is null or effective_until > effective_from),
  foreign key (subscription_id, organization_id)
    references private.subscriptions(id, organization_id) on delete restrict,
  unique (subscription_id, entitlement_key, effective_from)
);

create index subscription_entitlements_scope_idx
  on private.subscription_entitlements (organization_id, entitlement_key, effective_from desc);

create table private.billing_provider_events (
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 255),
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default 'received' check (outcome in ('received', 'processed', 'ignored', 'failed')),
  error_code text,
  primary key (provider, provider_event_id)
);

create table private.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  principal_id uuid references private.principals(id) on delete set null,
  subscription_id uuid,
  usage_key text not null check (usage_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  quantity numeric(20,6) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 40),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint usage_metadata_size check (octet_length(metadata::text) <= 1024),
  constraint usage_subscription_org_match
    foreign key (subscription_id, organization_id)
    references private.subscriptions(id, organization_id) on delete restrict,
  unique (organization_id, usage_key, idempotency_key)
);

create index usage_records_org_key_time_idx
  on private.usage_records (organization_id, usage_key, occurred_at desc);
create index usage_records_workspace_time_idx
  on private.usage_records (workspace_id, occurred_at desc);

alter table private.subscription_plans enable row level security;
alter table private.billing_customers enable row level security;
alter table private.subscriptions enable row level security;
alter table private.subscription_entitlements enable row level security;
alter table private.billing_provider_events enable row level security;
alter table private.usage_records enable row level security;

revoke all on private.subscription_plans, private.billing_customers,
  private.subscriptions, private.subscription_entitlements,
  private.billing_provider_events, private.usage_records
  from public, anon, authenticated;

insert into private.permission_catalog (permission_key, scope, description)
values ('usage.record', 'organization', 'Record metered usage for an organisation')
on conflict (permission_key) do nothing;

insert into private.role_permissions (role_key, permission_key)
values ('org_admin', 'usage.record')
on conflict do nothing;

insert into private.subscription_plans (plan_key, display_name, billing_interval) values
  ('free', 'Free', 'none'),
  ('personal', 'Personal', 'monthly'),
  ('personal_plus', 'Personal Plus', 'monthly'),
  ('professional', 'Professional', 'monthly'),
  ('professional_plus', 'Professional Plus', 'monthly'),
  ('law_firm', 'Law Firm', 'monthly'),
  ('enterprise', 'Enterprise', 'contract'),
  ('institutional', 'Institutional', 'contract')
on conflict (plan_key) do nothing;

create or replace function private.set_billing_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_billing_updated_at() from public, anon, authenticated;

create trigger billing_customers_set_updated_at
  before update on private.billing_customers
  for each row execute function private.set_billing_updated_at();
create trigger subscriptions_set_updated_at
  before update on private.subscriptions
  for each row execute function private.set_billing_updated_at();

create or replace function private.reject_billing_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Billing event and usage ledgers are append-only'
    using errcode = '55000';
end;
$$;

revoke all on function private.reject_billing_ledger_mutation() from public, anon, authenticated;

create trigger usage_records_immutable
  before update or delete on private.usage_records
  for each row execute function private.reject_billing_ledger_mutation();

create or replace function public.get_organization_entitlements(p_organization_id uuid)
returns table (
  plan_key text,
  subscription_status text,
  entitlement_key text,
  enabled boolean,
  limit_value bigint,
  effective_from timestamptz,
  effective_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null
     or not private.has_permission('billing.read', p_organization_id, null) then
    raise exception 'Billing access denied'
      using errcode = '42501';
  end if;

  return query
  with current_subscription as (
    select subscription.id, subscription.plan_key, subscription.status
    from private.subscriptions subscription
    where subscription.organization_id = p_organization_id
      and subscription.status in ('trialing', 'active', 'past_due', 'paused')
      and (subscription.current_period_end is null or subscription.current_period_end > now())
    order by
      case subscription.status when 'active' then 1 when 'trialing' then 2 when 'past_due' then 3 else 4 end,
      subscription.updated_at desc
    limit 1
  )
  select current_subscription.plan_key,
         current_subscription.status,
         entitlement.entitlement_key,
         entitlement.enabled,
         entitlement.limit_value,
         entitlement.effective_from,
         entitlement.effective_until
  from current_subscription
  left join private.subscription_entitlements entitlement
    on entitlement.subscription_id = current_subscription.id
   and entitlement.organization_id = p_organization_id
   and entitlement.effective_from <= now()
   and (entitlement.effective_until is null or entitlement.effective_until > now())
  order by entitlement.entitlement_key;
end;
$$;

revoke all on function public.get_organization_entitlements(uuid) from public, anon;
grant execute on function public.get_organization_entitlements(uuid) to authenticated;

create or replace function public.record_usage_event(
  p_organization_id uuid,
  p_workspace_id uuid,
  p_usage_key text,
  p_quantity numeric,
  p_unit text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_principal uuid;
  v_record_id uuid;
begin
  v_principal := private.current_principal_id();
  if v_principal is null
     or p_organization_id is null
     or p_quantity is null or p_quantity <= 0
     or p_usage_key !~ '^[a-z][a-z0-9_.-]{1,99}$'
     or p_unit is null or char_length(p_unit) > 40
     or p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128
     or p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
     or octet_length(p_metadata::text) > 1024
     or not private.has_permission('usage.record', p_organization_id, null) then
    raise exception 'Usage event is invalid or unauthorised'
      using errcode = '42501';
  end if;

  if p_workspace_id is not null and not exists (
    select 1 from public.workspaces workspace
    where workspace.id = p_workspace_id
      and workspace.organization_id = p_organization_id
      and workspace.status = 'active'
  ) then
    raise exception 'Usage workspace is outside the organisation'
      using errcode = '22023';
  end if;

  insert into private.usage_records (
    organization_id, workspace_id, principal_id, usage_key,
    quantity, unit, idempotency_key, metadata
  ) values (
    p_organization_id, p_workspace_id, v_principal, p_usage_key,
    p_quantity, p_unit, p_idempotency_key, p_metadata
  )
  on conflict (organization_id, usage_key, idempotency_key) do nothing
  returning id into v_record_id;

  if v_record_id is null then
    select usage.id into v_record_id
    from private.usage_records usage
    where usage.organization_id = p_organization_id
      and usage.usage_key = p_usage_key
      and usage.idempotency_key = p_idempotency_key;
  end if;

  return v_record_id;
end;
$$;

revoke all on function public.record_usage_event(uuid, uuid, text, numeric, text, text, jsonb) from public, anon;
grant execute on function public.record_usage_event(uuid, uuid, text, numeric, text, text, jsonb) to authenticated;

-- Only the trusted provider-webhook/server integration can mutate commercial
-- snapshots. This function is deliberately not exposed to authenticated users.
create or replace function private.apply_subscription_snapshot(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_organization_id uuid,
  p_plan_key text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_entitlements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_subscription_id uuid;
  v_event_inserted integer;
  entitlement jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Trusted billing integration required'
      using errcode = '42501';
  end if;

  if p_provider !~ '^[a-z][a-z0-9_-]{1,39}$'
     or p_provider_event_id is null or char_length(p_provider_event_id) not between 1 and 255
     or p_event_type is null or char_length(p_event_type) > 120
     or p_provider_customer_id is null or char_length(p_provider_customer_id) not between 1 and 255
     or p_provider_subscription_id is null or char_length(p_provider_subscription_id) not between 1 and 255
     or p_organization_id is null
     or p_plan_key is null or p_status not in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'unpaid', 'expired')
     or (p_period_start is not null and p_period_end is not null and p_period_end <= p_period_start)
     or jsonb_typeof(p_entitlements) <> 'array'
     or jsonb_array_length(p_entitlements) > 100 then
    raise exception 'Billing snapshot is invalid'
      using errcode = '22023';
  end if;

  if not exists (select 1 from private.subscription_plans plan where plan.plan_key = p_plan_key) then
    raise exception 'Unknown subscription plan'
      using errcode = '22023';
  end if;

  insert into private.billing_provider_events(provider, provider_event_id, event_type)
  values (p_provider, p_provider_event_id, p_event_type)
  on conflict do nothing;

  get diagnostics v_event_inserted = row_count;
  if v_event_inserted = 0 then
    select subscription.id into v_subscription_id
    from private.subscriptions subscription
    where subscription.provider = p_provider
      and subscription.provider_subscription_id = p_provider_subscription_id;
    return v_subscription_id;
  end if;

  insert into private.billing_customers(organization_id, provider, provider_customer_id)
  values (p_organization_id, p_provider, p_provider_customer_id)
  on conflict (organization_id, provider)
  do update set provider_customer_id = excluded.provider_customer_id,
                updated_at = now()
  returning id into v_customer_id;

  insert into private.subscriptions (
    billing_customer_id, organization_id, plan_key, provider,
    provider_subscription_id, status, current_period_start,
    current_period_end, cancel_at_period_end, cancelled_at, provider_updated_at
  ) values (
    v_customer_id, p_organization_id, p_plan_key, p_provider,
    p_provider_subscription_id, p_status, p_period_start,
    p_period_end, p_cancel_at_period_end,
    case when p_status = 'cancelled' then now() else null end, now()
  )
  on conflict (provider, provider_subscription_id)
  do update set
    billing_customer_id = excluded.billing_customer_id,
    organization_id = excluded.organization_id,
    plan_key = excluded.plan_key,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    cancelled_at = case when excluded.status = 'cancelled' then now() else null end,
    provider_updated_at = now(),
    updated_at = now()
  returning id into v_subscription_id;

  update private.subscription_entitlements
  set effective_until = now()
  where subscription_id = v_subscription_id
    and effective_until is null;

  for entitlement in select value from jsonb_array_elements(p_entitlements)
  loop
    if coalesce(entitlement ->> 'key', '') !~ '^[a-z][a-z0-9_.-]{1,99}$'
       or (entitlement ? 'limit' and (entitlement ->> 'limit') !~ '^[0-9]+$')
       or (entitlement ? 'enabled' and jsonb_typeof(entitlement -> 'enabled') <> 'boolean') then
      raise exception 'Entitlement item is invalid'
        using errcode = '22023';
    end if;

    insert into private.subscription_entitlements (
      subscription_id, organization_id, entitlement_key,
      limit_value, enabled, source_version
    ) values (
      v_subscription_id, p_organization_id, entitlement ->> 'key',
      case when entitlement ? 'limit' then (entitlement ->> 'limit')::bigint else null end,
      coalesce((entitlement ->> 'enabled')::boolean, true),
      left(p_provider_event_id, 120)
    );
  end loop;

  update private.billing_provider_events
  set processed_at = now(), outcome = 'processed'
  where provider = p_provider and provider_event_id = p_provider_event_id;

  return v_subscription_id;
end;
$$;

revoke all on function private.apply_subscription_snapshot(text, text, text, text, text, uuid, text, text, timestamptz, timestamptz, boolean, jsonb) from public, anon, authenticated;
grant execute on function private.apply_subscription_snapshot(text, text, text, text, text, uuid, text, text, timestamptz, timestamptz, boolean, jsonb) to service_role;

comment on table private.billing_customers is 'Provider customer identity mapped to exactly one Njumeni organisation per provider.';
comment on table private.subscriptions is 'Commercial subscription snapshots; never an authorisation source for legal resources.';
comment on table private.subscription_entitlements is 'Versioned commercial feature/usage allowances scoped to one organisation subscription.';
comment on table private.usage_records is 'Append-only idempotent usage ledger; usage does not itself grant resource access.';
comment on function private.apply_subscription_snapshot(text, text, text, text, text, uuid, text, text, timestamptz, timestamptz, boolean, jsonb) is 'Service-role-only idempotent provider event ingestion; provider adapters must verify webhook signatures before invoking.';
