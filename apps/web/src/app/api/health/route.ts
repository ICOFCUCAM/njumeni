export const dynamic = 'force-dynamic';
export function GET() {
  // Reports integration state only. Never returns secrets or environment values.
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return Response.json(
    {
      status: 'ok',
      service: 'njumeni-web',
      mode: 'identity-foundation',
      authenticationConnected: true,
      databaseConfigured: supabaseConfigured,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
