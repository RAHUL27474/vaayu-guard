import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export type Role = "admin" | "developer";

/** True for either role — developer is always a superset of admin. */
export function isAdminLike(role: Role): boolean {
  return role === "admin" || role === "developer";
}

export function isDeveloper(role: Role): boolean {
  return role === "developer";
}

/** Allow only the listed roles; everyone else is sent to /login. */
export async function requireRoles(allowed: Role[]): Promise<SessionUser> {
  const s = await getSessionUser();
  if (!s) redirect("/login");
  const role = s.profile.role as Role;
  const effectiveAllowed =
    allowed.includes("admin") && !allowed.includes("developer")
      ? [...allowed, "developer" as Role]
      : allowed;
  if (!effectiveAllowed.includes(role)) redirect("/login");
  return s;
}

/** Any signed-in dashboard user (admin or developer). */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRoles(["admin"]);
}

/** Developer only — token rotation and other dev-team-only controls. */
export async function requireDeveloper(): Promise<SessionUser> {
  return requireRoles(["developer"]);
}
