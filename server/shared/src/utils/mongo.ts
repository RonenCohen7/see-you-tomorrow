import mongoose from "mongoose";
import { logger } from "./logger.js";

/**
 * NoSQL-injection protection lives in `express-mongo-sanitize` at the HTTP edge
 * (strips `$`/`.` from body/query/params). Do NOT enable `mongoose.set("sanitizeFilter", true)`
 * globally — it wraps any sub-object containing `$` keys (e.g. `{$gte, $lte}`, `{$in}`)
 * with `{$eq}`, which breaks every range/`$in`/`$or` query with a CastError on Date/ObjectId paths.
 */
mongoose.set("strictQuery", true);

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
