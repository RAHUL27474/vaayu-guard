import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Service-role Supabase client — bypasses RLS entirely. Only ever used
 * server-side, inside the `/api/agent/*` route handlers, after the caller's
 * device bearer token has been independently verified against `devices`.
 * Never import this into anything reachable from a Server Component render
 * or a client bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for /api/agent/* routes."
    );
  }
  return createSupabaseClient<Database>(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
