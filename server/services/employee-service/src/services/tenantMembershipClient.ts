import { syncEmailMembership } from "@syt/shared";

export async function syncTenantMembership(email: string, isActive: boolean): Promise<void> {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  if (!tenantSlug) return;
  try {
    await syncEmailMembership({ email, tenantSlug, isActive });
  } catch {
    // Platform DB optional for single-tenant dev; don't block employee CRUD.
  }
}
