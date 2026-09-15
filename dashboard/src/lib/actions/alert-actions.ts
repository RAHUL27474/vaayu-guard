"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSuperadmin } from "@/lib/auth-guard";
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

/**
 * Asks the agent to close the specific window it flagged for this alert —
 * a graceful WM_CLOSE (same as clicking the window's own X), not a
 * forced kill and not a persistent block. Delivered on the device's next
 * check-in (within its poll interval) and consumed once — reopening the
 * same identity later needs another click.
 *
 * Superadmin-only by design — this is an active intervention on someone's
 * PC, not a read/triage action, so it's deliberately not handed to the
 * admin (director) role alongside acknowledge/dismiss.
 */
export async function requestCloseWindow(
  alertId: number
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({
      close_requested_at: new Date().toISOString(),
      close_requested_by: session.id,
    })
    .eq("id", alertId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
