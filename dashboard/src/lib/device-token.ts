import { randomBytes, createHash, timingSafeEqual } from "crypto";

/** A fresh random token (hex) to hand to a device — shown to the admin once. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifyToken(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(token));
  const stored = Buffer.from(storedHash);
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}

/** Pull the bearer token out of an Authorization header, or null. */
export function bearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}
