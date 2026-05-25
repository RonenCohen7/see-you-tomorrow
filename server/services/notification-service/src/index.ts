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

import { notificationRoutes } from "./routes/notificationRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";
import { initSocket } from "./socket.js";
import { startEmailWorker } from "./services/emailQueue.js";
import { startPreferenceReminderWorker } from "./services/preferenceReminderWorker.js";

const PORT = Number(process.env.PORT ?? 4006);
logger.info("notification-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
applySecurityMiddleware(app);
app.use(express.json({ limit: "1mb" }));
app.use(rejectPrototypePollution);
app.use(mongoSanitizeMiddleware);

app.use("/api/notifications", notificationRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "notification-service" }));

app.use(errorHandler);

const httpServer = createServer(app);
applyServerTimeouts(httpServer);
initSocket(httpServer);
startEmailWorker();
startPreferenceReminderWorker();

httpServer.listen(PORT, () => logger.info(`notification-service listening on ${PORT}`));
