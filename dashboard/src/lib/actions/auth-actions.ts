"use server";

import { createClient } from "@/lib/supabase/server";

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
