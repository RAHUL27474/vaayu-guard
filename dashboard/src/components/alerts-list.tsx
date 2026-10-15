"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alert, Device } from "@/lib/types/database";
import { setAlertStatus, requestCloseWindow } from "@/lib/actions/alert-actions";
import { formatWhatsAppIdentity } from "@/lib/format";

type DeviceLite = Pick<Device, "id" | "device_label" | "hostname" | "assigned_to_user">;

function StatusBadge({ status }: { status: Alert["status"] }) {
  const styles: Record<Alert["status"], string> = {
    open: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    acknowledged: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dismissed: "bg-surface-2 text-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export function AlertsList({
  alerts,
  deviceMap,
  isDeveloper = false,
  canCloseWindow = isDeveloper,
}: {
  alerts: Alert[];
  deviceMap: Record<string, DeviceLite>;
  isDeveloper?: boolean;
  canCloseWindow?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [closeRequested, setCloseRequested] = useState<Set<number>>(new Set());

  function act(id: number, status: "acknowledged" | "dismissed") {
    startTransition(async () => {
      await setAlertStatus(id, status);
      router.refresh();
    });
  }

  function closeWindow(id: number) {
    startTransition(async () => {
      const res = await requestCloseWindow(id);
      if (res.ok) setCloseRequested((prev) => new Set(prev).add(id));
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
            <th className="p-3">Device</th>
            <th className="hidden p-3 md:table-cell">Channel</th>
            <th className="p-3">Detected identity</th>
            <th className="hidden p-3 sm:table-cell">Seen</th>
            <th className="hidden p-3 md:table-cell">Count</th>
            <th className="hidden p-3 sm:table-cell">Status</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-6 text-center text-muted">
                No mismatches detected yet.
              </td>
            </tr>
          ) : (
            alerts.map((a) => {
              const device = deviceMap[a.device_id];
              return (
                <tr key={a.id} className="border-b border-line-soft last:border-0">
                  <td className="p-3 font-medium">
                    {device?.device_label ?? device?.hostname ?? a.device_id.slice(0, 8)}
                    {device?.assigned_to_user ? (
                      <div className="text-xs font-normal text-subtle">
                        {device.assigned_to_user}
                      </div>
                    ) : null}
                    <div className="mt-1 sm:hidden">
                      <StatusBadge status={a.status} />
                    </div>
                  </td>
                  <td className="hidden p-3 capitalize md:table-cell">{a.channel}</td>
                  <td className="p-3 [overflow-wrap:anywhere]">
                    {a.channel === "whatsapp" ? formatWhatsAppIdentity(a.detected_identity) : a.detected_identity}
                    {/* Columns hidden on small screens, folded in here instead. */}
                    <div className="mt-0.5 text-xs text-muted md:hidden">
                      <span className="capitalize">{a.channel}</span> · {a.occurrence_count}×
                      <span className="block sm:hidden">{new Date(a.last_seen_at).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="hidden p-3 text-muted sm:table-cell">
                    {new Date(a.last_seen_at).toLocaleString()}
                  </td>
                  <td className="hidden p-3 md:table-cell">{a.occurrence_count}</td>
                  <td className="hidden p-3 sm:table-cell">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3 text-right">
                    {a.status === "open" ? (
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                        {canCloseWindow ? (
                          a.close_requested_at || closeRequested.has(a.id) ? (
                            <span className="text-xs text-subtle">Close requested…</span>
                          ) : (
                            <button
                              disabled={pending}
                              onClick={() => closeWindow(a.id)}
                              className="text-xs font-medium text-rose-700 hover:underline dark:text-rose-400"
                              title="Sends a graceful close (like clicking X) to this window on its next check-in"
                            >
                              Close window
                            </button>
                          )
                        ) : null}
                        <button
                          disabled={pending}
                          onClick={() => act(a.id, "acknowledged")}
                          className="text-xs text-amber-700 hover:underline dark:text-amber-400"
                        >
                          Acknowledge
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => act(a.id, "dismissed")}
                          className="text-xs text-muted hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
