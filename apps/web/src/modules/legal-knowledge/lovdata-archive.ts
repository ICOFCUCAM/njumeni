// Lovdata public-data archives (Phase 2 Task 2.8).
//
// Verified 2026-11-12 on https://api.lovdata.no/om-api-tjenesten/: the free datasets are offered
// "uten krav om bruker eller autentisering" and download from /v1/publicData/get/{filename};
// https://api.lovdata.no/v1/publicData/list returns [{filename, description, sizeBytes, lastModified}].
// Archives are tar files compressed with bzip2. Node has no bzip2 decoder, so the worker loads the
// optional, worker-only `seek-bzip` runtime lazily (the same pattern as the embedding runtime);
// the web application never bundles it.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { sha256 } from './contracts.ts';
import { createHash } from 'node:crypto';
import { assertAcquisitionPermitted, LOVDATA_LICENCE_POLICY } from './licence-policy.ts';

export const LOVDATA_API_BASE = 'https://api.lovdata.no/v1/publicData';
export const LOVDATA_USER_AGENT = 'njumeni-legal-ingestion/1.0 (+https://github.com/ICOFCUCAM/njumeni)';
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 50_000;

export interface LovdataPublicDataFile {
  filename: string;
  description: string;
  sizeBytes: number;
  lastModified: string;
}
export interface LovdataArchiveEntry {
  path: string;
  content: string;
  sha256: string;
}
export interface LovdataArchive {
  filename: string;
  sourceUri: string;
  lastModified: string | null;
  sizeBytes: number;
  sha256: string;
  retrievedAt: string;
  entries: ReadonlyMap<string, LovdataArchiveEntry>;
}
export type Bzip2Decoder = (compressed: Uint8Array) => Uint8Array;
export type Bzip2DecoderLoader = () => Promise<Bzip2Decoder>;
export interface LovdataArchiveSource {
  load(): Promise<LovdataArchive>;
}

const DECODER_MODULE = 'seek-bzip';
export const loadSeekBzipDecoder: Bzip2DecoderLoader = async () => {
  let runtime: { default?: { decode?: unknown }; decode?: unknown };
  try {
    // A variable specifier keeps the optional runtime out of type-checking and bundling.
    runtime = await import(/* webpackIgnore: true */ DECODER_MODULE);
  } catch {
    throw new Error('LOVDATA_BZIP2_RUNTIME_NOT_INSTALLED');
  }
  const decode = runtime.decode ?? runtime.default?.decode;
  if (typeof decode !== 'function') throw new Error('LOVDATA_BZIP2_RUNTIME_INVALID');
  return (compressed: Uint8Array) => {
    const output = (decode as (input: Buffer) => Uint8Array)(Buffer.from(compressed));
    if (!(output instanceof Uint8Array)) throw new Error('LOVDATA_BZIP2_RUNTIME_INVALID');
    return output;
  };
};

function isSafeFilename(filename: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,120}\.tar\.bz2$/.test(filename);
}

/** The datasets the Lovdata licence policy covers (NLOD 2.0 public API data). */
export const LOVDATA_LICENSED_DATASETS: readonly string[] = LOVDATA_LICENCE_POLICY.permittedDatasets;

export function assertLovdataDatasetLicensed(filename: string): void {
  if (!isSafeFilename(filename)) throw new Error('LOVDATA_ARCHIVE_FILENAME_INVALID');
  if (!LOVDATA_LICENSED_DATASETS.includes(filename)) throw new Error('LEGAL_SOURCE_LICENCE_DATASET_NOT_PERMITTED');
}

/** Every request goes to the official API host; the website is never fetched (no scraping). */
function assertApiRequest(url: string, dataset: string | null): void {
  if (!url.startsWith(LOVDATA_API_BASE + '/')) throw new Error('LEGAL_SOURCE_LICENCE_HOST_NOT_PERMITTED');
  assertAcquisitionPermitted(
    { ...LOVDATA_LICENCE_POLICY, permittedDatasets: dataset === null ? [] : LOVDATA_LICENCE_POLICY.permittedDatasets },
    { uri: url, dataset },
  );
}

export function parsePublicDataList(value: unknown): LovdataPublicDataFile[] {
  if (!Array.isArray(value)) throw new Error('LOVDATA_PUBLIC_DATA_LIST_INVALID');
  return value.map(item => {
    const row = item as Record<string, unknown>;
    const sizeBytes = Number(row?.sizeBytes);
    if (!row || typeof row.filename !== 'string' || !isSafeFilename(row.filename) ||
        typeof row.lastModified !== 'string' || Number.isNaN(Date.parse(row.lastModified)) ||
        !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      throw new Error('LOVDATA_PUBLIC_DATA_LIST_INVALID');
    }
    return {
      filename: row.filename,
      description: typeof row.description === 'string' ? row.description : '',
      sizeBytes,
      lastModified: new Date(row.lastModified).toISOString(),
    };
  });
}

function readString(block: Uint8Array, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return Buffer.from(end < 0 ? slice : slice.subarray(0, end)).toString('utf8');
}
function readOctal(block: Uint8Array, offset: number, length: number): number {
  const text = readString(block, offset, length).trim();
  if (!/^[0-7]*$/.test(text)) throw new Error('LOVDATA_TAR_HEADER_INVALID');
  return text ? Number.parseInt(text, 8) : 0;
}

/** Reads regular files from a POSIX (ustar/GNU) tar archive. Paths are normalised and confined. */
export function readTarEntries(tar: Uint8Array): Map<string, LovdataArchiveEntry> {
  const entries = new Map<string, LovdataArchiveEntry>();
  let offset = 0;
  let longName: string | null = null;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    let checksum = 0;
    for (let index = 0; index < 512; index++) checksum += index >= 148 && index < 156 ? 32 : header[index]!;
    if (checksum !== readOctal(header, 148, 8)) throw new Error('LOVDATA_TAR_CHECKSUM_INVALID');
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156]!);
    const prefix = readString(header, 345, 155);
    const name = longName ?? (prefix ? prefix + '/' : '') + readString(header, 0, 100);
    longName = null;
    const dataStart = offset + 512;
    if (dataStart + size > tar.length) throw new Error('LOVDATA_TAR_TRUNCATED');
    const data = tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = Buffer.from(data).toString('utf8').replace(/\0+$/, ''); continue; }
    if (type !== '0' && type !== '\0') continue;
    const path = name.replace(/^\.\//, '');
    if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(path) || path.split('/').includes('..')) {
      throw new Error('LOVDATA_TAR_PATH_INVALID');
    }
    if (size > MAX_ENTRY_BYTES) throw new Error('LOVDATA_TAR_ENTRY_TOO_LARGE');
    if (entries.size >= MAX_ENTRIES) throw new Error('LOVDATA_TAR_TOO_MANY_ENTRIES');
    const content = new TextDecoder('utf-8', { fatal: true }).decode(data);
    entries.set(path, { path, content, sha256: sha256(content) });
  }
  return entries;
}

function bytesSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function decodeLovdataArchive(input: {
  filename: string;
  compressed: Uint8Array;
  expectedSizeBytes: number | null;
  lastModified: string | null;
  retrievedAt: string;
  loadDecoder?: Bzip2DecoderLoader;
}): Promise<LovdataArchive> {
  assertLovdataDatasetLicensed(input.filename);
  if (input.compressed.length === 0 || input.compressed.length > MAX_ARCHIVE_BYTES) {
    throw new Error('LOVDATA_ARCHIVE_SIZE_INVALID');
  }
  // The published sizeBytes is the only integrity signal Lovdata offers; a mismatch means a
  // truncated or substituted download.
  if (input.expectedSizeBytes !== null && input.compressed.length !== input.expectedSizeBytes) {
    throw new Error('LOVDATA_ARCHIVE_SIZE_MISMATCH');
  }
  if (input.compressed[0] !== 0x42 || input.compressed[1] !== 0x5a || input.compressed[2] !== 0x68) {
    throw new Error('LOVDATA_ARCHIVE_NOT_BZIP2');
  }
  const decode = await (input.loadDecoder ?? loadSeekBzipDecoder)();
  const entries = readTarEntries(decode(input.compressed));
  if (entries.size === 0) throw new Error('LOVDATA_ARCHIVE_EMPTY');
  return {
    filename: input.filename,
    sourceUri: LOVDATA_API_BASE + '/get/' + input.filename,
    lastModified: input.lastModified,
    sizeBytes: input.compressed.length,
    sha256: bytesSha256(input.compressed),
    retrievedAt: input.retrievedAt,
    entries,
  };
}

type FetchLike = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;

function classifyStatus(status: number): string {
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'UPSTREAM_5XX';
  if (status === 404) return 'SOURCE_RECORD_NOT_FOUND';
  return 'LOVDATA_HTTP_' + status;
}

/** Downloads an archive from the official API after checking it is listed, and verifies its size. */
export function createLovdataHttpArchiveSource(options: {
  filename: string;
  fetch?: FetchLike;
  loadDecoder?: Bzip2DecoderLoader;
  now?: () => Date;
  timeoutMs?: number;
}): LovdataArchiveSource {
  assertLovdataDatasetLicensed(options.filename);
  const fetcher = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const headers = { 'user-agent': LOVDATA_USER_AGENT };
  const timeout = options.timeoutMs ?? 120_000;
  return {
    async load() {
      let listResponse;
      assertApiRequest(LOVDATA_API_BASE + '/list', null);
      assertApiRequest(LOVDATA_API_BASE + '/get/' + options.filename, options.filename);
      try {
        listResponse = await fetcher(LOVDATA_API_BASE + '/list',
          { headers: { ...headers, accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
      } catch { throw new Error('NETWORK_TIMEOUT'); }
      if (!listResponse.ok) throw new Error(classifyStatus(listResponse.status));
      const listed = parsePublicDataList(await listResponse.json()).find(file => file.filename === options.filename);
      if (!listed) throw new Error('LOVDATA_ARCHIVE_NOT_LISTED');
      let response;
      try {
        response = await fetcher(LOVDATA_API_BASE + '/get/' + options.filename,
          { headers, signal: AbortSignal.timeout(timeout) });
      } catch { throw new Error('NETWORK_TIMEOUT'); }
      if (!response.ok) throw new Error(classifyStatus(response.status));
      const retrievedAt = (options.now?.() ?? new Date()).toISOString();
      return decodeLovdataArchive({
        filename: options.filename, compressed: new Uint8Array(await response.arrayBuffer()),
        expectedSizeBytes: listed.sizeBytes, lastModified: listed.lastModified, retrievedAt,
        ...(options.loadDecoder ? { loadDecoder: options.loadDecoder } : {}),
      });
    },
  };
}

/**
 * Reads an archive an operator downloaded from the official API (for hosts whose egress Lovdata
 * refuses). The operator records the listing facts; the size is checked against them.
 */
export function createLovdataFileArchiveSource(options: {
  path: string;
  /** The licensed dataset the file was downloaded as; defaults to the file name. */
  dataset?: string;
  expectedSizeBytes: number;
  lastModified: string;
  retrievedAt: string;
  expectedSha256?: string;
  loadDecoder?: Bzip2DecoderLoader;
}): LovdataArchiveSource {
  return {
    async load() {
      const compressed = new Uint8Array(await readFile(options.path));
      const archive = await decodeLovdataArchive({
        filename: options.dataset ?? basename(options.path), compressed, expectedSizeBytes: options.expectedSizeBytes,
        lastModified: new Date(options.lastModified).toISOString(),
        retrievedAt: new Date(options.retrievedAt).toISOString(),
        ...(options.loadDecoder ? { loadDecoder: options.loadDecoder } : {}),
      });
      if (options.expectedSha256 && archive.sha256 !== options.expectedSha256.toLowerCase()) {
        throw new Error('LOVDATA_ARCHIVE_HASH_MISMATCH');
      }
      return archive;
    },
  };
}
