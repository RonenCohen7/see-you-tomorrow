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

export async function sendScheduleEmail(
  to: string,
  ctx: { employeeName: string; workDate: string; workDateEnd?: string; status: string; location?: string }
) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? "noreply@seeyoutomorrow.local";
  const subject = "עדכון לוח זמנים";
  const dateLine =
    ctx.workDateEnd && ctx.workDateEnd !== ctx.workDate
      ? `תאריכים: ${ctx.workDate} עד ${ctx.workDateEnd} (כולל)`
      : `תאריך: ${ctx.workDate}`;
  const text = [
    `שלום ${ctx.employeeName},`,
    "",
    "לוח הזמנים שלך עודכן.",
    dateLine,
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

export async function sendMailWithAttachment(params: {
  to: string;
  subject: string;
  text: string;
  attachment: { filename: string; content: Buffer; contentType?: string };
}) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? "noreply@seeyoutomorrow.local";
  await transport.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    attachments: [
      {
        filename: params.attachment.filename,
        content: params.attachment.content,
        contentType: params.attachment.contentType ?? "application/pdf",
      },
    ],
  });
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  logger.info(`Email with attachment sent to ${params.to}`, { smtp: `${host}:${port}` });
}
