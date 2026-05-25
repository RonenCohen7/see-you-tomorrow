import { logger } from "@syt/shared";

/** Revoke all refresh tokens for a user (called when employee is deactivated). */
export async function revokeUserAuthTokensInternal(userId: string): Promise<void> {
  const base = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  try {
    const res = await fetch(`${base}/internal/tokens/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { "x-internal-secret": secret },
    });
    if (!res.ok) {
      const t = await res.text();
      logger.warn("revokeUserAuthTokensInternal failed", { userId, status: res.status, body: t.slice(0, 200) });
    }
  } catch (e) {
    logger.warn("revokeUserAuthTokensInternal error", { userId, e });
  }
}
