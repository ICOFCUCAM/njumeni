-- Lovdata licence policy, version 2 (owner rights review, 2026-11-12).
--
-- The owner read the NLOD 2.0 text (https://data.norge.no/nlod/en/2.0):
--   section 2 permits copying, modification, combination and redistribution for any purpose,
--   subject to the licence conditions;
--   section 5 requires attribution to the licensor and a reference to the licence, links to the
--   licence and the original source where practicable, and identification of modifications.
-- Version 2 adopts the owner's attribution, which also states that Njumeni processed and indexed
-- the material (the modification notice). Hosts, datasets and permitted uses are unchanged.
-- Version 1 stays on record (policies are append-only); this source only.
-- Nothing here approves, activates or enables the source.

select public.legal_source_record_licence_policy(
  'lovdata-official',
  'Owner rights review 2026-11-12 (recorded by migration 20261113100000)',
  'NLOD-2.0',
  'https://data.norge.no/nlod/en/2.0',
  'Contains data made available by Lovdata under the Norwegian Licence for Open Government Data (NLOD) 2.0. '
    || 'Source: Lovdata. Njumeni has processed and indexed the material for legal research. '
    || 'The authoritative legal text remains attributable to its original source.',
  array['api.lovdata.no'],
  array['gjeldende-lover.tar.bz2', 'gjeldende-sentrale-forskrifter.tar.bz2'],
  '{"retrieval_augmented_generation":true,"commercial_use":true,"display":true,"quotation":true,
    "redistribution":true,"model_training":false,"model_fine_tuning":false,"website_scraping":false}'::jsonb,
  array[
    'Attribute Lovdata as licensor and reference NLOD 2.0 wherever the material is displayed or redistributed (NLOD 2.0 section 5).',
    'Link to the licence (https://data.norge.no/nlod/en/2.0) and to the original Lovdata source where practicable.',
    'Identify that the material has been processed and indexed by Njumeni (modification notice, NLOD 2.0 section 5).',
    'Acquire data only from the official API (api.lovdata.no); bulk download and systematic extraction from the website are prohibited (Lovdata user terms 2.3).',
    'Only the licensed public API datasets of current laws and central regulations are covered; Norsk Lovtidend archives are not.',
    'Ordinary Lovdata website content must not be used for AI training or development of AI algorithms (Lovdata user terms 2.1).',
    'No model fine-tuning on Lovdata material without separate legal confirmation.',
    'This policy does not extend to any other source.'],
  array['https://data.norge.no/nlod/en/2.0',
    'https://lovdata.no/info/brukeravtale',
    'https://lovdata.no/artikkel/lovdata_tilrettelegger_for_bruk_tilpasset_var_ki-hverdag_gjor_api_av_oppdatert_regelverk_gratis_tilgjengelig_for_alle/5277',
    'https://api.lovdata.no/v1/publicData/list'],
  'Owner rights review 2026-11-12. NLOD 2.0 text verified: section 2 permits copying, modification, combination and '
    || 'redistribution for any purpose; section 5 requires attribution to the licensor, a reference to the licence, links '
    || 'where practicable and identification of modifications. Lovdata user terms 2.3 release current formal laws and '
    || 'central regulations under NLOD 2.0 with Lovdata named as source and direct larger downloads to the open API; '
    || 'website bulk download, systematic extraction and AI training remain prohibited (2.1, 2.3).'
)
where exists (select 1 from private.legal_sources where source_key = 'lovdata-official');
