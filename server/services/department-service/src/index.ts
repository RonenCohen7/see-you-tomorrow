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
import express from "express";
import { createServer } from "http";

import { departmentRoutes } from "./routes/departmentRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";

const PORT = Number(process.env.PORT ?? 4003);
logger.info("department-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
applySecurityMiddleware(app);
app.use(express.json({ limit: "2mb" }));
app.use(rejectPrototypePollution);
app.use(mongoSanitizeMiddleware);

app.use("/internal", internalRoutes);
app.use("/api/departments", departmentRoutes);
app.get("/health", (_req, res) => res.json({ ok: true, service: "department-service" }));

app.use(errorHandler);

const server = createServer(app);
applyServerTimeouts(server);
server.listen(PORT, () => logger.info(`department-service listening on ${PORT}`));
