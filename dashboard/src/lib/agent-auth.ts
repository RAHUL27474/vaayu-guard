import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, bearerToken } from "@/lib/device-token";
import type { Device } from "@/lib/types/database";

/**
 * Resolves the active device behind a request's Bearer token. Returns null
 * if the header is missing, the token doesn't match any device, or the
 * device has been disabled — callers should respond 401 in that case.
 */
export async function authenticateDevice(request: Request): Promise<Device | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: device } = await supabase
    .from("devices")
    .select("*")
    .eq("active_token_hash", hashToken(token))
    .eq("status", "active")
    .single();

  return device ?? null;
}
