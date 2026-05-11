import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { employeeRoutes } from "./routes/employeeRoutes.js";
import { internalRoutes } from "./routes/internalRoutes.js";

const PORT = Number(process.env.PORT ?? 4002);
logger.info("employee-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
app.use(express.json({ limit: "5mb" }));

app.use("/api/employees", employeeRoutes);
app.use("/internal", internalRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "employee-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`employee-service listening on ${PORT}`));
