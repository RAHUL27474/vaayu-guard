// Developer-defined hide-list matching, used by the agent check-in endpoint
// to drop sightings before they are ever stored. See migration 0009.

export type FilterRule = {
  target: "tab" | "email" | "whatsapp";
  pattern: string;
};

const digitsOnly = (s: string) => s.replace(/\D+/g, "");

/**
 * True if a sighting should be hidden (dropped, never stored) under any of
 * the given rules.
 *
 * - `tab` / `email`: case-insensitive substring match against the window
 *   title and (for email) the detected identity.
 * - `whatsapp`: digits-only comparison, so "+91 98765 43210", "9876543210"
 *   and "919876543210" all match the same rule.
 */
export function isHidden(
  windowTitle: string,
  detectedIdentity: string | null | undefined,
  rules: FilterRule[]
): boolean {
  if (rules.length === 0) return false;

  const title = (windowTitle ?? "").toLowerCase();
  const identity = (detectedIdentity ?? "").toLowerCase();
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
    return title.includes(p) || identity.includes(p);
  });
}
