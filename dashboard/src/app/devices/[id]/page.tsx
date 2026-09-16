import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { AlertsList } from "@/components/alerts-list";
import { TimelineTable } from "@/components/timeline-table";
import { DateNav } from "@/components/date-nav";
import { todayIST, istDayBoundsUtc, shiftDate } from "@/lib/date-range";
import { formatDuration, formatDate, formatWhatsAppIdentity } from "@/lib/format";
import type { WindowActivity } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export default async function DeviceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();

  const { data: device } = await supabase.from("devices").select("*").eq("id", id).single();
  if (!device) notFound();

  // Scoped to one day instead of a flat row limit — with enough activity,
  // a fixed limit(N) silently drops older entries as new ones come in
  // (confirmed live: this looked like Timeline entries "disappearing").
  const date = dateParam ?? todayIST();
  const { startUtc, endUtc } = istDayBoundsUtc(date);

  const [{ data: alerts }, { data: daily }, { data: activityRows }, { data: openAlerts }] =
    await Promise.all([
      supabase.from("alerts").select("*").eq("device_id", id).order("last_seen_at", { ascending: false }),
      supabase
        .from("daily_identity_activity")
        .select("*")
        .eq("device_id", id)
        .order("activity_date", { ascending: false })
        .limit(30),
      supabase
        .from("window_activity")
        .select("*")
        .eq("device_id", id)
        .gte("captured_at", startUtc)
        .lt("captured_at", endUtc)
        .order("captured_at", { ascending: false }),
      supabase.from("alerts").select("id").eq("device_id", id).eq("status", "open"),
    ]);

  const online =
    !!device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < ONLINE_WINDOW_MS;
  const openAlertCount = openAlerts?.length ?? 0;

  const deviceMap = {
    [device.id]: {
      id: device.id,
      device_label: device.device_label,
      hostname: device.hostname,
      assigned_to_user: device.assigned_to_user,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/devices"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          ← Back to Devices
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {device.device_label ?? device.hostname ?? device.id.slice(0, 8)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {device.assigned_to_user ?? "Unassigned"} · {device.assigned_email}
            </p>
          </div>
          <AutoRefresh intervalSeconds={15} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`} />
            {online ? "Online" : "Offline"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Open alerts</p>
          <p className={`mt-1 text-sm font-medium ${openAlertCount > 0 ? "text-rose-600" : ""}`}>
            {openAlertCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Agent version</p>
          <p className="mt-1 text-sm font-medium">
            {device.agent_version ? `v${device.agent_version}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Last seen</p>
          <p className="mt-1 text-sm font-medium">
            {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "never"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Alerts</h2>
        </div>
        <AlertsList
          alerts={alerts ?? []}
          deviceMap={deviceMap}
          isSuperadmin={session.profile.role === "superadmin"}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-medium text-slate-800">Daily summary</h2>
          <p className="text-xs text-slate-400">
            Non-assigned email/WhatsApp time, per day, on this PC.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="p-3">Date</th>
                <th className="p-3">Identity</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Opened</th>
                <th className="p-3">Total time</th>
                <th className="p-3">In foreground</th>
              </tr>
            </thead>
            <tbody>
              {(daily ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No mismatch activity recorded yet.
                  </td>
                </tr>
              ) : (
                (daily ?? []).map((row, i) => {
                  const fgPct =
                    row.total_hits > 0 ? Math.round((row.foreground_hits / row.total_hits) * 100) : 0;
                  return (
                    <tr
                      key={`${row.detected_identity}-${row.activity_date}-${i}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="p-3 text-slate-500">{formatDate(row.activity_date)}</td>
                      <td className="p-3">
                        {row.channel === "whatsapp" ? formatWhatsAppIdentity(row.detected_identity) : row.detected_identity}
                      </td>
                      <td className="p-3 capitalize">{row.channel}</td>
                      <td className="p-3">
                        {row.session_count} time{row.session_count === 1 ? "" : "s"}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {formatDuration(row.total_duration_seconds)}
                      </td>
                      <td className="p-3 text-slate-500">{fgPct}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="font-medium text-slate-800">Timeline</h2>
            <p className="text-xs text-slate-400">
              Every app/tab window title seen on this PC — titles only, never content.
            </p>
          </div>
          <DateNav date={date} prevDate={shiftDate(date, -1)} nextDate={shiftDate(date, 1)} />
        </div>
        <div className="p-4">
          <TimelineTable
            rows={(activityRows ?? []) as WindowActivity[]}
            emptyMessage={`No activity recorded for this device on ${date}.`}
          />
        </div>
      </div>
    </div>
  );
}
