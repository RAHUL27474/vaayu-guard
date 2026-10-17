"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDeveloper } from "@/lib/auth-guard";

/**
 * Deletes Timeline (window_activity) records. Developer-only — checked here
 * and again by the database's RLS delete policy (migration 0016).
 */
export async function deleteTimelineRows(ids: number[]): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  await requireDeveloper();
  const clean = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (clean.length === 0) return { ok: false, error: "Nothing to delete" };

  const supabase = await createClient();
  let deleted = 0;
  // Chunked so a large "delete all shown" stays within URL length limits.
  for (let i = 0; i < clean.length; i += 200) {
    const { data, error } = await supabase
      .from("window_activity")
      .delete()
      .in("id", clean.slice(i, i + 200))
      .select("id");
    if (error) return { ok: false, deleted, error: error.message };
    deleted += data?.length ?? 0;
  }
  return { ok: true, deleted };
}
