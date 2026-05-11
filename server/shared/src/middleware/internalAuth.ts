import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";

/** Validates service-to-service calls via shared secret header */
export function requireInternalSecret(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_SERVICE_SECRET;
  const got = req.headers["x-internal-secret"] as string | undefined;
  if (!expected || got !== expected) {
    return next(new AppError(403, "שירות פנימי לא מאומת", "FORBIDDEN_INTERNAL"));
  }
  next();
}
