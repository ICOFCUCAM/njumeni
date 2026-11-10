import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const sourcePath = 'docs/ORIGINAL_MASTER_PLAN_SOURCE.md';
const masterPath = 'docs/MASTER_IMPLEMENTATION_PLAN.md';
const expectedSourceHash =
  '4dce95748a34c529caa74fce5f2dfd3486fc9d2fa5c88ac54cc3f14f71992fe0';

test('the uploaded original twenty-section plan is preserved without content loss', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const master = await readFile(masterPath, 'utf8');

  assert.equal(
    createHash('sha256').update(source, 'utf8').digest('hex'),
    expectedSourceHash,
  );
  assert.ok(
    master.startsWith(source),
    'The canonical master plan must begin with the exact original source',
  );
  assert.match(master, /Live implementation overlay/);
  assert.equal(source.split('\n').length, 3437);
});

test('all twenty original top-level section headings remain present', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const headings = [
    '1. Brand and corporate identity',
    '2. Product architecture — complete system',
    '3. Complete product modules',
    '4. Complete AI architecture',
    '5. Technical architecture and technology stack',
    '6. Legal knowledge infrastructure',
    '7. Security, privacy and governance architecture',
    '8. Open-source research and software reuse architecture',
    '9. API architecture and integration framework',
    '10. Infrastructure, hosting and deployment',
    '11. Complete user journeys and operational workflows',
    '12. Administration and platform operations',
    '13. Commercial architecture and monetisation',
    '14. Testing, evaluation and quality assurance',
    '15. Repository and development structure',
    '16. Complete implementation roadmap',
    '17. Definition of completion',
    '18. Initial strategic priorities',
    '19. Permanent architectural decisions',
    '20. Immediate execution: establish the Njumeni foundation',
  ];

  for (const heading of headings) {
    assert.ok(source.includes(heading), 'Missing original section: ' + heading);
  }
});

test(
  'the original eight layer names and five named upstream repositories remain intact',
  async () => {
    const source = await readFile(sourcePath, 'utf8');
    const layers = [
      'Experience',
      'API',
      'Workflow orchestration',
      'Evidence',
      'Legal knowledge',
      'Reasoning',
      'Verification',
      'Infrastructure',
    ];
    const repositories = ['OpenContracts', 'CaseCite', 'Lawgent', 'Lovspor', 'Mike'];

    for (const layer of layers) {
      assert.ok(source.includes(layer), 'Missing original platform layer: ' + layer);
    }
    for (const repository of repositories) {
      assert.ok(source.includes(repository), 'Missing original upstream project: ' + repository);
    }
  },
);
