import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export type Role = "admin" | "superadmin";

/** True for either role — superadmin is always a superset of admin. */
export function isAdminLike(role: Role): boolean {
  return role === "admin" || role === "superadmin";
}

export function isSuperadmin(role: Role): boolean {
  return role === "superadmin";
}

/** Allow only the listed roles; everyone else is sent to /login. */
export async function requireRoles(allowed: Role[]): Promise<SessionUser> {
  const s = await getSessionUser();
  if (!s) redirect("/login");
  const role = s.profile.role as Role;
  const effectiveAllowed =
    allowed.includes("admin") && !allowed.includes("superadmin")
      ? [...allowed, "superadmin" as Role]
      : allowed;
  if (!effectiveAllowed.includes(role)) redirect("/login");
  return s;
}

/** Any signed-in dashboard user (admin or superadmin). */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRoles(["admin"]);
}

/** Superadmin only — device enrollment, token rotation, disabling PCs. */
export async function requireSuperadmin(): Promise<SessionUser> {
  return requireRoles(["superadmin"]);
}
