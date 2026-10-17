"use client";

import { useMemo, useState } from "react";
import type { WindowActivity } from "@/lib/types/database";
import { groupIntoBlocks, formatBlockDuration } from "@/lib/activity-blocks";
import { formatSite, formatWhatsAppIdentity } from "@/lib/format";

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
    const digits = q.replace(/\D+/g, "");
    return blocks.filter(
      (b) =>
        b.processName.toLowerCase().includes(q) ||
        b.windowTitle.toLowerCase().includes(q) ||
        (b.url ?? "").toLowerCase().includes(q) ||
        (b.browserProfile ?? "").toLowerCase().includes(q) ||
        (b.accountEmail ?? "").toLowerCase().includes(q) ||
        (digits.length > 0 && (b.whatsappNumber ?? "").includes(digits))
    );
  }, [blocks, query]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by app, site, email, number, or title…"
        className="w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary sm:max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">Duration</th>
              <th className="hidden p-3 font-medium sm:table-cell">App</th>
              <th className="p-3 font-medium">Site / window</th>
              <th className="hidden p-3 font-medium md:table-cell">Foreground</th>
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
              filtered.map((b, i) => {
                const site = formatSite(b.url);
                return (
                  <tr key={`${b.startAt}-${i}`} className="border-b border-line-soft last:border-0 hover:bg-surface-2/50">
                    <td className="whitespace-nowrap p-3 align-top text-muted">
                      <span className="sm:hidden">{new Date(b.startAt).toLocaleTimeString()}</span>
                      <span className="hidden sm:inline">{new Date(b.startAt).toLocaleString()}</span>
                      {b.endAt === null ? (
                        <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">· ongoing</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap p-3 align-top font-medium tabular-nums text-fg-2">
                      {formatBlockDuration(b.durationSeconds)}
                    </td>
                    <td className="hidden p-3 align-top font-medium sm:table-cell">{b.processName}</td>
                    <td className="p-3 align-top [overflow-wrap:anywhere]">
                      <div className="text-xs font-medium text-muted sm:hidden">{b.processName}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {site ? (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-fg-2">
                            {site}
                          </span>
                        ) : null}
                        {b.accountEmail ? (
                          <span
                            className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
                            title={b.browserProfile ? `Browser profile: ${b.browserProfile}` : "Signed-in browser account"}
                          >
                            ✉ {b.accountEmail}
                          </span>
                        ) : b.browserProfile ? (
                          <span className="rounded-full border border-line-strong px-1.5 py-0.5 text-xs text-muted">
                            {b.browserProfile}
                          </span>
                        ) : null}
                        {b.whatsappNumber ? (
                          <span
                            className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                            title="WhatsApp account signed in"
                          >
                            WhatsApp {formatWhatsAppIdentity(b.whatsappNumber)}
                          </span>
                        ) : null}
                      </div>
                      <div className={site ? "mt-0.5 text-muted" : ""}>{b.windowTitle}</div>
                    </td>
                    <td className="hidden p-3 align-top md:table-cell">
                      {b.isForeground ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
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
