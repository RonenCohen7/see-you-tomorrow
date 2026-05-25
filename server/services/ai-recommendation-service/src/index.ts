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
applySecurityMiddleware(app);
app.use(express.json({ limit: "1mb" }));
app.use(rejectPrototypePollution);
app.use(mongoSanitizeMiddleware);

app.use("/internal", internalAiRoutes);
app.use("/api/ai", aiRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "ai-recommendation-service" }));

app.use(errorHandler);

const server = createServer(app);
applyServerTimeouts(server);
server.listen(PORT, () => logger.info(`ai-recommendation-service listening on ${PORT}`));
