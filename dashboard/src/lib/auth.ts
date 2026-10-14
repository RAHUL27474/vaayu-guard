import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export type SessionUser = {
  id: string;
  email: string | null;
  profile: Profile;
};

/**
 * Returns the current authenticated dashboard user + profile, or null.
 * Wrapped in React `cache()` so it runs once per request even though both
 * a layout guard and the page itself may call it.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  // Verified locally against the project's asymmetric signing keys — no
  // round trip to the Auth server (see lib/supabase/middleware.ts).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .single();
  if (!profile) return null;

  return { id: claims.sub, email: (claims.email as string | undefined) ?? null, profile };
});
