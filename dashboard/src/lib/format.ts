/** "1h 24m", "45m", or "38s" — never shows more than two units. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/**
 * "919876543210" -> "+91 98765 43210". Falls back to the raw value for
 * anything that doesn't look like a plain 10-digit-plus-91-country-code
 * number, so the coarse "whatsapp_web_open" placeholder (no number known
 * yet) still displays as-is instead of being mangled.
 */
export function formatWhatsAppIdentity(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === raw.length && digits.length >= 10) return `+${digits}`;
  return raw;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
