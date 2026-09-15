import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { TimelineTable } from "@/components/timeline-table";
import type { WindowActivity } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ device?: string }>;
}) {
  await requireAdmin();
  const { device: deviceId } = await searchParams;
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from("devices")
    .select("id, device_label, hostname, assigned_to_user")
    .order("registered_at", { ascending: false });

  const activeDeviceId = deviceId ?? devices?.[0]?.id;

  const [{ data: rows }, { data: recentAcrossFleet }] = await Promise.all([
    activeDeviceId
      ? supabase
          .from("window_activity")
          .select("*")
          .eq("device_id", activeDeviceId)
          .order("captured_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] as WindowActivity[] }),
    // Enough rows across all devices that, after taking the first per
    // device below, every enrolled PC likely has a recent entry.
    supabase
      .from("window_activity")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(500),
  ]);

  // Right now, per device: the single most recent thing seen — an
  // approximation of "what's open" (a window that hasn't changed in a
  // while produces no new rows, so this is "last observed", not a live
  // poll of every open window every second).
  const latestByDevice = new Map<string, WindowActivity>();
  for (const row of recentAcrossFleet ?? []) {
    if (!latestByDevice.has(row.device_id)) latestByDevice.set(row.device_id, row);
  }

  function deviceName(id: string) {
    const d = (devices ?? []).find((x) => x.id === id);
    return d?.device_label ?? d?.hostname ?? id.slice(0, 8);
  }

  function timeAgo(iso: string) {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    return `${Math.round(seconds / 3600)}h ago`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Timeline</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every app/tab window title seen on a PC — general activity log,
            not just email/WhatsApp mismatches. Titles only, never content.
          </p>
        </div>
        <AutoRefresh intervalSeconds={15} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Right now, across all PCs</h2>
          <p className="text-xs text-slate-400">
            Last observed window per device — not a guarantee it's still open right now.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {(devices ?? []).length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No devices enrolled yet.</p>
          ) : (
            (devices ?? []).map((d) => {
              const latest = latestByDevice.get(d.id);
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span className="font-medium">{d.device_label ?? d.hostname ?? d.id.slice(0, 8)}</span>
                  {latest ? (
                    <span className="text-slate-600">
                      <span className="font-medium">{latest.process_name}</span> — {latest.window_title}
                      <span className="ml-2 text-xs text-slate-400">{timeAgo(latest.captured_at)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">No activity yet</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Full history for one PC:</p>
        <div className="flex flex-wrap gap-2">
          {(devices ?? []).map((d) => (
            <Link
              key={d.id}
              href={`/timeline?device=${d.id}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                d.id === activeDeviceId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {d.device_label ?? d.hostname ?? d.id.slice(0, 8)}
            </Link>
          ))}
        </div>
      </div>

      <TimelineTable rows={rows ?? []} />
    </div>
  );
}
