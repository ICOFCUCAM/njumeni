// Parser for Lovdata public-data documents (Phase 2 Task 2.8).
//
// Lovdata publishes its free datasets as "XML-kompatibel HTML med strukturer som kapitler,
// paragrafer og ledd" (https://api.lovdata.no/, verified 2026-11-12). The structure below was
// read from the published archive gjeldende-lover.tar.bz2 (lastModified 2026-11-11T02:32:00Z),
// not from documentation, which Lovdata does not publish:
//   header.documentHeader > dl.data-document-key-info > dt.X / dd.X  (key facts, e.g. legacyID)
//   main.documentBody > section.section (h2..h6 heading) > article.legalArticle[data-name="§1-1"]
//   article.changesToParent (amendment notes) and footer.footnotes (editorial) are not statute text.
// No dependencies: a tolerant tokenizer builds a small element tree.

export interface LovdataElement {
  tag: string;
  attrs: Record<string, string>;
  children: LovdataNode[];
}
export type LovdataNode = LovdataElement | string;

export interface LovdataSection {
  /** Enclosing headings and the section label, e.g. ["Kapittel 2. …", "§ 2-1"]. */
  path: string[];
  /** Statute text of the section, headed by its label and title. */
  text: string;
}

export interface LovdataDocument {
  languageCode: string | null;
  baseHref: string | null;
  title: string;
  /** Text of each dd in the key-information list, keyed by its class (legacyID, dokid, …). */
  keyInfo: Record<string, string>;
  /** List items of list-valued key facts (ministry, legalArea, changesToDocuments). */
  keyInfoItems: Record<string, string[]>;
  /** Link targets (href) of each key fact. */
  keyInfoLinks: Record<string, string[]>;
  sections: LovdataSection[];
  /** Relative hrefs of other legislation referenced from statute text, in document order. */
  references: string[];
}

const VOID_TAGS = new Set(['br', 'img', 'base', 'hr', 'meta', 'link', 'input', 'col', 'wbr']);
const BLOCK_TAGS = new Set([
  'article', 'section', 'p', 'li', 'ol', 'ul', 'div', 'table', 'tr', 'thead', 'tbody', 'caption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dl', 'dt', 'dd', 'header', 'footer', 'main', 'br',
]);
const HEADING = /^h[1-6]$/;
const EXCLUDED_CLASSES = new Set(['changesToParent', 'footnote', 'footnotes', 'footnotereference']);
const MAX_DOCUMENT_CHARACTERS = 20_000_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', shy: '\u00ad',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', laquo: '\u00ab', raquo: '\u00bb',
  sect: '\u00a7', para: '\u00b6', aelig: '\u00e6', oslash: '\u00f8', aring: '\u00e5',
  AElig: '\u00c6', Oslash: '\u00d8', Aring: '\u00c5', eacute: '\u00e9', times: '\u00d7',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z]{2,8});/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff &&
        !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<![^>]*>|<\?[\s\S]*?\?>|<\/\s*([A-Za-z][\w:-]*)\s*>|<([A-Za-z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** Builds an element tree; unmatched closing tags are ignored and open elements close at the end. */
export function parseMarkup(markup: string): LovdataElement {
  if (markup.length > MAX_DOCUMENT_CHARACTERS) throw new Error('LOVDATA_DOCUMENT_TOO_LARGE');
  const root: LovdataElement = { tag: '#root', attrs: {}, children: [] };
  const stack: LovdataElement[] = [root];
  for (const match of markup.matchAll(TOKEN)) {
    const [token, closing, opening, attributeText, selfClosing] = match;
    const current = stack[stack.length - 1]!;
    if (closing !== undefined) {
      const tag = closing.toLowerCase();
      const index = stack.map(element => element.tag).lastIndexOf(tag);
      if (index > 0) stack.length = index;
    } else if (opening !== undefined) {
      const tag = opening.toLowerCase();
      const attrs: Record<string, string> = {};
      for (const attribute of (attributeText ?? '').matchAll(ATTRIBUTE)) {
        const name = attribute[1]!.toLowerCase();
        attrs[name] = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
      }
      const element: LovdataElement = { tag, attrs, children: [] };
      current.children.push(element);
      if (!selfClosing && !VOID_TAGS.has(tag)) stack.push(element);
    } else if (token[0] !== '<' || token === '<') {
      current.children.push(decodeEntities(token));
    }
  }
  return root;
}

function classes(element: LovdataElement): string[] {
  return (element.attrs.class ?? '').split(/\s+/).filter(Boolean);
}
function hasClass(element: LovdataElement, name: string): boolean {
  return classes(element).includes(name);
}
function* walk(node: LovdataNode): Generator<LovdataElement> {
  if (typeof node === 'string') return;
  yield node;
  for (const child of node.children) yield* walk(child);
}
function find(root: LovdataElement, predicate: (element: LovdataElement) => boolean): LovdataElement | null {
  for (const element of walk(root)) if (predicate(element)) return element;
  return null;
}

function collapse(value: string): string {
  return value.replace(/[\s\u00a0]+/g, ' ').trim();
}
const MAX_PATH_LABEL = 280;
/** Section-path labels are short references; very long annex headings are shortened. */
function pathLabel(value: string): string {
  const label = collapse(value);
  return label.length <= MAX_PATH_LABEL ? label : label.slice(0, MAX_PATH_LABEL - 1).trimEnd() + '\u2026';
}

/** Inline text of a node, without editorial notes. */
export function inlineText(node: LovdataNode): string {
  if (typeof node === 'string') return node;
  if (classes(node).some(name => EXCLUDED_CLASSES.has(name))) return '';
  if (node.tag === 'br') return ' ';
  return node.children.map(inlineText).join('');
}

/** Block-aware text: one line per block element, list markers kept, editorial notes dropped. */
function blockLines(node: LovdataNode, lines: string[], buffer: { text: string }): void {
  if (typeof node === 'string') {
    buffer.text += node;
    return;
  }
  if (classes(node).some(name => EXCLUDED_CLASSES.has(name))) return;
  const block = BLOCK_TAGS.has(node.tag);
  const flush = () => {
    const line = collapse(buffer.text);
    if (line) lines.push(line);
    buffer.text = '';
  };
  if (block) flush();
  if (node.tag === 'li') {
    // Keep the list marker (a., 1.) on the same line as the item's first line of text.
    const itemLines = blockText({ ...node, tag: '#item' }).split('\n').filter(Boolean);
    const marker = collapse(node.attrs['data-name'] ?? '');
    if (marker && itemLines.length) itemLines[0] = marker + ' ' + itemLines[0];
    else if (marker) itemLines.push(marker);
    lines.push(...itemLines);
    return;
  }
  if (node.tag === 'td' || node.tag === 'th') buffer.text += ' ';
  for (const child of node.children) blockLines(child, lines, buffer);
  if (node.tag === 'td' || node.tag === 'th') buffer.text += ' ';
  if (block) flush();
}
export function blockText(node: LovdataNode): string {
  const lines: string[] = [];
  const buffer = { text: '' };
  blockLines(node, lines, buffer);
  const tail = collapse(buffer.text);
  if (tail) lines.push(tail);
  return lines.join('\n');
}

function headingOf(element: LovdataElement): LovdataElement | null {
  return element.children.find((child): child is LovdataElement =>
    typeof child !== 'string' && HEADING.test(child.tag)) ?? null;
}

function articleLabel(article: LovdataElement): { label: string; heading: string } {
  const header = headingOf(article);
  const valueElement = header ? find(header, element => hasClass(element, 'legalArticleValue')) : null;
  const dataName = article.attrs['data-name'] ?? '';
  const label = collapse(valueElement ? inlineText(valueElement) : dataName.replace(/^\u00a7\s*/, '\u00a7 '));
  const heading = header ? collapse(inlineText(header)) : label;
  return { label: label || heading, heading: heading || label };
}

function collectReferences(node: LovdataNode, references: string[]): void {
  if (typeof node === 'string') return;
  if (classes(node).some(name => EXCLUDED_CLASSES.has(name))) return;
  if (node.tag === 'a' && node.attrs.href) references.push(node.attrs.href);
  for (const child of node.children) collectReferences(child, references);
}

function extractSections(body: LovdataElement): { sections: LovdataSection[]; references: string[] } {
  const sections: LovdataSection[] = [];
  const references: string[] = [];
  const pending: string[] = [];
  let pendingPath: string[] = [];
  const flushPending = () => {
    const text = pending.join('\n').trim();
    if (text) sections.push({ path: [...pendingPath], text });
    pending.length = 0;
  };
  const visit = (element: LovdataElement, path: string[]) => {
    for (const child of element.children) {
      if (typeof child === 'string') {
        const text = collapse(child);
        if (text) {
          if (pending.length === 0) pendingPath = path;
          pending.push(text);
        }
        continue;
      }
      if (classes(child).some(name => EXCLUDED_CLASSES.has(name))) continue;
      if (child.tag === 'h1') continue;
      if (child.tag === 'article' && hasClass(child, 'legalArticle')) {
        flushPending();
        const { label, heading } = articleLabel(child);
        const header = headingOf(child);
        const bodyText = blockText({ ...child, children: child.children.filter(node => node !== header) });
        const text = [heading, bodyText].filter(Boolean).join('\n');
        if (text) sections.push({ path: [...path, pathLabel(label)], text });
        collectReferences(child, references);
        continue;
      }
      if (child.tag === 'section') {
        flushPending();
        const heading = headingOf(child);
        const headingText = heading ? pathLabel(inlineText(heading)) : '';
        visit(child, headingText ? [...path, headingText] : path);
        flushPending();
        continue;
      }
      if (HEADING.test(child.tag)) continue;
      // Loose statute text outside numbered sections (preambles, short historical acts).
      const text = blockText(child);
      if (text) {
        if (pending.length === 0) pendingPath = path;
        pending.push(text);
        collectReferences(child, references);
      }
    }
  };
  visit(body, []);
  flushPending();
  return { sections, references };
}

export function parseLovdataDocument(markup: string): LovdataDocument {
  const root = parseMarkup(markup);
  const html = find(root, element => element.tag === 'html');
  const lang = /^[A-Za-z]{2,3}/.exec(html?.attrs.lang ?? '')?.[0]?.toLowerCase() ?? null;
  const base = find(root, element => element.tag === 'base')?.attrs.href ?? null;
  const keyList = find(root, element => element.tag === 'dl' && hasClass(element, 'data-document-key-info'));
  const keyInfo: Record<string, string> = {};
  const keyInfoItems: Record<string, string[]> = {};
  const keyInfoLinks: Record<string, string[]> = {};
  for (const child of keyList?.children ?? []) {
    if (typeof child === 'string' || child.tag !== 'dd') continue;
    const name = classes(child)[0];
    if (!name || name in keyInfo) continue;
    keyInfo[name] = collapse(inlineText(child));
    keyInfoItems[name] = [...walk(child)].filter(element => element.tag === 'li')
      .filter(item => !find({ ...item, tag: '#item' }, inner => inner !== item && inner.tag === 'li'))
      .map(item => collapse(inlineText(item))).filter(Boolean);
    keyInfoLinks[name] = [...walk(child)].filter(element => element.tag === 'a' && element.attrs.href)
      .map(element => element.attrs.href!);
  }
  const body = find(root, element => element.tag === 'main' && hasClass(element, 'documentBody'));
  if (!body) throw new Error('LOVDATA_DOCUMENT_BODY_MISSING');
  const h1 = find(body, element => element.tag === 'h1');
  const title = collapse(keyInfo.title || (h1 ? inlineText(h1) : ''));
  if (!title) throw new Error('LOVDATA_DOCUMENT_TITLE_MISSING');
  const { sections, references } = extractSections(body);
  // A few historical acts publish only a title; the title is then the whole published text.
  if (sections.length === 0) sections.push({ path: [], text: title });
  return { languageCode: lang, baseHref: base, title, keyInfo, keyInfoItems, keyInfoLinks, sections, references };
}
