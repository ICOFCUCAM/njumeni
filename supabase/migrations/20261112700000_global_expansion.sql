-- Phase 12: global expansion (Master Plan v2.0 §6 jurisdiction profiles, §6.7 coverage levels,
-- U-21, U-22). Extends the jurisdiction model (supranational membership, citation conventions,
-- additional African jurisdictions, OHADA as Cameroon's supranational business-law layer, the EEA
-- for Norway), registers official sources for rights review (never active without approved rights),
-- adds a multilingual legal glossary for cross-language research, and a readiness report that never
-- advertises a jurisdiction beyond its tested coverage (P8).
-- Forward migration; nothing is deployed to the hosted project until all phases are complete.

-- ---------------------------------------------------------------------------------------------
-- 1. Jurisdiction profiles
-- ---------------------------------------------------------------------------------------------
alter table private.jurisdictions add column citation_style text not null default 'generic'
  check (citation_style in ('generic', 'norway', 'eu', 'uk', 'us', 'international', 'ohada', 'cameroon', 'commonwealth_africa', 'civil_africa'));
alter table private.jurisdictions add column territorial_note text check (territorial_note is null or char_length(territorial_note) <= 500);

insert into private.jurisdictions (code, parent_code, name, short_name, legal_system, status, official_languages, metadata) values
  ('EEA', null, 'European Economic Area', 'EEA', 'supranational', 'catalogued', array['en', 'nb', 'is', 'de'], '{"priority": 2}'),
  ('OHADA', null, 'Organisation for the Harmonisation of Business Law in Africa', 'OHADA', 'supranational', 'catalogued',
    array['fr', 'en', 'es', 'pt'], '{"priority": 6}'),
  ('NG', null, 'Federal Republic of Nigeria', 'Nigeria', 'common_law', 'catalogued', array['en'], '{"priority": 7}'),
  ('KE', null, 'Republic of Kenya', 'Kenya', 'common_law', 'catalogued', array['en', 'sw'], '{"priority": 7}'),
  ('ZA', null, 'Republic of South Africa', 'South Africa', 'mixed', 'catalogued', array['en', 'af', 'zu', 'xh'], '{"priority": 7}'),
  ('GH', null, 'Republic of Ghana', 'Ghana', 'common_law', 'catalogued', array['en'], '{"priority": 7}'),
  ('SN', 'OHADA', 'Republic of Senegal', 'Senegal', 'civil_law', 'catalogued', array['fr'], '{"priority": 7}')
on conflict (code) do nothing;

-- Uniform Acts apply directly in OHADA member states: OHADA law fits Cameroonian research.
update private.jurisdictions set parent_code = 'OHADA' where code = 'CM' and parent_code is null;

update private.jurisdictions j set citation_style = s.style, territorial_note = s.note
from (values
  ('NO', 'norway', 'Norwegian law; EEA law applies through incorporation into Norwegian law (EEA Act).'),
  ('EEA', 'international', 'EEA Agreement between the EU and Iceland, Liechtenstein and Norway.'),
  ('EU', 'eu', 'Directly applicable regulations; directives require national transposition.'),
  ('GB', 'uk', 'Three legal systems: England and Wales, Scotland, Northern Ireland. Extent must be checked per provision.'),
  ('US', 'us', 'Federal and state law; state coverage is separate.'),
  ('INTL', 'international', 'Treaties bind parties only; customary international law applies generally.'),
  ('CM', 'cameroon', 'Bijural: civil law (Francophone regions) and common law (Anglophone regions); OHADA Uniform Acts apply.'),
  ('OHADA', 'ohada', 'Uniform Acts are directly applicable in the 17 member states.'),
  ('NG', 'commonwealth_africa', 'Federal and state law.'),
  ('KE', 'commonwealth_africa', null),
  ('ZA', 'commonwealth_africa', 'Mixed Roman-Dutch and English common law; customary law recognised.'),
  ('GH', 'commonwealth_africa', null),
  ('SN', 'civil_africa', 'OHADA Uniform Acts apply.')) s(code, style, note)
where j.code = s.code;

-- Relationships the parent hierarchy cannot express (Norway is not under the EU).
create table private.jurisdiction_relationships (
  from_code text not null references private.jurisdictions (code) on delete restrict,
  to_code text not null references private.jurisdictions (code) on delete restrict,
  relationship text not null check (relationship in ('member_of', 'incorporates_by_treaty')),
  note text check (note is null or char_length(note) <= 500),
  primary key (from_code, to_code, relationship),
  check (from_code <> to_code)
);
alter table private.jurisdiction_relationships enable row level security;
revoke all on private.jurisdiction_relationships from public, anon, authenticated;
insert into private.jurisdiction_relationships (from_code, to_code, relationship, note) values
  ('NO', 'EEA', 'member_of', 'EEA EFTA State'),
  ('NO', 'EU', 'incorporates_by_treaty', 'EU acts apply in Norway only once incorporated into the EEA Agreement and Norwegian law'),
  ('CM', 'OHADA', 'member_of', 'OHADA member state'),
  ('SN', 'OHADA', 'member_of', 'OHADA member state')
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Official sources registered for rights review (never active without approved rights)
-- ---------------------------------------------------------------------------------------------
insert into private.legal_sources (jurisdiction_code, source_key, name, issuing_authority, source_type, base_uri, access_method,
  rights_status, ingestion_enabled, status, coverage) values
  ('EEA', 'efta-eea-lex', 'EEA-Lex', 'EFTA Secretariat', 'treaty', 'https://www.efta.int/', 'web', 'review_required', false, 'planned',
    '{"scope":"EEA Agreement, annexes and incorporation decisions"}'),
  ('US', 'govinfo', 'GovInfo', 'US Government Publishing Office', 'legislation', 'https://www.govinfo.gov/', 'api', 'review_required', false, 'planned',
    '{"scope":"United States Code, Code of Federal Regulations, Federal Register"}'),
  ('OHADA', 'ohada-official', 'OHADA official portal', 'OHADA Permanent Secretariat', 'legislation', 'https://www.ohada.org/', 'web',
    'review_required', false, 'planned', '{"scope":"Treaty, Uniform Acts, CCJA decisions"}'),
  ('NG', 'nigerialii', 'NigeriaLII', 'Laws.Africa / African Legal Information Institute', 'case_law', 'https://nigerialii.org/', 'web',
    'review_required', false, 'planned', '{"scope":"Judgments and legislation"}'),
  ('KE', 'kenya-law', 'Kenya Law', 'National Council for Law Reporting', 'case_law', 'https://new.kenyalaw.org/', 'web',
    'review_required', false, 'planned', '{"scope":"Laws of Kenya and Kenya Law Reports"}'),
  ('ZA', 'saflii', 'SAFLII', 'Southern African Legal Information Institute', 'case_law', 'https://www.saflii.org/', 'web',
    'review_required', false, 'planned', '{"scope":"Judgments and legislation"}'),
  ('GH', 'ghalii', 'GhaLII', 'Ghana Legal Information Institute', 'case_law', 'https://ghalii.org/', 'web',
    'review_required', false, 'planned', '{"scope":"Judgments and legislation"}'),
  ('SN', 'senegal-official-journal', 'Journal officiel du Sénégal — source discovery required', 'Government of Senegal', 'gazette', null,
    'manual', 'review_required', false, 'planned', '{"scope":"Official journal; access method to be confirmed"}')
on conflict (jurisdiction_code, source_key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 3. Multilingual legal glossary (U-22): concept-aligned terms for cross-language research
-- ---------------------------------------------------------------------------------------------
create table private.legal_glossary (
  concept_key text not null check (concept_key ~ '^[a-z][a-z0-9_]{1,59}$'),
  language_code text not null check (language_code ~ '^[a-z]{2}$'),
  term text not null check (char_length(term) between 2 and 80),
  preferred boolean not null default true,
  primary key (concept_key, language_code, term)
);
alter table private.legal_glossary enable row level security;
revoke all on private.legal_glossary from public, anon, authenticated;

insert into private.legal_glossary (concept_key, language_code, term, preferred)
select c.concept, l.lang, t.term, t.ord = 1
from (values
  ('employer', array['arbeidsgiver'], array['employer'], array['employeur']),
  ('employee', array['arbeidstaker', 'ansatt'], array['employee', 'worker'], array['salarié', 'employé']),
  ('dismissal', array['oppsigelse', 'avskjed'], array['dismissal', 'termination'], array['licenciement']),
  ('notice_period', array['oppsigelsesfrist'], array['notice period'], array['préavis']),
  ('employment_contract', array['arbeidsavtale'], array['employment contract'], array['contrat de travail']),
  ('contract', array['avtale', 'kontrakt'], array['contract', 'agreement'], array['contrat']),
  ('damages', array['erstatning'], array['damages', 'compensation'], array['dommages-intérêts', 'indemnisation']),
  ('liability', array['ansvar'], array['liability'], array['responsabilité']),
  ('appeal', array['anke', 'klage'], array['appeal'], array['appel', 'recours']),
  ('court', array['domstol', 'tingrett'], array['court'], array['tribunal', 'cour']),
  ('judgment', array['dom'], array['judgment'], array['jugement', 'arrêt']),
  ('act', array['lov'], array['act', 'statute'], array['loi']),
  ('regulation', array['forskrift'], array['regulation'], array['règlement', 'décret']),
  ('deadline', array['frist'], array['deadline', 'time limit'], array['délai']),
  ('limitation_period', array['foreldelse', 'foreldelsesfrist'], array['limitation period'], array['prescription']),
  ('lease', array['husleie', 'leieavtale'], array['lease', 'tenancy'], array['bail']),
  ('landlord', array['utleier'], array['landlord'], array['bailleur']),
  ('tenant', array['leietaker'], array['tenant'], array['locataire']),
  ('deposit', array['depositum'], array['deposit'], array['dépôt de garantie']),
  ('consumer', array['forbruker'], array['consumer'], array['consommateur']),
  ('seller', array['selger'], array['seller'], array['vendeur']),
  ('buyer', array['kjøper'], array['buyer'], array['acheteur']),
  ('defect', array['mangel'], array['defect'], array['défaut', 'vice']),
  ('complaint', array['reklamasjon', 'klage'], array['complaint'], array['réclamation', 'plainte']),
  ('personal_data', array['personopplysninger'], array['personal data'], array['données personnelles']),
  ('controller', array['behandlingsansvarlig'], array['controller'], array['responsable du traitement']),
  ('consent', array['samtykke'], array['consent'], array['consentement']),
  ('discrimination', array['diskriminering'], array['discrimination'], array['discrimination']),
  ('wage', array['lønn'], array['wage', 'salary'], array['salaire']),
  ('overtime', array['overtid'], array['overtime'], array['heures supplémentaires']),
  ('sick_leave', array['sykefravær', 'sykemelding'], array['sick leave'], array['arrêt maladie']),
  ('holiday', array['ferie'], array['holiday', 'annual leave'], array['congés payés']),
  ('accident', array['ulykke'], array['accident'], array['accident']),
  ('serious', array['alvorlig'], array['serious'], array['grave']),
  ('injury', array['skade'], array['injury'], array['blessure', 'lésion']),
  ('notify', array['varsle', 'melde'], array['notify', 'report'], array['notifier', 'déclarer']),
  ('immediately', array['straks', 'umiddelbart'], array['immediately'], array['immédiatement', 'sans délai']),
  ('authority', array['myndighet', 'tilsyn'], array['authority', 'inspectorate'], array['autorité']),
  ('labour_inspectorate', array['arbeidstilsynet'], array['labour inspectorate'], array['inspection du travail']),
  ('decision', array['vedtak', 'beslutning'], array['decision'], array['décision']),
  ('evidence', array['bevis'], array['evidence'], array['preuve']),
  ('witness', array['vitne'], array['witness'], array['témoin']),
  ('claimant', array['saksøker'], array['claimant', 'plaintiff'], array['demandeur']),
  ('defendant', array['saksøkt'], array['defendant', 'respondent'], array['défendeur']),
  ('settlement', array['forlik'], array['settlement'], array['transaction', 'règlement amiable']),
  ('lawyer', array['advokat'], array['lawyer', 'attorney'], array['avocat']),
  ('rights', array['rettigheter', 'rett'], array['rights', 'right'], array['droits', 'droit']),
  ('obligation', array['plikt', 'forpliktelse'], array['obligation', 'duty'], array['obligation']),
  ('company', array['selskap', 'aksjeselskap'], array['company'], array['société']),
  ('shareholder', array['aksjonær'], array['shareholder'], array['actionnaire'])
) c(concept, nb, en, fr)
cross join lateral (values ('nb', c.nb), ('en', c.en), ('fr', c.fr)) l(lang, terms)
cross join lateral unnest(l.terms) with ordinality t(term, ord)
on conflict do nothing;

create or replace function public.legal_glossary_terms(p_languages text[])
returns table (concept_key text, language_code text, term text, preferred boolean)
language sql stable security definer set search_path = '' as $$
  select g.concept_key, g.language_code, g.term, g.preferred from private.legal_glossary g
  where private.current_principal_id() is not null and g.language_code = any (p_languages)
  order by g.concept_key, g.language_code, g.preferred desc, g.term;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Jurisdiction readiness (P8: never advertise beyond tested coverage)
-- ---------------------------------------------------------------------------------------------
create or replace function public.jurisdiction_readiness()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', j.code, 'name', j.name, 'legalSystem', j.legal_system, 'parentCode', j.parent_code,
    'coverageLevel', j.status, 'languages', to_jsonb(j.official_languages), 'citationStyle', j.citation_style,
    'territorialNote', j.territorial_note,
    'relationships', coalesce((select jsonb_agg(jsonb_build_object('to', r.to_code, 'relationship', r.relationship, 'note', r.note))
      from private.jurisdiction_relationships r where r.from_code = j.code), '[]'::jsonb),
    'sources', (select count(*) from private.legal_sources s where s.jurisdiction_code = j.code),
    'approvedSources', (select count(*) from private.legal_sources s where s.jurisdiction_code = j.code and s.rights_status = 'approved'),
    'activeSources', (select count(*) from private.legal_sources s where s.jurisdiction_code = j.code and s.status = 'active' and s.ingestion_enabled),
    'authorities', (select count(*) from private.legal_authorities a where a.jurisdiction_code = j.code),
    'latestEvaluationPassed', (select e.passed from private.legal_retrieval_evaluations e where e.jurisdiction_code = j.code
      order by e.evaluated_at desc limit 1),
    'glossaryLanguages', (select coalesce(jsonb_agg(distinct g.language_code), '[]'::jsonb) from private.legal_glossary g
      where g.language_code = any (j.official_languages)),
    'meetsPartial', j.status in ('partial', 'supported'),
    'marketedAs', case j.status when 'supported' then 'Supported' when 'partial' then 'Supported for defined classes and periods'
      when 'pilot' then 'Preview: limited coverage' when 'planned' then 'Coming' else 'Not marketed' end)
    order by (j.metadata ->> 'priority')::int nulls last, j.code), '[]'::jsonb)
  from private.jurisdictions j
  where private.current_principal_id() is not null;
$$;

-- Research jurisdictions now include the citation style and parent, for display and formatting.
create or replace function public.research_list_jurisdictions_profile()
returns table (code text, name text, coverage_level text, official_languages text[], citation_style text, parent_code text)
language sql stable security definer set search_path = '' as $$
  select j.code, j.name, j.status, j.official_languages, j.citation_style, j.parent_code
  from private.jurisdictions j where private.current_principal_id() is not null order by j.code;
$$;

do $grants$
declare v_signature text;
begin
  foreach v_signature in array array['public.legal_glossary_terms(text[])', 'public.jurisdiction_readiness()',
    'public.research_list_jurisdictions_profile()'] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$grants$;
