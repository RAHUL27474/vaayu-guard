"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDeveloper } from "@/lib/auth-guard";
import type { Database } from "@/lib/types/database";

type Target = Database["public"]["Enums"]["filter_target"];

export async function createFilter(input: {
  deviceId: string;
  target: Target;
  pattern: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireDeveloper();
  const pattern = input.pattern.trim();
  if (!pattern) return { ok: false, error: "Pattern is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("visibility_filters").insert({
    device_id: input.deviceId,
    target: input.target,
    pattern,
    note: input.note?.trim() || null,
    created_by: session.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setFilterActive(
  id: number,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  await requireDeveloper();
  const supabase = await createClient();
  const { error } = await supabase
    .from("visibility_filters")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFilter(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await requireDeveloper();
  const supabase = await createClient();
  const { error } = await supabase.from("visibility_filters").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
