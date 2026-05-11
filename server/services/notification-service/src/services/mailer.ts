import nodemailer from "nodemailer";
import { logger } from "@syt/shared";

export function createTransport() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendScheduleEmail(to: string, ctx: { employeeName: string; workDate: string; status: string; location?: string }) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? "noreply@seeyoutomorrow.local";
  const subject = "עדכון לוח זמנים";
  const text = [
    `שלום ${ctx.employeeName},`,
    "",
    "לוח הזמנים שלך עודכן.",
    `תאריך: ${ctx.workDate}`,
    `סטטוס: ${ctx.status}`,
    ctx.location ? `מיקום: ${ctx.location}` : "",
    "",
    "See You Tomorrow",
  ]
    .filter(Boolean)
    .join("\n");

  await transport.sendMail({ from, to, subject, text });
  logger.info(`Email sent to ${to}`);
}
