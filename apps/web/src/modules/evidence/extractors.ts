// Text extraction for evidence files. Each extractor returns text per page so that every passage
// keeps a page anchor. Images need OCR, which is not configured at Stage 0 (no engine or language
// data is available offline here); they are recorded as 'unsupported' rather than guessed.
import { unzipSync, strFromU8 } from 'fflate';
import type { EvidenceFileKind } from './file-kind.ts';

export const EXTRACTOR_VERSION = '1.0.0';

export type ExtractionOutcome =
  | { status: 'succeeded'; extractor: string; pages: string[] }
  | { status: 'unsupported' | 'failed'; extractor: string; failureCode: string };

// ----- plain text -----------------------------------------------------------------------------
export function decodeText(bytes: Uint8Array): string {
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start));
  } catch {
    // Legacy files are commonly Windows-1252 (a superset of Latin-1).
    return new TextDecoder('windows-1252').decode(bytes.subarray(start));
  }
}

// ----- email (RFC 5322 / MIME) -----------------------------------------------------------------
function unfoldHeaders(block: string): Map<string, string> {
  const headers = new Map<string, string>();
  const lines = block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/);
  for (const line of lines) {
    const index = line.indexOf(':');
    if (index > 0)
      headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }
  return headers;
}

function decodeQuotedPrintable(value: string): Uint8Array {
  const soft = value.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i += 1) {
    if (soft[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(soft.slice(i + 1, i + 3))) {
      bytes.push(parseInt(soft.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(soft.charCodeAt(i) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function decodeBody(
  body: string,
  encoding: string | undefined,
  charset: string | undefined,
): string {
  const transfer = (encoding ?? '').toLowerCase();
  let bytes: Uint8Array;
  if (transfer === 'base64')
    bytes = Uint8Array.from(Buffer.from(body.replace(/\s+/g, ''), 'base64'));
  else if (transfer === 'quoted-printable') bytes = decodeQuotedPrintable(body);
  else return body;
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return decodeText(bytes);
  }
}

function parameter(header: string | undefined, name: string): string | undefined {
  const match = header?.match(new RegExp(`${name}\\s*=\\s*"?([^";]+)"?`, 'i'));
  return match?.[1];
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractMimeText(raw: string, depth = 0): { plain: string[]; html: string[] } {
  const split = raw.search(/\r?\n\r?\n/);
  const headerBlock = split < 0 ? raw : raw.slice(0, split);
  const body = split < 0 ? '' : raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const headers = unfoldHeaders(headerBlock);
  const contentType = headers.get('content-type') ?? 'text/plain';
  const result = { plain: [] as string[], html: [] as string[] };
  if (/^multipart\//i.test(contentType) && depth < 5) {
    const boundary = parameter(contentType, 'boundary');
    if (!boundary) return result;
    for (const part of body.split(`--${boundary}`).slice(1)) {
      if (part.startsWith('--')) break;
      const nested = extractMimeText(part.replace(/^\r?\n/, ''), depth + 1);
      result.plain.push(...nested.plain);
      result.html.push(...nested.html);
    }
    return result;
  }
  if (/attachment/i.test(headers.get('content-disposition') ?? '')) return result;
  const decoded = decodeBody(
    body,
    headers.get('content-transfer-encoding'),
    parameter(contentType, 'charset'),
  );
  if (/^text\/html/i.test(contentType)) result.html.push(htmlToText(decoded));
  else if (/^text\//i.test(contentType)) result.plain.push(decoded);
  return result;
}

export function extractEmailText(bytes: Uint8Array): string {
  const raw = decodeText(bytes);
  const split = raw.search(/\r?\n\r?\n/);
  const headers = unfoldHeaders(split < 0 ? raw : raw.slice(0, split));
  const summary = ['from', 'to', 'cc', 'date', 'subject']
    .filter((name) => headers.has(name))
    .map((name) => `${name[0]!.toUpperCase()}${name.slice(1)}: ${headers.get(name)}`);
  const parts = extractMimeText(raw);
  const bodyText = (parts.plain.length ? parts.plain : parts.html).join('\n\n').trim();
  return [...summary, '', bodyText].join('\n').trim();
}

// ----- OOXML (DOCX, XLSX) ----------------------------------------------------------------------
const MAX_UNCOMPRESSED = 200 * 1024 * 1024;

function unzipParts(
  bytes: Uint8Array,
  wanted: (name: string) => boolean,
): Record<string, Uint8Array> {
  let total = 0;
  return unzipSync(bytes, {
    filter: (file) => {
      if (!wanted(file.name)) return false;
      total += file.originalSize;
      if (total > MAX_UNCOMPRESSED) throw new Error('EVIDENCE_ARCHIVE_TOO_LARGE');
      return true;
    },
  });
}

function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

export function extractDocxText(bytes: Uint8Array): string {
  const parts = unzipParts(bytes, (name) => name === 'word/document.xml');
  const xml = parts['word/document.xml'];
  if (!xml) throw new Error('EVIDENCE_DOCX_INVALID');
  const document = strFromU8(xml);
  const paragraphs: string[] = [];
  for (const paragraph of document.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    const text =
      paragraph
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:(br|cr)\/>/g, '\n')
        .match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|\t|\n/g)
        ?.map((piece) =>
          piece === '\t' || piece === '\n' ? piece : xmlUnescape(piece.replace(/<[^>]+>/g, '')),
        )
        .join('') ?? '';
    paragraphs.push(text);
  }
  return paragraphs
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractXlsxSheets(bytes: Uint8Array): string[] {
  const parts = unzipParts(
    bytes,
    (name) =>
      name === 'xl/sharedStrings.xml' ||
      name === 'xl/workbook.xml' ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  const shared = parts['xl/sharedStrings.xml']
    ? (strFromU8(parts['xl/sharedStrings.xml']).match(/<si>[\s\S]*?<\/si>/g) ?? []).map((item) =>
        xmlUnescape(
          (item.match(/<t(?: [^>]*)?>[\s\S]*?<\/t>/g) ?? [])
            .map((t) => t.replace(/<[^>]+>/g, ''))
            .join(''),
        ),
      )
    : [];
  const names = parts['xl/workbook.xml']
    ? [...strFromU8(parts['xl/workbook.xml']).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) =>
        xmlUnescape(m[1]!),
      )
    : [];
  const sheetFiles = Object.keys(parts)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return sheetFiles.map((file, index) => {
    const xml = strFromU8(parts[file]!);
    const rows = (xml.match(/<row[ >][\s\S]*?<\/row>/g) ?? []).map((row) =>
      (row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? [])
        .map((cell) => {
          const type = cell.match(/ t="([^"]+)"/)?.[1];
          const value = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1];
          const inline = cell.match(/<is>[\s\S]*?<t(?: [^>]*)?>([\s\S]*?)<\/t>/)?.[1];
          if (type === 's' && value !== undefined) return shared[Number(value)] ?? '';
          if (type === 'inlineStr' && inline !== undefined) return xmlUnescape(inline);
          return value !== undefined ? xmlUnescape(value) : '';
        })
        .join('\t'),
    );
    const title = names[index] ? `Sheet: ${names[index]}` : `Sheet ${index + 1}`;
    return [title, ...rows].join('\n').trim();
  });
}

// ----- PDF -------------------------------------------------------------------------------------
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const document = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pages.push(
        text
          .replace(/[ \t]+\n/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim(),
      );
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

// ----- dispatcher ------------------------------------------------------------------------------
export async function extractEvidenceText(
  kind: EvidenceFileKind,
  bytes: Uint8Array,
): Promise<ExtractionOutcome> {
  try {
    switch (kind) {
      case 'text':
        return { status: 'succeeded', extractor: 'evidence-text', pages: [decodeText(bytes)] };
      case 'email':
        return {
          status: 'succeeded',
          extractor: 'evidence-email',
          pages: [extractEmailText(bytes)],
        };
      case 'docx':
        return { status: 'succeeded', extractor: 'evidence-docx', pages: [extractDocxText(bytes)] };
      case 'xlsx':
        return { status: 'succeeded', extractor: 'evidence-xlsx', pages: extractXlsxSheets(bytes) };
      case 'pdf': {
        const pages = await extractPdfPages(bytes);
        // A PDF with no text layer is a scan and needs OCR.
        if (pages.every((page) => page.trim() === '')) {
          return {
            status: 'unsupported',
            extractor: 'evidence-pdf',
            failureCode: 'OCR_NOT_CONFIGURED',
          };
        }
        return { status: 'succeeded', extractor: 'evidence-pdf', pages };
      }
      case 'png':
      case 'jpeg':
      case 'tiff':
        return {
          status: 'unsupported',
          extractor: 'evidence-image',
          failureCode: 'OCR_NOT_CONFIGURED',
        };
      default:
        return {
          status: 'unsupported',
          extractor: 'evidence-unknown',
          failureCode: 'EVIDENCE_TYPE_UNSUPPORTED',
        };
    }
  } catch (error) {
    const code =
      error instanceof Error && /^EVIDENCE_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'EVIDENCE_EXTRACTION_FAILED';
    return { status: 'failed', extractor: `evidence-${kind}`, failureCode: code };
  }
}
