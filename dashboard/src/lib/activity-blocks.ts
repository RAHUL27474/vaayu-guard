import type { WindowActivity } from "@/lib/types/database";

export type ActivityBlock = {
  processName: string;
  windowTitle: string;
  isForeground: boolean;
  startAt: string;
  endAt: string | null; // null = still the latest known state (may still be open)
  durationSeconds: number;
};

/**
 * window_activity only logs a new row when the title changes, so the gap
 * to the NEXT row is exactly how long a given window/title was the last
 * one seen — turning a flat diff log into readable "open from X to Y for
 * Zm" blocks instead of one row per poll tick.
 */
export function groupIntoBlocks(rows: WindowActivity[]): ActivityBlock[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );

  return sorted.map((row, i) => {
    const next = sorted[i + 1];
    const startMs = new Date(row.captured_at).getTime();
    const endMs = next ? new Date(next.captured_at).getTime() : Date.now();
    return {
      processName: row.process_name,
      windowTitle: row.window_title,
      isForeground: row.is_foreground,
      startAt: row.captured_at,
      endAt: next ? next.captured_at : null,
      durationSeconds: Math.max(0, Math.round((endMs - startMs) / 1000)),
    };
  });
}

export function formatBlockDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
