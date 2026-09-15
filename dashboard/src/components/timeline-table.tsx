"use client";

import { useMemo, useState } from "react";
import type { WindowActivity } from "@/lib/types/database";

export function TimelineTable({ rows }: { rows: WindowActivity[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.process_name.toLowerCase().includes(q) ||
        r.window_title.toLowerCase().includes(q)
    );
  }, [rows, query]);

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
              <th className="p-3">App</th>
              <th className="p-3">Window title</th>
              <th className="p-3">Foreground</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  {rows.length === 0
                    ? "No activity recorded yet for this device."
                    : `No activity matches "${query}".`}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3 text-slate-500">
                    {new Date(r.captured_at).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{r.process_name}</td>
                  <td className="p-3">{r.window_title}</td>
                  <td className="p-3">{r.is_foreground ? "Yes" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {rows.length} recent entries.
      </p>
    </div>
  );
}
