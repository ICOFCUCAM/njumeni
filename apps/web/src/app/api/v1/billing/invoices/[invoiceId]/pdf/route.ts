import { createHash } from 'node:crypto';
import { apiError } from '@/lib/api-response';
import { createClient } from '@/lib/supabase/server';
import { invoiceModel, type InvoiceView } from '@/modules/billing/billing';
import { renderPdf } from '@/modules/documents/export';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/v1/billing/invoices/{invoiceId}/pdf — an issued invoice as PDF (billing.read). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
): Promise<Response> {
  const { invoiceId } = await params;
  if (!UUID.test(invoiceId)) return apiError('invalid_request', 'invoiceId must be a UUID.');
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return apiError('unauthenticated', 'Sign in to download invoices.');
  const { data, error } = await supabase.rpc('billing_invoice_get', { p_invoice_id: invoiceId });
  if (error || !data) return apiError('not_found', 'Invoice not found.');
  const invoice = data as unknown as InvoiceView;
  const bytes = renderPdf(
    invoiceModel(invoice, createHash('sha256').update(JSON.stringify(invoice)).digest('hex')),
  );
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
