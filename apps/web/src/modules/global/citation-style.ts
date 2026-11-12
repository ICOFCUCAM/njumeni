// Jurisdiction-specific citation conventions (Phase 12; master plan §6 "legal citation conventions").
export type CitationStyle =
  | 'generic'
  | 'norway'
  | 'eu'
  | 'uk'
  | 'us'
  | 'international'
  | 'ohada'
  | 'cameroon'
  | 'commonwealth_africa'
  | 'civil_africa';

export interface CitableAuthority {
  citation: string;
  title: string;
  authorityType: string;
  /** Provision label as written in the source, e.g. "15-7", "98", "6(1)(a)". */
  provision?: string | null;
  /** Language of the output: 'fr' switches French conventions where they exist. */
  language?: string;
}

export function formatCitation(style: CitationStyle, a: CitableAuthority): string {
  const p = a.provision?.trim();
  const isJudgment = a.authorityType === 'judgment' || a.authorityType === 'decision';
  switch (style) {
    case 'norway':
      // Lov 17. juni 2005 nr. 62 (arbeidsmiljøloven) § 15-7 — shown with the official identifier.
      return isJudgment ? a.citation : `${a.title} (${a.citation})${p ? ` § ${p}` : ''}`;
    case 'eu':
      return `${a.title}${p ? `, Art. ${p}` : ''}${a.citation && !a.title.includes(a.citation) ? ` (${a.citation})` : ''}`;
    case 'uk':
      return isJudgment ? a.citation : `${a.title}${p ? `, s. ${p}` : ''}`;
    case 'us':
      // e.g. 42 U.S.C. § 2000e-2 when the citation is a code title; otherwise the act and section.
      return /U\.S\.C\.|C\.F\.R\./.test(a.citation)
        ? `${a.citation}${p ? ` § ${p}` : ''}`
        : `${a.title}${p ? ` § ${p}` : ''}`;
    case 'ohada':
    case 'civil_africa':
    case 'cameroon':
      if (isJudgment) return a.citation;
      return a.language === 'en'
        ? `${a.title}${p ? `, Article ${p}` : ''}`
        : `${a.title}${p ? `, art. ${p}` : ''}`;
    case 'international':
      return `${a.title}${p ? `, art. ${p}` : ''}${a.citation ? ` (${a.citation})` : ''}`;
    case 'commonwealth_africa':
      return isJudgment ? a.citation : `${a.title}${p ? `, section ${p}` : ''}`;
    default:
      return `${a.title}${p ? `, ${p}` : ''} (${a.citation})`;
  }
}
