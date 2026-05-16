import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { locationRoutes } from "./routes/locationRoutes.js";
import { parkingRoutes } from "./routes/parkingRoutes.js";
import { meetingRoutes } from "./routes/meetingRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";

const PORT = Number(process.env.PORT ?? 4004);
logger.info("location-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
app.use(express.json({ limit: "8mb" }));

app.use("/internal", internalRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/meeting-rooms", meetingRoutes);
app.get("/health", (_req, res) => res.json({ ok: true, service: "location-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`location-service listening on ${PORT}`));
