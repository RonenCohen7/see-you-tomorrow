import { getRequestTenantSlug } from "../config/tenantContext.js";

/** Headers for service-to-service calls. Forwards the current company so the callee opens the same databases. */
export function internalServiceHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "",
    ...extra,
  };
  const slug = getRequestTenantSlug();
  if (slug) headers["x-tenant-slug"] = slug;
  return headers;
}
