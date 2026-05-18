import { AppError, logger } from "@syt/shared";
import { notificationBase } from "../config/urls.js";

const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export async function sendAttachmentByEmail(params: {
  to: string;
  subject: string;
  text: string;
  filename: string;
  content: Buffer;
  contentType: string;
}): Promise<void> {
  const res = await fetch(`${notificationBase()}/internal/notifications/email-attachment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret(),
    },
    body: JSON.stringify({
      to: params.to,
      subject: params.subject,
      text: params.text,
      filename: params.filename,
      attachmentBase64: params.content.toString("base64"),
      contentType: params.contentType,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    logger.warn("sendAttachmentByEmail failed", { status: res.status, body: t.slice(0, 300) });
    throw new AppError(502, `שליחת מייל נכשלה: ${res.status}`, "UPSTREAM");
  }
}
