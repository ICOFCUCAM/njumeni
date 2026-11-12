// Section-level document analysis (Phase 7; Master Plan v2.0 Module E "document intelligence").
// Deterministic checks run on every save and before submission: missing required sections, left-over
// placeholders, legal assertions without a citation, citation markers that do not resolve, unused
// citations, ambiguous wording and inconsistent date formats.

export interface TemplateSection {
  key: string;
  title: string;
  required: boolean;
  guidance?: string;
}
export interface DocumentSection {
  key: string;
  title?: string;
  content: string;
}
export interface DocumentCitationRef {
  sectionKey: string;
  marker: number;
}
export type AnalysisSeverity = 'error' | 'warning' | 'info';
export interface AnalysisFinding {
  sectionKey: string | null;
  severity: AnalysisSeverity;
  code:
    | 'MISSING_REQUIRED_SECTION'
    | 'PLACEHOLDER_LEFT'
    | 'MARKER_WITHOUT_CITATION'
    | 'UNSUPPORTED_ASSERTION'
    | 'CITATION_NOT_REFERENCED'
    | 'AMBIGUOUS_LANGUAGE'
    | 'INCONSISTENT_DATE_FORMAT';
  message: string;
  excerpt?: string;
}
export interface DocumentAnalysis {
  findings: AnalysisFinding[];
  readyForReview: boolean;
  counts: Record<AnalysisSeverity, number>;
}

// Sections that name, frame or close a document rather than assert law.
const NON_SUBSTANTIVE = new Set([
  'recipient',
  'subject',
  'closing',
  'parties',
  'question',
  'decision',
  'relief',
  'request',
]);
const PLACEHOLDER = /\[(?:\s*(?:\.\.\.|…|todo|to be completed|insert)[^\]]*)\]|\bTODO\b|\bXXX\b/i;
const MARKER = /\[(\d{1,3})\]/g;
const LEGAL_ASSERTION =
  /\b(must|shall|is required to|is obliged to|is entitled to|is liable|has a duty|according to|pursuant to|under section|skal|må|plikter|har plikt|har rett til|er ansvarlig|etter loven|i henhold til|jf\.)|§/i;
const AMBIGUOUS: [RegExp, string][] = [
  [/\bas soon as possible\b|\bsnarest\b/i, '“as soon as possible” sets no deadline'],
  [/\breasonabl[ey]\b|\brimelig\b/i, '“reasonable” is open to interpretation'],
  [/\band\/or\b|\bog\/eller\b/i, '“and/or” is ambiguous'],
  [/\betc\.?(?=\s|$)|\bosv\.?(?=\s|$)|\bm\.m\.(?=\s|$)/i, 'an open-ended list'],
  [/\b(approximately|about|ca\.)\s+\d/i, 'an approximate figure'],
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÆØÅ0-9“"(])|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}
function clip(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function analyseDocument(
  template: readonly TemplateSection[],
  sections: readonly DocumentSection[],
  citations: readonly DocumentCitationRef[],
): DocumentAnalysis {
  const findings: AnalysisFinding[] = [];
  const byKey = new Map(sections.map((section) => [section.key, section.content ?? '']));
  const isoDates = new Set<string>();
  const dottedDates = new Set<string>();

  for (const spec of template) {
    const content = (byKey.get(spec.key) ?? '').trim();
    if (spec.required && content.length === 0) {
      findings.push({
        sectionKey: spec.key,
        severity: 'error',
        code: 'MISSING_REQUIRED_SECTION',
        message: `“${spec.title}” is required.`,
      });
      continue;
    }
    if (!content) continue;
    const placeholder = content.match(PLACEHOLDER);
    if (placeholder)
      findings.push({
        sectionKey: spec.key,
        severity: 'error',
        code: 'PLACEHOLDER_LEFT',
        message: `“${spec.title}” still contains a placeholder.`,
        excerpt: placeholder[0],
      });

    const sectionMarkers = new Set(
      citations.filter((c) => c.sectionKey === spec.key).map((c) => c.marker),
    );
    const used = new Set<number>();
    for (const match of content.matchAll(MARKER)) {
      const marker = Number(match[1]);
      used.add(marker);
      if (!sectionMarkers.has(marker))
        findings.push({
          sectionKey: spec.key,
          severity: 'error',
          code: 'MARKER_WITHOUT_CITATION',
          message: `Marker [${marker}] has no source attached.`,
        });
    }
    for (const marker of sectionMarkers)
      if (!used.has(marker))
        findings.push({
          sectionKey: spec.key,
          severity: 'warning',
          code: 'CITATION_NOT_REFERENCED',
          message: `Source [${marker}] is attached but not referred to in the text.`,
        });

    if (!NON_SUBSTANTIVE.has(spec.key))
      for (const sentence of sentences(content))
        if (
          LEGAL_ASSERTION.test(sentence) &&
          !/\[\d{1,3}\]/.test(sentence) &&
          !PLACEHOLDER.test(sentence)
        )
          findings.push({
            sectionKey: spec.key,
            severity: 'warning',
            code: 'UNSUPPORTED_ASSERTION',
            message: 'A legal statement has no citation.',
            excerpt: clip(sentence),
          });

    for (const [pattern, why] of AMBIGUOUS) {
      const match = content.match(pattern);
      if (match)
        findings.push({
          sectionKey: spec.key,
          severity: 'info',
          code: 'AMBIGUOUS_LANGUAGE',
          message: `Ambiguous wording: ${why}.`,
          excerpt: match[0],
        });
    }
    for (const d of content.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []) isoDates.add(d);
    for (const d of content.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g) ?? []) dottedDates.add(d);
  }
  if (isoDates.size > 0 && dottedDates.size > 0)
    findings.push({
      sectionKey: null,
      severity: 'info',
      code: 'INCONSISTENT_DATE_FORMAT',
      message: 'Dates are written in more than one format.',
    });

  const counts = { error: 0, warning: 0, info: 0 } as Record<AnalysisSeverity, number>;
  for (const finding of findings) counts[finding.severity] += 1;
  return { findings, readyForReview: counts.error === 0, counts };
}
