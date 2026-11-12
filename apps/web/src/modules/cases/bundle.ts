// Case bundle export (Phase 8; journey §15.1 step 14 "export and case archive", Module D "export case
// bundles"). A ZIP with a case report (PDF), the chronology (CSV), the approved documents (PDF and
// DOCX), an evidence manifest and a manifest listing the SHA-256 of every file.
import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { renderDocx, renderPdf, type ExportModel } from '../documents/export.ts';

export interface MatterView {
  id: string;
  matterNumber: string;
  title: string;
  legalCategory: string;
  jurisdictionCode: string;
  description: string | null;
  status: string;
  createdAt: string;
  parties: { id: string; name: string; role: string; representsPartyId: string | null }[];
  links: { type: string; id: string; title: string | null; status: string | null }[];
  tasks: {
    title: string;
    status: string;
    dueDate: string | null;
    priority: string;
    assigneeName: string | null;
  }[];
  deadlines: {
    title: string;
    type: string;
    dueAt: string;
    status: string;
    location: string | null;
    basis: string | null;
  }[];
  history: { type: string; occurredAt: string; summary: string }[];
  chronology: {
    date: string;
    precision: string;
    kind: string;
    description: string;
    source: string;
  }[];
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function csvCell(value: string): string {
  // Quote every cell; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function chronologyCsv(matter: MatterView): string {
  const rows = [
    ['date', 'precision', 'kind', 'description', 'source'],
    ...matter.chronology.map((c) => [c.date, c.precision, c.kind, c.description, c.source]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function caseReportModel(matter: MatterView, generatedAt: string): ExportModel {
  const partyName = new Map(matter.parties.map((p) => [p.id, p.name]));
  const role = (r: string) => r.replace(/_/g, ' ');
  const sections = [
    {
      title: 'Matter',
      content: [
        `${matter.matterNumber} · ${matter.title}`,
        `Category: ${role(matter.legalCategory)} · Jurisdiction: ${matter.jurisdictionCode} · Status: ${role(matter.status)}`,
        matter.description ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    {
      title: 'Parties',
      content:
        matter.parties
          .map(
            (p) =>
              `${p.name} — ${role(p.role)}${p.representsPartyId ? ` (for ${partyName.get(p.representsPartyId) ?? 'a party'})` : ''}`,
          )
          .join('\n') || 'None recorded.',
    },
    {
      title: 'Chronology',
      content:
        matter.chronology.map((c) => `${c.date} · ${c.description} (${c.source})`).join('\n') ||
        'No dated events.',
    },
    {
      title: 'Deadlines and hearings',
      content:
        matter.deadlines
          .map(
            (d) =>
              `${d.dueAt.slice(0, 16).replace('T', ' ')} · ${role(d.type)} · ${d.title} · ${d.status}${d.location ? ` · ${d.location}` : ''}`,
          )
          .join('\n') || 'None recorded.',
    },
    {
      title: 'Tasks',
      content:
        matter.tasks
          .map(
            (t) =>
              `[${t.status.replace('_', ' ')}] ${t.title}${t.dueDate ? ` · due ${t.dueDate}` : ''}`,
          )
          .join('\n') || 'None recorded.',
    },
    {
      title: 'Linked research, arguments, documents and evidence',
      content:
        matter.links
          .map((l) => `${role(l.type)}: ${l.title ?? l.id}${l.status ? ` (${l.status})` : ''}`)
          .join('\n') || 'None linked.',
    },
    {
      title: 'Procedural history',
      content: [...matter.history]
        .reverse()
        .map((h) => `${h.occurredAt.slice(0, 16).replace('T', ' ')} · ${h.summary}`)
        .join('\n'),
    },
  ];
  const hash = createHash('sha256').update(JSON.stringify(sections)).digest('hex');
  return {
    title: `Case report — ${matter.matterNumber}`,
    templateName: matter.title,
    versionNumber: 1,
    contentHash: hash,
    final: true,
    generatedAt,
    sections,
    citations: [],
  };
}

export interface BundleDocument {
  title: string;
  model: ExportModel;
}

export function buildCaseBundle(
  matter: MatterView,
  documents: readonly BundleDocument[],
  generatedAt: string,
): { zip: Uint8Array; sha256: string; files: { path: string; sha256: string; bytes: number }[] } {
  const files: Record<string, Uint8Array> = {};
  const slug = (text: string) =>
    text
      .replace(/[^\p{L}\p{N} _-]+/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'document';
  files['case-report.pdf'] = renderPdf(caseReportModel(matter, generatedAt));
  files['chronology.csv'] = strToU8(chronologyCsv(matter));
  documents.forEach((doc, index) => {
    const base = `documents/${String(index + 1).padStart(2, '0')}-${slug(doc.title)}-v${doc.model.versionNumber}`;
    files[`${base}.pdf`] = renderPdf(doc.model);
    files[`${base}.docx`] = renderDocx(doc.model);
  });
  files['evidence-manifest.json'] = strToU8(
    JSON.stringify(
      matter.links
        .filter((l) => l.type === 'evidence_item')
        .map((l) => ({ evidenceItemId: l.id, title: l.title })),
      null,
      2,
    ),
  );
  const listing = Object.entries(files).map(([path, bytes]) => ({
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
  }));
  files['manifest.json'] = strToU8(
    JSON.stringify(
      {
        matter: { id: matter.id, number: matter.matterNumber, title: matter.title },
        generatedAt,
        generator: 'Njumeni case bundle 1.0',
        note: 'Evidence originals stay in the workspace store; their identifiers are listed in evidence-manifest.json.',
        files: listing,
      },
      null,
      2,
    ),
  );
  const zip = zipSync(files, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
  return { zip, sha256: sha256(zip), files: listing };
}
