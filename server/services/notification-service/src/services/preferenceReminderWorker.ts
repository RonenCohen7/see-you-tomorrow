import { Queue, Worker } from "bullmq";
import { logger } from "@syt/shared";
import * as prefs from "./notificationPersistence.js";

function redisConnection(): { host: string; port: number; password?: string } {
  const urlStr = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const u = new URL(urlStr);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 6379,
      password: u.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

const QUEUE = "preference-reminders";

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${url} → ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function runOnce(): Promise<number> {
  const schBase = process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
  const empBase = process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  const hdr = { "x-internal-secret": secret };

  const env = (await fetchJson(`${schBase}/internal/reminders/preference-envelope`, {
    headers: hdr,
  })) as {
    remindersEnabled: boolean;
    targetWeekStartSunday: string;
  };

  if (!env.remindersEnabled) return 0;

  const week = env.targetWeekStartSunday;

  const empData = (await fetchJson(`${empBase}/internal/employees/by-role/employee/ids`, {
    headers: hdr,
  })) as { ids: string[] };
  const candidateIds = empData.ids ?? [];
  if (candidateIds.length === 0) return 0;

  const missRes = await fetch(`${schBase}/internal/attendance-preferences/missing-submitters`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json" },
    body: JSON.stringify({ weekStartSunday: week, candidateIds }),
  });
  if (!missRes.ok) {
    const t = await missRes.text();
    throw new Error(`missing-submitters → ${missRes.status}: ${t.slice(0, 200)}`);
  }
  const { missing } = (await missRes.json()) as { missing: string[] };

  const cooldownMs =
    Number(process.env.PREFERENCE_REMINDER_COOLDOWN_HOURS ?? 48) * 60 * 60 * 1000;

  let sent = 0;
  for (const uid of missing) {
    const recent = await prefs.hasRecentPreferenceReminder(uid, week, cooldownMs);
    if (recent) continue;
    await prefs.createPreferenceReminder(uid, week);
    sent++;
  }
  if (sent > 0) logger.info("preference reminders sent", { week, count: sent });
  return sent;
}

export function startPreferenceReminderWorker() {
  const connection = redisConnection();
  const everyMs = Number(process.env.PREFERENCE_REMINDER_INTERVAL_MS ?? 86_400_000);

  const queue = new Queue(QUEUE, { connection });
  void queue
    .add(
      "daily",
      {},
      {
        repeat: { every: everyMs },
        removeOnComplete: true,
        removeOnFail: 20,
      }
    )
    .catch((e) => logger.warn("preference reminder repeat schedule failed (redis?)", e));

  const worker = new Worker(
    QUEUE,
    async () => {
      try {
        await runOnce();
      } catch (e) {
        logger.error("preference reminder job failed", e);
        throw e;
      }
    },
    { connection, limiter: { max: 2, duration: 60_000 } }
  );

  worker.on("failed", (job, err) => {
    logger.error(`preference reminder job ${job?.id} failed`, err);
  });

  return { worker, queue };
}
