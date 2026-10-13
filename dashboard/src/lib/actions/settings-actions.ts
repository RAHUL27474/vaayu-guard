"use server";

import { randomBytes } from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireDeveloper } from "@/lib/auth-guard";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/config";

// Crockford-ish alphabet: no 0/O/1/I to keep a generated code easy to read
// out and type at a command prompt.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = randomBytes(10);
  const c = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `VG${c.slice(0, 2).join("")}-${c.slice(2, 6).join("")}-${c.slice(6, 10).join("")}`;
}

/**
 * Changes one of the fleet-wide agent secret codes — the uninstall code or
 * the developer-access code. Available to both roles (admin + developer).
 * Requires re-entering the caller's own login password — verified against a
 * throwaway Supabase client so the cookie session is left untouched — before
 * the change is applied.
 */
export async function changeSecretCode(input: {
  which: "uninstall" | "developer";
  password: string;
  mode: "random" | "manual";
  customCode?: string;
}): Promise<{ ok: boolean; error?: string; code?: string }> {
  // The developer-access code is developer-only; the uninstall code is either role.
  const session =
    input.which === "developer" ? await requireDeveloper() : await requireAdmin();
  if (!session.email) return { ok: false, error: "This account has no email to verify against." };
  if (!input.password) return { ok: false, error: "Enter your password." };

  const verifier = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await verifier.auth.signInWithPassword({
    email: session.email,
    password: input.password,
  });
  if (authError) return { ok: false, error: "Incorrect password." };

  let code: string;
  if (input.mode === "manual") {
    code = (input.customCode ?? "").trim();
    if (code.length < 6 || code.length > 64) {
      return { ok: false, error: "Code must be 6–64 characters." };
    }
  } else {
    code = generateCode();
  }

  const codePatch =
    input.which === "developer" ? { developer_code: code } : { uninstall_code: code };
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ ...codePatch, updated_by: session.id, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };

  return { ok: true, code };
}
