import { keyClient } from '@/modules/enterprise/api-keys';

export const dynamic = 'force-dynamic';

const MAX_BODY = 256 * 1024;

/**
 * POST /api/billing/webhooks/{provider} — payment provider notifications.
 * The body is relayed byte for byte with its signature header; the database verifies the
 * HMAC with the provider secret it holds, checks freshness, deduplicates and applies the event.
 * This route holds no secret and no privileged key.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(provider))
    return Response.json({ error: 'unknown provider' }, { status: 404 });
  const signature =
    request.headers.get('stripe-signature') ?? request.headers.get('x-njumeni-signature') ?? '';
  const body = await request.text();
  if (body.length > MAX_BODY) return Response.json({ error: 'payload too large' }, { status: 413 });
  const { data, error } = await keyClient().rpc('billing_webhook', {
    p_provider: provider,
    p_payload: body,
    p_signature: signature,
  });
  if (error) {
    const code = error.message.match(/BILLING_[A-Z_]+/)?.[0] ?? 'BILLING_WEBHOOK_FAILED';
    const status = /SIGNATURE|DISABLED/.test(code) ? 401 : /PAYLOAD|UNKNOWN/.test(code) ? 400 : 500;
    return Response.json({ error: code }, { status });
  }
  return Response.json(data, { status: 200 });
}
