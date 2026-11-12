-- Early-access and demonstration requests from the public homepage.
--
-- Njumeni is not yet a live service (web hosting, Lovdata activation and AI providers are pending),
-- so the homepage converts through a request, not a sign-up. This is the seventh function a caller
-- without a session may use. Abuse controls: strict validation, explicit consent, one open request
-- per email address (a repeat updates it), and a platform-wide cap of 60 new requests per hour.
-- Data minimisation: no IP address or user agent is stored. Retention: deleted 12 months after
-- the last update, daily (pg_cron where available). Only platform operators can read requests.

create table private.early_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$'),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  organisation text check (organisation is null or length(btrim(organisation)) between 2 and 160),
  audience text not null check (audience in ('individual', 'legal_professional', 'law_firm', 'enterprise', 'public_institution')),
  interest text not null check (interest in ('early_access', 'demonstration')),
  jurisdictions text[] not null default '{}' check (cardinality(jurisdictions) <= 10),
  message text check (message is null or length(message) <= 1500),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retain_until timestamptz not null default now() + interval '12 months'
);
create unique index early_access_requests_email_idx on private.early_access_requests(email);
create index early_access_requests_created_idx on private.early_access_requests(created_at desc);
alter table private.early_access_requests enable row level security;
revoke all on private.early_access_requests from public, anon, authenticated;

create or replace function public.early_access_request(
  p_email text, p_full_name text, p_organisation text, p_audience text, p_interest text,
  p_jurisdictions text[], p_message text, p_consent boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_jurisdictions text[] := coalesce(p_jurisdictions, '{}');
begin
  if not coalesce(p_consent, false) then raise exception 'EARLY_ACCESS_CONSENT_REQUIRED' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$' then raise exception 'EARLY_ACCESS_EMAIL_INVALID' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_full_name, ''))) not between 2 and 120
    or (nullif(btrim(coalesce(p_organisation, '')), '') is not null and length(btrim(p_organisation)) not between 2 and 160)
    or coalesce(p_audience, '') not in ('individual', 'legal_professional', 'law_firm', 'enterprise', 'public_institution')
    or coalesce(p_interest, '') not in ('early_access', 'demonstration')
    or cardinality(v_jurisdictions) > 10
    or exists (select 1 from unnest(v_jurisdictions) j where j !~ '^[A-Z][A-Z0-9_-]{1,15}$')
    or length(coalesce(p_message, '')) > 1500 then
    raise exception 'EARLY_ACCESS_INPUT_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from private.early_access_requests where email = v_email)
    and (select count(*) from private.early_access_requests where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'EARLY_ACCESS_BUSY' using errcode = '53400';
  end if;
  insert into private.early_access_requests (email, full_name, organisation, audience, interest, jurisdictions, message, consent_at)
  values (v_email, btrim(p_full_name), nullif(btrim(coalesce(p_organisation, '')), ''), p_audience, p_interest, v_jurisdictions,
    nullif(btrim(coalesce(p_message, '')), ''), now())
  on conflict (email) do update set full_name = excluded.full_name, organisation = excluded.organisation,
    audience = excluded.audience, interest = excluded.interest, jurisdictions = excluded.jurisdictions,
    message = excluded.message, consent_at = excluded.consent_at, updated_at = now(),
    retain_until = now() + interval '12 months', status = case when private.early_access_requests.status = 'closed' then 'new'
      else private.early_access_requests.status end;
  -- The same answer whether the address was new or known: the form reveals nothing about others.
  return 'received';
end;
$$;
revoke all on function public.early_access_request(text, text, text, text, text, text[], text, boolean) from public;
grant execute on function public.early_access_request(text, text, text, text, text, text[], text, boolean) to anon, authenticated, service_role;

create or replace function public.early_access_list(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'EARLY_ACCESS_NOT_AUTHORISED' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'email', r.email, 'fullName', r.full_name,
      'organisation', r.organisation, 'audience', r.audience, 'interest', r.interest, 'jurisdictions', to_jsonb(r.jurisdictions),
      'message', r.message, 'status', r.status, 'createdAt', r.created_at, 'updatedAt', r.updated_at) order by r.created_at desc)
    from private.early_access_requests r where p_status is null or r.status = p_status), '[]'::jsonb);
end;
$$;
create or replace function public.early_access_set_status(p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'EARLY_ACCESS_NOT_AUTHORISED' using errcode = '42501'; end if;
  if coalesce(p_status, '') not in ('new', 'contacted', 'closed') then raise exception 'EARLY_ACCESS_INPUT_INVALID' using errcode = '22023'; end if;
  update private.early_access_requests set status = p_status, updated_at = now() where id = p_request_id;
  if not found then raise exception 'EARLY_ACCESS_NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;
create or replace function public.early_access_purge_expired()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from private.early_access_requests where retain_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.early_access_list(text) from public, anon;
revoke all on function public.early_access_set_status(uuid, text) from public, anon;
revoke all on function public.early_access_purge_expired() from public, anon, authenticated;
grant execute on function public.early_access_list(text) to authenticated, service_role;
grant execute on function public.early_access_set_status(uuid, text) to authenticated, service_role;
grant execute on function public.early_access_purge_expired() to service_role;

do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('early-access-retention', '41 3 * * *', $cmd$select public.early_access_purge_expired();$cmd$);
  end if;
exception when others then
  raise notice 'Early-access retention not scheduled in the database (%)', sqlerrm;
end;
$schedule$;
