import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { createServer } from "http";
import { errorHandler, logger } from "@syt/shared";

import { notificationRoutes } from "./routes/notificationRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";
import { initSocket } from "./socket.js";
import { startEmailWorker } from "./services/emailQueue.js";

const PORT = Number(process.env.PORT ?? 4006);
logger.info("notification-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
app.use(express.json());

app.use("/api/notifications", notificationRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "notification-service" }));

app.use(errorHandler);

const httpServer = createServer(app);
initSocket(httpServer);
startEmailWorker();

httpServer.listen(PORT, () => logger.info(`notification-service listening on ${PORT}`));
