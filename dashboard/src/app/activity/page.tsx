import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { Device } from "@/lib/types/database";
import { formatDuration, formatDate, formatWhatsAppIdentity } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: daily }, { data: openSessions }, { data: devices }] = await Promise.all([
    supabase
      .from("daily_identity_activity")
      .select("*")
      .order("activity_date", { ascending: false })
      .limit(200),
    supabase
      .from("sessions")
      .select("*")
      .is("ended_at", null)
      .order("started_at", { ascending: false }),
    supabase.from("devices").select("id, device_label, hostname, assigned_to_user"),
  ]);

  const deviceMap: Record<string, Pick<Device, "id" | "device_label" | "hostname" | "assigned_to_user">> =
    Object.fromEntries((devices ?? []).map((d) => [d.id, d]));

  function deviceName(id: string) {
    const d = deviceMap[id];
    return d?.device_label ?? d?.hostname ?? id.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="mt-1 text-sm text-muted">
          How long non-assigned emails/WhatsApp stayed open, per device per day.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line p-4">
          <h2 className="font-medium text-fg-2">
            Currently open ({openSessions?.length ?? 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                <th className="p-3">Device</th>
                <th className="p-3">Identity</th>
                <th className="hidden p-3 sm:table-cell">Channel</th>
                <th className="p-3">Since</th>
              </tr>
            </thead>
            <tbody>
              {(openSessions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted">
                    Nothing open right now.
                  </td>
                </tr>
              ) : (
                (openSessions ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-line-soft last:border-0">
                    <td className="p-3 font-medium">{deviceName(s.device_id)}</td>
                    <td className="p-3 break-all">
                      {s.channel === "whatsapp" ? formatWhatsAppIdentity(s.detected_identity) : s.detected_identity}
                    </td>
                    <td className="hidden p-3 capitalize sm:table-cell">{s.channel}</td>
                    <td className="p-3 text-muted">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line p-4">
          <h2 className="font-medium text-fg-2">Daily summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                <th className="p-3">Date</th>
                <th className="p-3">Device</th>
                <th className="p-3">Identity</th>
                <th className="hidden p-3 md:table-cell">Channel</th>
                <th className="hidden p-3 md:table-cell">Opened</th>
                <th className="p-3">Total time</th>
                <th className="hidden p-3 sm:table-cell">In foreground</th>
              </tr>
            </thead>
            <tbody>
              {(daily ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                (daily ?? []).map((row, i) => {
                  const fgPct =
                    row.total_hits > 0
                      ? Math.round((row.foreground_hits / row.total_hits) * 100)
                      : 0;
                  return (
                    <tr
                      key={`${row.device_id}-${row.detected_identity}-${row.activity_date}-${i}`}
                      className="border-b border-line-soft last:border-0"
                    >
                      <td className="p-3 text-muted">{formatDate(row.activity_date)}</td>
                      <td className="p-3 font-medium">{deviceName(row.device_id)}</td>
                      <td className="p-3 break-all">
                        {row.channel === "whatsapp" ? formatWhatsAppIdentity(row.detected_identity) : row.detected_identity}
                      </td>
                      <td className="hidden p-3 capitalize md:table-cell">{row.channel}</td>
                      <td className="hidden p-3 md:table-cell">
                        {row.session_count} time{row.session_count === 1 ? "" : "s"}
                      </td>
                      <td className="p-3 font-semibold text-fg-2">
                        {formatDuration(row.total_duration_seconds)}
                      </td>
                      <td className="hidden p-3 text-muted sm:table-cell">{fgPct}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
