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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { id: user.id, email: user.email ?? null, profile };
});
