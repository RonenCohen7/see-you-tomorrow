import {
  applySecurityMiddleware,
  applyServerTimeouts,
  DB_NAMES,
  errorHandler,
  getConnection,
  getScheduleModel,
  loadRootEnv,
  logger,
  mongoSanitizeMiddleware,
  rejectPrototypePollution,
} from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { createServer } from "http";

import { scheduleRoutes } from "./routes/scheduleRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";
import { startPreferenceAiPipelineWorker } from "./services/preferenceAiPipelineWorker.js";

const PORT = Number(process.env.PORT ?? 4005);
logger.info("schedule-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

/**
 * Migration: the historical unique index on (employeeId, workDate) blocks split-day
 * schedules (e.g. 4h office + 4h home). Drop it once on startup; from now on the
 * compound index is non-unique.
 */
async function ensureSchemaMigrations() {
  try {
    const conn = await getConnection(DB_NAMES.schedules);
    const Schedule = getScheduleModel(conn);
    const indexes = await Schedule.collection.indexes();
    const legacy = indexes.find(
      (i) => i.name === "employeeId_1_workDate_1" && i.unique === true
    );
    if (legacy) {
      await Schedule.collection.dropIndex("employeeId_1_workDate_1");
      logger.info("dropped legacy unique index employeeId_1_workDate_1");
    }
    await Schedule.syncIndexes();
  } catch (e) {
    logger.warn("schedule index migration failed (will continue)", e);
  }
}

const app = express();
applySecurityMiddleware(app);
app.use(express.json({ limit: "1mb" }));
app.use(rejectPrototypePollution);
app.use(mongoSanitizeMiddleware);

app.use("/api/schedules", scheduleRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "schedule-service" }));

app.use(errorHandler);

const server = createServer(app);
applyServerTimeouts(server);
server.listen(PORT, async () => {
  logger.info(`schedule-service listening on ${PORT}`);
  await ensureSchemaMigrations();
  try {
    startPreferenceAiPipelineWorker();
    logger.info("preference AI pipeline worker started");
  } catch (e) {
    logger.warn("preference AI pipeline worker failed to start", e);
  }
});
