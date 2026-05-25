type Level = "info" | "warn" | "error" | "debug";

const REDACT_KEYS = new Set([
  "password",
  "accesstoken",
  "refreshtoken",
  "turnstiletoken",
  "authorization",
  "secret",
  "x-internal-secret",
  "jwt",
]);

function redactMeta(meta: unknown): unknown {
  if (meta === null || meta === undefined) return meta;
  if (typeof meta !== "object") return meta;
  if (Array.isArray(meta)) return meta.map(redactMeta);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactMeta(v) as unknown;
    }
  }
  return out;
}

function log(level: Level, msg: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  const safe = meta !== undefined ? redactMeta(meta) : undefined;
  if (safe !== undefined) {
    console[level === "debug" ? "log" : level](line, safe);
  } else {
    console[level === "debug" ? "log" : level](line);
  }
}

export const logger = {
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
};
