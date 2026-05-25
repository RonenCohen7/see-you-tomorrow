import {
  applySecurityMiddleware,
  applyServerTimeouts,
  errorHandler,
  loadRootEnv,
  logger,
  mongoSanitizeMiddleware,
  rejectPrototypePollution,
} from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import type { NextFunction, Request, Response } from "express";
import type { ServerResponse } from "http";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { isAdminOrManagerCached } from "./utils/loginRateLimitBypass.js";
import { platformRoutes } from "./platformRoutes.js";
import { centralAuthProxy, isCentralGatewayMode } from "./tenantResolver.js";

const PORT = Number(process.env.PORT ?? 4000);

const CENTRAL = isCentralGatewayMode();

logger.info("gateway starting", {
  PORT,
  NODE_ENV: process.env.NODE_ENV ?? "(unset)",
  GATEWAY_MODE: CENTRAL ? "central" : "tenant",
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL ?? "http://localhost:4001",
  REPORT_SERVICE_URL: process.env.REPORT_SERVICE_URL ?? "http://localhost:4008",
});

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
const EMPLOYEE_URL = process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
const DEPARTMENT_URL = process.env.DEPARTMENT_SERVICE_URL ?? "http://localhost:4003";
const LOCATION_URL = process.env.LOCATION_SERVICE_URL ?? "http://localhost:4004";
const SCHEDULE_URL = process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4006";
const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:4007";
const REPORT_URL = process.env.REPORT_SERVICE_URL ?? "http://localhost:4008";

const PROXY_BACKEND_DOWN_USER =
  "שירות המערכת אינו זמין זמנית. נסו שוב מאוחר יותר. אם הבעיה נמשכת, פנו למנהל המערכת או לתמיכה.";
const PROXY_BACKEND_DOWN_DEV =
  "שירות ה־backend לא זמין בסביבת הפיתוח. בדרך כלל צריך להרים את סטאק השרתים ואת שירותי הנתונים (למשל דרך Docker Compose) לפי מדריך המפתחים.";

function proxyBackendUnavailableMessage(): string {
  return process.env.NODE_ENV === "production" ? PROXY_BACKEND_DOWN_USER : PROXY_BACKEND_DOWN_DEV;
}

type RequestWithSkip = Request & { skipPrivilegedAuthLimits?: boolean };

function sendRateLimitJson(res: Response, windowMs: number): void {
  const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    error: `יותר מדי בקשות. נסו שוב בעוד ${retryAfterSeconds} שניות.`,
    code: "RATE_LIMIT",
    retryAfterSeconds,
  });
}

function rateLimitHandler(req: Request, res: Response, _next: NextFunction, options: { windowMs: number }): void {
  void req;
  sendRateLimitJson(res, options.windowMs);
}

const globalApiLimiter = rateLimit({
  windowMs: 60_000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const loginSlowDown = slowDown({
  windowMs: 15 * 60_000,
  delayAfter: 8,
  delayMs: (used) => Math.min(used * 120, 4000),
  skip: (req) => (req as RequestWithSkip).skipPrivilegedAuthLimits === true && req.path === "/login",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => (req as RequestWithSkip).skipPrivilegedAuthLimits === true && req.path === "/login",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `login:${req.ip}:${email}`;
  },
  handler: rateLimitHandler,
});

const forgotSlowDown = slowDown({
  windowMs: 60 * 60_000,
  delayAfter: 4,
  delayMs: (used) => Math.min(used * 200, 5000),
  skip: (req) =>
    (req as RequestWithSkip).skipPrivilegedAuthLimits === true && req.path === "/forgot-password",
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    (req as RequestWithSkip).skipPrivilegedAuthLimits === true && req.path === "/forgot-password",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `forgot:${req.ip}:${email}`;
  },
  handler: rateLimitHandler,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `register:${req.ip}`,
  handler: rateLimitHandler,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reset:${req.ip}`,
  handler: rateLimitHandler,
});

function privilegedAuthPrelude(req: Request, res: Response, next: NextFunction): void {
  void res;
  const r = req as RequestWithSkip;
  r.skipPrivilegedAuthLimits = false;
  if (req.method !== "POST") {
    next();
    return;
  }
  const path = req.path || "/";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || (path !== "/login" && path !== "/forgot-password")) {
    next();
    return;
  }
  void isAdminOrManagerCached(email)
    .then((privileged) => {
      r.skipPrivilegedAuthLimits = privileged;
      next();
    })
    .catch(() => {
      next();
    });
}

function authRouteLimits(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "POST") {
    next();
    return;
  }
  const path = req.path || "/";
  if (path === "/login") {
    loginSlowDown(req, res, () => {
      loginLimiter(req, res, next);
    });
    return;
  }
  if (path === "/forgot-password") {
    forgotSlowDown(req, res, () => {
      forgotPasswordLimiter(req, res, next);
    });
    return;
  }
  if (path === "/register") {
    registerLimiter(req, res, next);
    return;
  }
  if (path === "/reset-password") {
    resetPasswordLimiter(req, res, next);
    return;
  }
  next();
}

const app = express();

applySecurityMiddleware(app);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  })
);

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  globalApiLimiter(req, res, next);
});

const jsonParser = express.json({ limit: "1mb" });

function mountHttp(mountPath: string, target: string) {
  if (CENTRAL && mountPath !== "/api/auth") {
    return;
  }
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => mountPath + (path.startsWith("/") ? path : `/${path}`),
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error(`Proxy ${req.method} ${mountPath} → ${target} (${err.message})`);
        const out = res as ServerResponse;
        if (!out.headersSent) {
          out.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
          out.end(
            JSON.stringify({
              error: proxyBackendUnavailableMessage(),
              code: "BAD_GATEWAY",
            })
          );
        }
      },
    },
  });

  if (mountPath === "/api/auth") {
    if (CENTRAL) {
      const authChain = [
        jsonParser,
        mongoSanitizeMiddleware,
        rejectPrototypePollution,
        privilegedAuthPrelude,
        authRouteLimits,
      ] as const;
      app.post("/api/auth/login", ...authChain, centralAuthProxy("/login"));
      app.post("/api/auth/register", ...authChain, centralAuthProxy("/register"));
      app.post("/api/auth/forgot-password", ...authChain, centralAuthProxy("/forgot-password"));
      app.post("/api/auth/reset-password", ...authChain, centralAuthProxy("/reset-password"));
      return;
    }
    app.use(mountPath, jsonParser, mongoSanitizeMiddleware, rejectPrototypePollution, privilegedAuthPrelude, authRouteLimits, proxy);
    return;
  }
  app.use(mountPath, jsonParser, mongoSanitizeMiddleware, rejectPrototypePollution, proxy);
}

mountHttp("/api/auth", AUTH_URL);
mountHttp("/api/employees", EMPLOYEE_URL);
mountHttp("/api/departments", DEPARTMENT_URL);
mountHttp("/api/locations", LOCATION_URL);
mountHttp("/api/parking", LOCATION_URL);
mountHttp("/api/meeting-rooms", LOCATION_URL);
mountHttp("/api/schedules", SCHEDULE_URL);
mountHttp("/api/notifications", NOTIFICATION_URL);
mountHttp("/api/ai", AI_URL);
mountHttp("/api/reports", REPORT_URL);

if (CENTRAL) {
  app.use("/api/platform", platformRoutes);
}

const socketMw = createProxyMiddleware({
  target: NOTIFICATION_URL,
  changeOrigin: true,
  ws: true,
});
app.use("/socket.io", socketMw);

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "gateway", mode: CENTRAL ? "central" : "tenant" })
);

app.use(errorHandler);

const server = createServer(app);
applyServerTimeouts(server);
server.on("upgrade", socketMw.upgrade);

server.listen(PORT, () => logger.info(`Gateway listening on ${PORT}`));
