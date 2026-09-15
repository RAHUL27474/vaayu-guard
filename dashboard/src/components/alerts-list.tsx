"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alert, Device } from "@/lib/types/database";
import { setAlertStatus, requestCloseWindow } from "@/lib/actions/alert-actions";

type DeviceLite = Pick<Device, "id" | "device_label" | "hostname" | "assigned_to_user">;

function StatusBadge({ status }: { status: Alert["status"] }) {
  const styles: Record<Alert["status"], string> = {
    open: "bg-rose-100 text-rose-700",
    acknowledged: "bg-amber-100 text-amber-700",
    dismissed: "bg-slate-200 text-slate-500",
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
  isSuperadmin = false,
}: {
  alerts: Alert[];
  deviceMap: Record<string, DeviceLite>;
  isSuperadmin?: boolean;
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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="p-3">Device</th>
            <th className="p-3">Channel</th>
            <th className="p-3">Detected identity</th>
            <th className="p-3">Seen</th>
            <th className="p-3">Count</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-6 text-center text-slate-500">
                No mismatches detected yet.
              </td>
            </tr>
          ) : (
            alerts.map((a) => {
              const device = deviceMap[a.device_id];
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3 font-medium">
                    {device?.device_label ?? device?.hostname ?? a.device_id.slice(0, 8)}
                    {device?.assigned_to_user ? (
                      <div className="text-xs font-normal text-slate-400">
                        {device.assigned_to_user}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 capitalize">{a.channel}</td>
                  <td className="p-3">{a.detected_identity}</td>
                  <td className="p-3 text-slate-500">
                    {new Date(a.last_seen_at).toLocaleString()}
                  </td>
                  <td className="p-3">{a.occurrence_count}</td>
                  <td className="p-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3 text-right">
                    {a.status === "open" ? (
                      <div className="flex flex-wrap justify-end items-center gap-3">
                        {isSuperadmin ? (
                          a.close_requested_at || closeRequested.has(a.id) ? (
                            <span className="text-xs text-slate-400">Close requested…</span>
                          ) : (
                            <button
                              disabled={pending}
                              onClick={() => closeWindow(a.id)}
                              className="text-xs font-medium text-rose-700 hover:underline"
                              title="Sends a graceful close (like clicking X) to this window on its next check-in"
                            >
                              Close window
                            </button>
                          )
                        ) : null}
                        <button
                          disabled={pending}
                          onClick={() => act(a.id, "acknowledged")}
                          className="text-xs text-amber-700 hover:underline"
                        >
                          Acknowledge
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => act(a.id, "dismissed")}
                          className="text-xs text-slate-500 hover:underline"
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
