import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { departmentRoutes } from "./routes/departmentRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";

const PORT = Number(process.env.PORT ?? 4003);
logger.info("department-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
app.use(express.json({ limit: "5mb" }));

app.use("/internal", internalRoutes);
app.use("/api/departments", departmentRoutes);
app.get("/health", (_req, res) => res.json({ ok: true, service: "department-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`department-service listening on ${PORT}`));
