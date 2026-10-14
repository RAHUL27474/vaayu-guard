import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from the protected dashboard routes. Agent
 * traffic (`/api/agent/*`) is never protected here — it authenticates with
 * its own device bearer token, checked inside each route handler.
 */
export async function updateSession(request: NextRequest) {
  let cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        cookiesToSet = list;
        list.forEach(({ name, value }) => request.cookies.set(name, value));
      },
    },
  });

  // getClaims() verifies the JWT locally against the project's (cached)
  // asymmetric signing keys and only hits the Auth server when the access
  // token actually needs refreshing — getUser() was a network round trip
  // to Supabase on every single request.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/devices") ||
    path.startsWith("/alerts") ||
    path.startsWith("/activity") ||
    path.startsWith("/timeline");

  const applyCookies = (res: NextResponse) => {
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return applyCookies(NextResponse.redirect(url));
  }

  return applyCookies(NextResponse.next({ request }));
}
