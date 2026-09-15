import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

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

  const { data: rows } = activeDeviceId
    ? await supabase
        .from("window_activity")
        .select("*")
        .eq("device_id", activeDeviceId)
        .order("captured_at", { ascending: false })
        .limit(300)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every app/tab window title seen on a PC — general activity log,
          not just email/WhatsApp mismatches. Titles only, never content.
        </p>
      </div>

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
        {(devices ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No devices enrolled yet.</p>
        ) : null}
      </div>

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
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  No activity recorded yet for this device.
                </td>
              </tr>
            ) : (
              (rows ?? []).map((r) => (
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
    </div>
  );
}
