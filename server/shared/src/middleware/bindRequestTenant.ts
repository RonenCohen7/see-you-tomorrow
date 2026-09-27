import type { NextFunction, Response } from "express";
import { isSharedSaasMode, runWithTenant } from "../config/tenantContext.js";
import { AppError } from "../utils/errors.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { extractBearer, type AuthRequest } from "./authJwt.js";

export const TENANT_HEADER = "x-tenant-slug";

function isTenantOptional(req: AuthRequest): boolean {
  const path = req.path || "/";
  if (path === "/health" || req.originalUrl.split("?")[0] === "/health") return true;
  if (req.method === "POST" && (path === "/register-organization" || path.endsWith("/register-organization"))) {
    return true;
  }
  return false;
}

function isTenantScoped(req: AuthRequest): boolean {
  const path = req.originalUrl.split("?")[0] ?? "";
  return path.startsWith("/api/") || path.startsWith("/internal/") || path === "/internal";
}

/**
 * Selects the company database for this request.
 * Browser clients cannot choose another company: a JWT tenant wins, and it must match the header.
 */
export function bindRequestTenant(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = (req.header(TENANT_HEADER) ?? "").trim().toLowerCase();
  let jwtTenant = "";
  const token = extractBearer(req);
  if (token) {
    try {
      jwtTenant = (verifyAccessToken(token).tenant ?? "").trim().toLowerCase();
    } catch {
      jwtTenant = "";
    }
  }

  if (jwtTenant && header && jwtTenant !== header) {
    next(new AppError(403, "הבקשה שייכת לחברה אחרת", "TENANT_MISMATCH"));
    return;
  }

  if (!isSharedSaasMode()) {
    const expected = (process.env.TENANT_SLUG ?? "").trim().toLowerCase();
    const claimed = jwtTenant || header;
    if (claimed && expected && claimed !== expected) {
      next(new AppError(403, "הבקשה שייכת לחברה אחרת", "TENANT_MISMATCH"));
      return;
    }
    next();
    return;
  }

  const slug = jwtTenant || header;
  if (isSharedSaasMode() && !slug && !isTenantOptional(req) && isTenantScoped(req)) {
    next(new AppError(401, "חסר זיהוי חברה. התחברו מחדש.", "TENANT_REQUIRED"));
    return;
  }

  if (!slug) {
    next();
    return;
  }

  runWithTenant(slug, () => next());
}
