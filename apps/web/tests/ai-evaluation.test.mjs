// AI evaluation (Phase 13; master plan §18.2). Runs the reasoning and drafting agents over a
// synthetic case set and measures the metrics that gate releases, against the committed
// thresholds in quality/evaluation-thresholds.json. Model-backed runs reuse the same harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildArgumentProposal,
  validateArgumentProposal,
} from '../src/modules/reasoning/argument.ts';
import { buildDraft, validateDraft } from '../src/modules/documents/drafting.ts';
import { analyseDocument } from '../src/modules/documents/analysis.ts';

const thresholds = Object.fromEntries(
  JSON.parse(
    readFileSync(new URL('../../../quality/evaluation-thresholds.json', import.meta.url), 'utf8'),
  ).thresholds.map((t) => [t.metric, t.minimum]),
);
const TEMPLATE = [
  { key: 'question', title: 'Question', required: true },
  { key: 'facts', title: 'Facts', required: true },
  { key: 'law', title: 'Applicable law', required: true },
  { key: 'analysis', title: 'Analysis', required: true },
  { key: 'conflicts', title: 'Conflicting authority', required: false },
  { key: 'limitations', title: 'Limitations', required: true },
];
const uuid = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Twelve synthetic cases: varying numbers of verified, failed and conflicting authorities,
// facts with and without evidence, and cases with no law at all.
const CASES = Array.from({ length: 12 }, (_, i) => {
  const verified = i % 4;
  const claims = [
    ...Array.from({ length: verified }, (_, k) => ({
      ordinal: k,
      category: k === 2 ? 'conflicting_authority' : 'verified_authority',
      statement: `Rule ${k}`,
      quotedText: k === 1 ? null : `Synthetic provision ${i}.${k} applies.`,
      passageId: uuid(i * 10 + k + 1),
      authorityCitation: `SYN-${i}-${k}`,
      verificationStatus: 'verified',
    })),
    {
      ordinal: 9,
      category: 'verified_authority',
      statement: 'Forged',
      quotedText: 'Invented text.',
      passageId: uuid(900 + i),
      authorityCitation: 'FAKE',
      verificationStatus: 'failed',
    },
  ];
  const propositions = Array.from({ length: i % 3 }, (_, k) => ({
    id: uuid(500 + i * 10 + k),
    statement: `Synthetic provision ${i}.${k} fact applies to the employer`,
    status: 'alleged',
    links:
      k === 0
        ? [
            {
              evidenceItemId: uuid(700 + i),
              evidenceTitle: `Exhibit ${i}`,
              passageId: null,
              relation: 'supports',
            },
          ]
        : [],
  }));
  return {
    question: `Synthetic question ${i}: does provision ${i} apply to the employer?`,
    claims,
    propositions,
  };
});

test('reasoning and drafting meet the release thresholds on the synthetic evaluation set', () => {
  let lawNodes = 0,
    groundedLawNodes = 0,
    citations = 0,
    accurateCitations = 0,
    limitationCases = 0,
    disclosed = 0,
    invented = 0;
  for (const c of CASES) {
    const verifiedPassages = new Set(
      c.claims.filter((x) => x.verificationStatus === 'verified').map((x) => x.passageId),
    );
    const proposal = validateArgumentProposal(buildArgumentProposal(c), c);
    for (const node of proposal.nodes.filter(
      (n) =>
        ['applicable_rule', 'judicial_interpretation', 'counterargument'].includes(n.node_type) &&
        n.authority_passage_id,
    )) {
      lawNodes += 1;
      if (verifiedPassages.has(node.authority_passage_id)) groundedLawNodes += 1;
    }
    const input = {
      template: TEMPLATE,
      question: c.question,
      jurisdictionCode: 'NO',
      asOfDate: '2026-01-01',
      coverageLevel: 'pilot',
      limitations: ['Coverage is pilot.'],
      claims: c.claims,
      argumentNodes: [],
    };
    const draft = validateDraft(buildDraft(input), input);
    for (const citation of draft.citations) {
      citations += 1;
      const claim = c.claims.find((x) => x.passageId === citation.authority_passage_id);
      if (
        claim?.verificationStatus === 'verified' &&
        (citation.quoted_text === undefined || citation.quoted_text === claim.quotedText)
      )
        accurateCitations += 1;
      if (!claim || claim.verificationStatus !== 'verified') invented += 1;
    }
    limitationCases += 1;
    if ((draft.sections.find((s) => s.key === 'limitations')?.content ?? '').includes('pilot'))
      disclosed += 1;
    // A case without verified law must not be presented as answered: the law section is a placeholder.
    if (
      !c.claims.some(
        (x) => x.verificationStatus === 'verified' && x.category !== 'conflicting_authority',
      )
    ) {
      const analysis = analyseDocument(
        TEMPLATE,
        draft.sections,
        draft.citations.map((x) => ({ sectionKey: x.section_key, marker: x.marker })),
      );
      assert.ok(
        analysis.findings.some((f) => f.code === 'PLACEHOLDER_LEFT' && f.sectionKey === 'law'),
        `case "${c.question}" blocks submission`,
      );
    }
  }
  const sourceGrounding = groundedLawNodes / lawNodes;
  const citationAccuracy = accurateCitations / citations;
  const limitationDisclosure = disclosed / limitationCases;
  console.log(
    JSON.stringify({
      lawNodes,
      sourceGrounding,
      citations,
      citationAccuracy,
      limitationDisclosure,
      invented,
    }),
  );
  assert.ok(
    lawNodes > 10 && citations > 10,
    'the evaluation set exercises enough law to be meaningful',
  );
  assert.equal(invented, 0, 'no fabricated citation in any draft');
  assert.ok(sourceGrounding >= thresholds.sourceGrounding, `source grounding ${sourceGrounding}`);
  assert.ok(
    citationAccuracy >= thresholds.citationAccuracy,
    `citation accuracy ${citationAccuracy}`,
  );
  assert.ok(
    limitationDisclosure >= thresholds.limitationDisclosure,
    `limitation disclosure ${limitationDisclosure}`,
  );
});
