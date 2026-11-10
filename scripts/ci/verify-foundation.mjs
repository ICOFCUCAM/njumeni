import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'docs/MASTER_IMPLEMENTATION_PLAN.md',
  'docs/ORIGINAL_MASTER_PLAN_SOURCE.md',
  'docs/ORIGINAL_SOURCE_RECONCILIATION.md',
  'docs/PHASE_REGISTER.md',
  'docs/ENGINEERING_STANDARDS.md',
  'docs/ENVIRONMENT_STRATEGY.md',
  'docs/DATABASE_MIGRATION_POLICY.md',
  'docs/APP_SHELL.md',
  'apps/web/package.json',
  'apps/web/package-lock.json',
  'apps/web/src/modules/registry.ts',
  'apps/web/src/components/workspace-shell.tsx',
  'apps/web/src/app/api/health/route.ts',
  'scripts/ci/check-migrations.mjs',
  'docs/architecture/ADR-0001-modular-monolith-and-bounded-contexts.md',
  'docs/architecture/MODULE_LAYER_MAP.md',
  'docs/architecture/MODULE_REQUIREMENTS_TRACEABILITY.md',
  'tests/original-plan.test.mjs',
  '.editorconfig',
  '.prettierrc.json',
  '.env.example',
];

for (const path of requiredFiles) {
  await readFile(path, 'utf8');
}

const masterPlan = await readFile('docs/MASTER_IMPLEMENTATION_PLAN.md', 'utf8');
const originalSource = await readFile('docs/ORIGINAL_MASTER_PLAN_SOURCE.md', 'utf8');
assert.ok(
  masterPlan.startsWith(originalSource),
  'Master plan does not preserve the original source as its prefix',
);
const register = await readFile('docs/PHASE_REGISTER.md', 'utf8');
const architecture = await readFile(
  'docs/architecture/ADR-0001-modular-monolith-and-bounded-contexts.md',
  'utf8',
);
const moduleMap = await readFile('docs/architecture/MODULE_LAYER_MAP.md', 'utf8');
const traceability = await readFile(
  'docs/architecture/MODULE_REQUIREMENTS_TRACEABILITY.md',
  'utf8',
);

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

const modules = [
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
];

for (const layer of layers) {
  assert.ok(masterPlan.includes(layer), `Master plan is missing layer: ${layer}`);
  assert.ok(architecture.includes(layer), `ADR is missing layer: ${layer}`);
  assert.ok(moduleMap.includes(layer), `Module layer map is missing layer: ${layer}`);
}

for (const [index, moduleName] of modules.entries()) {
  const letter = String.fromCharCode(65 + index);
  assert.ok(moduleMap.includes(`**${moduleName}**`), `Module map is missing module ${letter}`);
  assert.ok(
    traceability.includes(`## Module ${letter} — ${moduleName}`),
    `Capability traceability is missing module ${letter}`,
  );
}

assert.ok(register.includes('Phase 0 — Foundation and repository/infrastructure audit'));
assert.ok(register.includes('| 1 | Identity, tenancy and security foundation |'));
assert.ok(masterPlan.includes('Phase 13 — Production hardening and launch'));
assert.ok(architecture.includes('no compile-time dependency cycle'));
assert.ok(traceability.includes('original module-level capability requirements'));

const moduleRegistry = await readFile('apps/web/src/modules/registry.ts', 'utf8');
for (const moduleName of modules) {
  assert.ok(
    moduleRegistry.includes(moduleName),
    `Application registry is missing canonical module: ${moduleName}`,
  );
}

const envExample = await readFile('.env.example', 'utf8');
assert.ok(envExample.includes('replace-with-local-service-role-key'));
assert.ok(envExample.includes('AI_PROVIDER_DEFAULT=mock'));
assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(envExample), 'Potential live AI key found in .env.example');

console.log('Njumeni foundation integrity checks passed.');
