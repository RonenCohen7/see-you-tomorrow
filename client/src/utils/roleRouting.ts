import type { Role } from "../types/models";

/**
 * Where each role lands by default after login / when blocked from a manager-only page.
 * Regular employees see only Calendar, Meeting rooms, Preferences, Profile, Settings —
 * sending them to /dashboard would either show nothing useful or trigger a redirect loop
 * with the route guards.
 */
export function defaultLandingForRole(role: Role | null | undefined): string {
  if (role === "employee") return "/calendar";
  return "/dashboard";
}
