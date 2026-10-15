"use client";

import { useMemo, useState } from "react";
import type { WindowActivity } from "@/lib/types/database";
import { groupIntoBlocks, formatBlockDuration } from "@/lib/activity-blocks";

export function TimelineTable({
  rows,
  emptyMessage = "No activity recorded yet for this device.",
}: {
  rows: WindowActivity[];
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");

  // Newest first for reading, but blocks (and their durations) are
  // computed on the full chronological set first.
  const blocks = useMemo(() => groupIntoBlocks(rows).reverse(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter(
      (b) =>
        b.processName.toLowerCase().includes(q) ||
        b.windowTitle.toLowerCase().includes(q)
    );
  }, [blocks, query]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by app or window title…"
        className="w-full rounded-md border border-line-strong px-3 py-1.5 text-sm sm:max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
              <th className="p-3">Time</th>
              <th className="p-3">Duration</th>
              <th className="hidden p-3 sm:table-cell">App</th>
              <th className="p-3">Window title</th>
              <th className="hidden p-3 md:table-cell">Foreground</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  {rows.length === 0 ? emptyMessage : `No activity matches "${query}".`}
                </td>
              </tr>
            ) : (
              filtered.map((b, i) => (
                <tr key={`${b.startAt}-${i}`} className="border-b border-line-soft last:border-0">
                  <td className="p-3 text-muted">
                    <span className="sm:hidden">{new Date(b.startAt).toLocaleTimeString()}</span>
                    <span className="hidden sm:inline">{new Date(b.startAt).toLocaleString()}</span>
                    {b.endAt === null ? (
                      <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">· ongoing</span>
                    ) : null}
                  </td>
                  <td className="p-3 font-medium text-fg-2">
                    {formatBlockDuration(b.durationSeconds)}
                  </td>
                  <td className="hidden p-3 font-medium sm:table-cell">{b.processName}</td>
                  <td className="p-3 [overflow-wrap:anywhere]">
                    <div className="text-xs font-medium text-muted sm:hidden">{b.processName}</div>
                    {b.windowTitle}
                  </td>
                  <td className="hidden p-3 md:table-cell">{b.isForeground ? "Yes" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-subtle">
        Showing {filtered.length} of {blocks.length} activity blocks.
      </p>
    </div>
  );
}
