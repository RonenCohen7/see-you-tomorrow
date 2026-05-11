import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import cors from "cors";
import express from "express";
import { createServer } from "http";
import type { ServerResponse } from "http";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { logger } from "@syt/shared";

const PORT = Number(process.env.PORT ?? 4000);

logger.info("gateway starting", {
  PORT,
  NODE_ENV: process.env.NODE_ENV ?? "(unset)",
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

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  })
);

app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: 400,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const jsonParser = express.json({ limit: "2mb" });
const sanitize = mongoSanitize();

/**
 * Express strips the mount path from `req.url` before the proxy runs, so the upstream
 * would otherwise receive `/register` instead of `/api/auth/register` → 404 on every API call.
 */
function mountHttp(mountPath: string, target: string) {
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
              error:
                "שירות ה-backend לא זמין. שלבים (כל אחת בשורה נפרדת בטרמינל): (1) MongoDB — אם אין mongod מקומי, מהשורש: npm run docker:deps (2) מהשורש: npm run dev — פקודה אחת בשורה; אל תצמיד שתי פקודות npm באותה שורה בלי רווח ביניהן.",
              code: "BAD_GATEWAY",
            })
          );
        }
      },
    },
  });

  app.use(mountPath, jsonParser, sanitize, proxy);
}

mountHttp("/api/auth", AUTH_URL);
mountHttp("/api/employees", EMPLOYEE_URL);
mountHttp("/api/departments", DEPARTMENT_URL);
mountHttp("/api/locations", LOCATION_URL);
mountHttp("/api/parking", LOCATION_URL);
mountHttp("/api/schedules", SCHEDULE_URL);
mountHttp("/api/notifications", NOTIFICATION_URL);
mountHttp("/api/ai", AI_URL);
mountHttp("/api/reports", REPORT_URL);

const socketMw = createProxyMiddleware({
  target: NOTIFICATION_URL,
  changeOrigin: true,
  ws: true,
});
app.use("/socket.io", socketMw);

app.get("/health", (_req, res) => res.json({ ok: true, service: "gateway" }));

const server = createServer(app);
server.on("upgrade", socketMw.upgrade);

server.listen(PORT, () => logger.info(`Gateway listening on ${PORT}`));
