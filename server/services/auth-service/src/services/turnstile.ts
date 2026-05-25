import type { Request } from "express";
import { AppError, logger } from "@syt/shared";

function clientIp(req: Pick<Request, "ip" | "headers">): string | undefined {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]?.trim();
  }
  return req.ip;
}

/** When TURNSTILE_SECRET is unset, verification is skipped (local dev). */
export async function assertTurnstileOk(
  token: string | undefined,
  req: Pick<Request, "ip" | "headers">
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET?.trim();
  if (!secret) return;

  if (!token || !token.trim()) {
    throw new AppError(400, "אימות אבטחה חסר. רעננו את העמוד ונסו שוב.", "TURNSTILE_REQUIRED");
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  const ip = clientIp(req);
  if (ip) body.set("remoteip", ip);

  let data: { success?: boolean; "error-codes"?: string[] };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  } catch (e) {
    logger.warn("Turnstile siteverify request failed", e instanceof Error ? e.message : e);
    throw new AppError(503, "שירות האימות אינו זמין זמנית. נסו שוב בעוד רגע.", "TURNSTILE_UNAVAILABLE");
  }

  if (!data.success) {
    logger.warn("Turnstile verification failed", { codes: data["error-codes"] });
    throw new AppError(429, "אימות האבטחה נכשל. רעננו את העמוד ונסו שוב.", "TURNSTILE_FAILED");
  }
}
