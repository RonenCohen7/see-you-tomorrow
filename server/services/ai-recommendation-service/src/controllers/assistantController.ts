import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { assistantChatBodySchema } from "../validations/assistant.js";
import { runAssistantClaudeChat } from "../services/assistantClaudeAgent.js";

export async function assistantChat(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");

  const parsed = assistantChatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  }

  const result = await runAssistantClaudeChat({
    body: parsed.data,
    role: req.user.role,
    authHeader,
  });

  res.json({
    reply: result.reply,
    navigateTo: result.navigateTo,
    usedAgent: result.usedAgent,
  });
}
