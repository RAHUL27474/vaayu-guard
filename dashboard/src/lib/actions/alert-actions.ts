"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import type { Alert } from "@/lib/types/database";

export async function setAlertStatus(
  alertId: number,
  status: Extract<Alert["status"], "acknowledged" | "dismissed">
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({
      status,
      acknowledged_by: session.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", alertId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
