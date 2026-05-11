import type { NextFunction, Request, Response } from "express";
import { AppError, isAppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function routeLabel(req: Request): string {
  return `${req.method} ${req.originalUrl ?? req.url}`;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const label = routeLabel(req);

  if (isAppError(err)) {
    logger.warn(`${label} → HTTP ${err.statusCode}${err.code ? ` ${err.code}` : ""}: ${err.message}`, err.details);
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err instanceof Error) {
    logger.error(`${label} → unhandled ${err.name}: ${err.message}`, err.stack ?? err);
  } else {
    logger.error(`${label} → unhandled`, err);
  }
  return res.status(500).json({ error: "שגיאת שרת", code: "INTERNAL" });
}
