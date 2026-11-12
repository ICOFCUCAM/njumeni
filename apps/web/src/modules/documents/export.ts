// DOCX and PDF export (Phase 7; journey §15.5 "DOCX / PDF export"). Both formats carry the version
// number, its content hash and, unless the exported version is the approved one, a DRAFT marking,
// so an exported file can always be traced back to the exact stored version and its sources.
import { strToU8, zipSync } from 'fflate';

export interface ExportCitation {
  marker: number;
  citation: string;
  quotedText: string | null;
  sourceUri: string | null;
  validFrom: string | null;
}
export interface ExportModel {
  title: string;
  templateName: string;
  versionNumber: number;
  contentHash: string;
  final: boolean;
  generatedAt: string;
  sections: { title: string; content: string }[];
  citations: ExportCitation[];
}

export function exportStatusLine(model: ExportModel): string {
  return model.final
    ? `Approved version ${model.versionNumber} · ${model.contentHash.slice(0, 16)}`
    : `DRAFT — not approved · version ${model.versionNumber} · ${model.contentHash.slice(0, 16)}`;
}

function sourceLine(citation: ExportCitation): string {
  return [
    `[${citation.marker}] ${citation.citation}`,
    citation.validFrom ? `(version in force from ${citation.validFrom})` : '',
    citation.quotedText ? `— “${citation.quotedText}”` : '',
    citation.sourceUri ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ----- DOCX ------------------------------------------------------------------------------------
function xml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function wParagraph(text: string, style?: string): string {
  const props = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${props}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Status"><w:name w:val="Status"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="9B1C1C"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Source"><w:name w:val="Source"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

export function renderDocx(model: ExportModel): Uint8Array {
  const body = [
    wParagraph(exportStatusLine(model), 'Status'),
    wParagraph(model.title, 'Title'),
    wParagraph(model.templateName, 'Status'),
    ...model.sections.flatMap((section) => [
      wParagraph(section.title, 'Heading1'),
      ...paragraphs(section.content).map((p) => wParagraph(p)),
    ]),
    ...(model.citations.length
      ? [
          wParagraph('Sources', 'Heading1'),
          ...model.citations.map((c) => wParagraph(sourceLine(c), 'Source')),
        ]
      : []),
    wParagraph(
      `Generated ${model.generatedAt} by Njumeni. Legal information prepared for review by a qualified person.`,
      'Status',
    ),
  ].join('');
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`${header}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`${header}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`),
    'word/_rels/document.xml.rels': strToU8(`${header}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'word/styles.xml': strToU8(STYLES),
    'word/document.xml': strToU8(`${header}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`),
    'docProps/core.xml': strToU8(`${header}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xml(model.title)}</dc:title><dc:creator>Njumeni</dc:creator><cp:revision>${model.versionNumber}</cp:revision>
<dc:identifier>sha256:${model.contentHash}</dc:identifier>
<dcterms:created xsi:type="dcterms:W3CDTF">${xml(model.generatedAt)}</dcterms:created>
</cp:coreProperties>`),
  };
  // Fixed timestamps keep the archive byte-identical for identical content.
  return zipSync(files, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
}

// ----- PDF -------------------------------------------------------------------------------------
// A4, Helvetica (a standard PDF font, so nothing is embedded), WinAnsi encoding: covers Norwegian
// and French letters; characters outside it are replaced with "?".
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;

const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
  '§': 0xa7,
};
function winAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text.normalize('NFC')) {
    const code = char.codePointAt(0)!;
    if (WIN_ANSI_EXTRA[char] !== undefined) bytes.push(WIN_ANSI_EXTRA[char]!);
    else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else if (char === '\t') bytes.push(0x20);
    else bytes.push(0x3f);
  }
  return bytes;
}
function pdfString(text: string): string {
  return winAnsi(text)
    .map((b) =>
      b === 0x28 || b === 0x29 || b === 0x5c
        ? `\\${String.fromCharCode(b)}`
        : b < 0x20 || b > 0x7e
          ? `\\${b.toString(8).padStart(3, '0')}`
          : String.fromCharCode(b),
    )
    .join('');
}
// Average Helvetica advance ≈ 0.52 em; slightly conservative wrapping.
function wrap(text: string, size: number, width: number): string[] {
  const max = Math.max(10, Math.floor(width / (size * 0.53)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= max) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
      while (line.length > max) {
        lines.push(line.slice(0, max));
        line = line.slice(max);
      }
    }
    lines.push(line);
  }
  return lines;
}

export function renderPdf(model: ExportModel): Uint8Array {
  type Line = { text: string; size: number; bold?: boolean; gapBefore?: number | undefined; colour?: string };
  const lines: Line[] = [];
  const add = (text: string, size: number, options: Omit<Line, 'text' | 'size'> = {}) =>
    wrap(text, size, PAGE_W - 2 * MARGIN).forEach((t, i) =>
      lines.push({ text: t, size, ...options, gapBefore: i === 0 ? options.gapBefore : 0 }),
    );
  add(exportStatusLine(model), 8, { colour: '0.6 0.1 0.1' });
  add(model.title, 18, { bold: true, gapBefore: 8 });
  add(model.templateName, 9, { gapBefore: 2 });
  for (const section of model.sections) {
    add(section.title, 13, { bold: true, gapBefore: 14 });
    for (const p of paragraphs(section.content)) add(p, 10.5, { gapBefore: 5 });
  }
  if (model.citations.length) {
    add('Sources', 13, { bold: true, gapBefore: 14 });
    for (const c of model.citations) add(sourceLine(c), 8.5, { gapBefore: 3 });
  }
  add(
    `Generated ${model.generatedAt} by Njumeni. Legal information prepared for review by a qualified person.`,
    8,
    { gapBefore: 14 },
  );

  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;
  const footer = (n: number) =>
    `BT /F1 7 Tf 0.4 0.4 0.4 rg ${MARGIN} 30 Td (${pdfString(`${exportStatusLine(model)} · page ${n}`)}) Tj ET`;
  for (const line of lines) {
    const height = line.size * 1.3 + (line.gapBefore ?? 0);
    if (y - height < MARGIN) {
      ops.push(footer(pages.length + 1));
      pages.push(ops.join('\n'));
      ops = [];
      y = PAGE_H - MARGIN;
    }
    y -= height;
    ops.push(
      `BT /${line.bold ? 'F2' : 'F1'} ${line.size} Tf ${line.colour ?? '0 0 0'} rg ${MARGIN} ${y.toFixed(2)} Td (${pdfString(line.text)}) Tj ET`,
    );
  }
  ops.push(footer(pages.length + 1));
  pages.push(ops.join('\n'));

  // Objects: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then (page, content) pairs.
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 6 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[5] = `<< /Title (${pdfString(model.title)}) /Producer (Njumeni) /Subject (${pdfString(`version ${model.versionNumber} sha256:${model.contentHash}`)}) >>`;
  pages.forEach((content, i) => {
    // Content streams are pure ASCII: all text inside them was escaped by pdfString.
    const latin = content;
    objects[pageIds[i]!] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i]! + 1} 0 R >>`;
    objects[pageIds[i]! + 1] = `<< /Length ${latin.length} >>\nstream\n${latin}\nendstream`;
  });
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
