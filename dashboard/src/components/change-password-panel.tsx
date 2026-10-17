"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "@/lib/actions/auth-actions";

export function ChangePasswordPanel({ email }: { email: string | null }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await changeOwnPassword({ currentPassword: current, newPassword: next });
      if (!res.ok) {
        setError(res.error ?? "Could not change the password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    });
  }

  const inputClass = "w-full rounded-md border border-line-strong px-3 py-2 text-sm";

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-subtle">Your login password</p>
      {email ? (
        <p className="mt-1 text-xs text-muted">
          Signed in as <span className="font-medium">{email}</span>.
        </p>
      ) : null}
      <form
        className="mt-3 max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (min 8 characters)"
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={inputClass}
        />
        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        {done ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Password changed. Use the new one next time you log in.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !current || !next || !confirm}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
