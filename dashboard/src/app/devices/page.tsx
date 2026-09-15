import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { DevicesList } from "@/components/devices-list";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const session = await requireAdmin();
  const supabase = await createClient();

  const [{ data: devices }, { data: openAlerts }] = await Promise.all([
    supabase.from("devices").select("*").order("registered_at", { ascending: false }),
    supabase.from("alerts").select("device_id").eq("status", "open"),
  ]);

  const openAlertCounts: Record<string, number> = {};
  for (const a of openAlerts ?? []) {
    openAlertCounts[a.device_id] = (openAlertCounts[a.device_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Devices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Company PCs enrolled in identity monitoring.
          </p>
        </div>
        <AutoRefresh intervalSeconds={20} />
      </div>
      <DevicesList
        devices={devices ?? []}
        isSuperadmin={session.profile.role === "superadmin"}
        openAlertCounts={openAlertCounts}
      />
    </div>
  );
}
