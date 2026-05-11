import type { NextFunction, Response } from "express";
import { AppError } from "../utils/errors.js";
import type { Role } from "../types/roles.js";
import type { AuthRequest } from "./authJwt.js";

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "נדרשת התחברות", "UNAUTHORIZED"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "אין הרשאה לפעולה זו", "FORBIDDEN"));
    }
    next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireRoles("admin")(req, res, next);
}
