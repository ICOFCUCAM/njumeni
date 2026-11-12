import test from 'node:test';
import assert from 'node:assert/strict';
import { runLegalResearch } from '../src/modules/research/service.ts';
import {
  KEYWORD_FALLBACK_NOTE,
  researchQueryEmbedder,
} from '../src/modules/research/query-embedder.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const WS = '22222222-2222-4222-8222-222222222222';
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
  semantic_score: 0.7,
  score: 0.75,
};
const permission = {
  source_key: 'src',
  may_display: true,
  may_quote: true,
  attribution_text: 'Source',
};

function client() {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'research_list_jurisdictions')
        return { data: [{ code: 'NO', coverage_level: 'pilot' }], error: null };
      if (name.startsWith('research_search')) return { data: [row], error: null };
      if (name === 'research_authority_context') return { data: [], error: null };
      if (name === 'research_source_permissions') return { data: [permission], error: null };
      if (name === 'research_record_run') return { data: 'run-1', error: null };
      throw new Error(name);
    },
  };
}
const request = {
  organizationId: ORG,
  workspaceId: WS,
  question: 'Når skal arbeidsgiver varsle?',
  jurisdictionCode: 'NO',
  asOfDate: '2024-06-01',
  languageCodes: ['nb'],
};

test('the web server embeds questions locally by default and can be switched off', () => {
  const fake = {
    profile: {},
    embedQuery: async () => ({ modelKey: 'm', values: [1] }),
    embedPassages: async () => [],
  };
  assert.equal(
    researchQueryEmbedder({ LEGAL_QUERY_EMBEDDER: 'local' }, () => fake) instanceof Function,
    true,
  );
  assert.equal(researchQueryEmbedder({ LEGAL_QUERY_EMBEDDER: 'off' }), undefined);
  assert.throws(
    () => researchQueryEmbedder({ LEGAL_QUERY_EMBEDDER: 'remote' }),
    /LEGAL_QUERY_EMBEDDER_INVALID/,
  );
  assert.equal(typeof researchQueryEmbedder({}, () => fake), 'function');
});

test('with an embedder, research is hybrid (keyword and meaning)', async () => {
  const c = client();
  await runLegalResearch(c, request, async () => ({
    modelKey: 'multilingual-e5-small-v1',
    values: new Array(384).fill(0.01),
  }));
  const recorded = c.calls.find(([n]) => n === 'research_record_run')[1];
  assert.equal(recorded.p_retrieval_mode, 'hybrid');
  assert.ok(!recorded.p_limitations.includes(KEYWORD_FALLBACK_NOTE));
});

test('an unavailable embedder falls back to keyword search and the answer says so', async () => {
  const c = client();
  const failing = researchQueryEmbedder({}, () => ({
    profile: {},
    embedPassages: async () => [],
    embedQuery: async () => {
      throw new Error('model download failed');
    },
  }));
  const embed = async () => {
    throw new Error('LEGAL_EMBEDDING_UNAVAILABLE');
  };
  for (const embedder of [embed, failing]) {
    if (embedder === failing)
      await assert.rejects(
        failing('q'),
        /LEGAL_EMBEDDING_UNAVAILABLE/,
        'any embedder error means unavailable',
      );
    c.calls.length = 0;
    await runLegalResearch(c, request, embedder);
    const recorded = c.calls.find(([n]) => n === 'research_record_run')[1];
    assert.equal(recorded.p_retrieval_mode, 'lexical', 'recorded honestly as keyword search');
    assert.ok(
      recorded.p_limitations.includes(KEYWORD_FALLBACK_NOTE),
      'and disclosed to the reader',
    );
  }
});

test('an explicitly requested semantic search still fails rather than degrade silently', async () => {
  const c = client();
  await assert.rejects(
    runLegalResearch(c, { ...request, mode: 'semantic' }, async () => {
      throw new Error('LEGAL_EMBEDDING_UNAVAILABLE');
    }),
    /LEGAL_EMBEDDING_UNAVAILABLE/,
  );
});
