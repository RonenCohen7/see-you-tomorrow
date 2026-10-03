import type { NextFunction, Request, Response } from "express";
import {
  AppError,
  getTenantByInviteToken,
  getTenantBySlug,
  isSharedSaasMode,
  verifyAccessToken,
} from "@syt/shared";
import { resolveAuthTenant } from "./tenantResolver.js";

const AUTH_RESOLVE = new Set(["/login", "/register", "/forgot-password"]);

/**
 * Shared SaaS: the browser cannot pick a company header.
 * The gateway sets `x-tenant-slug` from a verified token or from the company registry.
 */
export function attachSharedTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!isSharedSaasMode()) {
    next();
    return;
  }

  delete req.headers["x-tenant-slug"];

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(auth.slice(7));
      if (payload.tenant) {
        req.headers["x-tenant-slug"] = payload.tenant;
        next();
        return;
      }
    } catch {
      /* expired access token */
    }
  }

  const refresh = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (refresh) {
    try {
      const payload = verifyAccessToken(refresh);
      if (payload.tenant) {
        req.headers["x-tenant-slug"] = payload.tenant;
        next();
        return;
      }
    } catch {
      /* auth service reports invalid refresh */
    }
  }

  const path = req.path || "/";
  if (req.method === "POST" && path === "/register-organization") {
    next();
    return;
  }

  if (req.method === "POST" && path === "/reset-password") {
    const slug = typeof req.body?.tenantSlug === "string" ? req.body.tenantSlug.trim().toLowerCase() : "";
    if (!slug) {
      next(new AppError(400, "חסר קוד חברה לאיפוס הסיסמה", "TENANT_REQUIRED"));
      return;
    }
    void getTenantBySlug(slug)
      .then((tenant) => {
        if (!tenant) {
          next(new AppError(404, "החברה לא נמצאה", "TENANT_NOT_FOUND"));
          return;
        }
        req.headers["x-tenant-slug"] = tenant.slug;
        next();
      })
      .catch(next);
    return;
  }

  if (req.method === "POST" && path === "/register-departments") {
    const slug = typeof req.body?.tenantSlug === "string" ? req.body.tenantSlug.trim().toLowerCase() : "";
    const invite = typeof req.body?.inviteToken === "string" ? req.body.inviteToken.trim() : "";
    if (!slug && !invite) {
      next(new AppError(400, "נדרש קוד חברה או קישור הזמנה", "TENANT_REQUIRED"));
      return;
    }
    void (invite ? getTenantByInviteToken(invite) : getTenantBySlug(slug))
      .then((tenant) => {
        if (!tenant) {
          next(new AppError(404, "החברה לא נמצאה", "TENANT_NOT_FOUND"));
          return;
        }
        req.headers["x-tenant-slug"] = tenant.slug;
        next();
      })
      .catch(next);
    return;
  }

  if (req.method === "POST" && AUTH_RESOLVE.has(path)) {
    void resolveAuthTenant(req)
      .then((tenant) => {
        req.headers["x-tenant-slug"] = tenant.slug;
        next();
      })
      .catch(next);
    return;
  }

  if (req.originalUrl.startsWith("/api/")) {
    next(new AppError(401, "נדרשת התחברות לחברה", "TENANT_REQUIRED"));
    return;
  }
  next();
}
