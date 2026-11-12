import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage } from '../src/modules/global/language.ts';
import { conceptsIn, translateQuery } from '../src/modules/global/glossary.ts';
import { formatCitation } from '../src/modules/global/citation-style.ts';
import { LOCALES, messageKeys, messagesFor, resolveLocale, t } from '../src/modules/global/i18n.ts';

const G = [
  ['employer', 'nb', 'arbeidsgiver'],
  ['employer', 'en', 'employer'],
  ['employer', 'fr', 'employeur'],
  ['notify', 'nb', 'varsle'],
  ['notify', 'en', 'notify'],
  ['notify', 'fr', 'notifier'],
  ['accident', 'nb', 'ulykke'],
  ['accident', 'en', 'accident'],
  ['accident', 'fr', 'accident'],
  ['serious', 'nb', 'alvorlig'],
  ['serious', 'en', 'serious'],
  ['serious', 'fr', 'grave'],
  ['notice_period', 'nb', 'oppsigelsesfrist'],
  ['notice_period', 'en', 'notice period'],
  ['notice_period', 'fr', 'préavis'],
  ['labour_inspectorate', 'nb', 'arbeidstilsynet'],
  ['labour_inspectorate', 'en', 'labour inspectorate'],
].map(([concept_key, language_code, term]) => ({
  concept_key,
  language_code,
  term,
  preferred: true,
}));

test('questions are routed by language', () => {
  assert.equal(detectLanguage('Når må arbeidsgiver varsle Arbeidstilsynet etter en ulykke?'), 'nb');
  assert.equal(detectLanguage('Kva må eg gjere når arbeidsgivaren ikkje betaler?'), 'nn');
  assert.equal(
    detectLanguage('When must the employer notify the inspectorate after a serious accident?'),
    'en',
  );
  assert.equal(detectLanguage('Quand l’employeur doit-il déclarer un accident grave ?'), 'fr');
  assert.equal(detectLanguage('—'), 'unknown');
});

test('an English question becomes a Norwegian concept query, inventing nothing', () => {
  const english = 'When must the employer notify the labour inspectorate after a serious accident?';
  assert.deepEqual(conceptsIn(english, 'en', G).sort(), [
    'accident',
    'employer',
    'labour_inspectorate',
    'notify',
    'serious',
  ]);
  const translated = translateQuery(english, 'en', 'nb', G);
  assert.deepEqual(translated.query.split(' ').sort(), [
    'alvorlig',
    'arbeidsgiver',
    'arbeidstilsynet',
    'ulykke',
    'varsle',
  ]);
  assert.equal(
    translateQuery('What is the weather like in Paris?', 'en', 'nb', G),
    null,
    'too few legal concepts: no rewrite',
  );
  assert.equal(translateQuery(english, 'en', 'en', G), null, 'same language: no rewrite');
  assert.deepEqual(
    conceptsIn('What is my notice period?', 'en', G),
    ['notice_period'],
    'multi-word terms win over their parts',
  );
  assert.deepEqual(
    conceptsIn('Employers must notify', 'en', G).sort(),
    ['employer', 'notify'],
    'simple inflections are recognised',
  );
});

test('citations follow the convention of each jurisdiction', () => {
  const act = {
    citation: 'LOV-2005-06-17-62',
    title: 'Arbeidsmiljøloven',
    authorityType: 'act',
    provision: '15-7',
  };
  assert.equal(formatCitation('norway', act), 'Arbeidsmiljøloven (LOV-2005-06-17-62) § 15-7');
  assert.equal(
    formatCitation('uk', {
      citation: '1996 c. 18',
      title: 'Employment Rights Act 1996',
      authorityType: 'act',
      provision: '98',
    }),
    'Employment Rights Act 1996, s. 98',
  );
  assert.equal(
    formatCitation('uk', { citation: '[2024] UKSC 1', title: 'X v Y', authorityType: 'judgment' }),
    '[2024] UKSC 1',
  );
  assert.equal(
    formatCitation('eu', {
      citation: 'CELEX 32016R0679',
      title: 'Regulation (EU) 2016/679',
      authorityType: 'regulation_eu',
      provision: '6',
    }),
    'Regulation (EU) 2016/679, Art. 6 (CELEX 32016R0679)',
  );
  assert.equal(
    formatCitation('us', {
      citation: '42 U.S.C.',
      title: 'Civil Rights Act',
      authorityType: 'act',
      provision: '2000e-2',
    }),
    '42 U.S.C. § 2000e-2',
  );
  assert.equal(
    formatCitation('ohada', {
      citation: 'AUSCGIE',
      title: 'Acte uniforme relatif au droit des sociétés commerciales',
      authorityType: 'act',
      provision: '414',
    }),
    'Acte uniforme relatif au droit des sociétés commerciales, art. 414',
  );
  assert.equal(
    formatCitation('commonwealth_africa', {
      citation: 'Cap 226',
      title: 'Employment Act',
      authorityType: 'act',
      provision: '45',
    }),
    'Employment Act, section 45',
  );
});

test('every interface string exists in every locale, and locales resolve sensibly', () => {
  for (const locale of LOCALES)
    for (const key of messageKeys())
      assert.ok(messagesFor(locale)[key]?.length > 0, `${locale}:${key}`);
  assert.equal(resolveLocale('nb-NO', null), 'nb');
  assert.equal(resolveLocale(null, 'nn-NO,nn;q=0.9,en;q=0.8'), 'nb');
  assert.equal(resolveLocale('', 'fr-CM,fr;q=0.9'), 'fr');
  assert.equal(resolveLocale('de-DE', 'de'), 'en');
  assert.equal(
    t('fr', 'disclaimer.legal_information'),
    'Il s’agit d’une information juridique, et non d’un conseil juridique.',
  );
});
