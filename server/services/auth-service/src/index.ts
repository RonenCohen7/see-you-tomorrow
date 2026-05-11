import { loadRootEnv } from "@syt/shared";
loadRootEnv();
import "express-async-errors";
import express from "express";
import { errorHandler, logger } from "@syt/shared";

import { authRoutes } from "./routes/authRoutes.js";

const PORT = Number(process.env.PORT ?? 4001);

function mongoPreview() {
  const u = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017";
  return u.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

logger.info("auth-service starting", {
  PORT,
  NODE_ENV: process.env.NODE_ENV ?? "(unset)",
  MONGO_URI: mongoPreview(),
  ALLOW_PUBLIC_REGISTER: process.env.ALLOW_PUBLIC_REGISTER ?? "(unset)",
  JWT_SECRET_set: !!process.env.JWT_SECRET,
});

const app = express();
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "auth-service" }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`auth-service listening on ${PORT}`));
