"use server";

import { createClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/auth-guard";
import { generateToken, hashToken } from "@/lib/device-token";

export async function createDevice(input: {
  deviceLabel: string;
  assignedEmail: string;
  assignedPhone?: string;
  assignedToUser?: string;
}): Promise<{ ok: boolean; error?: string; token?: string }> {
  const session = await requireSuperadmin();
  const supabase = await createClient();

  const token = generateToken();
  const { error } = await supabase.from("devices").insert({
    device_label: input.deviceLabel || null,
    assigned_email: input.assignedEmail,
    assigned_phone: input.assignedPhone || null,
    assigned_to_user: input.assignedToUser || null,
    enrollment_token_hash: hashToken(token),
    created_by: session.id,
  });
  if (error) return { ok: false, error: error.message };

  // Returned exactly once — only its hash is ever stored.
  return { ok: true, token };
}

export async function disableDevice(
  deviceId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("devices")
    .update({ status: "disabled" })
    .eq("id", deviceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
