"use client";

import { useMemo, useState } from "react";
import type { WindowActivity } from "@/lib/types/database";
import { groupIntoBlocks, formatBlockDuration } from "@/lib/activity-blocks";

export function TimelineTable({ rows }: { rows: WindowActivity[] }) {
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
        className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="p-3">Time</th>
              <th className="p-3">Duration</th>
              <th className="p-3">App</th>
              <th className="p-3">Window title</th>
              <th className="p-3">Foreground</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  {rows.length === 0
                    ? "No activity recorded yet for this device."
                    : `No activity matches "${query}".`}
                </td>
              </tr>
            ) : (
              filtered.map((b, i) => (
                <tr key={`${b.startAt}-${i}`} className="border-b border-slate-100 last:border-0">
                  <td className="p-3 text-slate-500">
                    {new Date(b.startAt).toLocaleString()}
                    {b.endAt === null ? (
                      <span className="ml-1 text-xs text-emerald-600">· ongoing</span>
                    ) : null}
                  </td>
                  <td className="p-3 font-medium text-slate-700">
                    {formatBlockDuration(b.durationSeconds)}
                  </td>
                  <td className="p-3 font-medium">{b.processName}</td>
                  <td className="p-3">{b.windowTitle}</td>
                  <td className="p-3">{b.isForeground ? "Yes" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {blocks.length} activity blocks.
      </p>
    </div>
  );
}
