import nodemailer from "nodemailer";
import { logger } from "@syt/shared";

type OutboundAttachment = { filename: string; content: Buffer; contentType?: string };

type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  attachments?: OutboundAttachment[];
};

function fromAddress(): string {
  const configured = process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim();
  return configured || "noreply@seeyoutomorrow.local";
}

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

async function deliverResend(apiKey: string, mail: OutboundMail) {
  const body: Record<string, unknown> = {
    from: fromAddress(),
    to: [mail.to],
    subject: mail.subject,
    text: mail.text,
  };
  if (mail.attachments?.length) {
    body.attachments = mail.attachments.map((file) => ({
      filename: file.filename,
      content: file.content.toString("base64"),
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
  logger.info(`Email sent via Resend to ${mail.to}`);
}

async function deliverSmtp(mail: OutboundMail) {
  const transport = createTransport();
  await transport.sendMail({
    from: fromAddress(),
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    attachments: mail.attachments?.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType ?? "application/pdf",
    })),
  });
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  logger.info(`Email sent via SMTP to ${mail.to}`, { smtp: `${host}:${port}` });
}

async function deliver(mail: OutboundMail) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    await deliverResend(apiKey, mail);
    return;
  }
  await deliverSmtp(mail);
}

export async function sendPlainEmail(to: string, subject: string, text: string) {
  await deliver({ to, subject, text });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  fullName: string;
  resetUrl: string;
  locale: "he" | "en";
}) {
  const isHe = params.locale === "he";
  const subject = isHe ? "איפוס סיסמה — See You Tomorrow" : "Reset your password — See You Tomorrow";
  const text = isHe
    ? [
        `שלום ${params.fullName},`,
        "",
        "קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך.",
        "לחץ על הקישור הבא (תוקף שעה) כדי לבחור סיסמה חדשה:",
        "",
        params.resetUrl,
        "",
        "אם לא ביקשת איפוס — התעלם ממייל זה.",
        "",
        "See You Tomorrow",
      ].join("\n")
    : [
        `Hello ${params.fullName},`,
        "",
        "We received a request to reset your password.",
        "Use this link (valid for one hour) to choose a new password:",
        "",
        params.resetUrl,
        "",
        "If you did not request this, you can ignore this email.",
        "",
        "See You Tomorrow",
      ].join("\n");

  await deliver({ to: params.to, subject, text });
}

export async function sendMailWithAttachment(params: {
  to: string;
  subject: string;
  text: string;
  attachment: { filename: string; content: Buffer; contentType?: string };
}) {
  await deliver({
    to: params.to,
    subject: params.subject,
    text: params.text,
    attachments: [params.attachment],
  });
}
