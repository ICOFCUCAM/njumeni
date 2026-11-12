// Organisation template authoring (Phase 9). Firms describe a template as one section per line:
//   Title            optional section
//   Title *          required section
//   Title * | guidance for the drafter
export interface TemplateSectionInput {
  key: string;
  title: string;
  required: boolean;
  guidance: string;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/œ/g, 'oe')
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 's_$1')
      .slice(0, 36) || 'section'
  );
}

export function parseTemplateSections(text: string): TemplateSectionInput[] {
  const sections: TemplateSectionInput[] = [];
  const used = new Set<string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [head = '', ...rest] = line.split('|');
    const required = /\*\s*$/.test(head.trim());
    const title = head
      .replace(/\*\s*$/, '')
      .trim()
      .slice(0, 120);
    if (!title) continue;
    let key = /^[a-z]/.test(slug(title)) ? slug(title) : `s_${slug(title)}`;
    for (let n = 2; used.has(key); n += 1) key = `${slug(title).slice(0, 33)}_${n}`;
    used.add(key);
    sections.push({ key, title, required, guidance: rest.join('|').trim().slice(0, 500) });
  }
  if (sections.length === 0 || sections.length > 40) throw new Error('TEMPLATE_INVALID');
  return sections;
}

export interface ConflictHit {
  name: string;
  source: 'client' | 'matter_party';
  role: string;
  matterNumber: string | null;
  matterStatus: string | null;
  matched: string;
}

export function describeHit(hit: ConflictHit): string {
  return hit.source === 'client'
    ? `${hit.name} is a client of the firm`
    : `${hit.name} is ${hit.role.replace(/_/g, ' ')} in ${hit.matterNumber} (${hit.matterStatus?.replace('_', ' ')})`;
}

/** Splits the names box of a conflict check: one name per line or comma-separated. */
export function parseNames(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,;]/)
        .map((n) => n.trim())
        .filter((n) => n.length >= 2),
    ),
  ].slice(0, 30);
}
