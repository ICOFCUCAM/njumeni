import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('web application dependencies are pinned and lockfile matches manifest', async () => {
  const manifest = JSON.parse(await readFile('apps/web/package.json', 'utf8'));
  const lock = JSON.parse(await readFile('apps/web/package-lock.json', 'utf8'));
  assert.equal(manifest.private, true);
  assert.equal(manifest.engines.node, '>=22.13.0 <23');
  assert.equal(lock.lockfileVersion, 3);
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    assert.equal(lock.packages[''].dependencies[name], version);
  }
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    assert.equal(lock.packages[''].devDependencies[name], version);
  }
});

test('all thirteen canonical A–M modules have registry route entries', async () => {
  const registry = await readFile('apps/web/src/modules/registry.ts', 'utf8');
  const expected = [
    ['A', 'Njumeni Legal Intelligence', 'intelligence'],
    ['B', 'Legal Research Engine', 'research'],
    ['C', 'Evidence Intelligence Engine', 'evidence'],
    ['D', 'Legal Case Management', 'matters'],
    ['E', 'Legal Document Intelligence', 'documents'],
    ['F', 'Legal Argument and Reasoning Engine', 'arguments'],
    ['G', 'Jurisdiction and Legal Systems Engine', 'jurisdictions'],
    ['H', 'Personal Legal Assistant', 'assistant'],
    ['I', 'Professional Legal Workspace', 'professional'],
    ['J', 'Enterprise and Law Firm Workspace', 'organisation'],
    ['K', 'Institutional Workspace', 'institutional'],
    ['L', 'Legal Compliance and Risk Intelligence', 'compliance'],
    ['M', 'Legal Knowledge Management', 'knowledge'],
  ];

  for (const [id, name, slug] of expected) {
    assert.ok(registry.includes("id: '" + id + "'"), 'Missing module id ' + id);
    assert.ok(registry.includes("name: '" + name + "'"), 'Missing canonical name ' + name);
    assert.ok(registry.includes("slug: '" + slug + "'"), 'Missing route slug ' + slug);
  }
});

test('health and sign-in boundaries do not pretend authentication or database are connected', async () => {
  const health = await readFile('apps/web/src/app/api/health/route.ts', 'utf8');
  const signIn = await readFile('apps/web/src/app/(auth)/sign-in/page.tsx', 'utf8');
  const workspace = await readFile('apps/web/src/app/(workspace)/layout.tsx', 'utf8');

  assert.match(health, /authenticationConnected: false/);
  assert.match(health, /databaseConnected: false/);
  assert.match(signIn, /No sign-in is being simulated/);
  assert.match(workspace, /WorkspaceShell/);
});

test('application shell documents every module route and preview limitation', async () => {
  const docs = await readFile('docs/APP_SHELL.md', 'utf8');
  const dashboard = await readFile('apps/web/src/app/(workspace)/dashboard/page.tsx', 'utf8');
  assert.match(docs, /\/intelligence/);
  assert.match(docs, /\/knowledge/);
  assert.match(docs, /server-side identity\/tenant guard/);
  assert.match(dashboard, /no live case data is connected/);
});
