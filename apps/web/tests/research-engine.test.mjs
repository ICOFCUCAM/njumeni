import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestSentence,
  composeResearchAnswer,
  sentencesOf,
} from '../src/modules/research/composer.ts';
import { runLegalResearch } from '../src/modules/research/service.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const WS = '22222222-2222-4222-8222-222222222222';

function passage(overrides = {}) {
  return {
    passageId: 'p1',
    authorityId: 'a1',
    authorityVersionId: 'v1',
    authorityTitle: 'Arbeidsmiljøloven',
    citation: 'LOV-2005-06-17-62',
    jurisdictionCode: 'NO',
    authorityType: 'act',
    languageCode: 'nb',
    legalStatus: 'in_force',
    validFrom: '2020-01-01',
    validUntil: null,
    sourceUri: null,
    sourceKey: 'src',
    sourceContentHash: 'a'.repeat(64),
    passageContent:
      'Loven gjelder alle virksomheter. Ved alvorlig ulykke skal arbeidsgiver straks varsle Arbeidstilsynet.',
    pageNumber: null,
    sectionPath: ['§ 5-2'],
    lexicalScore: 0.75,
    semanticScore: null,
    score: 0.75,
    rank: 1,
    citationLabel: 'LOV-2005-06-17-62, § 5-2',
    ...overrides,
  };
}
const QUOTE = {
  source_key: 'src',
  display_permitted: true,
  quote_permitted: true,
  attribution_text: 'Source: Lovdata (test)',
};
const base = {
  question: 'Når må arbeidsgiver varsle om en alvorlig ulykke?',
  asOfDate: '2024-06-01',
  jurisdictionCode: 'NO',
  coverageLevel: 'pilot',
  context: [],
};

test('sentences are exact substrings and the best one matches the question', () => {
  const content = passage().passageContent;
  for (const sentence of sentencesOf(content)) assert.ok(content.includes(sentence));
  assert.equal(
    bestSentence(base.question, content),
    'Ved alvorlig ulykke skal arbeidsgiver straks varsle Arbeidstilsynet.',
  );
  assert.deepEqual(sentencesOf('Jf. § 3. Arbeidsgiver skal varsle. «Straks» betyr uten opphold.'), [
    'Jf. § 3.',
    'Arbeidsgiver skal varsle.',
    '«Straks» betyr uten opphold.',
  ]);
});

test('a quotable source yields a verified-authority claim with citation and verbatim quote', () => {
  const result = composeResearchAnswer({ ...base, passages: [passage()], permissions: [QUOTE] });
  assert.equal(result.claims.length, 1);
  const [claim] = result.claims;
  assert.equal(claim.category, 'verified_authority');
  assert.equal(claim.passage_id, 'p1');
  assert.equal(claim.citation_text, 'LOV-2005-06-17-62');
  assert.equal(
    claim.quoted_text,
    'Ved alvorlig ulykke skal arbeidsgiver straks varsle Arbeidstilsynet.',
  );
  assert.ok(passage().passageContent.includes(claim.quoted_text));
  assert.match(claim.statement, /^LOV-2005-06-17-62 § 5-2 \(version in force from 2020-01-01\): “/);
  assert.ok(result.limitations.some((l) => l.includes('Source: Lovdata (test)')));
  assert.ok(result.limitations.some((l) => l.includes('"pilot"')));
});

test('a display-only source is cited without any quotation', () => {
  const result = composeResearchAnswer({
    ...base,
    passages: [passage()],
    permissions: [{ ...QUOTE, quote_permitted: false }],
  });
  assert.equal(result.claims[0].quoted_text, undefined);
  assert.match(result.claims[0].statement, /permits citation but not quotation/);
});

test('sources without display permission are never used', () => {
  const result = composeResearchAnswer({
    ...base,
    passages: [passage()],
    permissions: [{ ...QUOTE, display_permitted: false }],
  });
  assert.deepEqual(
    result.claims.map((c) => c.category),
    ['unresolved_question'],
  );
});

test('one claim per authority, at most five, in rank order', () => {
  const passages = [
    passage({ passageId: 'p1', authorityId: 'a1' }),
    passage({ passageId: 'p2', authorityId: 'a1' }),
    ...[2, 3, 4, 5, 6, 7].map((n) =>
      passage({ passageId: `p${n + 1}`, authorityId: `a${n}`, citation: `C${n}` }),
    ),
  ];
  const result = composeResearchAnswer({ ...base, passages, permissions: [QUOTE] });
  assert.deepEqual(
    result.claims.map((c) => c.passage_id),
    ['p1', 'p3', 'p4', 'p5', 'p6'],
  );
  assert.equal(result.findings.length, 8, 'every retrieved passage is kept as a finding');
});

test('nothing retrieved means an explicit abstention, never an invented answer', () => {
  const result = composeResearchAnswer({ ...base, passages: [], permissions: [] });
  assert.equal(result.claims.length, 1);
  assert.equal(result.claims[0].category, 'unresolved_question');
  assert.match(result.claims[0].statement, /does not answer without a verifiable source/);
});

test('later amendments become limitations; overrulings are conflicting authority; interpretations are interpretation', () => {
  const context = [
    {
      from_authority_id: 'a1',
      to_authority_id: 'x',
      relationship_type: 'amended_by',
      effective_from: '2027-01-01',
      to_citation: 'LOV-2026-9',
      to_title: 'Endringslov',
      after_as_of: true,
    },
    {
      from_authority_id: 'a1',
      to_authority_id: 'hr',
      relationship_type: 'overruled_by',
      effective_from: '2023-01-01',
      to_citation: 'HR-2023-1',
      to_title: 'Dom',
      after_as_of: false,
    },
    {
      from_authority_id: 'a1',
      to_authority_id: 'hr2',
      relationship_type: 'interprets',
      effective_from: '2021-01-01',
      to_citation: 'HR-2021-1',
      to_title: 'Dom',
      after_as_of: false,
    },
  ];
  const passages = [
    passage(),
    passage({
      passageId: 'hr2-p',
      authorityId: 'hr2',
      citation: 'HR-2021-1',
      authorityType: 'judgment',
    }),
  ];
  const result = composeResearchAnswer({ ...base, passages, context, permissions: [QUOTE] });
  assert.ok(
    result.limitations.some(
      (l) =>
        l ===
        'LOV-2005-06-17-62 was amended by LOV-2026-9 with effect from 2027-01-01, after 2024-06-01. This answer applies the law as it stood on 2024-06-01.',
    ),
  );
  const conflict = result.claims.find((c) => c.category === 'conflicting_authority');
  assert.match(conflict.statement, /overruled by HR-2023-1/);
  const interpretation = result.claims.find((c) => c.category === 'interpretation');
  assert.equal(
    interpretation.passage_id,
    'hr2-p',
    'points to the interpreting decision when it was retrieved',
  );
});

test('service runs plan → scoped search → context → record, passing the workspace scope everywhere', async () => {
  const calls = [];
  const row = {
    passage_id: 'p1',
    authority_id: 'a1',
    authority_version_id: 'v1',
    authority_title: 'Arbeidsmiljøloven',
    citation: 'LOV-1',
    jurisdiction_code: 'NO',
    authority_type: 'act',
    language_code: 'nb',
    legal_status: 'in_force',
    valid_from: '2020-01-01',
    valid_until: null,
    source_uri: null,
    source_content_hash: 'a'.repeat(64),
    passage_content: 'Arbeidsgiver skal straks varsle om ulykker.',
    page_number: null,
    section_path: [],
    source_key: 'src',
    lexical_score: 0.8,
  };
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      switch (name) {
        case 'research_list_jurisdictions':
          return { data: [{ code: 'NO', coverage_level: 'pilot' }], error: null };
        case 'research_search_lexical':
          return { data: [row], error: null };
        case 'research_authority_context':
          return { data: [], error: null };
        case 'research_source_permissions':
          return { data: [QUOTE], error: null };
        case 'research_record_run':
          return { data: 'run-1', error: null };
        default:
          throw new Error(name);
      }
    },
  };
  const result = await runLegalResearch(client, {
    organizationId: ORG,
    workspaceId: WS,
    question: 'Når skal arbeidsgiver varsle?',
    jurisdictionCode: 'NO',
    asOfDate: '2024-06-01',
    languageCodes: ['nb'],
  });
  assert.deepEqual(result, { runId: 'run-1' });
  for (const [name, args] of calls.filter(([n]) => n !== 'research_list_jurisdictions')) {
    assert.equal(args.p_organization_id, ORG, name);
    assert.equal(args.p_workspace_id, WS, name);
  }
  const recorded = calls.find(([n]) => n === 'research_record_run')[1];
  assert.equal(
    recorded.p_retrieval_mode,
    'lexical',
    'without an embedder the engine stays lexical',
  );
  assert.equal(recorded.p_claims[0].quoted_text, 'Arbeidsgiver skal straks varsle om ulykker.');
});

test('service rejects invalid scope, questions and semantic mode without an embedder', async () => {
  const client = { rpc: async () => ({ data: [], error: null }) };
  const request = {
    organizationId: ORG,
    workspaceId: WS,
    question: 'Spørsmål om ferie',
    jurisdictionCode: 'NO',
    asOfDate: '2024-06-01',
    languageCodes: ['nb'],
  };
  await assert.rejects(
    runLegalResearch(client, { ...request, organizationId: 'x' }),
    /RESEARCH_SCOPE_INVALID/,
  );
  await assert.rejects(
    runLegalResearch(client, { ...request, question: 'x' }),
    /RESEARCH_QUESTION_INVALID/,
  );
  await assert.rejects(
    runLegalResearch(client, { ...request, mode: 'semantic' }),
    /RESEARCH_SEMANTIC_NOT_CONFIGURED/,
  );
  await assert.rejects(runLegalResearch(client, request), /RESEARCH_JURISDICTION_UNKNOWN/);
});
