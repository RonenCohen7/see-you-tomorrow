import { internalServiceHeaders, logger } from "@syt/shared";
import { notificationBase } from "../config/urls.js";

export async function sendPasswordResetEmail(params: {
  to: string;
  fullName: string;
  resetUrl: string;
  locale: "he" | "en";
}): Promise<void> {
  const res = await fetch(`${notificationBase()}/internal/notifications/password-reset-email`, {
    method: "POST",
    headers: internalServiceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const t = await res.text();
    logger.warn("sendPasswordResetEmail failed", { status: res.status, body: t.slice(0, 300) });
    throw new Error(`password reset email failed: ${res.status}`);
  }
}
