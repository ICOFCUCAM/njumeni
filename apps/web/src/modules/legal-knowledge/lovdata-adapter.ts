// Lovdata public-data adapter: Norwegian current acts (Phase 2 Task 2.8, master plan §6.3).
//
// Source facts verified 2026-11-12 (docs/PHASE_2_TASK_2_8_LOVDATA_PILOT.md):
// - https://api.lovdata.no/om-api-tjenesten/: consolidated current acts and central regulations
//   "kan fritt benyttes til alle formål uten vederlag, gjennom API. Dataene er lisensiert under
//   NLOD 2.0."; no user or authentication required; new packages every night.
// - https://api.lovdata.no/v1/publicData/list lists gjeldende-lover.tar.bz2.
// Registering this adapter does not permit ingestion: the database gates (rights review,
// operator activation, ingestion enablement and the exact adapter pin) decide that.
import type { LegalAdapterRegistration } from './adapter-registry.ts';
import type {
  LegalAuthorityInput,
  LegalSourceAdapter,
  LegalSourceManifest,
} from './contracts.ts';
import {
  assertLovdataDatasetLicensed,
  createLovdataFileArchiveSource,
  createLovdataHttpArchiveSource,
  type LovdataArchive,
  type LovdataArchiveSource,
} from './lovdata-archive.ts';
import { parseLovdataDocument, type LovdataDocument } from './lovdata-document.ts';
import { LOVDATA_LICENCE_POLICY } from './licence-policy.ts';

export const LOVDATA_SOURCE_KEY = 'lovdata-official';
export const LOVDATA_ADAPTER_KEY = 'lovdata-public-data';
// 1.1.0: licence-policy enforcement (licensed API datasets only), dataset snapshots for
// incremental synchronisation and absence detection, licence URI in the provenance metadata.
export const LOVDATA_ADAPTER_VERSION = '1.1.0';
export const LOVDATA_NORMALISATION_PROFILE = 'lovdata-nl-html-v1';
export const LOVDATA_CURRENT_ACTS_ARCHIVE = 'gjeldende-lover.tar.bz2';
export const LOVDATA_CENTRAL_REGULATIONS_ARCHIVE = 'gjeldende-sentrale-forskrifter.tar.bz2';
export const LOVDATA_LICENCE = LOVDATA_LICENCE_POLICY.licenceIdentifier;

export const LOVDATA_MANIFEST: LegalSourceManifest = Object.freeze({
  sourceKey: LOVDATA_SOURCE_KEY,
  name: 'Lovdata — official legal information portal',
  issuingAuthority: 'Lovdata / Norwegian public authorities',
  jurisdictionCode: 'NO',
  sourceType: 'legislation',
  baseUri: 'https://lovdata.no/',
  allowedHosts: Object.freeze(['lovdata.no']),
  accessMethod: 'bulk_download',
  adapterKey: LOVDATA_ADAPTER_KEY,
  adapterVersion: LOVDATA_ADAPTER_VERSION,
});

const CURSOR_PREFIX = 'after:';
const DOKID = /^[A-Z]{2,4}\/(lov|forskrift)\/\d{4}-\d{2}-\d{2}(?:-[0-9A-Za-z]{1,12})?$/;
const REFID = /^(lov|forskrift)\/\d{4}-\d{2}-\d{2}(?:-\d{1,6})?/;
const VARIANT = /-([a-z]{2})\.xml$/;
const MAX_RELATIONSHIPS = 100;
const MAX_METADATA_LIST = 20;
// Norway's Constitution (Kongeriket Noregs grunnlov), identified by its Lovdata reference.
const CONSTITUTION_REFID = 'lov/1814-05-17';

interface IndexedDocument {
  externalId: string;
  entryPath: string;
  entrySha256: string;
  refid: string;
  document: LovdataDocument;
}
interface LovdataIndex {
  archive: LovdataArchive;
  byExternalId: Map<string, IndexedDocument>;
  byRefid: Map<string, string>;
  externalIds: string[];
}

function isoDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function refidOf(href: string): string | null {
  return REFID.exec(href.replace(/^\/+/, ''))?.[0] ?? null;
}

export function buildLovdataIndex(archive: LovdataArchive): LovdataIndex {
  const byExternalId = new Map<string, IndexedDocument>();
  const byRefid = new Map<string, string>();
  for (const entry of [...archive.entries.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!entry.path.endsWith('.xml')) continue;
    const document = parseLovdataDocument(entry.content);
    const dokid = document.keyInfo.dokid ?? '';
    const refid = document.keyInfo.refid ?? '';
    if (!DOKID.test(dokid) || !REFID.test(refid)) throw new Error('LOVDATA_DOCUMENT_IDENTIFIER_INVALID');
    // Language variants share one DokumentID (for example the nynorsk Constitution).
    const variant = VARIANT.exec(entry.path)?.[1];
    const externalId = variant ? dokid + ':' + variant : dokid;
    if (byExternalId.has(externalId)) throw new Error('LOVDATA_DUPLICATE_EXTERNAL_ID');
    byExternalId.set(externalId, { externalId, entryPath: entry.path, entrySha256: entry.sha256, refid, document });
    if (!variant || !byRefid.has(refid)) byRefid.set(refid, externalId);
  }
  if (byExternalId.size === 0) throw new Error('LOVDATA_ARCHIVE_HAS_NO_DOCUMENTS');
  return { archive, byExternalId, byRefid, externalIds: [...byExternalId.keys()].sort() };
}

function canonicalUri(indexed: IndexedDocument): string | null {
  const base = indexed.document.baseHref;
  if (base !== 'https://lovdata.no/') return null;
  return new URL(indexed.refid, base).toString();
}

function relationshipsFor(index: LovdataIndex, indexed: IndexedDocument, provenanceUri: string | null) {
  const relationships: NonNullable<LegalAuthorityInput['relationships']>[number][] = [];
  const seen = new Set<string>();
  const add = (href: string, relationshipType: 'amends' | 'cites', sourceNote: string) => {
    const refid = refidOf(href);
    const target = refid ? index.byRefid.get(refid) : undefined;
    if (!target || target === indexed.externalId || refid === indexed.refid) return;
    const key = relationshipType + '|' + target;
    if (seen.has(key) || relationships.length >= MAX_RELATIONSHIPS) return;
    seen.add(key);
    relationships.push({ targetExternalId: target, relationshipType, sourceNote, provenanceUri });
  };
  for (const href of indexed.document.keyInfoLinks.changesToDocuments ?? []) {
    add(href, 'amends', 'Lovdata key information: "Endrer"');
  }
  for (const href of indexed.document.references) add(href, 'cites', 'Reference in the statute text');
  return relationships;
}

export function toLovdataAuthority(index: LovdataIndex, externalId: string) {
  const indexed = index.byExternalId.get(externalId);
  if (!indexed) throw new Error('SOURCE_RECORD_NOT_FOUND');
  const { document } = indexed;
  const info = document.keyInfo;
  const uri = canonicalUri(indexed);
  const kind = DOKID.exec(info.dokid ?? '')?.[1];
  const authority: LegalAuthorityInput = {
    externalId,
    citation: info.legacyID || null,
    title: document.title,
    authorityType: indexed.refid === CONSTITUTION_REFID ? 'constitution' : kind === 'forskrift' ? 'regulation' : 'act',
    issuingBody: null,
    languageCode: document.languageCode,
    canonicalUri: uri,
    publicationDate: isoDate(info.dateOfPublication),
    legalStatus: 'in_force',
    // The consolidated text is the text in force since its latest amendment took effect.
    validFrom: isoDate(info.lastChangeInForce) ?? isoDate(info.dateInForce),
    metadata: {
      dataset: index.archive.filename,
      datasetLastModified: index.archive.lastModified,
      datasetSha256: index.archive.sha256,
      datasetSizeBytes: index.archive.sizeBytes,
      entryPath: indexed.entryPath,
      entrySha256: indexed.entrySha256,
      dokid: info.dokid ?? null,
      refid: indexed.refid,
      eli: info.eli || null,
      shortTitle: info.titleShort || null,
      ministries: (document.keyInfoItems.ministry ?? []).slice(0, MAX_METADATA_LIST),
      legalAreas: (document.keyInfoItems.legalArea ?? []).slice(0, MAX_METADATA_LIST),
      dateInForce: isoDate(info.dateInForce),
      lastChangeInForce: isoDate(info.lastChangeInForce),
      lastChangedBy: info.lastChangedBy ? info.lastChangedBy.slice(0, 500) : null,
      licence: LOVDATA_LICENCE,
      licenceUri: LOVDATA_LICENCE_POLICY.licenceUri,
      licencePolicyVersion: LOVDATA_LICENCE_POLICY.policyVersion,
      normalisationProfile: LOVDATA_NORMALISATION_PROFILE,
    },
    relationships: relationshipsFor(index, indexed, uri),
  };
  const sourceText = [document.title, ...document.sections.map(section => section.text)].join('\n\n');
  return {
    authority,
    sourceText,
    sections: document.sections,
    retrievedAt: index.archive.retrievedAt,
    sourceUri: index.archive.sourceUri + '#' + indexed.entryPath,
  };
}

export function createLovdataAdapter(options: {
  archiveSource: LovdataArchiveSource;
  pageSize?: number;
}): LegalSourceAdapter {
  const pageSize = options.pageSize ?? 200;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('LOVDATA_PAGE_SIZE_INVALID');
  let indexPromise: Promise<LovdataIndex> | undefined;
  const index = () => {
    indexPromise ??= options.archiveSource.load().then(buildLovdataIndex);
    indexPromise.catch(() => { indexPromise = undefined; });
    return indexPromise;
  };
  return {
    manifest: LOVDATA_MANIFEST,
    async listChangedAuthorities(cursor) {
      if (cursor !== null && (!cursor.startsWith(CURSOR_PREFIX) || cursor.length > 600)) {
        throw new Error('LOVDATA_CURSOR_INVALID');
      }
      const after = cursor === null ? null : cursor.slice(CURSOR_PREFIX.length);
      const { externalIds } = await index();
      const remaining = after === null ? externalIds : externalIds.filter(id => id > after);
      const page = remaining.slice(0, pageSize);
      const complete = remaining.length <= pageSize;
      return {
        externalIds: page,
        nextCursor: complete || page.length === 0 ? null : CURSOR_PREFIX + page[page.length - 1],
        complete,
      };
    },
    async fetchAuthority(externalId) {
      return toLovdataAuthority(await index(), externalId);
    },
    async datasetSnapshot() {
      const { archive, externalIds } = await index();
      return {
        dataset: archive.filename,
        sha256: archive.sha256,
        sizeBytes: archive.sizeBytes,
        lastModified: archive.lastModified,
        retrievedAt: archive.retrievedAt,
        sourceUri: archive.sourceUri,
        externalIds,
      };
    },
  };
}

/** Archive source from the worker environment: a verified local file, else the official API. */
export function lovdataArchiveSourceFromEnv(env: NodeJS.ProcessEnv): LovdataArchiveSource {
  // Only a dataset the licence policy covers can be selected (current laws by default).
  const dataset = env.LOVDATA_DATASET?.trim() || LOVDATA_CURRENT_ACTS_ARCHIVE;
  assertLovdataDatasetLicensed(dataset);
  const path = env.LOVDATA_ARCHIVE_PATH?.trim();
  if (!path) return createLovdataHttpArchiveSource({ filename: dataset });
  const sizeBytes = Number(env.LOVDATA_ARCHIVE_SIZE_BYTES);
  const lastModified = env.LOVDATA_ARCHIVE_LAST_MODIFIED?.trim();
  const retrievedAt = env.LOVDATA_ARCHIVE_RETRIEVED_AT?.trim();
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || !lastModified || !retrievedAt ||
      Number.isNaN(Date.parse(lastModified)) || Number.isNaN(Date.parse(retrievedAt))) {
    throw new Error('LOVDATA_ARCHIVE_FILE_PROVENANCE_REQUIRED');
  }
  const expectedSha256 = env.LOVDATA_ARCHIVE_SHA256?.trim();
  return createLovdataFileArchiveSource({
    path, dataset, expectedSizeBytes: sizeBytes, lastModified, retrievedAt,
    ...(expectedSha256 ? { expectedSha256 } : {}),
  });
}

export function lovdataAdapterRegistration(env: NodeJS.ProcessEnv = process.env): LegalAdapterRegistration {
  return {
    manifest: LOVDATA_MANIFEST,
    create: () => createLovdataAdapter({ archiveSource: lovdataArchiveSourceFromEnv(env) }),
  };
}
