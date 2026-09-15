import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/config";

/**
 * Server-side Supabase client bound to the request cookies, using the
 * anon key (RLS-scoped). Use in Server Components, Route Handlers and
 * Server Actions that act as the signed-in dashboard user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore, middleware refreshes the session.
        }
      },
    },
  });
}
