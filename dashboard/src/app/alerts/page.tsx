import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AlertsList } from "@/components/alerts-list";
import { AutoRefresh } from "@/components/auto-refresh";
import type { Device } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: alerts }, { data: devices }] = await Promise.all([
    supabase.from("alerts").select("*").order("last_seen_at", { ascending: false }),
    supabase.from("devices").select("id, device_label, hostname, assigned_to_user"),
  ]);

  const deviceMap = new Map(
    (devices ?? []).map((d) => [d.id, d as Pick<Device, "id" | "device_label" | "hostname" | "assigned_to_user">])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Non-assigned email/WhatsApp activity detected on company PCs.
          </p>
        </div>
        <AutoRefresh intervalSeconds={15} />
      </div>
      <AlertsList alerts={alerts ?? []} deviceMap={Object.fromEntries(deviceMap)} />
    </div>
  );
}
