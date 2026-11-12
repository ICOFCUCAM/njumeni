import type { ModuleIconName } from '@/components/module-icon';
export type ModuleDefinition = {
  id: string;
  name: string;
  shortLabel: string;
  slug: string;
  href: string;
  summary: string;
  description: string;
  deliveryPhase: string;
  icon: ModuleIconName;
};
export const moduleRegistry: ModuleDefinition[] = [
  {
    id: 'A',
    name: 'Njumeni Legal Intelligence',
    shortLabel: 'Legal Intelligence',
    slug: 'intelligence',
    href: '/intelligence',
    summary:
      'The central legal intelligence experience for questions, research and source-linked analysis.',
    description:
      'The unified entry point for legal questions, jurisdiction-aware research, legal issue identification and source-grounded intelligence.',
    deliveryPhase: 'Phases 5–7',
    icon: 'sparkles',
  },
  {
    id: 'B',
    name: 'Legal Research Engine',
    shortLabel: 'Legal Research',
    slug: 'research',
    href: '/research',
    summary: 'Discover legislation, judgments, regulations, treaties and other legal authorities.',
    description:
      'A jurisdiction-aware research engine with authoritative source discovery, historical versions, passage provenance and citation verification.',
    deliveryPhase: 'Phases 2 and 5',
    icon: 'search',
  },
  {
    id: 'C',
    name: 'Evidence Intelligence Engine',
    shortLabel: 'Evidence Intelligence',
    slug: 'evidence',
    href: '/evidence',
    summary: 'Organise documents, exhibits, chronology, extraction and evidence provenance.',
    description:
      'A secure evidence foundation for originals, immutable versions, extracted passages, chronology, relationships and chain-of-custody records.',
    deliveryPhase: 'Phases 3–4',
    icon: 'file',
  },
  {
    id: 'D',
    name: 'Legal Case Management',
    shortLabel: 'Matters and Cases',
    slug: 'matters',
    href: '/matters',
    summary: 'Manage matter lifecycles, parties, tasks, deadlines and procedural history.',
    description:
      'The matter context coordinates case intake, lifecycle, assignments, deadlines, events and authorised links to evidence and legal work product.',
    deliveryPhase: 'Phases 9–10',
    icon: 'folder',
  },
  {
    id: 'E',
    name: 'Legal Document Intelligence',
    shortLabel: 'Document Intelligence',
    slug: 'documents',
    href: '/documents',
    summary: 'Review, compare, draft and verify legal documents with traceable source references.',
    description:
      'A controlled document lifecycle for templates, drafts, analysis, citation verification, human review, approval and export.',
    deliveryPhase: 'Phases 4 and 8',
    icon: 'file',
  },
  {
    id: 'F',
    name: 'Legal Argument and Reasoning Engine',
    shortLabel: 'Legal Reasoning',
    slug: 'arguments',
    href: '/arguments',
    summary: 'Structure legal issues, facts, rules, claims, arguments and counterarguments.',
    description:
      'A provenance-preserving argument graph and reasoning workspace that distinguishes facts, allegations, inferences, rules and legal conclusions.',
    deliveryPhase: 'Phase 5',
    icon: 'scale',
  },
  {
    id: 'G',
    name: 'Jurisdiction and Legal Systems Engine',
    shortLabel: 'Jurisdictions',
    slug: 'jurisdictions',
    href: '/jurisdictions',
    summary:
      'Resolve jurisdiction, legal system, court hierarchy, applicable dates and source coverage.',
    description:
      'A governed jurisdiction registry for legal-system profiles, source coverage, official languages, court hierarchies and applicable-law context.',
    deliveryPhase: 'Phase 2; expansion in Phase 12',
    icon: 'globe',
  },
  {
    id: 'H',
    name: 'Personal Legal Assistant',
    shortLabel: 'Personal Assistant',
    slug: 'assistant',
    href: '/assistant',
    summary: 'Help individuals organise legal questions, documents, timelines and preparation.',
    description:
      'A private personal workspace for guided intake, plain-language explanation, document organisation, chronology and preparation for qualified legal support.',
    deliveryPhase: 'Phase 9',
    icon: 'user',
  },
  {
    id: 'I',
    name: 'Professional Legal Workspace',
    shortLabel: 'Professional Workspace',
    slug: 'professional',
    href: '/professional',
    summary: 'Bring client matters, research, evidence, drafting and review into one workspace.',
    description:
      'A professional workspace for client and matter assignments, research, evidence, argument development, drafting, collaboration and reviewed work product.',
    deliveryPhase: 'Phases 9–10',
    icon: 'briefcase',
  },
  {
    id: 'J',
    name: 'Enterprise and Law Firm Workspace',
    shortLabel: 'Law Firm and Enterprise',
    slug: 'organisation',
    href: '/organisation',
    summary: 'Manage organisations, teams, roles, invitations, shared libraries and policies.',
    description:
      'An organisation context for teams, offices, memberships, roles, invitations, workflow policies, audit, usage and enterprise administration.',
    deliveryPhase: 'Phase 10',
    icon: 'building',
  },
  {
    id: 'K',
    name: 'Institutional Workspace',
    shortLabel: 'Institutional Workspace',
    slug: 'institutional',
    href: '/institutional',
    summary: 'Support institution-scoped legal research, review, oversight and records governance.',
    description:
      'A strictly isolated institutional workspace for repositories, administrative decision review, compliance, oversight, retention and institutional reporting.',
    deliveryPhase: 'Phase 10',
    icon: 'landmark',
  },
  {
    id: 'L',
    name: 'Legal Compliance and Risk Intelligence',
    shortLabel: 'Compliance and Risk',
    slug: 'compliance',
    href: '/compliance',
    summary: 'Track regulatory sources, obligations, assessments, evidence and review schedules.',
    description:
      'A source-linked compliance and risk context built around traceable obligations, regulatory change, evidence, explainable assessments and review schedules.',
    deliveryPhase: 'Phases 10 and 12',
    icon: 'shield',
  },
  {
    id: 'M',
    name: 'Legal Knowledge Management',
    shortLabel: 'Knowledge Management',
    slug: 'knowledge',
    href: '/knowledge',
    summary: 'Curate research, precedents, opinions, templates, arguments and approved knowledge.',
    description:
      'A governed knowledge context for saved research, precedents, opinions, templates, approved arguments, collections, taxonomies and access policies.',
    deliveryPhase: 'Phases 9–10',
    icon: 'book',
  },
];
export function getModuleBySlug(slug: string): ModuleDefinition | undefined {
  return moduleRegistry.find((module) => module.slug === slug);
}
