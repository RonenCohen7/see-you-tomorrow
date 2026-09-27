import { getRequestTenantSlug } from "./tenantContext.js";

/**
 * Database prefix for the current request, else TENANT_DB_PREFIX.
 * `acme` → `acme_`. Empty string means the legacy unprefixed databases.
 */
export function getTenantDbPrefix(): string {
  const fromRequest = getRequestTenantSlug();
  const raw = (fromRequest || process.env.TENANT_DB_PREFIX?.trim() || "").trim();
  if (!raw) return "";
  return raw.endsWith("_") ? raw : `${raw}_`;
}

function resolveDbNames() {
  const prefix = getTenantDbPrefix();
  return {
    auth: `${prefix}syt_auth`,
    employees: `${prefix}syt_employees`,
    departments: `${prefix}syt_departments`,
    locations: `${prefix}syt_locations`,
    schedules: `${prefix}syt_schedules`,
    notifications: `${prefix}syt_notifications`,
    settings: `${prefix}syt_settings`,
  } as const;
}

type DbNames = ReturnType<typeof resolveDbNames>;

/** Resolved on each access so a shared process can serve a different company per request. */
export function getDbNames(): DbNames {
  return resolveDbNames();
}

/** MongoDB database names per bounded context (lazy — reads TENANT_DB_PREFIX on first access). */
export const DB_NAMES: DbNames = new Proxy({} as DbNames, {
  get(_target, prop: string) {
    return getDbNames()[prop as keyof DbNames];
  },
});

/** Central platform registry (tenant routing, email membership, invites). Not tenant-prefixed. */
export const PLATFORM_DB = "syt_platform";
