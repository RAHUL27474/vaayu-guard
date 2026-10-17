// Developer-defined hide-list matching, used by the agent check-in endpoint
// to drop sightings before they are ever stored. See migrations 0009, 0013
// and 0014.

export type FilterRule = {
  target: "tab" | "email" | "whatsapp" | "profile" | "app";
  pattern: string;
};

const digitsOnly = (s: string) => s.replace(/\D+/g, "");
const stripExe = (s: string) => s.replace(/\.exe$/, "");

/**
 * True if a sighting should be hidden (dropped, never stored) under any of
 * the given rules.
 *
 * - `tab` / `email`: case-insensitive substring match against the window
 *   title and (for email) the detected identity.
 * - `whatsapp`: digits-only comparison, so "+91 98765 43210", "9876543210"
 *   and "919876543210" all match the same rule.
 * - `profile`: exact (trimmed, case-insensitive) match against the window's
 *   browser profile name (e.g. "Person 2") OR the account email signed in to
 *   it. Only ever matches rows that carry a profile/account — anything else is
 *   never hidden by a profile rule.
 * - `app`: exact (case-insensitive) match against the process name
 *   ("chrome", "WhatsApp"); a trailing ".exe" is ignored on either side.
 */
export function isHidden(
  windowTitle: string,
  detectedIdentity: string | null | undefined,
  rules: FilterRule[],
  browserProfile?: string | null,
  extra?: { processName?: string | null; accountEmail?: string | null }
): boolean {
  if (rules.length === 0) return false;

  const title = (windowTitle ?? "").toLowerCase();
  const identity = (detectedIdentity ?? "").toLowerCase();
  const profile = (browserProfile ?? "").trim().toLowerCase();
  const account = (extra?.accountEmail ?? "").trim().toLowerCase();
  const app = stripExe((extra?.processName ?? "").trim().toLowerCase());
  const titleDigits = digitsOnly(windowTitle ?? "");
  const identityDigits = digitsOnly(detectedIdentity ?? "");

  return rules.some((r) => {
    const pattern = r.pattern?.trim();
    if (!pattern) return false;

    if (r.target === "whatsapp") {
      const p = digitsOnly(pattern);
      if (!p) return false;
      return titleDigits.includes(p) || identityDigits.includes(p);
    }

    const p = pattern.toLowerCase();
    // `tab` matches the title only; `email` also checks the detected identity.
    if (r.target === "tab") return title.includes(p);
    // Exact matches, so "Person 2" doesn't also silence "Person 20".
    if (r.target === "profile") {
      return (profile.length > 0 && profile === p) || (account.length > 0 && account === p);
    }
    if (r.target === "app") return app.length > 0 && app === stripExe(p);
    return title.includes(p) || identity.includes(p);
  });
}
