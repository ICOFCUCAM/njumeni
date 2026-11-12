import { keyClient } from '@/modules/enterprise/api-keys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — liveness for monitoring (Phase 0, extended in Phase 13).
 * Reports integration state and whether the database answers, with its schema version.
 * Never returns secrets or environment values.
 */
export async function GET(): Promise<Response> {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const started = Date.now();
  let database: 'ok' | 'unreachable' | 'not_configured' = supabaseConfigured
    ? 'unreachable'
    : 'not_configured';
  let schemaVersion: string | null = null;
  if (supabaseConfigured) {
    try {
      const { data, error } = await keyClient().rpc('platform_health');
      if (!error && data) {
        database = 'ok';
        schemaVersion = (data as { schemaVersion: string | null }).schemaVersion;
      }
    } catch {
      database = 'unreachable';
    }
  }
  const healthy = database === 'ok';
  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'njumeni-web',
      authenticationConnected: true,
      databaseConfigured: supabaseConfigured,
      database,
      schemaVersion,
      latencyMs: Date.now() - started,
    },
    {
      status: healthy || !supabaseConfigured ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
