import { Queue, Worker } from "bullmq";
import { logger } from "@syt/shared";
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

export type EmailJob = {
  notificationId: string;
  recipientId: string;
  workDate: string;
  /** Inclusive end when the notification spans multiple days */
  workDateEnd?: string;
  status: string;
};

let queue: Queue<EmailJob> | null = null;

export function getEmailQueue() {
  if (!queue) {
    queue = new Queue<EmailJob>("email-notifications", { connection: redisConnection() });
  }
  return queue;
}

export function startEmailWorker() {
  const worker = new Worker<EmailJob>(
    "email-notifications",
    async (job) => {
      const emp = await http.fetchEmployee(job.data.recipientId);
      if (!emp?.email) {
        logger.warn("No email for recipient", job.data.recipientId);
        return;
      }
      await mailer.sendScheduleEmail(emp.email, {
        employeeName: emp.fullName ?? "עובד",
        workDate: job.data.workDate,
        workDateEnd: job.data.workDateEnd,
        status: job.data.status,
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
