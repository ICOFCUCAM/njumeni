import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { analyseDocument } from '../src/modules/documents/analysis.ts';
import { compareVersions, diffWords } from '../src/modules/documents/compare.ts';
import { renderDocx, renderPdf } from '../src/modules/documents/export.ts';
import { buildDraft, draftDocument, validateDraft } from '../src/modules/documents/drafting.ts';

const P1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const P2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const TEMPLATE = [
  { key: 'question', title: 'Question presented', required: true },
  { key: 'facts', title: 'Facts', required: true, guidance: 'State the facts.' },
  { key: 'law', title: 'Applicable law', required: true },
  { key: 'analysis', title: 'Analysis', required: true },
  { key: 'conflicts', title: 'Conflicting authority', required: false },
  { key: 'limitations', title: 'Limitations', required: true },
];

test('analysis flags missing sections, placeholders, unresolved markers and unsupported law', () => {
  const result = analyseDocument(
    TEMPLATE,
    [
      { key: 'question', content: 'Must the employer notify?' },
      { key: 'facts', content: '[To be completed: state the facts]' },
      {
        key: 'law',
        content:
          'The employer must notify at once [1]. The employer shall also keep a register. See [2].',
      },
      {
        key: 'analysis',
        content: 'Notice must be given as soon as possible, etc. Dated 2026-01-02 and 3.1.2026.',
      },
    ],
    [
      { sectionKey: 'law', marker: 1 },
      { sectionKey: 'analysis', marker: 3 },
    ],
  );
  const codes = result.findings.map((f) => `${f.sectionKey}:${f.code}`);
  assert.ok(codes.includes('limitations:MISSING_REQUIRED_SECTION'));
  assert.ok(codes.includes('facts:PLACEHOLDER_LEFT'));
  assert.ok(codes.includes('law:MARKER_WITHOUT_CITATION'));
  assert.ok(codes.includes('law:UNSUPPORTED_ASSERTION'), 'the uncited “shall” sentence is flagged');
  assert.equal(
    result.findings.filter((f) => f.code === 'UNSUPPORTED_ASSERTION' && f.sectionKey === 'law')
      .length,
    1,
    'the cited sentence is not',
  );
  assert.ok(codes.includes('analysis:CITATION_NOT_REFERENCED'));
  assert.ok(codes.includes('analysis:AMBIGUOUS_LANGUAGE'));
  assert.ok(codes.includes('null:INCONSISTENT_DATE_FORMAT'));
  assert.equal(result.readyForReview, false);
});

test('a complete, cited document is ready for review', () => {
  const sections = TEMPLATE.map((s) => ({
    key: s.key,
    content: s.key === 'law' ? 'The employer must notify [1].' : 'Text.',
  }));
  const result = analyseDocument(TEMPLATE, sections, [{ sectionKey: 'law', marker: 1 }]);
  assert.equal(result.readyForReview, true);
  assert.equal(result.counts.error, 0);
});

test('word diff and section comparison', () => {
  assert.deepEqual(diffWords('notify within three days', 'notify at once'), [
    { op: 'equal', text: 'notify ' },
    { op: 'delete', text: 'within three days' },
    { op: 'insert', text: 'at once' },
  ]);
  const comparison = compareVersions(
    [
      { key: 'a', title: 'A', content: 'same' },
      { key: 'b', title: 'B', content: '' },
      { key: 'c', title: 'C', content: 'gone' },
    ],
    [
      { key: 'a', title: 'A', content: 'same' },
      { key: 'b', title: 'B', content: 'new' },
      { key: 'c', title: 'C', content: '' },
    ],
  );
  assert.deepEqual(
    comparison.map((c) => c.change),
    ['unchanged', 'added', 'removed'],
  );
});

const MODEL = {
  title: 'Notat om varsling (æøå)',
  templateName: 'Legal memorandum',
  versionNumber: 4,
  contentHash: 'b'.repeat(64),
  final: false,
  generatedAt: '2026-11-12T10:00:00Z',
  sections: [
    { title: 'Question', content: 'Når må arbeidsgiver varsle? <script>&' },
    { title: 'Law', content: 'Arbeidsgiver skal straks varsle (§ 5-2) [1].\n\nSecond paragraph.' },
  ],
  citations: [
    {
      marker: 1,
      citation: 'LOV-1',
      quotedText: 'Arbeidsgiver skal straks varsle.',
      sourceUri: 'https://example.invalid/lov',
      validFrom: '2015-01-01',
    },
  ],
};

test('DOCX export is a valid package with escaped content, sources and draft marking', () => {
  const files = unzipSync(renderDocx(MODEL));
  assert.ok(files['[Content_Types].xml'] && files['word/document.xml'] && files['word/styles.xml']);
  const xml = strFromU8(files['word/document.xml']);
  assert.match(xml, /DRAFT — not approved · version 4/);
  assert.match(xml, /&lt;script&gt;&amp;/);
  assert.match(xml, /\[1\] LOV-1 \(version in force from 2015-01-01\)/);
  assert.match(strFromU8(files['docProps/core.xml']), /sha256:b{64}/);
  assert.deepEqual(renderDocx(MODEL), renderDocx(MODEL), 'identical content gives identical bytes');
  assert.match(
    strFromU8(unzipSync(renderDocx({ ...MODEL, final: true }))['word/document.xml']),
    /Approved version 4/,
  );
});

test('PDF export has a valid structure and encodes Norwegian letters', () => {
  const bytes = renderPdf(MODEL);
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.ok(text.slice(startxref).startsWith('xref'), 'startxref points at the xref table');
  for (const match of text.matchAll(/(\d{10}) 00000 n /g)) {
    assert.match(
      text.slice(Number(match[1])),
      /^\d+ 0 obj/,
      'each xref offset points at an object',
    );
  }
  assert.match(text, /\\346\\370\\345/, 'æøå are encoded in WinAnsi');
  assert.match(text, /\\247 5-2/, '§ is encoded');
  assert.match(text, /DRAFT/);
  const stream = text.slice(text.indexOf('stream\n') + 7, text.indexOf('\nendstream'));
  assert.doesNotMatch(stream, /[^\x20-\x7e\n]/, 'content streams are ASCII with real line breaks');
  assert.match(stream, /ET\nBT/, 'text objects are separated by line breaks');
  const long = renderPdf({
    ...MODEL,
    sections: [
      {
        title: 'Long',
        content: Array.from({ length: 400 }, (_, i) => `Paragraph ${i}.`).join('\n'),
      },
    ],
  });
  assert.ok(
    Number(
      Buffer.from(long)
        .toString('latin1')
        .match(/\/Count (\d+)/)[1],
    ) > 1,
    'long documents paginate',
  );
});

const INPUT = {
  template: TEMPLATE,
  question: 'Must the employer notify?',
  jurisdictionCode: 'NO',
  asOfDate: '2026-01-01',
  coverageLevel: 'pilot',
  limitations: ['Coverage is pilot.'],
  claims: [
    {
      ordinal: 0,
      category: 'verified_authority',
      statement: 's',
      quotedText: 'Arbeidsgiver skal straks varsle.',
      passageId: P1,
      authorityCitation: 'LOV-1',
      verificationStatus: 'verified',
    },
    {
      ordinal: 1,
      category: 'conflicting_authority',
      statement: 'Overruled view',
      quotedText: null,
      passageId: P2,
      authorityCitation: 'HR-2',
      verificationStatus: 'verified',
    },
    {
      ordinal: 2,
      category: 'verified_authority',
      statement: 'x',
      quotedText: 'Forged.',
      passageId: 'dddddddd-0000-4000-8000-000000000009',
      authorityCitation: 'X',
      verificationStatus: 'failed',
    },
  ],
  argumentNodes: [
    {
      nodeType: 'fact',
      label: 'Notice was given three days later.',
      reviewStatus: 'accepted',
      isAssumption: false,
    },
    { nodeType: 'fact', label: 'Rejected fact.', reviewStatus: 'rejected', isAssumption: false },
    {
      nodeType: 'counterargument',
      label: 'The incident was not serious.',
      reviewStatus: 'accepted',
      isAssumption: false,
    },
  ],
};

test('the drafting agent cites verified passages only and leaves placeholders it cannot fill', () => {
  const draft = buildDraft(INPUT);
  assert.deepEqual(
    draft.citations.map((c) => c.authority_passage_id),
    [P1, P2],
  );
  const by = Object.fromEntries(draft.sections.map((s) => [s.key, s.content]));
  assert.match(by.law, /LOV-1: “Arbeidsgiver skal straks varsle\.” \[1\]/);
  assert.match(by.conflicts, /HR-2: Overruled view \[2\]/);
  assert.match(by.facts, /three days later/);
  assert.doesNotMatch(by.facts, /Rejected/);
  assert.match(by.analysis, /Against: The incident was not serious/);
  assert.match(by.limitations, /pilot/);
  const analysis = analyseDocument(
    TEMPLATE,
    draft.sections,
    draft.citations.map((c) => ({ sectionKey: c.section_key, marker: c.marker })),
  );
  assert.equal(analysis.findings.filter((f) => f.code === 'MARKER_WITHOUT_CITATION').length, 0);
  assert.doesNotThrow(() => validateDraft(draft, INPUT));
});

test('draft validation rejects ungrounded citations, altered quotes and foreign sections', () => {
  const ok = {
    sections: [{ key: 'law', content: 'x [1]' }],
    citations: [
      {
        section_key: 'law',
        marker: 1,
        authority_passage_id: P1,
        quoted_text: 'Arbeidsgiver skal straks varsle.',
      },
    ],
  };
  assert.doesNotThrow(() => validateDraft(ok, INPUT));
  assert.throws(
    () =>
      validateDraft(
        {
          ...ok,
          citations: [
            { ...ok.citations[0], authority_passage_id: 'dddddddd-0000-4000-8000-000000000009' },
          ],
        },
        INPUT,
      ),
    /AI_OUTPUT_UNGROUNDED/,
  );
  assert.throws(
    () =>
      validateDraft(
        { ...ok, citations: [{ ...ok.citations[0], quoted_text: 'Arbeidsgiver kan varsle.' }] },
        INPUT,
      ),
    /AI_OUTPUT_UNGROUNDED/,
  );
  assert.throws(
    () => validateDraft({ ...ok, sections: [{ key: 'verdict', content: 'x' }] }, INPUT),
    /AI_OUTPUT_INVALID/,
  );
});

test('draftDocument authorises, records and saves an agent version against the current version', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      switch (name) {
        case 'document_get':
          return {
            data: {
              organizationId: 'o',
              workspaceId: 'w',
              currentVersion: 1,
              researchRunId: 'r',
              issueId: 'i',
              template: { sections: TEMPLATE },
            },
            error: null,
          };
        case 'research_get_run':
          return { data: { ...INPUT, claims: INPUT.claims }, error: null };
        case 'argument_get_graph':
          return { data: { nodes: INPUT.argumentNodes }, error: null };
        case 'ai_authorise_execution':
          return { data: { allowed: true, reason: null }, error: null };
        case 'ai_record_execution':
          return { data: 'exec-1', error: null };
        case 'document_save_version':
          return { data: 2, error: null };
        default:
          return { data: null, error: { message: 'unexpected' } };
      }
    },
  };
  const result = await draftDocument(client, 'doc-1');
  assert.equal(result.version, 2);
  const save = calls.find((c) => c.name === 'document_save_version').args;
  assert.equal(save.p_expected_version, 1);
  assert.equal(save.p_ai_execution_id, 'exec-1');
  assert.equal(calls.find((c) => c.name === 'ai_authorise_execution').args.p_agent_key, 'drafting');
});
