import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGlciRegistry, summariseRegistry, LEGAL_DATE_KINDS } from '../src/modules/glci/registry.ts';

const profile = {
  monitoringLanguages: ['nb', 'nn'], authorityHierarchy: [{ authorityType: 'constitution', rank: 1 }],
  publicationSchedule: { cadence: 'daily' }, effectiveDateRules: { publicationIsNotCommencement: true, dateKinds: [...LEGAL_DATE_KINDS] },
  reviewProcedure: { reviewerRole: 'knowledge_admin' }, checkIntervalMinutes: 1440, staleAfterHours: 48, notes: null,
};
const target = (key, extra = {}) => ({ targetKey: key, name: key, targetType: 'legal_database', officialUri: 'https://api.lovdata.no/v1/publicData/list',
  sourceKey: 'lovdata-official', sourceRights: 'review_required', monitorAdapter: 'lovdata-public-data-listing', status: 'planned', activationBasis: null, notes: null, ...extra });

test('the registry response is parsed and summarised', () => {
  const registry = parseGlciRegistry([
    { code: 'NO', name: 'Norway', status: 'planned', officialLanguages: ['no'], profile, targets: [
      target('no-lovdata-current-laws', { status: 'active', activationBasis: 'licence_policy_v2' }),
      target('no-lovdata-central-regulations', { activationBasis: 'licence_policy_v2' }),
      target('no-stortinget', { targetType: 'parliament', monitorAdapter: null }),
    ] },
    { code: 'KE', name: 'Kenya', status: 'catalogued', officialLanguages: ['en'], profile: null, targets: [] },
  ]);
  assert.deepEqual(summariseRegistry(registry), { jurisdictions: 2, profiled: 1, targets: 3, activeTargets: 1, activatableTargets: 1, awaitingRightsReview: 1 });
  assert.deepEqual([...LEGAL_DATE_KINDS], ['publication', 'enactment', 'effective', 'repeal', 'transitional']);
});

test('a profile that does not separate publication from commencement is rejected', () => {
  assert.throws(() => parseGlciRegistry([{ code: 'NO', name: 'Norway', status: 'planned', targets: [],
    profile: { ...profile, effectiveDateRules: { publicationIsNotCommencement: false } } }]), /GLCI_REGISTRY_RESPONSE_INVALID/);
  assert.throws(() => parseGlciRegistry([{ code: 'NO', name: 'Norway', status: 'planned', profile: null, targets: [target('x', { targetType: 'blog' })] }]),
    /GLCI_REGISTRY_RESPONSE_INVALID/);
  assert.throws(() => parseGlciRegistry({}), /GLCI_REGISTRY_RESPONSE_INVALID/);
});
