import type { NextFunction, Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";

export function requireManagerOrAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError(401, "נדרשת התחברות", "UNAUTHORIZED"));
  if (req.user.role !== "admin" && req.user.role !== "manager") {
    return next(new AppError(403, "אין הרשאה לדוחות", "FORBIDDEN"));
  }
  next();
}
