import type { Request, Response } from "express";
import { AppError, assertTurnstileOk } from "@syt/shared";
import { supportChatBodySchema } from "../validations/supportChat.js";
import { runSupportClaudeChat } from "../services/supportClaudeAgent.js";

export async function supportChat(req: Request, res: Response) {
  const parsed = supportChatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  }

  await assertTurnstileOk(parsed.data.turnstileToken, req);

  const result = await runSupportClaudeChat(parsed.data);

  res.json({
    reply: result.reply,
    usedAgent: result.usedAgent,
  });
}
