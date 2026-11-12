// Commercial presentation helpers (Phase 11; Master Plan v2.0 §17). Amounts are integer minor units.
import type { ExportModel } from '../documents/export.ts';

export function formatMoney(minor: number | null, currency = 'USD'): string {
  if (minor === null) return 'By contract';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export interface Meter {
  key: string;
  used: number;
  limit: number | null;
}

const METER_LABELS: Record<string, string> = {
  'ai.credits.monthly': 'AI credits',
  'research.runs.monthly': 'Research runs',
  'documents.generated.monthly': 'Generated documents',
  'api.requests.monthly': 'API requests',
};

export function describeMeter(
  meter: Meter,
  overage: boolean,
): {
  label: string;
  text: string;
  ratio: number | null;
  state: 'ok' | 'warning' | 'exhausted' | 'overage';
} {
  const label = METER_LABELS[meter.key] ?? meter.key;
  if (meter.limit === null)
    return {
      label,
      text: `${meter.used.toLocaleString('en-GB')} used (contracted)`,
      ratio: null,
      state: 'ok',
    };
  const ratio = meter.limit === 0 ? (meter.used > 0 ? Infinity : 1) : meter.used / meter.limit;
  const state =
    ratio > 1
      ? overage
        ? 'overage'
        : 'exhausted'
      : ratio >= 1
        ? overage
          ? 'warning'
          : 'exhausted'
        : ratio >= 0.8
          ? 'warning'
          : 'ok';
  return {
    label,
    text: `${meter.used.toLocaleString('en-GB')} of ${meter.limit.toLocaleString('en-GB')}`,
    ratio,
    state,
  };
}

export interface InvoiceView {
  number: string;
  organization: string;
  periodStart: string;
  periodEnd: string;
  plan: string;
  currency: string;
  lines: { description: string; quantity: number; unitMinor: number; amountMinor: number }[];
  subtotalMinor: number;
  taxRatePercent: number;
  taxMinor: number;
  totalMinor: number;
  status: string;
  issuedAt: string;
}

/** An invoice as a PDF model (reuses the document renderer; "final" means issued, not draft). */
export function invoiceModel(invoice: InvoiceView, contentHash: string): ExportModel {
  const money = (minor: number) => formatMoney(minor, invoice.currency);
  return {
    title: `Invoice ${invoice.number}`,
    templateName: `${invoice.organization} · ${invoice.periodStart.slice(0, 10)} to ${invoice.periodEnd.slice(0, 10)} · ${invoice.status.toUpperCase()}`,
    versionNumber: 1,
    contentHash,
    final: true,
    generatedAt: invoice.issuedAt,
    sections: [
      {
        title: 'Lines',
        content: invoice.lines.length
          ? invoice.lines
              .map(
                (l) =>
                  `${l.description} · ${Number(l.quantity).toLocaleString('en-GB')} × ${money(Number(l.unitMinor))} = ${money(l.amountMinor)}`,
              )
              .join('\n')
          : 'No charges for this period.',
      },
      {
        title: 'Totals',
        content: [
          `Subtotal: ${money(invoice.subtotalMinor)}`,
          `VAT ${invoice.taxRatePercent}%: ${money(invoice.taxMinor)}`,
          `Total: ${money(invoice.totalMinor)}`,
        ].join('\n'),
      },
    ],
    citations: [],
  };
}
