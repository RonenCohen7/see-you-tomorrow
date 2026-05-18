import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { aiRoutes } from "./routes/aiRoutes.js";
import { internalAiRoutes } from "./routes/internalAiRoutes.js";

const PORT = Number(process.env.PORT ?? 4007);
logger.info("ai-recommendation-service starting", {
  PORT,
  JWT_SECRET_set: !!process.env.JWT_SECRET,
  ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY?.trim(),
  CLAUDE_MODEL: process.env.CLAUDE_MODEL ?? "(default)",
});

const app = express();
app.use(express.json());

app.use("/internal", internalAiRoutes);
app.use("/api/ai", aiRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "ai-recommendation-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`ai-recommendation-service listening on ${PORT}`));
