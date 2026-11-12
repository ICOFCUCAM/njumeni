// Evidence file-type detection from the bytes themselves (never from the filename alone).
export type EvidenceFileKind =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'text'
  | 'email'
  | 'png'
  | 'jpeg'
  | 'tiff'
  | 'unknown';

export const EVIDENCE_MAX_BYTES = 100 * 1024 * 1024;

/** Declared MIME types accepted for evidence upload, with the kind their bytes must match. */
export const EVIDENCE_MIME_KINDS: Readonly<Record<string, EvidenceFileKind>> = Object.freeze({
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'text',
  'text/csv': 'text',
  'message/rfc822': 'email',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/tiff': 'tiff',
});

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  let control = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) control += 1;
  }
  return sample.length > 0 && control / sample.length < 0.02;
}

function looksLikeEmail(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4096));
  const headerBlock = head.split(/\r?\n\r?\n/, 1)[0] ?? '';
  return (
    /^(from|to|subject|date|message-id|received|mime-version):/im.test(headerBlock) &&
    /^from:/im.test(headerBlock)
  );
}

/** Detects the container kind; OOXML documents are distinguished by their content-types part. */
export function detectEvidenceFileKind(
  bytes: Uint8Array,
  zipEntries?: readonly string[],
): EvidenceFileKind {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]))
    return 'tiff';
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (zipEntries?.includes('word/document.xml')) return 'docx';
    if (zipEntries?.includes('xl/workbook.xml')) return 'xlsx';
    return 'unknown';
  }
  if (looksLikeText(bytes)) return looksLikeEmail(bytes) ? 'email' : 'text';
  return 'unknown';
}
