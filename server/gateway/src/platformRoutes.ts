import { Router } from "express";
import {
  AppError,
  getTenantBySlug,
  normalizeEmail,
  resolveTenantsForAuth,
} from "@syt/shared";
import type { Request, Response } from "express";

const r = Router();

/** Resolve active tenant(s) for login routing (central gateway). */
r.get("/tenants/resolve", async (req: Request, res: Response) => {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  const tenantSlug = typeof req.query.tenantSlug === "string" ? req.query.tenantSlug : undefined;
  const inviteToken = typeof req.query.inviteToken === "string" ? req.query.inviteToken : undefined;

  if (!email.trim()) {
    throw new AppError(400, "נדרש אימייל", "EMAIL_REQUIRED");
  }

  const tenants = await resolveTenantsForAuth({
    email,
    tenantSlug,
    inviteToken,
  });

  res.json({
    email: normalizeEmail(email),
    tenants: tenants.map((t) => ({
      slug: t.slug,
      name: t.name,
      gatewayUrl: t.gatewayUrl,
      subdomain: t.subdomain,
    })),
  });
});

/** Validate company slug before login (optional UX helper). */
r.get("/tenants/by-slug/:slug", async (req: Request, res: Response) => {
  const tenant = await getTenantBySlug(req.params.slug ?? "");
  if (!tenant) {
    res.status(404).json({ error: "חברה לא נמצאה", code: "TENANT_NOT_FOUND" });
    return;
  }
  res.json({ slug: tenant.slug, name: tenant.name, gatewayUrl: tenant.gatewayUrl });
});

export const platformRoutes = r;
