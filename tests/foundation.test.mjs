import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('formatter configuration is valid and pinned to agreed conventions', async () => {
  const config = JSON.parse(await readFile('.prettierrc.json', 'utf8'));
  assert.equal(config.printWidth, 100);
  assert.equal(config.tabWidth, 2);
  assert.equal(config.singleQuote, true);
  assert.equal(config.endOfLine, 'lf');
});

test('environment example contains placeholders and mock AI by default', async () => {
  const env = await readFile('.env.example', 'utf8');
  assert.match(env, /APP_ENV=local/);
  assert.match(env, /AI_PROVIDER_DEFAULT=mock/);
  assert.match(env, /replace-with-local-service-role-key/);
  assert.doesNotMatch(env, /sk-[A-Za-z0-9]{20,}/);
});

test('repository ignores populated environment files but allows the template', async () => {
  const ignore = await readFile('.gitignore', 'utf8');
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});

test('the phase register records verified Phase 0 closeout and opens Phase 1 only', async () => {
  const register = await readFile('docs/PHASE_REGISTER.md', 'utf8');
  assert.match(register, /Phase 0 — Foundation and repository\/infrastructure audit/);
  assert.match(register, /\| 0 \| Foundation and repository\/infrastructure audit \| 🟢 CLOSED \|/);
  assert.match(register, /\| 1 \| Identity, tenancy and security foundation \| 🟡 OPEN \|/);
  assert.match(register, /\| 2 \| Legal knowledge foundation \| 🔒 LOCKED \|/);
  assert.match(register, /\| 13 \| Production hardening and launch \| 🔒 LOCKED \|/);
  assert.match(register, /6cbcf032b3116ddb69f5ef9ccd29330d4a9212d1/);
  assert.match(register, /Phase 0 closeout verified/);
});

test('A–M module names and canonical eight layers remain present', async () => {
  const map = await readFile('docs/architecture/MODULE_LAYER_MAP.md', 'utf8');
  const trace = await readFile('docs/architecture/MODULE_REQUIREMENTS_TRACEABILITY.md', 'utf8');
  for (const name of [
    'Njumeni Legal Intelligence',
    'Legal Research Engine',
    'Evidence Intelligence Engine',
    'Legal Case Management',
    'Legal Document Intelligence',
    'Legal Argument and Reasoning Engine',
    'Jurisdiction and Legal Systems Engine',
    'Personal Legal Assistant',
    'Professional Legal Workspace',
    'Enterprise and Law Firm Workspace',
    'Institutional Workspace',
    'Legal Compliance and Risk Intelligence',
    'Legal Knowledge Management',
  ]) {
    assert.ok(map.includes(`**${name}**`));
  }
  for (const layer of [
    'Experience',
    'API',
    'Workflow orchestration',
    'Evidence',
    'Legal knowledge',
    'Reasoning',
    'Verification',
    'Infrastructure',
  ]) {
    assert.ok(trace.includes(layer));
  }
});
