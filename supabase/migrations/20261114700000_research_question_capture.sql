-- "Ask Njumeni", Phase 0: capture a visitor's first legal question, with consent, before live
-- public research exists.
--
-- Live answers are not offered yet: Lovdata awaits activation on the hosted service and plain-
-- language retrieval has not passed a held-out evaluation. Visitors may leave their question so
-- they can be answered when Norway opens, and so real plain-language questions can be used to
-- evaluate and improve retrieval. This is the eighth function a caller without a session may use.
-- Abuse controls: strict validation, required consent, a platform-wide cap of 120 questions per
-- hour. Data minimisation: no IP address or user agent; the email address is optional. Questions
-- can contain personal details, so they are deleted 30 days after submission (daily, pg_cron where
-- available). Only platform operators can read them.

create table private.research_question_submissions (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(btrim(question)) between 5 and 1000),
  jurisdiction_code text not null check (jurisdiction_code ~ '^[A-Z][A-Z0-9_-]{1,15}$'),
  as_of_date date,
  response_language text not null check (response_language in ('nb', 'nn', 'en')),
  contact_email text check (contact_email is null or (contact_email = lower(contact_email)
    and contact_email ~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$')),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  retain_until timestamptz not null default now() + interval '30 days'
);
create index research_question_submissions_created_idx on private.research_question_submissions(created_at desc);
alter table private.research_question_submissions enable row level security;
revoke all on private.research_question_submissions from public, anon, authenticated;

create or replace function public.research_question_submit(
  p_question text, p_jurisdiction_code text, p_as_of_date date, p_response_language text,
  p_contact_email text, p_consent boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
begin
  if not coalesce(p_consent, false) then raise exception 'RESEARCH_QUESTION_CONSENT_REQUIRED' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_question, ''))) not between 5 and 1000
    or coalesce(p_jurisdiction_code, '') !~ '^[A-Z][A-Z0-9_-]{1,15}$'
    or coalesce(p_response_language, '') not in ('nb', 'nn', 'en')
    or (p_as_of_date is not null and p_as_of_date not between date '1814-05-17' and current_date + 3650)
    or (v_email is not null and v_email !~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$') then
    raise exception 'RESEARCH_QUESTION_INPUT_INVALID' using errcode = '22023';
  end if;
  if (select count(*) from private.research_question_submissions where created_at > now() - interval '1 hour') >= 120 then
    raise exception 'RESEARCH_QUESTION_BUSY' using errcode = '53400';
  end if;
  insert into private.research_question_submissions (question, jurisdiction_code, as_of_date, response_language, contact_email, consent_at)
  values (btrim(p_question), p_jurisdiction_code, p_as_of_date, p_response_language, v_email, now());
  return 'received';
end;
$$;
revoke all on function public.research_question_submit(text, text, date, text, text, boolean) from public;
grant execute on function public.research_question_submit(text, text, date, text, text, boolean) to anon, authenticated, service_role;

create or replace function public.research_question_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'RESEARCH_QUESTION_NOT_AUTHORISED' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question,
      'jurisdictionCode', q.jurisdiction_code, 'asOfDate', q.as_of_date, 'responseLanguage', q.response_language,
      'contactEmail', q.contact_email, 'createdAt', q.created_at, 'retainUntil', q.retain_until) order by q.created_at desc)
    from private.research_question_submissions q), '[]'::jsonb);
end;
$$;
create or replace function public.research_question_purge_expired()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from private.research_question_submissions where retain_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.research_question_list() from public, anon;
revoke all on function public.research_question_purge_expired() from public, anon, authenticated;
grant execute on function public.research_question_list() to authenticated, service_role;
grant execute on function public.research_question_purge_expired() to service_role;

do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('research-question-retention', '47 3 * * *', $cmd$select public.research_question_purge_expired();$cmd$);
  end if;
exception when others then
  raise notice 'Research-question retention not scheduled in the database (%)', sqlerrm;
end;
$schedule$;
