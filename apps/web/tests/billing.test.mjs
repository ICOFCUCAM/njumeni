import test from 'node:test';
import assert from 'node:assert/strict';
import { describeMeter, formatMoney, invoiceModel } from '../src/modules/billing/billing.ts';
import { renderPdf } from '../src/modules/documents/export.ts';

test('money is formatted from minor units', () => {
  assert.equal(formatMoney(9875), 'US$98.75');
  assert.equal(formatMoney(0), 'US$0.00');
  assert.equal(formatMoney(null), 'By contract');
});

test('meters show allowance state; hard stops versus billed overage', () => {
  assert.equal(
    describeMeter({ key: 'research.runs.monthly', used: 10, limit: 30 }, false).state,
    'ok',
  );
  assert.equal(
    describeMeter({ key: 'research.runs.monthly', used: 25, limit: 30 }, false).state,
    'warning',
  );
  assert.equal(
    describeMeter({ key: 'research.runs.monthly', used: 30, limit: 30 }, false).state,
    'exhausted',
  );
  assert.equal(
    describeMeter({ key: 'research.runs.monthly', used: 31, limit: 30 }, true).state,
    'overage',
  );
  assert.equal(
    describeMeter({ key: 'api.requests.monthly', used: 0, limit: 0 }, false).state,
    'exhausted',
    'a zero allowance is not available',
  );
  assert.equal(
    describeMeter({ key: 'ai.credits.monthly', used: 5, limit: null }, false).text,
    '5 used (contracted)',
  );
  assert.equal(
    describeMeter({ key: 'ai.credits.monthly', used: 5, limit: null }, false).label,
    'AI credits',
  );
});

test('invoices render as PDF with lines and totals', () => {
  const model = invoiceModel(
    {
      number: 'INV-2026-000001',
      organization: 'Hansen & Co',
      periodStart: '2026-10-01T00:00:00Z',
      periodEnd: '2026-11-01T00:00:00Z',
      plan: 'professional',
      currency: 'USD',
      status: 'open',
      issuedAt: '2026-11-01T00:00:00Z',
      lines: [
        { description: 'Professional plan', quantity: 1, unitMinor: 7900, amountMinor: 7900 },
        { description: 'Overage: research.runs', quantity: 12, unitMinor: 10, amountMinor: 120 },
      ],
      subtotalMinor: 8020,
      taxRatePercent: 25,
      taxMinor: 2005,
      totalMinor: 10025,
    },
    'c'.repeat(64),
  );
  assert.equal(model.title, 'Invoice INV-2026-000001');
  assert.match(model.sections[0].content, /Overage: research.runs · 12 × US\$0.10 = US\$1.20/);
  assert.match(model.sections[1].content, /Total: US\$100.25/);
  assert.ok(Buffer.from(renderPdf(model)).toString('latin1').startsWith('%PDF-1.4'));
});
