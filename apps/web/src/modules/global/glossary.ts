// Cross-language legal queries through the concept-aligned legal glossary (Phase 12, U-22).
// A question asked in one language is rewritten as the legal concepts it mentions, expressed in
// the sources' language. Only recognised concepts are carried over, so nothing is invented, and
// the rewrite is disclosed with the research result.
export interface GlossaryTerm {
  concept_key: string;
  language_code: string;
  term: string;
  preferred: boolean;
}

function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')} `;
}

/** Concepts mentioned in the text (longest terms first, so "notice period" wins over "notice"). */
export function conceptsIn(
  text: string,
  language: string,
  glossary: readonly GlossaryTerm[],
): string[] {
  let haystack = normalise(text);
  const found: string[] = [];
  const terms = glossary
    .filter((t) => t.language_code === language)
    .sort((a, b) => b.term.length - a.term.length);
  for (const term of terms) {
    const needle = ` ${term.term.toLowerCase()} `;
    // Allow simple inflection: a trailing -s/-e/-en/-er/-ne on the last word.
    const pattern = new RegExp(
      ` ${term.term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|e|en|er|ne|et|a)? `,
      'u',
    );
    if (haystack.includes(needle) || pattern.test(haystack)) {
      if (!found.includes(term.concept_key)) found.push(term.concept_key);
      haystack = haystack.replace(pattern, ' ');
    }
  }
  return found;
}

export function translateQuery(
  text: string,
  from: string,
  to: string,
  glossary: readonly GlossaryTerm[],
): { query: string; concepts: string[] } | null {
  if (from === to) return null;
  const concepts = conceptsIn(text, from, glossary);
  const terms = concepts
    .map(
      (concept) =>
        glossary.find((t) => t.concept_key === concept && t.language_code === to && t.preferred) ??
        glossary.find((t) => t.concept_key === concept && t.language_code === to),
    )
    .filter((t): t is GlossaryTerm => Boolean(t))
    .map((t) => t.term);
  // Too little recognised to search meaningfully in another language.
  if (terms.length < 2) return null;
  return { query: terms.join(' '), concepts };
}
