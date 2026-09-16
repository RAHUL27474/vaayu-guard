const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date as "YYYY-MM-DD" in IST — the dashboard's own timezone, not the server's (Vercel runs UTC). */
export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant bounds [start, end) for one IST calendar day, for filtering timestamptz columns. */
export function istDayBoundsUtc(dateStr: string): { startUtc: string; endUtc: string } {
  const startMs = new Date(`${dateStr}T00:00:00.000Z`).getTime() - IST_OFFSET_MS;
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
