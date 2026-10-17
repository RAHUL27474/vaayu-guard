"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WindowActivity } from "@/lib/types/database";
import { deleteTimelineRows } from "@/lib/actions/timeline-actions";
import { groupIntoBlocks, formatBlockDuration } from "@/lib/activity-blocks";
import { formatSite, formatWhatsAppIdentity } from "@/lib/format";

export function TimelineTable({
  rows,
  emptyMessage = "No activity recorded yet for this device.",
  canDelete = false,
}: {
  rows: WindowActivity[];
  emptyMessage?: string;
  // Developer-only: per-row delete and "delete all shown".
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function remove(ids: number[], what: string) {
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${what}? This cannot be undone.`)) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteTimelineRows(ids);
      if (!res.ok) setDeleteError(res.error ?? "Could not delete");
      router.refresh();
    });
  }

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
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by app, site, email, number, or title…"
          className="w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary sm:max-w-sm"
        />
        {canDelete && filtered.length > 0 ? (
          <button
            disabled={pending}
            onClick={() =>
              remove(
                filtered.map((b) => b.id),
                `all ${filtered.length} record${filtered.length === 1 ? "" : "s"} shown${query.trim() ? ` matching "${query.trim()}"` : ""}`
              )
            }
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            {pending ? "Deleting…" : `Delete all ${filtered.length} shown`}
          </button>
        ) : null}
      </div>
      {deleteError ? <p className="text-sm text-rose-600 dark:text-rose-400">{deleteError}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">Duration</th>
              <th className="hidden p-3 font-medium sm:table-cell">App</th>
              <th className="p-3 font-medium">Site / window</th>
              <th className="hidden p-3 font-medium md:table-cell">Foreground</th>
              {canDelete ? <th className="p-3" aria-label="Delete" /> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canDelete ? 6 : 5} className="p-6 text-center text-muted">
                  {rows.length === 0 ? emptyMessage : `No activity matches "${query}".`}
                </td>
              </tr>
            ) : (
              filtered.map((b) => {
                const site = formatSite(b.url);
                return (
                  <tr key={b.id} className="border-b border-line-soft last:border-0 hover:bg-surface-2/50">
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
                    {canDelete ? (
                      <td className="p-3 text-right align-top">
                        <button
                          disabled={pending}
                          onClick={() => remove([b.id], `this record ("${b.windowTitle.slice(0, 60)}")`)}
                          className="rounded p-1 text-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          title="Delete this record"
                          aria-label="Delete this record"
                        >
                          🗑
                        </button>
                      </td>
                    ) : null}
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
