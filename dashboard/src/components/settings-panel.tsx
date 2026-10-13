"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeSecretCode } from "@/lib/actions/settings-actions";

export function SettingsPanel({
  which,
  title,
  description,
  command,
  code,
  updatedAt,
}: {
  which: "uninstall" | "developer";
  title: string;
  description: string;
  command: string;
  code: string;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"password" | "choose">("password");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setStep("password");
    setPassword("");
    setMode("random");
    setCustomCode("");
    setError(null);
  }

  function toChoose() {
    setError(null);
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setStep("choose");
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await changeSecretCode({
        which,
        password,
        mode,
        customCode: mode === "manual" ? customCode : undefined,
      });
      if (!res.ok) {
        // A wrong password is only known once the server checks it, so bounce
        // back to the password step to make the fix obvious.
        setError(res.error ?? "Could not change the code.");
        if (res.error === "Incorrect password.") setStep("password");
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
        <code className="mt-2 block break-all rounded bg-slate-50 p-2 text-lg font-semibold">
          {code}
        </code>
        <p className="mt-2 text-xs text-slate-500">
          {description} <code>{command}</code>. Changing it takes
          effect on each PC at its next check-in.
        </p>
        {updatedAt ? (
          <p className="mt-1 text-xs text-slate-400">
            Last changed {new Date(updatedAt).toLocaleString()}.
          </p>
        ) : null}
        <button
          onClick={() => setOpen(true)}
          className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          Change code
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Change {title.toLowerCase()}</h2>
              <button onClick={reset} className="text-sm text-slate-400 hover:underline">
                Close
              </button>
            </div>

            {step === "password" ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  For security, confirm your password (the one you logged in with).
                </p>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && toChoose()}
                  placeholder="Your password"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                <div className="flex justify-end gap-2">
                  <button onClick={reset} className="rounded-md px-3 py-1.5 text-sm text-slate-600">
                    Cancel
                  </button>
                  <button
                    onClick={toChoose}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "random"}
                      onChange={() => setMode("random")}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">Generate a random code</span>
                      <span className="block text-xs text-slate-500">
                        A new secure code like <code>VGAB-CDEF-GHJK</code> is created for you.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "manual"}
                      onChange={() => setMode("manual")}
                      className="mt-1"
                    />
                    <span className="w-full">
                      <span className="font-medium">Set it myself</span>
                      <input
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        onFocus={() => setMode("manual")}
                        placeholder="Enter a code (6–64 characters)"
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </span>
                  </label>
                </div>
                {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setStep("password")}
                    className="rounded-md px-3 py-1.5 text-sm text-slate-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={submit}
                    disabled={pending}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save new code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
