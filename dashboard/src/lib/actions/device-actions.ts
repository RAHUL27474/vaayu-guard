"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { generateToken, hashToken } from "@/lib/device-token";

export async function createDevice(input: {
  deviceLabel: string;
  assignedEmail: string;
  assignedPhone?: string;
  assignedToUser?: string;
}): Promise<{ ok: boolean; error?: string; token?: string }> {
  const session = await requireAdmin();
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
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("devices")
    .update({ status: "disabled" })
    .eq("id", deviceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateDevice(input: {
  deviceId: string;
  deviceLabel: string;
  assignedEmail: string;
  assignedPhone?: string;
  assignedToUser?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const email = input.assignedEmail.trim();
  if (!email) return { ok: false, error: "Assigned email is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .update({
      device_label: input.deviceLabel.trim() || null,
      assigned_email: email,
      assigned_phone: input.assignedPhone?.trim() || null,
      assigned_to_user: input.assignedToUser?.trim() || null,
    })
    .eq("id", input.deviceId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Device not found or not permitted." };
  return { ok: true };
}

/**
 * Permanently deletes a device and — via ON DELETE CASCADE — its alerts,
 * activity, sessions, Timeline records and device-specific hide rules.
 * Admin or developer (RLS policy from migration 0018).
 */
export async function deleteDevice(
  deviceId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .delete()
    .eq("id", deviceId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  // RLS silently filters a disallowed delete to zero rows rather than erroring.
  if (!data?.length) return { ok: false, error: "Device not found or not permitted." };
  return { ok: true };
}
