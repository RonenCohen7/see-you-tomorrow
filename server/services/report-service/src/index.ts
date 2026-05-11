import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { reportRoutes } from "./routes/reportRoutes.js";

const PORT = Number(process.env.PORT ?? 4008);
logger.info("report-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
app.use(express.json({ limit: "400kb" }));

app.use("/api/reports", reportRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "report-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`report-service listening on ${PORT}`));
