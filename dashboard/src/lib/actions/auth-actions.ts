"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/config";

/**
 * Signs out server-side (clears the auth cookies on this response), so the
 * browser never has to download the Supabase client library just to log out.
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Changes the signed-in user's own login password. The current password is
 * re-verified against a throwaway Supabase client (so the cookie session is
 * left untouched) before the new one is applied to the caller's own session.
 */
export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!session.email) return { ok: false, error: "This account has no email to verify against." };
  if (!input.currentPassword) return { ok: false, error: "Enter your current password." };
  if (input.newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (input.newPassword === input.currentPassword) {
    return { ok: false, error: "New password must differ from the current one." };
  }

  const verifier = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await verifier.auth.signInWithPassword({
    email: session.email,
    password: input.currentPassword,
  });
  if (authError) return { ok: false, error: "Incorrect current password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
