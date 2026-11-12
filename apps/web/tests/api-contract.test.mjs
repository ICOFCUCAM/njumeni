import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GET as openapi } from '../src/app/api/v1/openapi.json/route.ts';

const ROUTES = {
  '/research/runs': '../src/app/api/v1/research/runs/route.ts',
  '/research/runs/{runId}': '../src/app/api/v1/research/runs/[runId]/route.ts',
  '/documents/{documentId}/export': '../src/app/api/v1/documents/[documentId]/export/route.ts',
  '/matters/{matterId}/export': '../src/app/api/v1/matters/[matterId]/export/route.ts',
  '/matters': '../src/app/api/v1/matters/route.ts',
  '/billing/invoices/{invoiceId}/pdf':
    '../src/app/api/v1/billing/invoices/[invoiceId]/pdf/route.ts',
};

test('every documented operation has a handler and every handler is documented', async () => {
  const document = await openapi().json();
  assert.equal(document.openapi, '3.1.0');
  assert.deepEqual(Object.keys(document.paths).sort(), Object.keys(ROUTES).sort());
  for (const [path, file] of Object.entries(ROUTES)) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const handlers = [
      ...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g),
    ].map((m) => m[1].toLowerCase());
    assert.deepEqual(Object.keys(document.paths[path]).sort(), handlers.sort(), path);
  }
});

test('the documented claim categories match the database ledger exactly', async () => {
  const document = await openapi().json();
  const sql = await readFile(
    new URL(
      '../../../supabase/migrations/20261111300000_legal_research_engine.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const block = sql.slice(
    sql.indexOf('category text not null check (category in ('),
    sql.indexOf('statement text not null'),
  );
  const databaseCategories = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    [...document.components.schemas.Claim.properties.category.enum].sort(),
    databaseCategories,
  );
});

test('every error response uses the shared error schema', async () => {
  const document = await openapi().json();
  for (const operations of Object.values(document.paths)) {
    for (const operation of Object.values(operations)) {
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) >= 400) {
          assert.equal(
            response.content['application/json'].schema.$ref,
            '#/components/schemas/Error',
          );
        }
      }
    }
  }
});
