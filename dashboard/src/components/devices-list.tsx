"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Device } from "@/lib/types/database";
import { createDevice, disableDevice } from "@/lib/actions/device-actions";

function StatusBadge({ status }: { status: Device["status"] }) {
  const styles: Record<Device["status"], string> = {
    pending: "bg-amber-100 text-amber-700",
    active: "bg-emerald-100 text-emerald-700",
    disabled: "bg-slate-200 text-slate-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function HealthDot({ device, openAlertCount }: { device: Device; openAlertCount: number }) {
  const online =
    !!device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < ONLINE_WINDOW_MS;

  let color = "bg-slate-300"; // offline
  let label = "Offline";
  if (online && openAlertCount > 0) {
    color = "bg-rose-500";
    label = `Online — ${openAlertCount} open alert${openAlertCount === 1 ? "" : "s"}`;
  } else if (online) {
    color = "bg-emerald-500";
    label = "Online — clean";
  }

  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </span>
  );
}

export function DevicesList({
  devices,
  isSuperadmin,
  openAlertCounts,
}: {
  devices: Device[];
  isSuperadmin: boolean;
  openAlertCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createDevice({
        deviceLabel: label,
        assignedEmail: email,
        assignedPhone: phone,
        assignedToUser: assignedTo,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not create device");
        return;
      }
      setIssuedToken(res.token ?? null);
      setLabel("");
      setEmail("");
      setPhone("");
      setAssignedTo("");
      router.refresh();
    });
  }

  function disable(id: string) {
    startTransition(async () => {
      await disableDevice(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {issuedToken ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <p className="font-medium text-emerald-800">
            Enrollment token (shown once — copy it now):
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs">
            {issuedToken}
          </code>
          <p className="mt-2 text-xs text-emerald-700">
            Paste this into the agent&apos;s <code>install.ps1</code> on the
            target PC. It cannot be shown again.
          </p>
          <button
            className="mt-2 text-xs underline"
            onClick={() => setIssuedToken(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {isSuperadmin ? (
        <div>
          <button
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "Add device"}
          </button>
          {showForm ? (
            <form
              onSubmit={submit}
              className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  Device label
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Reception Desk 2"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  Assigned to (name)
                </label>
                <input
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  Assigned company email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  Assigned WhatsApp number
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91…"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {error ? (
                <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="w-fit rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:col-span-2"
              >
                {pending ? "Creating…" : "Create device + issue token"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="p-3">Health</th>
              <th className="p-3">Label</th>
              <th className="p-3">Assigned to</th>
              <th className="p-3">Assigned email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last seen</th>
              <th className="p-3">Consent</th>
              <th className="p-3">Version</th>
              {isSuperadmin ? <th className="p-3 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  No devices enrolled yet.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3">
                    <HealthDot device={d} openAlertCount={openAlertCounts[d.id] ?? 0} />
                  </td>
                  <td className="p-3 font-medium">{d.device_label ?? d.hostname ?? "—"}</td>
                  <td className="p-3">{d.assigned_to_user ?? "—"}</td>
                  <td className="p-3">{d.assigned_email}</td>
                  <td className="p-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="p-3 text-slate-500">
                    {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "never"}
                  </td>
                  <td className="p-3 text-slate-500">
                    {d.consent_acknowledged_at
                      ? new Date(d.consent_acknowledged_at).toLocaleDateString()
                      : "pending"}
                  </td>
                  <td className="p-3 text-slate-500">
                    {d.agent_version ? `v${d.agent_version}` : "—"}
                  </td>
                  {isSuperadmin ? (
                    <td className="p-3 text-right">
                      {d.status !== "disabled" ? (
                        <button
                          disabled={pending}
                          onClick={() => disable(d.id)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Disable
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
