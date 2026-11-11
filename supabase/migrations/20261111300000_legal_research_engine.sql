-- Phase 4: Legal research engine with the verification core (Master Plan v2.0 §4 Module B,
-- §8.2 verified-or-abstain claim ledger U-09, §8.3 verification checks pulled forward U-10).
-- Research records are tenant data (private schema, permission-checked RPCs). Verification is
-- performed by the database itself when a run is recorded, so a client cannot mark a claim verified.
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Research records
-- ---------------------------------------------------------------------------------------------
create table private.research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  question text not null check (char_length(btrim(question)) between 3 and 4000),
  jurisdiction_code text not null references private.jurisdictions (code) on delete restrict,
  as_of_date date not null,
  language_codes text[] not null check (cardinality(language_codes) between 1 and 10),
  retrieval_mode text not null check (retrieval_mode in ('lexical', 'semantic', 'hybrid')),
  status text not null check (status in ('answered', 'abstained')),
  coverage_level text not null,
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  engine_version text not null check (char_length(engine_version) between 1 and 40),
  created_by uuid references private.principals (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, organization_id) references public.workspaces (id, organization_id)
    on delete restrict
);
create index research_runs_workspace_idx on private.research_runs (workspace_id, created_at desc);

create table private.research_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.research_runs (id) on delete restrict,
  rank integer not null check (rank > 0),
  passage_id uuid not null references private.legal_authority_passages (id) on delete restrict,
  authority_version_id uuid not null references private.legal_authority_versions (id) on delete restrict,
  authority_id uuid not null references private.legal_authorities (id) on delete restrict,
  score real not null check (score >= 0 and score <= 1),
  unique (run_id, rank)
);

-- The claim ledger. Every claim carries one of the six answer categories (Module A).
create table private.research_claims (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.research_runs (id) on delete restrict,
  ordinal integer not null check (ordinal >= 0),
  category text not null check (category in ('verified_authority', 'interpretation',
    'factual_assumption', 'inference', 'unresolved_question', 'conflicting_authority')),
  statement text not null check (char_length(btrim(statement)) between 1 and 4000),
  cited_passage_id uuid references private.legal_authority_passages (id) on delete restrict,
  citation_text text check (citation_text is null or char_length(citation_text) <= 512),
  quoted_text text check (quoted_text is null or char_length(quoted_text) <= 4000),
  verification_status text not null check (verification_status in ('verified', 'failed', 'not_applicable')),
  failure_codes text[] not null default '{}'::text[],
  unique (run_id, ordinal),
  check (category <> 'verified_authority' or cited_passage_id is not null or verification_status = 'failed')
);

create table private.citation_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.research_runs (id) on delete restrict,
  claim_id uuid not null references private.research_claims (id) on delete restrict,
  check_type text not null check (check_type in ('existence', 'resolution', 'currency', 'source_rights', 'quotation')),
  passed boolean not null,
  detail text check (detail is null or char_length(detail) <= 500),
  checked_at timestamptz not null default now()
);
create index citation_checks_run_idx on private.citation_checks (run_id);

do $tables$
declare
  v_table text;
begin
  foreach v_table in array array['research_runs', 'research_findings', 'research_claims', 'citation_checks'] loop
    execute format('alter table private.%I enable row level security', v_table);
    execute format('revoke all on private.%I from public, anon, authenticated', v_table);
    execute format('create trigger %I before update or delete on private.%I for each row execute function private.reject_append_only_mutation()',
      v_table || '_immutable', v_table);
  end loop;
end;
$tables$;

-- ---------------------------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_research_scope(
  p_organization_id uuid, p_workspace_id uuid, p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null or p_workspace_id is null
    or not exists (select 1 from public.workspaces where id = p_workspace_id and organization_id = p_organization_id)
    or private.current_principal_id() is null
    or not private.has_permission(p_permission, p_organization_id, p_workspace_id) then
    raise exception 'RESEARCH_NOT_AUTHORISED' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_research_scope(uuid, uuid, text) from public, anon, authenticated;

-- Whitespace-normalised comparison text for quotation fidelity.
create or replace function private.normalise_quotation(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(normalize(coalesce(p_text, ''), NFC), '\s+', ' ', 'g'));
$$;
revoke all on function private.normalise_quotation(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Workspace-scoped retrieval (no service-role key in the web application)
-- ---------------------------------------------------------------------------------------------
create or replace function public.research_search_lexical(
  p_organization_id uuid, p_workspace_id uuid, p_query text, p_jurisdiction_code text,
  p_as_of_date date, p_language_codes text[], p_authority_types text[] default '{}'::text[],
  p_limit integer default 12
)
returns table (
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, lexical_score real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  return query select * from private.search_legal_passages_lexical(
    p_query, p_jurisdiction_code, p_as_of_date, p_language_codes, p_authority_types, p_limit);
end;
$$;

create or replace function public.research_search_semantic(
  p_organization_id uuid, p_workspace_id uuid, p_embedding extensions.vector,
  p_embedding_model_key text, p_jurisdiction_code text, p_as_of_date date,
  p_language_codes text[], p_authority_types text[] default '{}'::text[], p_limit integer default 12
)
returns table (
  passage_id uuid, authority_id uuid, authority_version_id uuid, authority_title text,
  citation text, jurisdiction_code text, authority_type text, language_code text,
  legal_status text, valid_from date, valid_until date, source_uri text,
  source_content_hash text, passage_content text, page_number integer,
  section_path text[], source_key text, semantic_score real
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  return query select * from private.search_legal_passages_semantic(
    p_embedding, p_embedding_model_key, p_jurisdiction_code, p_as_of_date, p_language_codes,
    p_authority_types, p_limit);
end;
$$;

-- Relationships around retrieved authorities: conflicts, overrulings and later amendments.
create or replace function public.research_authority_context(
  p_organization_id uuid, p_workspace_id uuid, p_authority_ids uuid[], p_as_of_date date
)
returns table (
  from_authority_id uuid, to_authority_id uuid, relationship_type text, effective_from date,
  to_citation text, to_title text, after_as_of boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  if coalesce(cardinality(p_authority_ids), 0) > 50 then
    raise exception 'RESEARCH_CONTEXT_TOO_LARGE' using errcode = '22023';
  end if;
  return query
  select r.from_authority_id, r.to_authority_id, r.relationship_type, r.effective_from,
    a.citation, a.title, (r.effective_from is not null and r.effective_from > p_as_of_date)
  from private.legal_authority_relationships r
  join private.legal_authorities a on a.id = r.to_authority_id
  where r.from_authority_id = any(p_authority_ids)
    and r.relationship_type in ('amended_by', 'repealed_by', 'replaced_by', 'overruled_by',
      'conflicts_with', 'distinguishes', 'interprets', 'applies')
  order by r.from_authority_id, r.relationship_type, r.to_authority_id;
end;
$$;

-- Display/quote permissions and attribution for retrieved sources, so answers never quote a
-- source that only permits citation.
create or replace function public.research_source_permissions(
  p_organization_id uuid, p_workspace_id uuid, p_source_keys text[]
)
returns table (source_key text, display_permitted boolean, quote_permitted boolean,
  attribution_text text, licence_identifier text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  return query
  select s.source_key,
    coalesce((e.permissions ->> 'display')::boolean, false) and (e.review_expires_at is null or e.review_expires_at > now()),
    coalesce((e.permissions ->> 'quote')::boolean, false) and (e.review_expires_at is null or e.review_expires_at > now()),
    s.attribution_text, s.licence_identifier
  from private.legal_sources s
  left join private.legal_source_rights_evidence e on e.source_id = s.id
  where s.source_key = any(p_source_keys)
  order by s.source_key;
end;
$$;

create or replace function public.research_list_jurisdictions()
returns table (code text, name text, coverage_level text, official_languages text[])
language sql
stable
security definer
set search_path = ''
as $$
  select j.code, j.name, j.status, j.official_languages
  from private.jurisdictions j
  where private.current_principal_id() is not null
  order by j.code;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Recording a run, with verification performed by the database
-- ---------------------------------------------------------------------------------------------
create or replace function public.research_record_run(
  p_organization_id uuid, p_workspace_id uuid, p_question text, p_jurisdiction_code text,
  p_as_of_date date, p_language_codes text[], p_retrieval_mode text, p_limitations jsonb,
  p_engine_version text, p_findings jsonb, p_claims jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_level text;
  v_finding jsonb;
  v_claim jsonb;
  v_claim_id uuid;
  v_ordinal integer := 0;
  v_passage record;
  v_category text;
  v_failures text[];
  v_status text;
  v_has_verified boolean := false;
  v_quote text;
  v_citation text;
  v_quote_permitted boolean;
  v_display_permitted boolean;
  v_passage_id uuid;
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.create');
  select status into v_level from private.jurisdictions where code = p_jurisdiction_code;
  if v_level is null then
    raise exception 'RESEARCH_JURISDICTION_UNKNOWN' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_findings, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_claims, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_findings, '[]'::jsonb)) > 50 or jsonb_array_length(coalesce(p_claims, '[]'::jsonb)) > 100 then
    raise exception 'RESEARCH_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  insert into private.research_runs (organization_id, workspace_id, question, jurisdiction_code, as_of_date,
    language_codes, retrieval_mode, status, coverage_level, limitations, engine_version, created_by)
  values (p_organization_id, p_workspace_id, btrim(p_question), p_jurisdiction_code, p_as_of_date,
    p_language_codes, p_retrieval_mode, 'abstained', v_level, coalesce(p_limitations, '[]'::jsonb),
    p_engine_version, private.current_principal_id())
  returning id into v_run_id;

  -- Findings must reference real passages; their authority and version are derived, not trusted.
  for v_finding in select value from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) loop
    insert into private.research_findings (run_id, rank, passage_id, authority_version_id, authority_id, score)
    select v_run_id, (v_finding ->> 'rank')::integer, passage.id, version.id, version.authority_id,
      least(greatest((v_finding ->> 'score')::real, 0), 1)
    from private.legal_authority_passages passage
    join private.legal_authority_versions version on version.id = passage.authority_version_id
    where passage.id = (v_finding ->> 'passage_id')::uuid;
  end loop;

  for v_claim in select value from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) loop
    v_category := v_claim ->> 'category';
    v_failures := '{}';
    v_quote := nullif(v_claim ->> 'quoted_text', '');
    v_citation := nullif(v_claim ->> 'citation_text', '');
    v_status := 'not_applicable';
    v_passage_id := null;

    if v_category in ('verified_authority', 'conflicting_authority') or v_claim ? 'passage_id' then
      select passage.id, passage.content, version.id as version_id, version.valid_from, version.valid_until,
        authority.id as authority_id, authority.citation, authority.jurisdiction_code, authority.legal_status,
        source.id as source_id, source.rights_status, source.status as source_status, source.ingestion_enabled
      into v_passage
      from private.legal_authority_passages passage
      join private.legal_authority_versions version on version.id = passage.authority_version_id
      join private.legal_authorities authority on authority.id = version.authority_id
      join private.legal_sources source on source.id = authority.source_id
      where passage.id = nullif(v_claim ->> 'passage_id', '')::uuid;
      v_passage_id := v_passage.id;

      select coalesce((e.permissions ->> 'quote')::boolean, false), coalesce((e.permissions ->> 'display')::boolean, false)
      into v_quote_permitted, v_display_permitted
      from private.legal_source_rights_evidence e
      where e.source_id = v_passage.source_id and (e.review_expires_at is null or e.review_expires_at > now());

      -- existence: the cited authority exists in a registered source
      if v_passage_id is null then
        v_failures := array_append(v_failures, 'CITATION_NOT_FOUND');
      else
        -- resolution: a stated citation must match the authority that owns the passage
        if v_citation is not null and lower(btrim(v_citation)) not like lower(btrim(coalesce(v_passage.citation, ''))) || '%' then
          v_failures := array_append(v_failures, 'CITATION_MISMATCH');
        end if;
        -- currency: the version must be in force on the research date, in the same jurisdiction
        if (v_passage.valid_from is not null and v_passage.valid_from > p_as_of_date)
          or (v_passage.valid_until is not null and p_as_of_date >= v_passage.valid_until)
          or v_passage.legal_status in ('repealed', 'expired', 'overruled')
          or v_passage.jurisdiction_code <> p_jurisdiction_code then
          v_failures := array_append(v_failures, 'AUTHORITY_NOT_IN_FORCE_ON_DATE');
        end if;
        -- source rights: approved, active, enabled, display permitted
        if v_passage.rights_status <> 'approved' or v_passage.source_status <> 'active'
          or not v_passage.ingestion_enabled or not coalesce(v_display_permitted, false) then
          v_failures := array_append(v_failures, 'SOURCE_NOT_PERMITTED');
        end if;
        -- quotation: verbatim (whitespace-normalised) and quoting permitted
        if v_quote is not null then
          if not coalesce(v_quote_permitted, false) then
            v_failures := array_append(v_failures, 'QUOTATION_NOT_PERMITTED');
          elsif position(private.normalise_quotation(v_quote) in private.normalise_quotation(v_passage.content)) = 0 then
            v_failures := array_append(v_failures, 'QUOTATION_MISMATCH');
          end if;
        end if;
      end if;
      v_status := case when cardinality(v_failures) = 0 then 'verified' else 'failed' end;
    end if;

    insert into private.research_claims (run_id, ordinal, category, statement, cited_passage_id, citation_text,
      quoted_text, verification_status, failure_codes)
    values (v_run_id, v_ordinal, v_category, left(v_claim ->> 'statement', 4000),
      v_passage_id,
      v_citation, v_quote, v_status, v_failures)
    returning id into v_claim_id;

    if v_status <> 'not_applicable' then
      insert into private.citation_checks (run_id, claim_id, check_type, passed, detail) values
        (v_run_id, v_claim_id, 'existence', not ('CITATION_NOT_FOUND' = any(v_failures)), null),
        (v_run_id, v_claim_id, 'resolution', not ('CITATION_MISMATCH' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), v_citation),
        (v_run_id, v_claim_id, 'currency', not ('AUTHORITY_NOT_IN_FORCE_ON_DATE' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), p_as_of_date::text),
        (v_run_id, v_claim_id, 'source_rights', not ('SOURCE_NOT_PERMITTED' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), null);
      if v_quote is not null then
        insert into private.citation_checks (run_id, claim_id, check_type, passed, detail)
        values (v_run_id, v_claim_id, 'quotation',
          not ('QUOTATION_MISMATCH' = any(v_failures) or 'QUOTATION_NOT_PERMITTED' = any(v_failures) or 'CITATION_NOT_FOUND' = any(v_failures)), null);
      end if;
    end if;
    if v_category = 'verified_authority' and v_status = 'verified' then
      v_has_verified := true;
    end if;
    v_ordinal := v_ordinal + 1;
  end loop;

  -- Verified-or-abstain: a run is 'answered' only when at least one law claim verified.
  if v_has_verified then
    -- research_runs is append-only; the status is decided before any reader can see the run,
    -- so the insert-time value is replaced inside this transaction via a guarded path.
    perform set_config('njumeni.research_status_update', v_run_id::text, true);
    update private.research_runs set status = 'answered' where id = v_run_id;
  end if;
  perform private.record_evidence_audit(p_organization_id, p_workspace_id, 'research.run_recorded',
    'research_run', v_run_id, jsonb_build_object('answered', v_has_verified));
  return v_run_id;
end;
$$;

-- Allow exactly one status transition, inside research_record_run, for the run it created.
create or replace function private.guard_research_run_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and current_setting('njumeni.research_status_update', true) = old.id::text
    and old.status = 'abstained' and new.status = 'answered'
    and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  raise exception 'Research records are append-only' using errcode = '55000';
end;
$$;
revoke all on function private.guard_research_run_mutation() from public, anon, authenticated;
drop trigger research_runs_immutable on private.research_runs;
create trigger research_runs_immutable before update or delete on private.research_runs
  for each row execute function private.guard_research_run_mutation();

-- ---------------------------------------------------------------------------------------------
-- 5. Reading research
-- ---------------------------------------------------------------------------------------------
create or replace function public.research_list_runs(p_organization_id uuid, p_workspace_id uuid)
returns table (run_id uuid, question text, jurisdiction_code text, as_of_date date, status text,
  verified_claims bigint, failed_claims bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_research_scope(p_organization_id, p_workspace_id, 'research.read');
  return query
  select run.id, run.question, run.jurisdiction_code, run.as_of_date, run.status,
    (select count(*) from private.research_claims c where c.run_id = run.id and c.verification_status = 'verified'),
    (select count(*) from private.research_claims c where c.run_id = run.id and c.verification_status = 'failed'),
    run.created_at
  from private.research_runs run
  where run.organization_id = p_organization_id and run.workspace_id = p_workspace_id
  order by run.created_at desc, run.id
  limit 100;
end;
$$;

create or replace function public.research_get_run(p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_run private.research_runs;
begin
  select * into v_run from private.research_runs where id = p_run_id;
  if not found then
    raise exception 'RESEARCH_NOT_AUTHORISED' using errcode = '42501';
  end if;
  perform private.require_research_scope(v_run.organization_id, v_run.workspace_id, 'research.read');
  return jsonb_build_object(
    'id', v_run.id, 'question', v_run.question, 'jurisdictionCode', v_run.jurisdiction_code,
    'asOfDate', v_run.as_of_date, 'languageCodes', to_jsonb(v_run.language_codes),
    'retrievalMode', v_run.retrieval_mode, 'status', v_run.status, 'coverageLevel', v_run.coverage_level,
    'limitations', v_run.limitations, 'engineVersion', v_run.engine_version, 'createdAt', v_run.created_at,
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ordinal', c.ordinal, 'category', c.category, 'statement', c.statement,
        'citation', c.citation_text, 'quotedText', c.quoted_text,
        'verificationStatus', c.verification_status, 'failureCodes', to_jsonb(c.failure_codes),
        'passageId', c.cited_passage_id,
        'authorityTitle', a.title, 'authorityCitation', a.citation,
        'validFrom', v.valid_from, 'validUntil', v.valid_until,
        'sourceUri', coalesce(v.source_uri, a.canonical_uri)
      ) order by c.ordinal)
      from private.research_claims c
      left join private.legal_authority_passages p on p.id = c.cited_passage_id
      left join private.legal_authority_versions v on v.id = p.authority_version_id
      left join private.legal_authorities a on a.id = v.authority_id
      where c.run_id = v_run.id), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object('rank', f.rank, 'passageId', f.passage_id, 'score', f.score,
        'authorityTitle', a.title, 'citation', a.citation) order by f.rank)
      from private.research_findings f join private.legal_authorities a on a.id = f.authority_id
      where f.run_id = v_run.id), '[]'::jsonb),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object('checkType', k.check_type, 'passed', k.passed, 'claimOrdinal', c.ordinal)
        order by c.ordinal, k.check_type)
      from private.citation_checks k join private.research_claims c on c.id = k.claim_id
      where k.run_id = v_run.id), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------------------------
do $grants$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.research_search_lexical(uuid, uuid, text, text, date, text[], text[], integer)',
    'public.research_search_semantic(uuid, uuid, extensions.vector, text, text, date, text[], text[], integer)',
    'public.research_authority_context(uuid, uuid, uuid[], date)',
    'public.research_list_jurisdictions()',
    'public.research_source_permissions(uuid, uuid, text[])',
    'public.research_record_run(uuid, uuid, text, text, date, text[], text, jsonb, text, jsonb, jsonb)',
    'public.research_list_runs(uuid, uuid)',
    'public.research_get_run(uuid)'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
