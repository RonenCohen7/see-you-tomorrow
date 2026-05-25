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

import { employeeRoutes } from "./routes/employeeRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";

const PORT = Number(process.env.PORT ?? 4002);
logger.info("employee-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
applySecurityMiddleware(app);
app.use(express.json({ limit: "2mb" }));
app.use(rejectPrototypePollution);
app.use(mongoSanitizeMiddleware);

app.use("/api/employees", employeeRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "employee-service" }));

app.use(errorHandler);

const server = createServer(app);
applyServerTimeouts(server);
server.listen(PORT, () => logger.info(`employee-service listening on ${PORT}`));
