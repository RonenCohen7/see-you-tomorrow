import { Queue, Worker, type JobsOptions } from "bullmq";
import { getRequestTenantSlug, isSharedSaasMode, logger, runWithTenant } from "@syt/shared";
import * as mailer from "./mailer.js";
import * as http from "../config/httpClients.js";

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

type EmailJobBase = { tenantSlug?: string };

export type EmailJob = EmailJobBase &
  (
    | {
        notificationKind?: "schedule_update";
        notificationId: string;
        recipientId: string;
        workDate: string;
        /** Inclusive end when the notification spans multiple days */
        workDateEnd?: string;
        status: string;
      }
    | {
        notificationKind: "meeting_invite";
        notificationId: string;
        recipientId: string;
        meetingSubject: string;
        meetingBody: string;
      }
  );

let queue: Queue<EmailJob> | null = null;

export function getEmailQueue() {
  if (!queue) {
    queue = new Queue<EmailJob>("email-notifications", { connection: redisConnection() });
  }
  return queue;
}

/**
 * Do not block HTTP handlers on BullMQ — when Redis is down, `Queue.add` can stall the whole
 * schedule-save path via the notification internal API.
 */
export function enqueueEmailJobsBestEffort(jobs: { name: string; data: EmailJob; opts: JobsOptions }[]): void {
  if (jobs.length === 0) return;
  void (async () => {
    try {
      const q = getEmailQueue();
      const tenantSlug = getRequestTenantSlug() ?? undefined;
      for (const j of jobs) {
        await q.add(j.name, tenantSlug ? { ...j.data, tenantSlug } : j.data, j.opts);
      }
    } catch (e) {
      logger.warn("email queue enqueue failed — is Redis running (docker compose)?", {
        err: e instanceof Error ? e.message : String(e),
      });
    }
  })();
}

export function startEmailWorker() {
  const worker = new Worker<EmailJob>(
    "email-notifications",
    async (job) => {
      if (isSharedSaasMode() && !job.data.tenantSlug) {
        logger.warn("email job missing tenant; skipped", job.id);
        return;
      }
      await runWithTenant(job.data.tenantSlug ?? null, async () => {
        if (job.data.notificationKind !== "meeting_invite") {
          logger.info("Skipped schedule assignment email");
          return;
        }
        const emp = await http.fetchEmployee(job.data.recipientId);
        if (!emp?.email) {
          logger.warn("No email for recipient", job.data.recipientId);
          return;
        }
        await mailer.sendPlainEmail(emp.email, job.data.meetingSubject, job.data.meetingBody);
      });
    },
    {
      connection: redisConnection(),
      limiter: { max: 50, duration: 60_000 },
    }
  );

  worker.on("failed", (job, err) => {
    logger.error(`Email job failed ${job?.id}`, err);
  });

  return worker;
}
