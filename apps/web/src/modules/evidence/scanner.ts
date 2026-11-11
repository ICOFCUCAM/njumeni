// Evidence intake scanning. The built-in scanner enforces structural safety rules and recognises
// the EICAR test signature; a full anti-malware engine (for example ClamAV) plugs in through
// ExternalMalwareScanner before Stage 1, when real user files are accepted (ADR-0003).
import { unzipSync } from 'fflate';
import {
  detectEvidenceFileKind,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_KINDS,
  type EvidenceFileKind,
} from './file-kind.ts';

export type ScanVerdict = 'clean' | 'infected' | 'rejected';
export interface ScanResult {
  verdict: ScanVerdict;
  detail: string | null;
  kind: EvidenceFileKind;
  scanner: string;
}
export interface ExternalMalwareScanner {
  readonly name: string;
  scan(bytes: Uint8Array): Promise<{ infected: boolean; signature: string | null }>;
}

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  // Latin-1 decoding keeps a 1:1 byte mapping, so binary content is searched safely.
  return new TextDecoder('latin1').decode(bytes).includes(needle);
}

function zipEntryNames(bytes: Uint8Array): string[] | null {
  try {
    // Names only: the filter rejects every entry so nothing is decompressed (zip-bomb safe).
    const names: string[] = [];
    unzipSync(bytes, {
      filter: (file) => {
        names.push(file.name);
        return false;
      },
    });
    return names;
  } catch {
    return null;
  }
}

export async function scanEvidenceFile(
  bytes: Uint8Array,
  declaredMimeType: string,
  external?: ExternalMalwareScanner,
): Promise<ScanResult> {
  const scanner = external ? `structural+${external.name}` : 'structural';
  const reject = (detail: string, kind: EvidenceFileKind = 'unknown'): ScanResult => ({
    verdict: 'rejected',
    detail,
    kind,
    scanner,
  });

  if (bytes.length === 0) return reject('Empty file');
  if (bytes.length > EVIDENCE_MAX_BYTES) return reject('File exceeds the 100 MB limit');
  if (containsAscii(bytes, EICAR)) {
    return { verdict: 'infected', detail: 'EICAR-Test-Signature', kind: 'unknown', scanner };
  }
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return reject('Executable content is not accepted');
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return reject('Executable content is not accepted');
  }

  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const entries = isZip ? zipEntryNames(bytes) : undefined;
  if (isZip && entries === null) return reject('Corrupt archive');
  const kind = detectEvidenceFileKind(bytes, entries ?? undefined);
  const expected = EVIDENCE_MIME_KINDS[declaredMimeType];
  if (!expected) return reject(`File type ${declaredMimeType} is not accepted`, kind);
  // Plain text may legitimately be a saved email and vice versa.
  const compatible =
    expected === kind ||
    (expected === 'text' && kind === 'email') ||
    (expected === 'email' && kind === 'text');
  if (!compatible) return reject(`Content does not match the declared type (${kind})`, kind);

  if (
    entries?.some(
      (name) =>
        /vbaProject\.bin$/i.test(name) ||
        (/\.(bin|exe|dll|js|vbs)$/i.test(name) && /embeddings|activeX/i.test(name)),
    )
  ) {
    return reject('Macro-enabled or embedded executable content is not accepted', kind);
  }
  if (
    kind === 'pdf' &&
    (containsAscii(bytes, '/JavaScript') ||
      containsAscii(bytes, '/Launch') ||
      containsAscii(bytes, '/EmbeddedFile'))
  ) {
    return reject('PDF with active or embedded content is not accepted', kind);
  }

  if (external) {
    const result = await external.scan(bytes);
    if (result.infected) {
      return { verdict: 'infected', detail: result.signature ?? 'Malware detected', kind, scanner };
    }
  }
  return { verdict: 'clean', detail: null, kind, scanner };
}
