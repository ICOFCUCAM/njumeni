// Language detection for legal questions (Phase 12, U-22). Deterministic and stopword-based:
// adequate for routing a question to the right search language, not for translation.
export type DetectedLanguage = 'nb' | 'nn' | 'en' | 'fr' | 'unknown';

const MARKERS: Record<Exclude<DetectedLanguage, 'unknown'>, string[]> = {
  nb: [
    'og',
    'ikke',
    'jeg',
    'det',
    'som',
    'på',
    'av',
    'har',
    'skal',
    'må',
    'kan',
    'når',
    'hva',
    'hvordan',
    'etter',
    'til',
    'om',
    'min',
    'meg',
    'eller',
    'ble',
    'hvis',
  ],
  nn: [
    'ikkje',
    'eg',
    'kva',
    'korleis',
    'kven',
    'kvifor',
    'ein',
    'eit',
    'berre',
    'frå',
    'òg',
    'vere',
    'mykje',
  ],
  en: [
    'the',
    'and',
    'is',
    'are',
    'my',
    'can',
    'what',
    'when',
    'how',
    'must',
    'after',
    'to',
    'of',
    'for',
    'with',
    'does',
    'do',
    'i',
    'an',
    'if',
    'was',
  ],
  fr: [
    'le',
    'la',
    'les',
    'des',
    'est',
    'une',
    'un',
    'et',
    'que',
    'qui',
    'pour',
    'dans',
    'pas',
    'mon',
    'ma',
    'je',
    'quand',
    'comment',
    'doit',
    'peut',
    'après',
    'du',
    'au',
  ],
};

export function detectLanguage(text: string): DetectedLanguage {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length === 0) return 'unknown';
  const score = (lang: keyof typeof MARKERS) =>
    words.filter((w) => MARKERS[lang].includes(w)).length;
  // Nynorsk shares most function words with Bokmål: any Nynorsk-specific form decides it.
  if (score('nn') > 0) return 'nn';
  const ranked = (['nb', 'en', 'fr'] as const)
    .map((l) => [l, score(l)] as const)
    .sort((a, b) => b[1] - a[1]);
  const [best, top] = ranked[0]!;
  if (top === 0) return /[æøå]/i.test(text) ? 'nb' : 'unknown';
  return best;
}
