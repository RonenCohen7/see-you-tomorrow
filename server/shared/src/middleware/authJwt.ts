import type { NextFunction, Request, Response } from "express";
import { isSharedSaasMode } from "../config/tenantContext.js";
import { AppError } from "../utils/errors.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { Role } from "../types/roles.js";

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: Role; tenant?: string };
}

export function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractBearer(req);
    if (!token) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
    const payload = verifyAccessToken(token);
    if (!payload.sub || !payload.role || !payload.email) {
      throw new AppError(401, "אסימון לא תקין", "INVALID_TOKEN");
    }
    if (isSharedSaasMode() && !payload.tenant) {
      throw new AppError(401, "ההתחברות ישנה. התחברו מחדש.", "TENANT_REQUIRED");
    }
    req.user = { id: payload.sub, email: payload.email, role: payload.role, tenant: payload.tenant };
    next();
  } catch {
    next(new AppError(401, "אסימון פג תוקף או לא תקין", "UNAUTHORIZED"));
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractBearer(req);
    if (!token) return next();
    const payload = verifyAccessToken(token);
    if (payload.sub && payload.role && payload.email) {
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
    }
    next();
  } catch {
    next();
  }
}
