// Shapes returned by document_get, and the export model built from them (Phase 7).
import type { DocumentSection, TemplateSection } from './analysis.ts';
import type { ExportModel } from './export.ts';

export interface StoredCitation {
  sectionKey: string;
  marker: number;
  citation: string;
  quotedText: string | null;
  authorityPassageId: string | null;
  evidenceItemId: string | null;
  sourceUri: string | null;
  validFrom: string | null;
  validUntil: string | null;
}
export interface StoredDocument {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  status: 'draft' | 'in_review' | 'approved';
  currentVersion: number;
  approvedVersion: number | null;
  researchRunId: string | null;
  issueId: string | null;
  template: { key: string; name: string; version: number; sections: TemplateSection[] };
  version: {
    number: number;
    sections: (DocumentSection & { title: string })[];
    contentHash: string;
    origin: 'human' | 'agent';
    changeNote: string | null;
    createdAt: string;
  };
  citations: StoredCitation[];
  versions: {
    number: number;
    origin: string;
    changeNote: string | null;
    contentHash: string;
    createdAt: string;
  }[];
  approvals: {
    version: number;
    decision: string;
    note: string | null;
    selfReview: boolean;
    decidedAt: string;
  }[];
  canEdit: boolean;
  canApprove: boolean;
}

export function isFinalVersion(document: StoredDocument): boolean {
  return document.status === 'approved' && document.approvedVersion === document.version.number;
}

export function buildExportModel(document: StoredDocument, generatedAt: string): ExportModel {
  return {
    title: document.title,
    templateName: document.template.name,
    versionNumber: document.version.number,
    contentHash: document.version.contentHash,
    final: isFinalVersion(document),
    generatedAt,
    sections: document.version.sections
      .filter((section) => section.content.trim())
      .map((section) => ({ title: section.title, content: section.content })),
    citations: document.citations.map((c) => ({
      marker: c.marker,
      citation: c.citation,
      quotedText: c.quotedText,
      sourceUri: c.sourceUri,
      validFrom: c.validFrom,
    })),
  };
}
