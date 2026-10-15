"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Device } from "@/lib/types/database";
import { createDevice, disableDevice } from "@/lib/actions/device-actions";

function StatusBadge({ status }: { status: Device["status"] }) {
  const styles: Record<Device["status"], string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    disabled: "bg-surface-2 text-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

// Slightly more than 2 poll cycles (default 45s) — long enough that one
// missed check-in doesn't flash "Offline", short enough that a PC that's
// genuinely off/asleep shows it within a couple of minutes.
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function HealthDot({ device, openAlertCount }: { device: Device; openAlertCount: number }) {
  const online =
    !!device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < ONLINE_WINDOW_MS;

  let color = "bg-line-strong"; // offline
  let label = device.last_seen_at ? `Offline — last seen ${timeAgo(device.last_seen_at)}` : "Never seen";
  if (online && openAlertCount > 0) {
    color = "bg-rose-500";
    label = `Online — ${openAlertCount} open alert${openAlertCount === 1 ? "" : "s"}`;
  } else if (online) {
    color = "bg-emerald-500";
    label = "Online — clean";
  }

  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      {/* Dot only on phones — the label is in the title tooltip. */}
      <span className="hidden text-xs text-muted sm:inline">{label}</span>
    </span>
  );
}

export function DevicesList({
  devices,
  isDeveloper,
  canAddDevice = isDeveloper,
  canDisableDevice = isDeveloper,
  openAlertCounts,
}: {
  devices: Device[];
  isDeveloper: boolean;
  canAddDevice?: boolean;
  canDisableDevice?: boolean;
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
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            Enrollment token (shown once — copy it now):
          </p>
          <code className="mt-2 block break-all rounded bg-surface p-2 text-xs">
            {issuedToken}
          </code>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
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

      {canAddDevice ? (
        <div>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-fg"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "Add device"}
          </button>
          {showForm ? (
            <form
              onSubmit={submit}
              className="mt-3 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
            >
              <div>
                <label className="block text-xs font-medium text-muted">
                  Device label
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Reception Desk 2"
                  className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">
                  Assigned to (name)
                </label>
                <input
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">
                  Assigned company email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">
                  Assigned WhatsApp number
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91…"
                  className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm"
                />
              </div>
              {error ? (
                <p className="text-sm text-rose-600 sm:col-span-2 dark:text-rose-400">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="w-fit rounded-md bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50 sm:col-span-2"
              >
                {pending ? "Creating…" : "Create device + issue token"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
              <th className="p-3">Health</th>
              <th className="p-3">Device</th>
              <th className="hidden p-3 md:table-cell">Assigned to</th>
              <th className="hidden p-3 lg:table-cell">Assigned email</th>
              <th className="p-3">Status</th>
              <th className="hidden p-3 sm:table-cell">Last seen</th>
              <th className="hidden p-3 xl:table-cell">Consent</th>
              <th className="hidden p-3 lg:table-cell">Version</th>
              {canDisableDevice ? <th className="p-3 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted">
                  No devices enrolled yet.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} className="border-b border-line-soft last:border-0">
                  <td className="p-3">
                    <HealthDot device={d} openAlertCount={openAlertCounts[d.id] ?? 0} />
                  </td>
                  <td className="p-3 font-medium">
                    <Link href={`/devices/${d.id}`} className="text-fg hover:underline">
                      {d.device_label ?? d.hostname ?? "—"}
                    </Link>
                    {/* Columns hidden on small screens, folded in here instead. */}
                    <div className="mt-0.5 space-y-0.5 text-xs font-normal text-muted lg:hidden">
                      {d.assigned_to_user ? <div className="md:hidden">{d.assigned_to_user}</div> : null}
                      <div className="[overflow-wrap:anywhere]">{d.assigned_email}</div>
                    </div>
                  </td>
                  <td className="hidden p-3 md:table-cell">{d.assigned_to_user ?? "—"}</td>
                  <td className="hidden p-3 lg:table-cell">{d.assigned_email}</td>
                  <td className="p-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="hidden p-3 text-muted sm:table-cell">
                    {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "never"}
                  </td>
                  <td className="hidden p-3 text-muted xl:table-cell">
                    {d.consent_acknowledged_at
                      ? new Date(d.consent_acknowledged_at).toLocaleDateString()
                      : "pending"}
                  </td>
                  <td className="hidden p-3 text-muted lg:table-cell">
                    {d.agent_version ? `v${d.agent_version}` : "—"}
                  </td>
                  {canDisableDevice ? (
                    <td className="p-3 text-right">
                      {d.status !== "disabled" ? (
                        <button
                          disabled={pending}
                          onClick={() => disable(d.id)}
                          className="text-xs text-rose-600 hover:underline dark:text-rose-400"
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
