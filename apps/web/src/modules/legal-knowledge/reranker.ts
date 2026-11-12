// Second-stage legal reranker (extends, does not replace, executeLegalRetrieval).
//
// The first stage (lexical, semantic or hybrid search with the effective-date, status, language
// and jurisdiction filters in rankLegalPassages) produces a candidate pool. This stage re-scores
// that pool with legal signals and records, for every passage, which signals moved it and by how
// much (evidence traceability). It is deterministic: no model call, same input, same order.
//
// Signals (each in [0, 1]):
//   retrieval     first-stage score fused with reciprocal ranks of the lexical and semantic lists
//   jurisdiction  home jurisdiction 1, a related jurisdiction (OHADA for CM, EU via EEA for NO) less
//   authority     position in the hierarchy of legal authority (constitution > act > regulation …)
//   currency      confidence that the text is in force on the as-of date
//   provision     the passage is the provision the question names (§ 15-3, article 5, kapittel 4)
//   citation      the question names the authority (citation, short title or title words)
//   language      the passage is in the preferred language
// Then: authority support (several passages of one authority agree), a relative confidence
// cutoff that drops weak tails, and abstention when nothing reaches the absolute minimum.
import type { RankedLegalPassage, RetrievalPlan } from './retrieval.ts';

export interface RerankFeatures {
  retrieval: number;
  jurisdiction: number;
  authority: number;
  currency: number;
  provision: number;
  citation: number;
  language: number;
}
export type RerankWeights = Readonly<Record<keyof RerankFeatures, number>>;

export interface RerankTrace {
  rerankerVersion: string;
  firstStageRank: number;
  firstStageScore: number;
  features: RerankFeatures;
  authoritySupport: number;
  score: number;
  reasons: string[];
}
export interface RerankedLegalPassage extends RankedLegalPassage {
  rerank: RerankTrace;
}

export interface LegalRerankerOptions {
  weights?: Partial<RerankWeights>;
  /** Related jurisdictions and their weight (the plan's own jurisdiction is always 1). */
  relatedJurisdictions?: Readonly<Record<string, number>>;
  /** The language the user asked in; passages in it are preferred. */
  preferredLanguage?: string | null;
  /** Drop passages scoring below this share of the best score. */
  relativeCutoff?: number;
  /** Abstain (return nothing) when the best score is below this. */
  abstainBelow?: number;
  /** Maximum passages kept per authority (the rest are redundant evidence). */
  maxPassagesPerAuthority?: number;
  /**
   * Authority-level confidence cut: keep only authorities whose best passage scores at least this
   * share of the best authority's score. 0 keeps every authority (passage-level cut only).
   */
  authorityMargin?: number;
  /** At most this many distinct authorities are returned. */
  maxAuthorities?: number;
}
export interface LegalReranker {
  readonly version: string;
  rerank(plan: RetrievalPlan, question: string, passages: readonly RankedLegalPassage[]): RerankedLegalPassage[];
}

// 1.1.0: authority-level confidence cut (authorityMargin, maxAuthorities).
export const LEGAL_RERANKER_VERSION = 'legal-rerank-1.1.0';

/**
 * Calibrated profile (2026-11-12, lovdata-no-v1, 41 cases, real corpus of 753 acts / 31 007
 * embedded passages). 36-run sweep; the best setting passing every gate:
 * Precision@5 0.774, Recall@10 0.974, MRR 0.897, currency 1.000, section hit 0.923.
 * One or two authorities fail currency (a wrong top act cuts the right one); three is the floor.
 * Tuned on the scored set: confirm on a held-out set before any coverage claim.
 */
export const CALIBRATED_RERANK_OPTIONS: Readonly<LegalRerankerOptions> = Object.freeze({
  authorityMargin: 0.9,
  maxAuthorities: 3,
  maxPassagesPerAuthority: 10,
});

export const DEFAULT_RERANK_WEIGHTS: RerankWeights = Object.freeze({
  retrieval: 0.42,
  provision: 0.18,
  citation: 0.14,
  authority: 0.1,
  currency: 0.08,
  jurisdiction: 0.05,
  language: 0.03,
});

/** Hierarchy of legal authority used for ranking; higher binds more. */
export const AUTHORITY_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  constitution: 1,
  treaty: 0.9,
  act: 0.9,
  regulation_eu: 0.85,
  directive: 0.8,
  regulation: 0.75,
  statutory_instrument: 0.75,
  judgment: 0.7,
  decision: 0.6,
  order: 0.55,
  official_guidance: 0.45,
  other: 0.3,
});

const CURRENCY_WEIGHTS: Readonly<Record<RankedLegalPassage['legalStatus'], number>> = Object.freeze({
  in_force: 1,
  amended: 0.8,
  unknown: 0.55,
  repealed: 0,
  expired: 0,
  overruled: 0,
});

const RRF_K = 60;

// ------------------------------------------------------------------ provisions in the question
export interface ProvisionReference {
  kind: 'section' | 'article' | 'chapter';
  label: string;
}
const PROVISION_PATTERNS: readonly [ProvisionReference['kind'], RegExp][] = [
  ['section', /§{1,2}\s*(\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?)/giu],
  ['section', /\b(?:section|sec\.|s\.|paragraf|paragraph)\s*(\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?)/giu],
  ['article', /\b(?:article|art\.|artikkel|artikel|artículo)\s*(\d+[a-z]?)/giu],
  ['chapter', /\b(?:chapter|kapittel|kapitel|chapitre|ch\.)\s*(\d+[a-z]?)/giu],
];
export function extractProvisionReferences(question: string): ProvisionReference[] {
  const found = new Map<string, ProvisionReference>();
  for (const [kind, pattern] of PROVISION_PATTERNS) {
    for (const match of question.matchAll(pattern)) {
      const label = match[1]!.replace(/\s+/g, '').toLowerCase();
      found.set(kind + ':' + label, { kind, label });
    }
  }
  return [...found.values()];
}
function provisionLabelOf(part: string): ProvisionReference | null {
  const text = part.trim().toLowerCase();
  const section = /^§{1,2}\s*(\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?)/u.exec(text);
  if (section) return { kind: 'section', label: section[1]!.replace(/\s+/g, '') };
  const article = /^(?:article|art\.|artikkel|artikel)\s*(\d+[a-z]?)/u.exec(text);
  if (article) return { kind: 'article', label: article[1]! };
  const chapter = /^(?:chapter|kapittel|kapitel|chapitre)\s*(\d+[a-z]?)/u.exec(text);
  if (chapter) return { kind: 'chapter', label: chapter[1]! };
  return null;
}
function provisionScore(references: readonly ProvisionReference[], passage: RankedLegalPassage): number {
  if (!references.length) return 0;
  const path = passage.sectionPath.map(provisionLabelOf).filter((x): x is ProvisionReference => x !== null);
  const last = path[path.length - 1];
  let best = 0;
  for (const reference of references) {
    // Articles and sections are interchangeable labels in many systems (art. 5 / § 5).
    const unit = (r: ProvisionReference) => (r.kind === 'chapter' ? 'chapter' : 'unit');
    if (last && unit(last) === unit(reference) && last.label === reference.label) best = Math.max(best, 1);
    else if (path.some(p => unit(p) === unit(reference) && p.label === reference.label)) best = Math.max(best, 0.7);
    else {
      const opening = passage.passageContent.slice(0, 80).toLowerCase().replace(/\s+/g, '');
      if (reference.kind !== 'chapter' && (opening.startsWith('§' + reference.label) || opening.startsWith('§' + reference.label + '.'))) {
        best = Math.max(best, 0.85);
      }
    }
  }
  return best;
}

// ------------------------------------------------------------------ citation relevance
const STOPWORDS = new Set(['the', 'and', 'for', 'of', 'in', 'on', 'to', 'a', 'an', 'is', 'what', 'which', 'how', 'when', 'who',
  'om', 'og', 'i', 'på', 'av', 'til', 'for', 'med', 'er', 'hva', 'hvilke', 'hvordan', 'når', 'den', 'det', 'de', 'en', 'et',
  'le', 'la', 'les', 'des', 'du', 'de', 'et', 'en', 'au', 'aux', 'est', 'quel', 'quelle', 'comment', 'lov', 'loven', 'act', 'law']);
function words(text: string): string[] {
  return text.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}-]+/u).filter(w => w.length >= 3 && !STOPWORDS.has(w));
}
function citationScore(question: string, passage: RankedLegalPassage): number {
  const q = question.toLowerCase().normalize('NFKC');
  if (passage.citation && q.includes(passage.citation.toLowerCase())) return 1;
  const title = passage.authorityTitle.toLowerCase().normalize('NFKC');
  // A short title in parentheses ("Lov om arbeidsmiljø … (arbeidsmiljøloven)") or a one-word title.
  const short = /\(([^)]{3,60})\)\s*$/.exec(title)?.[1]?.trim();
  if (short && q.includes(short)) return 1;
  const titleWords = new Set(words(title));
  if (!titleWords.size) return 0;
  const questionWords = words(question);
  // Compound-word languages: a question word that contains, or is contained in, a title word counts.
  const hits = [...titleWords].filter(t => questionWords.some(w => w === t || (w.length >= 5 && t.length >= 5 && (w.includes(t) || t.includes(w)))));
  return Math.min(1, hits.length / Math.min(titleWords.size, 4));
}

// ------------------------------------------------------------------ reranker
function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function validateOptions(options: LegalRerankerOptions): Required<Omit<LegalRerankerOptions, 'preferredLanguage' | 'weights'>> & {
  weights: RerankWeights; preferredLanguage: string | null;
} {
  const weights = { ...DEFAULT_RERANK_WEIGHTS, ...(options.weights ?? {}) };
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (Object.values(weights).some(w => !Number.isFinite(w) || w < 0) || Math.abs(total - 1) > 1e-6) {
    throw new Error('LEGAL_RERANK_WEIGHTS_INVALID');
  }
  const relativeCutoff = options.relativeCutoff ?? 0.6;
  const abstainBelow = options.abstainBelow ?? 0.2;
  const maxPassagesPerAuthority = options.maxPassagesPerAuthority ?? 3;
  const authorityMargin = options.authorityMargin ?? 0;
  const maxAuthorities = options.maxAuthorities ?? 10;
  if (!(relativeCutoff >= 0 && relativeCutoff < 1) || !(abstainBelow >= 0 && abstainBelow < 1) ||
      !(authorityMargin >= 0 && authorityMargin < 1) || !Number.isInteger(maxAuthorities) || maxAuthorities < 1 || maxAuthorities > 50 ||
      !Number.isInteger(maxPassagesPerAuthority) || maxPassagesPerAuthority < 1 || maxPassagesPerAuthority > 20) {
    throw new Error('LEGAL_RERANK_OPTIONS_INVALID');
  }
  const relatedJurisdictions = options.relatedJurisdictions ?? {};
  if (Object.values(relatedJurisdictions).some(w => !(w >= 0 && w <= 1))) throw new Error('LEGAL_RERANK_OPTIONS_INVALID');
  return { weights, relatedJurisdictions, preferredLanguage: options.preferredLanguage ?? null, relativeCutoff, abstainBelow, maxPassagesPerAuthority, authorityMargin, maxAuthorities };
}

export function createLegalReranker(options: LegalRerankerOptions = {}): LegalReranker {
  const config = validateOptions(options);
  return Object.freeze({
    version: LEGAL_RERANKER_VERSION,
    rerank(plan: RetrievalPlan, question: string, passages: readonly RankedLegalPassage[]): RerankedLegalPassage[] {
      if (!passages.length) return [];
      const references = extractProvisionReferences(question);
      // Competition ranking: passages with equal scores share a rank, so ties are not broken by
      // an arbitrary identifier order.
      const rankOf = (key: 'lexicalScore' | 'semanticScore') => {
        const scores = passages.filter(p => p[key] !== null).map(p => p[key]!);
        return new Map(passages.filter(p => p[key] !== null)
          .map(p => [p.passageId, 1 + scores.filter(s => s > p[key]!).length]));
      };
      const lexicalRanks = rankOf('lexicalScore');
      const semanticRanks = rankOf('semanticScore');
      const maxRrf = 2 / (RRF_K + 1);

      const scored = passages.map(passage => {
        const lexicalRank = lexicalRanks.get(passage.passageId);
        const semanticRank = semanticRanks.get(passage.passageId);
        const rrf = (lexicalRank ? 1 / (RRF_K + lexicalRank) : 0) + (semanticRank ? 1 / (RRF_K + semanticRank) : 0);
        const features: RerankFeatures = {
          retrieval: clamp(0.6 * clamp(passage.score) + 0.4 * (rrf / maxRrf)),
          jurisdiction: passage.jurisdictionCode === plan.jurisdictionCode ? 1 : clamp(config.relatedJurisdictions[passage.jurisdictionCode] ?? 0),
          authority: AUTHORITY_WEIGHTS[passage.authorityType] ?? AUTHORITY_WEIGHTS.other!,
          currency: (CURRENCY_WEIGHTS[passage.legalStatus] ?? 0) * (passage.validFrom ? 1 : 0.9),
          provision: provisionScore(references, passage),
          citation: citationScore(question, passage),
          language: !config.preferredLanguage || passage.languageCode === config.preferredLanguage ? 1 : 0.8,
        };
        // When the question names no provision, that signal is neutral rather than a penalty.
        const effective = { ...features, provision: references.length ? features.provision : features.retrieval };
        const score = (Object.keys(config.weights) as (keyof RerankFeatures)[])
          .reduce((sum, key) => sum + config.weights[key] * effective[key], 0);
        return { passage, features, base: clamp(score) };
      });

      // Authority support: several passages of one authority in the pool corroborate it.
      const support = new Map<string, number>();
      for (const item of scored) {
        if (item.base >= config.abstainBelow) support.set(item.passage.authorityId, (support.get(item.passage.authorityId) ?? 0) + 1);
      }
      const ranked = scored.map(item => {
        const authoritySupport = Math.min(0.06, 0.02 * Math.max(0, (support.get(item.passage.authorityId) ?? 1) - 1));
        return { ...item, authoritySupport, score: clamp(item.base + authoritySupport) };
      }).sort((a, b) => b.score - a.score || a.passage.rank - b.passage.rank || a.passage.passageId.localeCompare(b.passage.passageId));

      const best = ranked[0]!.score;
      if (best < config.abstainBelow) return [];
      // Authority-level cut: authorities ranked by their best passage; keep those within the margin.
      const authorityBest = new Map<string, number>();
      for (const item of ranked) if (!authorityBest.has(item.passage.authorityId)) authorityBest.set(item.passage.authorityId, item.score);
      const keptAuthorities = new Set([...authorityBest.entries()]
        .filter(([, score]) => score >= config.authorityMargin * best)
        .slice(0, config.maxAuthorities).map(([id]) => id));
      const perAuthority = new Map<string, number>();
      const kept = ranked.filter(item => {
        if (item.score < config.relativeCutoff * best || item.score < config.abstainBelow) return false;
        if (!keptAuthorities.has(item.passage.authorityId)) return false;
        const count = perAuthority.get(item.passage.authorityId) ?? 0;
        if (count >= config.maxPassagesPerAuthority) return false;
        perAuthority.set(item.passage.authorityId, count + 1);
        return true;
      }).slice(0, plan.limit);

      return kept.map((item, index) => {
        const reasons: string[] = [];
        if (item.features.provision === 1) reasons.push('Matches the provision named in the question.');
        else if (item.features.provision > 0) reasons.push('Within the provision named in the question.');
        if (item.features.citation === 1) reasons.push('The question names this authority.');
        if (item.features.jurisdiction < 1) reasons.push('From a related jurisdiction (' + item.passage.jurisdictionCode + ').');
        if (item.features.currency < 1) reasons.push('Currency on the as-of date is less certain (' + item.passage.legalStatus + (item.passage.validFrom ? '' : ', no start date') + ').');
        if (item.authoritySupport > 0) reasons.push('Several passages of this authority were retrieved.');
        if (item.passage.lexicalScore !== null && item.passage.semanticScore !== null) reasons.push('Found by both lexical and semantic search.');
        return {
          ...item.passage,
          score: item.score,
          rank: index + 1,
          rerank: {
            rerankerVersion: LEGAL_RERANKER_VERSION,
            firstStageRank: item.passage.rank,
            firstStageScore: item.passage.score,
            features: item.features,
            authoritySupport: item.authoritySupport,
            score: item.score,
            reasons,
          },
        };
      });
    },
  });
}
