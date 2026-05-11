import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { aiRoutes } from "./routes/aiRoutes.js";

const PORT = Number(process.env.PORT ?? 4007);
logger.info("ai-recommendation-service starting", { PORT, JWT_SECRET_set: !!process.env.JWT_SECRET });

const app = express();
app.use(express.json());

app.use("/api/ai", aiRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "ai-recommendation-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`ai-recommendation-service listening on ${PORT}`));
