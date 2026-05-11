import mongoose from "mongoose";
import { logger } from "./logger.js";

const connections = new Map<string, mongoose.Connection>();

/** Default targets MongoDB on the host (local dev). Docker Compose sets MONGO_URI to mongodb://mongo:27017. */
export function getMongoUri(): string {
  return process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017";
}

export async function getConnection(dbName: string): Promise<mongoose.Connection> {
  const cached = connections.get(dbName);
  if (cached?.readyState === 1) return cached;

  const uri = getMongoUri();
  const conn = mongoose.createConnection(`${uri}/${dbName}`, {
    // Fail fast instead of hanging ~30s when Mongo is down or waking from sleep (Docker).
    serverSelectionTimeoutMS: 10_000,
  });
  await conn.asPromise();
  logger.info(`Mongo connected: ${dbName}`);
  connections.set(dbName, conn);
  return conn;
}
