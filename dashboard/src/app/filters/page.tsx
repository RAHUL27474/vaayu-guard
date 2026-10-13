import { requireDeveloper } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { FiltersManager } from "@/components/filters-manager";

export const dynamic = "force-dynamic";

export default async function FiltersPage() {
  await requireDeveloper();
  const supabase = await createClient();

  const [{ data: devices }, { data: filters }] = await Promise.all([
    supabase
      .from("devices")
      .select("id, device_label, hostname, assigned_to_user, assigned_email")
      .order("registered_at", { ascending: false }),
    supabase
      .from("visibility_filters")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Filters</h1>
        <p className="mt-1 text-sm text-slate-500">
          Developer-only. Choose what each PC is allowed to report — matching
          tabs, emails and WhatsApp numbers are never stored and never shown to
          the admin.
        </p>
      </div>
      <FiltersManager devices={devices ?? []} filters={filters ?? []} />
    </div>
  );
}
