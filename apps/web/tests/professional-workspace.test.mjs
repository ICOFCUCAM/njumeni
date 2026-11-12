import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeHit,
  parseNames,
  parseTemplateSections,
} from '../src/modules/professional/templates.ts';

test('template sections are parsed with required flags, guidance and unique keys', () => {
  const sections = parseTemplateSections(
    'Scope of work *| What we will do\nFees *\n\nFees\n2. Særlige vilkår',
  );
  assert.deepEqual(
    sections.map((s) => s.key),
    ['scope_of_work', 'fees', 'fees_2', 's_2_saerlige_vilkar'],
  );
  assert.deepEqual(
    sections.map((s) => s.required),
    [true, true, false, false],
  );
  assert.equal(sections[0].guidance, 'What we will do');
  assert.equal(sections[0].title, 'Scope of work');
  assert.throws(() => parseTemplateSections('\n \n'), /TEMPLATE_INVALID/);
});

test('conflict names and hits are presented clearly', () => {
  assert.deepEqual(parseNames('Acme AS, Kari Nordmann\nAcme AS;x'), ['Acme AS', 'Kari Nordmann']);
  assert.equal(
    describeHit({
      name: 'Acme AS',
      source: 'matter_party',
      role: 'opposing_party',
      matterNumber: 'M-2026-0001',
      matterStatus: 'on_hold',
      matched: 'acme',
    }),
    'Acme AS is opposing party in M-2026-0001 (on hold)',
  );
  assert.equal(
    describeHit({
      name: 'Kari',
      source: 'client',
      role: 'client',
      matterNumber: null,
      matterStatus: null,
      matched: 'kari',
    }),
    'Kari is a client of the firm',
  );
});
