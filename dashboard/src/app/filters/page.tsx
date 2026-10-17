import { requireDeveloper } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { FiltersManager } from "@/components/filters-manager";

export const dynamic = "force-dynamic";

export default async function FiltersPage() {
  await requireDeveloper();
  const supabase = await createClient();

  const [{ data: devices }, { data: filters }, { data: recent }] = await Promise.all([
    supabase
      .from("devices")
      .select("id, device_label, hostname, assigned_to_user, assigned_email")
      .order("registered_at", { ascending: false }),
    supabase
      .from("visibility_filters")
      .select("*")
      .order("created_at", { ascending: false }),
    // Recent activity, only to suggest real values (apps, browser profiles and
    // their signed-in emails) each PC has reported when adding a rule.
    supabase
      .from("window_activity")
      .select("device_id, process_name, browser_profile, account_email")
      .order("captured_at", { ascending: false })
      .limit(3000),
  ]);

  const suggestions: Record<string, { apps: string[]; profiles: string[] }> = {};
  for (const r of recent ?? []) {
    const s = (suggestions[r.device_id] ??= { apps: [], profiles: [] });
    if (r.process_name && !s.apps.includes(r.process_name)) s.apps.push(r.process_name);
    for (const p of [r.account_email, r.browser_profile]) {
      if (p && !s.profiles.includes(p)) s.profiles.push(p);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Filters</h1>
        <p className="mt-1 text-sm text-muted">
          Developer-only. Choose what each PC is allowed to report — matching
          tabs, emails, WhatsApp numbers, whole browser profiles or whole apps
          are never stored and never shown to the admin.
        </p>
      </div>
      <FiltersManager devices={devices ?? []} filters={filters ?? []} suggestions={suggestions} />
    </div>
  );
}
