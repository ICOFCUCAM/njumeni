import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Verified GLCI audit export (GLCI-11), for platform operators. The export carries its own
 * integrity result and SHA-256 digest, and taking it is itself recorded and audited.
 */
export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('glci_audit_export' as never, { p_from: 1 } as never);
  if (error || !data) return new Response('Not found', { status: 404 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="njumeni-glci-audit-${stamp}.json"`,
      'cache-control': 'no-store',
    },
  });
}
