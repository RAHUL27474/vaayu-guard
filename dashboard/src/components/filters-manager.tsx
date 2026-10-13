"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Device, VisibilityFilter } from "@/lib/types/database";
import { createFilter, deleteFilter, setFilterActive } from "@/lib/actions/filter-actions";

type DeviceLite = Pick<Device, "id" | "device_label" | "hostname" | "assigned_to_user" | "assigned_email">;

const TARGET_LABEL: Record<VisibilityFilter["target"], string> = {
  tab: "Tab / site",
  email: "Email address",
  whatsapp: "WhatsApp number",
};

function deviceName(d: DeviceLite): string {
  return d.device_label ?? d.hostname ?? d.assigned_email ?? d.id.slice(0, 8);
}

export function FiltersManager({
  devices,
  filters,
}: {
  devices: DeviceLite[];
  filters: VisibilityFilter[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [target, setTarget] = useState<VisibilityFilter["target"]>("tab");
  const [pattern, setPattern] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const byDevice = new Map<string, VisibilityFilter[]>();
  for (const f of filters) {
    const list = byDevice.get(f.device_id) ?? [];
    list.push(f);
    byDevice.set(f.device_id, list);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!deviceId) {
      setError("Select a device first");
      return;
    }
    startTransition(async () => {
      const res = await createFilter({ deviceId, target, pattern, note });
      if (!res.ok) {
        setError(res.error ?? "Could not add rule");
        return;
      }
      setPattern("");
      setNote("");
      router.refresh();
    });
  }

  function toggle(id: number, active: boolean) {
    startTransition(async () => {
      await setFilterActive(id, active);
      router.refresh();
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      await deleteFilter(id);
      router.refresh();
    });
  }

  if (devices.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
        No devices enrolled yet. Add a device first, then you can filter what it reports.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={add}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500">Device</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {deviceName(d)}
                {d.assigned_to_user ? ` — ${d.assigned_to_user}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Hide by</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as VisibilityFilter["target"])}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="tab">Tab / site (matches window title)</option>
            <option value="email">Email address</option>
            <option value="whatsapp">WhatsApp number</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            {target === "tab"
              ? "Keyword / domain (e.g. facebook.com)"
              : target === "email"
                ? "Email address (or part of it)"
                : "WhatsApp number"}
          </label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={
              target === "tab" ? "facebook.com" : target === "email" ? "someone@gmail.com" : "+91…"
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="why this is hidden"
          />
        </div>
        {error ? <p className="text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:col-span-2"
        >
          {pending ? "Adding…" : "Add hide rule"}
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Matching tabs, emails and WhatsApp numbers are dropped at the agent&apos;s
        next check-in and never stored — the admin never sees them. Existing
        data already stored is not removed.
      </p>

      <div className="space-y-4">
        {devices.map((d) => {
          const rules = byDevice.get(d.id) ?? [];
          return (
            <div key={d.id} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 p-3">
                <span className="font-medium">{deviceName(d)}</span>
                <span className="text-xs text-slate-400">
                  {rules.length} rule{rules.length === 1 ? "" : "s"}
                </span>
              </div>
              {rules.length === 0 ? (
                <p className="p-3 text-sm text-slate-400">
                  Nothing hidden — the admin sees everything from this PC.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {rules.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {TARGET_LABEL[r.target]}
                      </span>
                      <code className={`break-all ${r.active ? "" : "text-slate-400 line-through"}`}>
                        {r.pattern}
                      </code>
                      {r.note ? <span className="text-xs text-slate-400">({r.note})</span> : null}
                      <div className="ml-auto flex items-center gap-3">
                        <button
                          disabled={pending}
                          onClick={() => toggle(r.id, !r.active)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          {r.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => remove(r.id)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
