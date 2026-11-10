export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'njumeni-web',
      mode: 'foundation-shell',
      authenticationConnected: false,
      databaseConnected: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
