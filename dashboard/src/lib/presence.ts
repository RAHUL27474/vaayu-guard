// Shared "is this PC online?" / "how long ago?" helpers. Kept out of the
// component render bodies on purpose: the time-relative values depend on the
// wall clock, and centralizing them here keeps every page's notion of
// "online" identical (and keeps Date.now() out of render for the React
// purity lint).

// Slightly more than 2 poll cycles (agent default 45s) — long enough that one
// missed check-in doesn't flash "Offline", short enough that a PC that's
// genuinely off/asleep shows it within a couple of minutes.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/** Compact "3s ago" / "4m ago" / "2h ago" / "5d ago". */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}
