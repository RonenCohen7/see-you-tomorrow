import { logger } from "@syt/shared";
import { notificationBase } from "../config/urls.js";

const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export async function sendPasswordResetEmail(params: {
  to: string;
  fullName: string;
  resetUrl: string;
  locale: "he" | "en";
}): Promise<void> {
  const res = await fetch(`${notificationBase()}/internal/notifications/password-reset-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const t = await res.text();
    logger.warn("sendPasswordResetEmail failed", { status: res.status, body: t.slice(0, 300) });
    throw new Error(`password reset email failed: ${res.status}`);
  }
}
