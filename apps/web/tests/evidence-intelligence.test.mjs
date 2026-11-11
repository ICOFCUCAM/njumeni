import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { scanEvidenceFile } from '../src/modules/evidence/scanner.ts';
import { extractEvidenceText } from '../src/modules/evidence/extractors.ts';
import {
  buildChronology,
  buildPassages,
  extractEntities,
  findDates,
  fullText,
  sha256Hex,
} from '../src/modules/evidence/analysis.ts';
import { processPendingEvidence } from '../src/modules/evidence/pipeline.ts';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function docx(paragraphs, extra = {}) {
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`)
    .join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(`<w:document><w:body>${body}</w:body></w:document>`),
    ...extra,
  });
}
function xlsx() {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="Payments" sheetId="1"/></sheets></workbook>',
    ),
    'xl/sharedStrings.xml': strToU8(
      '<sst><si><t>Date</t></si><si><t>Amount</t></si><si><t>Salary March</t></si></sst>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="inlineStr"><is><t>2024-03-31</t></is></c><c r="B2"><v>42000</v></c><c r="C2" t="s"><v>2</v></c></row>' +
        '</sheetData></worksheet>',
    ),
  });
}
/** A valid single-page PDF with a text layer; xref offsets are computed exactly. */
function pdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(out);
}
const EML = [
  'From: HR <hr@employer.example>',
  'To: worker@example.invalid',
  'Subject: =?utf-8?q?Varsel?=',
  'Date: Thu, 14 Mar 2024 09:00:00 +0100',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Vi bekrefter at ulykken ble meldt 14. mars 2024. Kontakt oss p=C3=A5 telefon.',
  '--b1--',
  '',
].join('\r\n');

// ----- scanning ----------------------------------------------------------------------------
test('scanner accepts well-formed documents whose bytes match the declared type', async () => {
  assert.equal((await scanEvidenceFile(docx(['Hello']), DOCX)).verdict, 'clean');
  assert.equal((await scanEvidenceFile(xlsx(), XLSX)).verdict, 'clean');
  assert.equal((await scanEvidenceFile(pdf('Hello'), 'application/pdf')).verdict, 'clean');
  assert.equal((await scanEvidenceFile(strToU8(EML), 'message/rfc822')).verdict, 'clean');
});

test('scanner flags the EICAR test signature as infected', async () => {
  const eicar = strToU8('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  const result = await scanEvidenceFile(eicar, 'text/plain');
  assert.equal(result.verdict, 'infected');
  assert.equal(result.detail, 'EICAR-Test-Signature');
});

test('scanner rejects disguised, executable, macro-enabled and active content', async () => {
  assert.equal(
    (await scanEvidenceFile(pdf('x'), DOCX)).verdict,
    'rejected',
    'PDF declared as DOCX',
  );
  assert.equal(
    (await scanEvidenceFile(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]), 'application/pdf')).verdict,
    'rejected',
    'executable',
  );
  const macro = docx(['x'], { 'word/vbaProject.bin': Uint8Array.from([1, 2, 3]) });
  assert.match((await scanEvidenceFile(macro, DOCX)).detail, /Macro-enabled/);
  const activePdf = strToU8(
    new TextDecoder()
      .decode(pdf('x'))
      .replace(
        '/Type /Catalog',
        '/Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >>',
      ),
  );
  assert.match((await scanEvidenceFile(activePdf, 'application/pdf')).detail, /active or embedded/);
  assert.equal(
    (await scanEvidenceFile(strToU8('hello'), 'application/x-msdownload')).verdict,
    'rejected',
    'unaccepted type',
  );
  assert.equal(
    (await scanEvidenceFile(new Uint8Array(), 'text/plain')).verdict,
    'rejected',
    'empty file',
  );
});

test('external malware scanners plug in after structural checks', async () => {
  const external = {
    name: 'test-av',
    scan: async () => ({ infected: true, signature: 'Test.Signature' }),
  };
  const result = await scanEvidenceFile(strToU8('plain text'), 'text/plain', external);
  assert.equal(result.verdict, 'infected');
  assert.equal(result.scanner, 'structural+test-av');
});

// ----- extraction --------------------------------------------------------------------------
test('extracts text from DOCX, XLSX, PDF, email and plain text', async () => {
  const d = await extractEvidenceText(
    'docx',
    docx(['Arbeidsgiver skal varsle.', 'Second &amp; last']),
  );
  assert.deepEqual(d.pages, ['Arbeidsgiver skal varsle.\nSecond & last']);
  const x = await extractEvidenceText('xlsx', xlsx());
  assert.equal(x.pages[0], 'Sheet: Payments\nDate\tAmount\n2024-03-31\t42000\tSalary March');
  const p = await extractEvidenceText('pdf', pdf('Notice received 14 March 2024'));
  assert.equal(p.status, 'succeeded');
  assert.match(p.pages[0], /Notice received 14 March 2024/);
  const e = await extractEvidenceText('email', strToU8(EML));
  assert.match(e.pages[0], /^From: HR <hr@employer\.example>/);
  assert.match(e.pages[0], /Kontakt oss på telefon/, 'quoted-printable UTF-8 is decoded');
  const t = await extractEvidenceText(
    'text',
    Uint8Array.from([0xef, 0xbb, 0xbf, ...strToU8('Æøå')]),
  );
  assert.deepEqual(t.pages, ['Æøå'], 'byte-order mark is stripped');
});

test('images and text-less PDFs are recorded as needing OCR, never guessed', async () => {
  const image = await extractEvidenceText('png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));
  assert.deepEqual([image.status, image.failureCode], ['unsupported', 'OCR_NOT_CONFIGURED']);
  const scanned = await extractEvidenceText('pdf', pdf(''));
  assert.deepEqual([scanned.status, scanned.failureCode], ['unsupported', 'OCR_NOT_CONFIGURED']);
});

test('corrupt documents fail with a stable code', async () => {
  const result = await extractEvidenceText('docx', zipSync({ 'other.xml': strToU8('<x/>') }));
  assert.deepEqual([result.status, result.failureCode], ['failed', 'EVIDENCE_DOCX_INVALID']);
});

// ----- analysis ----------------------------------------------------------------------------
test('passages keep exact offsets into the full text and page anchors', () => {
  const pages = ['First paragraph.\n\nSecond paragraph.', 'Page two text.'];
  const passages = buildPassages(pages);
  const text = fullText(pages);
  assert.equal(passages.length, 3);
  for (const passage of passages) {
    assert.equal(text.slice(passage.start_offset, passage.end_offset), passage.content);
    assert.equal(passage.content_hash, sha256Hex(passage.content));
  }
  assert.deepEqual(
    passages.map((p) => p.page_number),
    [1, 1, 2],
  );
});

test('long paragraphs are split below the passage limit at sentence boundaries', () => {
  const long = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
  const passages = buildPassages([long]);
  assert.ok(passages.length > 1);
  assert.ok(passages.every((p) => p.content.length <= 2000));
  assert.equal(passages.map((p) => p.content).join(' '), long);
});

test('dates are recognised in Norwegian, English, French and numeric forms', () => {
  const found = findDates(
    'Meldt 14. mars 2024, svar 2024-04-02, møte 05.06.2024, letter of March 7, 2024, le 3 avril 2024, i mai 2024.',
  );
  assert.deepEqual(
    found.map((d) => [d.iso, d.precision]),
    [
      ['2024-03-14', 'day'],
      ['2024-04-02', 'day'],
      ['2024-06-05', 'day'],
      ['2024-03-07', 'day'],
      ['2024-04-03', 'day'],
      ['2024-05-01', 'month'],
    ],
  );
  assert.deepEqual(findDates('31.02.2024 and 2024-13-01'), [], 'impossible dates are ignored');
});

test('entities are extracted with normalised values and exact offsets', () => {
  const passages = buildPassages([
    'Fra Nordic Transport AS (ref: SAK-2024/118): krav NOK 12 500,50 til post@nordic.example, tlf +47 22 33 44 55, se https://example.invalid/sak.',
  ]);
  const entities = extractEntities(passages);
  const byType = Object.fromEntries(entities.map((e) => [e.entity_type, e.normalised_value]));
  assert.equal(byType.organisation, 'Nordic Transport AS');
  assert.equal(byType.amount, 'NOK 12500.50');
  assert.equal(byType.email, 'post@nordic.example');
  assert.equal(byType.phone, '+4722334455');
  assert.equal(byType.url, 'https://example.invalid/sak');
  assert.match(byType.reference, /SAK-2024\/118/);
  for (const entity of entities) {
    assert.equal(
      passages[0].content.slice(entity.start_offset, entity.end_offset),
      entity.raw_value,
    );
  }
});

test('chronology creates one event per dated sentence, in date order', () => {
  const passages = buildPassages([
    'Ulykken skjedde 12. mars 2024. Arbeidsgiver ble varslet 14. mars 2024.\n\nOn 2 March 2024 the shift plan changed.',
  ]);
  const events = buildChronology(passages);
  assert.deepEqual(
    events.map((e) => e.event_date),
    ['2024-03-02', '2024-03-12', '2024-03-14'],
  );
  assert.equal(events[1].description, 'Ulykken skjedde 12. mars 2024.');
});

// ----- worker pipeline ---------------------------------------------------------------------
function fakeWorkerClient(files, objects) {
  const calls = [];
  return {
    calls,
    storage: {
      from: () => ({
        download: async (key) =>
          objects.has(key)
            ? { data: new Blob([objects.get(key)]), error: null }
            : { data: null, error: { message: 'missing' } },
      }),
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'evidence_worker_pending_files') return { data: files, error: null };
      return {
        data: name === 'evidence_worker_record_extraction' ? 'extraction-id' : null,
        error: null,
      };
    },
  };
}

test('pipeline scans, verifies the hash and records extraction with entities and events', async () => {
  const bytes = docx(['Arbeidsgiver ble varslet 14. mars 2024 av Nordic Transport AS.']);
  const client = fakeWorkerClient(
    [
      {
        evidence_file_id: 'f1',
        storage_object_key: 'k1',
        content_sha256: sha256Hex(bytes),
        mime_type: DOCX,
        scan_status: 'pending',
        needs_extraction: false,
      },
    ],
    new Map([['k1', bytes]]),
  );
  const result = await processPendingEvidence({ client });
  assert.deepEqual(result.scanned, { clean: 1, infected: 0, rejected: 0 });
  assert.deepEqual(result.extracted, { succeeded: 1, unsupported: 0, failed: 0 });
  const scan = client.calls.find(([name]) => name === 'evidence_worker_record_scan')[1];
  assert.equal(scan.p_observed_sha256, sha256Hex(bytes));
  const extraction = client.calls.find(([name]) => name === 'evidence_worker_record_extraction')[1];
  assert.equal(extraction.p_extractor, 'evidence-docx');
  assert.equal(extraction.p_passages.length, 1);
  assert.equal(extraction.p_events[0].event_date, '2024-03-14');
  assert.ok(extraction.p_entities.some((e) => e.entity_type === 'organisation'));
});

test('pipeline does not extract tampered or infected files', async () => {
  const bytes = strToU8('ordinary text');
  const eicar = strToU8('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  const client = fakeWorkerClient(
    [
      {
        evidence_file_id: 'f1',
        storage_object_key: 'k1',
        content_sha256: 'f'.repeat(64),
        mime_type: 'text/plain',
        scan_status: 'pending',
        needs_extraction: false,
      },
      {
        evidence_file_id: 'f2',
        storage_object_key: 'k2',
        content_sha256: sha256Hex(eicar),
        mime_type: 'text/plain',
        scan_status: 'pending',
        needs_extraction: false,
      },
    ],
    new Map([
      ['k1', bytes],
      ['k2', eicar],
    ]),
  );
  const result = await processPendingEvidence({ client });
  assert.deepEqual(result.scanned, { clean: 0, infected: 1, rejected: 1 });
  assert.equal(
    client.calls.filter(([name]) => name === 'evidence_worker_record_extraction').length,
    0,
  );
});

test('pipeline reports per-file failures with stable codes and continues', async () => {
  const client = fakeWorkerClient(
    [
      {
        evidence_file_id: 'f1',
        storage_object_key: 'missing',
        content_sha256: 'a'.repeat(64),
        mime_type: 'text/plain',
        scan_status: 'pending',
        needs_extraction: false,
      },
    ],
    new Map(),
  );
  const result = await processPendingEvidence({ client });
  assert.deepEqual(result.errors, [{ fileId: 'f1', code: 'EVIDENCE_DOWNLOAD_FAILED' }]);
});
