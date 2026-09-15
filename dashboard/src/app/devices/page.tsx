import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { DevicesList } from "@/components/devices-list";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const session = await requireAdmin();
  const supabase = await createClient();

  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .order("registered_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Devices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Company PCs enrolled in identity monitoring.
        </p>
      </div>
      <DevicesList
        devices={devices ?? []}
        isSuperadmin={session.profile.role === "superadmin"}
      />
    </div>
  );
}
