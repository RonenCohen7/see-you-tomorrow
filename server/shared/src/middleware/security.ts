import type { Application, NextFunction, Request, Response } from "express";
import type { Server } from "http";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";

const isProd = process.env.NODE_ENV === "production";

function hasPollutionKeys(value: unknown, depth = 0): boolean {
  if (depth > 14) return false;
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((v) => hasPollutionKeys(v, depth + 1));
  }
  for (const key of Object.keys(value as object)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") return true;
    if (hasPollutionKeys((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}

/**
 * Helmet, trust proxy, disable X-Powered-By. Mount before body parsers.
 * CSP/HSTS apply in production; dev keeps CSP off for API-only responses.
 */
export function applySecurityMiddleware(app: Application): void {
  app.disable("x-powered-by");
  if (process.env.RATE_LIMIT_TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: isProd
        ? {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
    })
  );
}

/** Mount after express.json() — scans body and query for prototype-pollution keys. */
export function rejectPrototypePollution(req: Request, res: Response, next: NextFunction): void {
  if (hasPollutionKeys(req.body) || hasPollutionKeys(req.query)) {
    res.status(400).json({ error: "בקשה לא תקינה", code: "BAD_INPUT" });
    return;
  }
  next();
}

export const mongoSanitizeMiddleware = mongoSanitize();

export function applyServerTimeouts(server: Server): void {
  server.requestTimeout = 60_000;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 61_000;
}
