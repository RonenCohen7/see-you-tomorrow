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

import { reportRoutes } from "./routes/reportRoutes.js";

const PORT = Number(process.env.PORT ?? 4008);
logger.info("report-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
applySecurityMiddleware(app);
app.use(express.json({ limit: "1mb" }));
app.use(rejectPrototypePollution);
app.use(mongoSanitizeMiddleware);

app.use("/api/reports", reportRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "report-service" }));

app.use(errorHandler);

const server = createServer(app);
applyServerTimeouts(server);
server.listen(PORT, () => logger.info(`report-service listening on ${PORT}`));
