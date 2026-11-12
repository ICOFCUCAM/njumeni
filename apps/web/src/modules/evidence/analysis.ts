// Deterministic evidence analysis: passages with exact offsets, entity extraction and chronology.
// Rule-based by design for Phase 3; AI-assisted extraction (persons, events without explicit
// dates, classification) arrives with the agent framework in Phase 5.
import { createHash } from 'node:crypto';

export const PAGE_SEPARATOR = '\n\f\n';
const MAX_PASSAGE_CHARS = 2000;

export interface EvidencePassage {
  ordinal: number;
  page_number: number;
  start_offset: number;
  end_offset: number;
  content: string;
  content_hash: string;
}
export interface EvidenceEntity {
  passage_ordinal: number;
  entity_type: 'date' | 'amount' | 'email' | 'phone' | 'reference' | 'organisation' | 'url';
  raw_value: string;
  normalised_value: string;
  start_offset: number;
  end_offset: number;
}
export interface EvidenceEvent {
  passage_ordinal: number;
  event_date: string;
  date_precision: 'day' | 'month' | 'year';
  description: string;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function fullText(pages: readonly string[]): string {
  return pages.map((page) => page.normalize('NFC')).join(PAGE_SEPARATOR);
}

/** Splits page text into paragraph-sized passages whose offsets index into fullText(pages). */
export function buildPassages(pages: readonly string[]): EvidencePassage[] {
  const passages: EvidencePassage[] = [];
  let pageStart = 0;
  pages.forEach((rawPage, pageIndex) => {
    const page = rawPage.normalize('NFC');
    const paragraph = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
    for (const match of page.matchAll(paragraph)) {
      let start = match.index;
      let text = match[0];
      while (text.length > 0) {
        let take = text.length;
        if (take > MAX_PASSAGE_CHARS) {
          const window = text.slice(0, MAX_PASSAGE_CHARS);
          const cut = Math.max(
            window.lastIndexOf('. '),
            window.lastIndexOf('\n'),
            window.lastIndexOf(' '),
          );
          take = cut > MAX_PASSAGE_CHARS / 2 ? cut + 1 : MAX_PASSAGE_CHARS;
        }
        const piece = text.slice(0, take);
        const leading = piece.length - piece.trimStart().length;
        const content = piece.trim();
        if (content) {
          const absoluteStart = pageStart + start + leading;
          passages.push({
            ordinal: passages.length,
            page_number: pageIndex + 1,
            start_offset: absoluteStart,
            end_offset: absoluteStart + content.length,
            content,
            content_hash: sha256Hex(content),
          });
        }
        start += take;
        text = text.slice(take);
      }
    }
    pageStart += page.length + PAGE_SEPARATOR.length;
  });
  return passages;
}

// ----- dates -----------------------------------------------------------------------------------
const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  januar: 1,
  february: 2,
  feb: 2,
  februar: 2,
  march: 3,
  mar: 3,
  mars: 3,
  april: 4,
  apr: 4,
  may: 5,
  mai: 5,
  june: 6,
  jun: 6,
  juni: 6,
  july: 7,
  jul: 7,
  juli: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
  desember: 12,
  des: 12,
  janvier: 1,
  février: 2,
  fevrier: 2,
  avril: 4,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
};
const MONTH_NAMES = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1800 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

interface DateMatch {
  start: number;
  end: number;
  raw: string;
  iso: string;
  precision: 'day' | 'month';
}

export function findDates(text: string): DateMatch[] {
  const found: DateMatch[] = [];
  const push = (start: number, raw: string, iso: string | null, precision: 'day' | 'month') => {
    if (!iso) return;
    const end = start + raw.length;
    if (found.some((m) => start < m.end && m.start < end)) return;
    found.push({ start, end, raw, iso, precision });
  };
  const patterns: [RegExp, (m: RegExpMatchArray) => [string | null, 'day' | 'month']][] = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => [validDate(+m[1]!, +m[2]!, +m[3]!), 'day']],
    [/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, (m) => [validDate(+m[3]!, +m[2]!, +m[1]!), 'day']],
    [
      new RegExp(`\\b(\\d{1,2})\\.?\\s+(${MONTH_NAMES})\\.?\\s+(\\d{4})\\b`, 'giu'),
      (m) => [validDate(+m[3]!, MONTHS[m[2]!.toLowerCase()]!, +m[1]!), 'day'],
    ],
    [
      new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'giu'),
      (m) => [validDate(+m[3]!, MONTHS[m[1]!.toLowerCase()]!, +m[2]!), 'day'],
    ],
    [
      new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{4})\\b`, 'giu'),
      (m) => [validDate(+m[2]!, MONTHS[m[1]!.toLowerCase()]!, 1), 'month'],
    ],
  ];
  for (const [pattern, toIso] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const [iso, precision] = toIso(match);
      push(match.index!, match[0], iso, precision);
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

// ----- other entities --------------------------------------------------------------------------
const ENTITY_PATTERNS: {
  type: EvidenceEntity['entity_type'];
  pattern: RegExp;
  normalise: (raw: string) => string;
}[] = [
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    normalise: (raw) => raw.toLowerCase(),
  },
  {
    type: 'url',
    pattern: /\bhttps?:\/\/[^\s<>"')]+/g,
    normalise: (raw) => raw.replace(/[.,;:]+$/, ''),
  },
  {
    type: 'amount',
    pattern:
      /(?:\b(?:NOK|kr\.?|EUR|USD|GBP|XAF|FCFA)\s?|[€$£])\d{1,3}(?:[ . ]\d{3})*(?:,\d{1,2})?(?:\s?(?:NOK|kr|EUR|USD|GBP))?|\b\d{1,3}(?:[ . ]\d{3})*(?:,\d{1,2})?\s?(?:NOK|kr|EUR|USD|GBP|XAF|FCFA)\b/g,
    normalise: (raw) => {
      const currency = raw.match(/NOK|kr|EUR|USD|GBP|XAF|FCFA|€|\$|£/)?.[0] ?? '';
      const code =
        ({ kr: 'NOK', '€': 'EUR', $: 'USD', '£': 'GBP', FCFA: 'XAF' } as Record<string, string>)[
          currency
        ] ?? currency;
      const number = raw.replace(/[^\d,]/g, '').replace(',', '.');
      return `${code} ${Number(number).toFixed(2)}`;
    },
  },
  {
    type: 'phone',
    pattern: /(?:\+\d{1,3}[\s-]?)?(?:\(\d{1,4}\)[\s-]?)?\b\d{2,4}(?:[\s-]\d{2,4}){2,4}\b/g,
    normalise: (raw) => raw.replace(/[^\d+]/g, ''),
  },
  {
    type: 'reference',
    pattern:
      /\b(?:Sak(?:snr)?\.?|Saksnummer|Ref(?:eranse)?\.?|Case(?: No\.?)?|Our ref\.?|Vår ref\.?|Deres ref\.?)\s*:?\s*[A-Z0-9][A-Z0-9/._-]{2,40}\b/gi,
    normalise: (raw) => raw.replace(/\s+/g, ' ').trim(),
  },
  {
    type: 'organisation',
    pattern:
      /\b(?:[A-ZÆØÅ][\p{L}&.-]*\s){0,4}[A-ZÆØÅ][\p{L}&.-]*\s(?:AS|ASA|SA|SARL|Ltd|Limited|LLC|Inc|GmbH|AB|ApS|BV|NV|plc)\b/gu,
    normalise: (raw) => raw.replace(/\s+/g, ' ').trim(),
  },
];

// Capitalised words that commonly precede a company name but are not part of it.
const ORGANISATION_LEADING_WORDS = new Set([
  'fra',
  'from',
  'til',
  'to',
  'the',
  'den',
  'det',
  'av',
  'by',
  'med',
  'with',
  'hos',
  'og',
  'and',
  'mellom',
  'between',
  're',
  'ang',
  'vedr',
  'kunde',
  'client',
  'mot',
  'against',
  'for',
]);

function trimOrganisationLead(raw: string): { raw: string; skipped: number } {
  let skipped = 0;
  let rest = raw;
  for (;;) {
    const word = rest.match(/^(\S+)\s+/);
    if (!word || !ORGANISATION_LEADING_WORDS.has(word[1]!.toLowerCase().replace(/[.:]$/, '')))
      break;
    skipped += word[0].length;
    rest = rest.slice(word[0].length);
  }
  return { raw: rest, skipped };
}

export function extractEntities(passages: readonly EvidencePassage[]): EvidenceEntity[] {
  const entities: EvidenceEntity[] = [];
  for (const passage of passages) {
    const taken: [number, number][] = [];
    const add = (
      type: EvidenceEntity['entity_type'],
      start: number,
      raw: string,
      normalised: string,
    ) => {
      const end = start + raw.length;
      if (taken.some(([s, e]) => start < e && s < end)) return;
      taken.push([start, end]);
      entities.push({
        passage_ordinal: passage.ordinal,
        entity_type: type,
        raw_value: raw.slice(0, 300),
        normalised_value: normalised.slice(0, 300),
        start_offset: start,
        end_offset: end,
      });
    };
    for (const date of findDates(passage.content)) add('date', date.start, date.raw, date.iso);
    for (const { type, pattern, normalise } of ENTITY_PATTERNS) {
      for (const match of passage.content.matchAll(pattern)) {
        let raw = match[0].trim();
        let start = match.index! + match[0].indexOf(raw);
        if (type === 'organisation') {
          const trimmed = trimOrganisationLead(raw);
          raw = trimmed.raw;
          start += trimmed.skipped;
          if (!/\s/.test(raw)) continue; // a bare legal suffix is not a name
        }
        if (raw.length >= 3) add(type, start, raw, normalise(raw));
      }
    }
  }
  return entities.sort(
    (a, b) => a.passage_ordinal - b.passage_ordinal || a.start_offset - b.start_offset,
  );
}

/** One chronology event per dated sentence, anchored to its passage. */
export function buildChronology(passages: readonly EvidencePassage[]): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];
  const seen = new Set<string>();
  for (const passage of passages) {
    // Break after . ! ? only before a capitalised word, so "14. mars 2024" stays one sentence.
    const sentences = passage.content.split(/(?<=[.!?])\s+(?=[A-ZÆØÅÉ"«(])|\n+/);
    for (const sentence of sentences) {
      const dates = findDates(sentence);
      for (const date of dates) {
        const description = sentence.replace(/\s+/g, ' ').trim().slice(0, 1000);
        const key = `${date.iso}|${description}`;
        if (!description || seen.has(key)) continue;
        seen.add(key);
        events.push({
          passage_ordinal: passage.ordinal,
          event_date: date.iso,
          date_precision: date.precision,
          description,
        });
      }
    }
  }
  return events.sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || a.passage_ordinal - b.passage_ordinal,
  );
}
