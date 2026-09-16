"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * Prev/next-day arrows plus a native date picker, all navigating via the
 * URL's `date` query param — so a per-device history table can be scoped to
 * one day instead of silently truncating at a fixed row limit as activity
 * accumulates (confirmed live: entries were "disappearing" from Timeline
 * purely because they'd scrolled past the old flat limit(300), not because
 * anything was deleted).
 */
export function DateNav({
  date,
  prevDate,
  nextDate,
  extraParams,
}: {
  date: string;
  prevDate: string;
  nextDate: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function go(nextDateValue: string) {
    const params = new URLSearchParams(extraParams);
    params.set("date", nextDateValue);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <button
        onClick={() => go(prevDate)}
        className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50"
        aria-label="Previous day"
      >
        ←
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1"
      />
      <button
        onClick={() => go(nextDate)}
        className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}
