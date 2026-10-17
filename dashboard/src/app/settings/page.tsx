import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { SettingsPanel } from "@/components/settings-panel";
import { ChangePasswordPanel } from "@/components/change-password-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const isDeveloper = session.profile.role === "developer";
  const supabase = await createClient();

  // The developer-access code is only ever selected for (and shown to)
  // developers — an admin never receives it, not even in the page payload.
  const columns = isDeveloper
    ? "uninstall_code, developer_code, updated_at, updated_by"
    : "uninstall_code, updated_at, updated_by";
  const { data: settings } = await supabase
    .from("app_settings")
    .select(columns)
    .maybeSingle<{
      uninstall_code: string;
      developer_code?: string;
      updated_at: string;
      updated_by: string | null;
    }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          {isDeveloper
            ? "Admin and developer can manage the uninstall code; the developer-access code is developer-only."
            : "Manage the agent uninstall code."}
        </p>
      </div>
      {settings ? (
        <div className="space-y-4">
          <SettingsPanel
            which="uninstall"
            title="Agent uninstall code"
            description="Required to uninstall the agent:"
            command={`VaayuGuardAgent.exe --uninstall ${settings.uninstall_code}`}
            code={settings.uninstall_code}
            updatedAt={settings.updated_at}
          />
          {isDeveloper && settings.developer_code ? (
            <SettingsPanel
              which="developer"
              title="Developer-access code"
              description="Opens the local developer panel on a PC:"
              command={`VaayuGuardAgent.exe --dev ${settings.developer_code}`}
              code={settings.developer_code}
              updatedAt={settings.updated_at}
            />
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-surface p-6 text-center text-muted">
          Settings have not been initialised yet (run migration 0010).
        </p>
      )}
      <ChangePasswordPanel email={session.email} />
    </div>
  );
}
