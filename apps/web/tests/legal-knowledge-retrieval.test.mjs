import assert from 'node:assert/strict';
import test from 'node:test';
import {createRetrievalPlan,rankLegalPassages,assessLegalAnswerEvidence} from '../src/modules/legal-knowledge/retrieval.ts';

const base={query:'employment termination notice',jurisdictionCode:'NO',asOfDate:'2026-01-01',languageCodes:['no','en'],mode:'hybrid',limit:10};
const candidate=(overrides={})=>({
  passageId:'p-1',authorityId:'a-1',authorityVersionId:'v-1',authorityTitle:'Working Environment Act',
  citation:'Arbeidsmiljøloven § 15-7',jurisdictionCode:'NO',authorityType:'act',languageCode:'no',
  legalStatus:'in_force',validFrom:'2024-01-01',validUntil:null,sourceUri:'https://lovdata.no/act',sourceKey:'lovdata',
  sourceContentHash:'a'.repeat(64),passageContent:'An employee may not be dismissed without objective justification.',
  pageNumber:null,sectionPath:['Chapter 15','Section 15-7'],lexicalScore:0.8,semanticScore:0.9,...overrides,
});

test('creates a bounded jurisdiction, date, language and mode retrieval plan',()=>{
  const plan=createRetrievalPlan({...base,languageCodes:['no','en','no']});
  assert.deepEqual(plan.languageCodes,['en','no']);assert.equal(plan.asOfDate,'2026-01-01');
  assert.equal(plan.requireEffectiveAtDate,true);assert.equal(plan.limit,10);
});
test('rejects invalid retrieval query, jurisdiction, date, language and limits',()=>{
  assert.throws(()=>createRetrievalPlan({...base,query:'  '}),/LEGAL_RETRIEVAL_QUERY_INVALID/);
  assert.throws(()=>createRetrievalPlan({...base,jurisdictionCode:'bad-code'}),/LEGAL_RETRIEVAL_JURISDICTION_INVALID/);
  assert.throws(()=>createRetrievalPlan({...base,asOfDate:'2026-02-31'}),/LEGAL_RETRIEVAL_DATE_INVALID/);
  assert.throws(()=>createRetrievalPlan({...base,languageCodes:[]}),/LEGAL_RETRIEVAL_LANGUAGE_INVALID/);
  assert.throws(()=>createRetrievalPlan({...base,limit:51}),/LEGAL_RETRIEVAL_LIMIT_INVALID/);
});
test('filters candidates by jurisdiction, language, legal status and effective date',()=>{
  const plan=createRetrievalPlan(base);
  const rows=[
    candidate(),
    candidate({passageId:'future',validFrom:'2027-01-01'}),
    candidate({passageId:'repealed',legalStatus:'repealed'}),
    candidate({passageId:'wrong-jurisdiction',jurisdictionCode:'GB'}),
    candidate({passageId:'wrong-language',languageCode:'fr'}),
    candidate({passageId:'expired',validUntil:'2025-12-31'}),
  ];
  assert.deepEqual(rankLegalPassages(plan,rows).map(x=>x.passageId),['p-1']);
});
test('uses deterministic weighted hybrid ranking and citation anchors',()=>{
  const plan=createRetrievalPlan(base);
  const rows=[candidate({passageId:'b',lexicalScore:0.9,semanticScore:0.7}),candidate({passageId:'a',lexicalScore:0.8,semanticScore:0.95})];
  const ranked=rankLegalPassages(plan,rows);
  assert.equal(ranked[0].passageId,'a');assert.equal(ranked[0].rank,1);
  assert.match(ranked[0].citationLabel,/Arbeidsmiljøloven § 15-7/);
  assert.match(ranked[0].citationLabel,/Chapter 15/);
});
test('lexical and semantic modes reject candidates without their corresponding score',()=>{
  assert.equal(rankLegalPassages(createRetrievalPlan({...base,mode:'lexical'}),[candidate({lexicalScore:null})]).length,0);
  assert.equal(rankLegalPassages(createRetrievalPlan({...base,mode:'semantic'}),[candidate({semanticScore:null})]).length,0);
});
test('requires retrieved citations and complete coverage before grounded answer status',()=>{
  const plan=createRetrievalPlan(base);
  const passages=rankLegalPassages(plan,[candidate()]);
  const assessment=assessLegalAnswerEvidence({answerText:'The Act requires objective justification.',citedPassageIds:['p-1'],retrievedPassages:passages,coverageComplete:true,sourceRightsApproved:true});
  assert.equal(assessment.canPresentAsGrounded,true);assert.equal(assessment.citedSources.length,1);
});
test('flags unsupported citations, missing citations, rights and coverage gaps',()=>{
  const passages=rankLegalPassages(createRetrievalPlan(base),[candidate()]);
  const assessment=assessLegalAnswerEvidence({answerText:'Legal conclusion.',citedPassageIds:['not-retrieved'],retrievedPassages:passages,coverageComplete:false,sourceRightsApproved:false});
  assert.equal(assessment.canPresentAsGrounded,false);assert.deepEqual(assessment.unsupportedCitations,['not-retrieved']);
  assert.ok(assessment.warnings.length>=4);
});
test('never treats a passage as grounded when no retrieved source is cited',()=>{
  const passages=rankLegalPassages(createRetrievalPlan(base),[candidate()]);
  assert.equal(assessLegalAnswerEvidence({answerText:'Answer',citedPassageIds:[],retrievedPassages:passages,coverageComplete:true,sourceRightsApproved:true}).canPresentAsGrounded,false);
});

test('executes lexical, semantic and hybrid provider queries according to the requested mode',async()=>{
  const lexical=[candidate({passageId:'lex',semanticScore:null})];
  const semantic=[candidate({passageId:'sem',lexicalScore:null,semanticScore:0.95}),candidate({passageId:'lex',lexicalScore:null,semanticScore:0.8})];
  const calls=[];
  const provider={searchLexical:async()=>{calls.push('lexical');return lexical;},searchSemantic:async()=>{calls.push('semantic');return semantic;}};
  const hybrid=await (await import('../src/modules/legal-knowledge/retrieval.ts')).executeLegalRetrieval(createRetrievalPlan(base),provider);
  assert.deepEqual(calls.sort(),['lexical','semantic']);assert.equal(hybrid.length,2);
  calls.length=0;
  await (await import('../src/modules/legal-knowledge/retrieval.ts')).executeLegalRetrieval(createRetrievalPlan({...base,mode:'lexical'}),provider);
  assert.deepEqual(calls,['lexical']);
});
test('rejects retrieval provider collisions for a passage mapped to different authority versions',async()=>{
  const {executeLegalRetrieval}=await import('../src/modules/legal-knowledge/retrieval.ts');
  const provider={
    searchLexical:async()=>[candidate({passageId:'collision',authorityVersionId:'v1'})],
    searchSemantic:async()=>[candidate({passageId:'collision',authorityVersionId:'v2'})],
  };
  await assert.rejects(()=>executeLegalRetrieval(createRetrievalPlan(base),provider),/LEGAL_RETRIEVAL_PASSAGE_ID_COLLISION/);
});
