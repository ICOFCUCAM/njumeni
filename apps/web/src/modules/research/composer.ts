// Grounded, extractive answer composition (Phase 4). Every legal statement is a verbatim extract
// from a retrieved, in-force, rights-approved passage, recorded with its citation so that the
// database can verify it. AI interpretation is added in Phase 5; until then the engine never
// paraphrases law, and it abstains when nothing verifiable is found.
import type { RerankedLegalPassage, RerankTrace } from '../legal-knowledge/reranker.ts';
import type { RankedLegalPassage } from '../legal-knowledge/retrieval.ts';

// 1.1.0: second-stage legal reranking with a recorded trace per finding.
export const RESEARCH_ENGINE_VERSION = 'extractive-1.1.0';
const MAX_AUTHORITIES = 5;

export type ClaimCategory =
  | 'verified_authority'
  | 'interpretation'
  | 'factual_assumption'
  | 'inference'
  | 'unresolved_question'
  | 'conflicting_authority';

export interface ResearchClaimInput {
  category: ClaimCategory;
  statement: string;
  passage_id?: string;
  citation_text?: string;
  quoted_text?: string;
}
export interface ResearchFindingInput {
  rank: number;
  passage_id: string;
  score: number;
  /** The second-stage reranker's trace, when the passages were reranked (evidence traceability). */
  trace?: RerankTrace;
}
export interface AuthorityContextEdge {
  from_authority_id: string;
  to_authority_id: string;
  relationship_type: string;
  effective_from: string | null;
  to_citation: string | null;
  to_title: string;
  after_as_of: boolean;
}
export interface SourcePermission {
  source_key: string;
  display_permitted: boolean;
  quote_permitted: boolean;
  attribution_text: string | null;
}
export interface ComposedResearch {
  claims: ResearchClaimInput[];
  findings: ResearchFindingInput[];
  limitations: string[];
}

const STOPWORDS = new Set([
  'når',
  'hva',
  'hvem',
  'hvor',
  'hvordan',
  'hvorfor',
  'skal',
  'må',
  'kan',
  'har',
  'det',
  'den',
  'som',
  'for',
  'med',
  'til',
  'av',
  'og',
  'om',
  'en',
  'et',
  'er',
  'på',
  'i',
  'jeg',
  'min',
  'what',
  'when',
  'who',
  'how',
  'why',
  'must',
  'can',
  'the',
  'and',
  'for',
  'with',
  'does',
  'have',
  'has',
  'are',
  'is',
  'of',
  'to',
  'in',
  'on',
  'a',
  'an',
  'my',
  'do',
  'be',
  'quand',
  'que',
  'qui',
  'les',
  'des',
  'une',
  'est',
  'pour',
  'dans',
  'sur',
  'doit',
]);

/** Crude cross-language stem: lower-case, letters only, first five characters. */
function stems(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/\p{L}+/gu) ?? [])
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
      .map((word) => word.slice(0, 5)),
  );
}

/** Sentences of a passage, each an exact substring of it. */
// Abbreviations common in Norwegian, English and French legal text that end with a full stop
// but do not end a sentence.
const ABBREVIATIONS =
  /(?:^|\s)(?:jf|jfr|nr|f\.eks|bl\.a|m\.m|mv|ca|pkt|bokst|art|ledd|kap|e\.g|i\.e|cf|no|para|al|ex|cit|op|vs)\.$/i;

export function sentencesOf(content: string): string[] {
  const pieces = content
    .split(/(?<=[.!?])\s+(?=[\p{Lu}"«(§])|\n+/u)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
  const sentences: string[] = [];
  for (const piece of pieces) {
    const previous = sentences.at(-1);
    if (previous !== undefined && ABBREVIATIONS.test(previous)) {
      // Rejoin with the original separator so the sentence stays an exact substring.
      const start = content.indexOf(previous);
      const end = content.indexOf(piece, start + previous.length);
      sentences[sentences.length - 1] = content.slice(start, end + piece.length);
    } else {
      sentences.push(piece);
    }
  }
  return sentences.filter((sentence) => content.includes(sentence));
}

/** The sentence sharing the most stems with the question (ties: the earliest). */
export function bestSentence(question: string, content: string): string {
  const wanted = stems(question);
  let best = '';
  let bestScore = -1;
  for (const sentence of sentencesOf(content)) {
    const have = stems(sentence);
    let score = 0;
    for (const stem of wanted) if (have.has(stem)) score += 1;
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  return (best || content).slice(0, 1500);
}

// Relationships surfaced to the user. Overruling and conflicts are 'conflicting_authority';
// a decision interpreting, applying or distinguishing the law is 'interpretation'.
const RELATIONSHIP_CLAIMS: Record<string, { category: ClaimCategory; phrase: string }> = {
  overruled_by: { category: 'conflicting_authority', phrase: 'is recorded as overruled by' },
  conflicts_with: { category: 'conflicting_authority', phrase: 'is recorded as conflicting with' },
  distinguishes: { category: 'interpretation', phrase: 'is distinguished in' },
  interprets: { category: 'interpretation', phrase: 'is interpreted in' },
  applies: { category: 'interpretation', phrase: 'is applied in' },
};

const LATER_CHANGE_PHRASES: Record<string, string> = {
  amended_by: 'amended by',
  replaced_by: 'replaced by',
  repealed_by: 'repealed by',
};

export function composeResearchAnswer(input: {
  question: string;
  asOfDate: string;
  jurisdictionCode: string;
  coverageLevel: string;
  passages: readonly RankedLegalPassage[];
  context: readonly AuthorityContextEdge[];
  permissions: readonly SourcePermission[];
}): ComposedResearch {
  const permissionBySource = new Map(input.permissions.map((p) => [p.source_key, p]));
  const claims: ResearchClaimInput[] = [];
  const limitations: string[] = [];
  const findings: ResearchFindingInput[] = input.passages.map((passage, index) => {
    const trace = (passage as Partial<RerankedLegalPassage>).rerank;
    return {
      rank: index + 1,
      passage_id: passage.passageId,
      score: Math.max(0, Math.min(1, passage.score)),
      ...(trace ? { trace } : {}),
    };
  });

  // One claim per authority (its best-ranked passage), in rank order.
  const seen = new Set<string>();
  const chosen: RankedLegalPassage[] = [];
  for (const passage of input.passages) {
    if (seen.has(passage.authorityId)) continue;
    const permission = permissionBySource.get(passage.sourceKey);
    if (!permission?.display_permitted) continue;
    seen.add(passage.authorityId);
    chosen.push(passage);
    if (chosen.length === MAX_AUTHORITIES) break;
  }

  for (const passage of chosen) {
    const permission = permissionBySource.get(passage.sourceKey)!;
    const label = passage.citation ?? passage.authorityTitle;
    const where = passage.sectionPath.length ? ` ${passage.sectionPath.join(' ')}` : '';
    const inForce = passage.validFrom ? ` (version in force from ${passage.validFrom})` : '';
    if (permission.quote_permitted) {
      const sentence = bestSentence(input.question, passage.passageContent);
      claims.push({
        category: 'verified_authority',
        statement: `${label}${where}${inForce}: “${sentence}”`,
        passage_id: passage.passageId,
        ...(passage.citation ? { citation_text: passage.citation } : {}),
        quoted_text: sentence,
      });
    } else {
      claims.push({
        category: 'verified_authority',
        statement: `${label}${where}${inForce} addresses this question. The source permits citation but not quotation; consult the official text.`,
        passage_id: passage.passageId,
        ...(passage.citation ? { citation_text: passage.citation } : {}),
      });
    }
    if (permission.attribution_text)
      limitations.push(`Source attribution: ${permission.attribution_text}`);
  }

  for (const edge of input.context) {
    const source = chosen.find((passage) => passage.authorityId === edge.from_authority_id);
    if (!source) continue;
    const target = edge.to_citation ?? edge.to_title;
    const label = source.citation ?? source.authorityTitle;
    const laterChange = LATER_CHANGE_PHRASES[edge.relationship_type];
    if (laterChange && edge.after_as_of) {
      limitations.push(
        `${label} was ${laterChange} ${target} with effect from ${edge.effective_from}, after ${input.asOfDate}. This answer applies the law as it stood on ${input.asOfDate}.`,
      );
    } else if (RELATIONSHIP_CLAIMS[edge.relationship_type] && !edge.after_as_of) {
      const { category, phrase } = RELATIONSHIP_CLAIMS[edge.relationship_type]!;
      // Point to the related decision's own passage when it was retrieved.
      const related = input.passages.find(
        (passage) => passage.authorityId === edge.to_authority_id,
      );
      claims.push({
        category,
        statement:
          category === 'conflicting_authority'
            ? `${label} ${phrase} ${target}${edge.effective_from ? ` (from ${edge.effective_from})` : ''}. Review it before relying on this authority.`
            : `${label} ${phrase} ${target}${edge.effective_from ? ` (from ${edge.effective_from})` : ''}.`,
        passage_id: (related ?? source).passageId,
      });
    }
  }

  if (chosen.length === 0) {
    claims.push({
      category: 'unresolved_question',
      statement: `No verified authority was found in the covered ${input.jurisdictionCode} sources for this question as of ${input.asOfDate}. Njumeni does not answer without a verifiable source.`,
    });
  }
  limitations.unshift(
    `Coverage for ${input.jurisdictionCode} is "${input.coverageLevel}": only rights-approved sources that are live in this deployment were searched.`,
    'This answer consists of verified extracts from the law as it stood on the stated date. It is legal information, not legal advice; AI-assisted interpretation is not yet enabled.',
  );
  return { claims, findings, limitations: [...new Set(limitations)] };
}
