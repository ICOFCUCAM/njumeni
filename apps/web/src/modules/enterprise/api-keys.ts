// Enterprise API keys (Phase 10). A key is a delegated, scoped credential: requests carrying
// "Authorization: Bearer njk_…" are served without a browser session through key-specific
// database functions, which act as the key's creator within the key's scopes and workspace.
// The web application never holds a service-role key.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const API_KEY_PATTERN = /^njk_[0-9a-f]{8}_[0-9a-f]{48}$/;

/** Returns the API key from an Authorization header, null when absent, or 'malformed'. */
export function bearerApiKey(request: Pick<Request, 'headers'>): string | null | 'malformed' {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match || !match[1]!.startsWith('njk_')) return null;
  return API_KEY_PATTERN.test(match[1]!) ? match[1]! : 'malformed';
}

/** A stateless client for key-authenticated calls (no cookies, no session persistence). */
export function keyClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('NOT_CONFIGURED');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Maps key errors to API error codes without revealing whether a key exists. */
export function keyErrorStatus(message: string): 'unauthenticated' | 'forbidden' | 'not_found' {
  if (/API_KEY_INVALID/.test(message)) return 'unauthenticated';
  if (/API_KEY_SCOPE/.test(message)) return 'forbidden';
  return 'not_found';
}
