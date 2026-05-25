import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { logger } from "@syt/shared";
import { buildSupportSystemPrompt } from "./supportSystemPrompt.js";
import type { SupportChatBody } from "../validations/supportChat.js";

function claudeModel(): string {
  return process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
}

function apiKey(): string | undefined {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k || undefined;
}

function friendlyFailure(locale: "he" | "en"): string {
  return locale === "en"
    ? "Support chat is temporarily unavailable. Browse the FAQ above or email sales@seeyoutomorrow.local."
    : "צ'אט התמיכה אינו זמין כרגע. עיינו בשאלות הנפוצות למעלה או כתבו ל-sales@seeyoutomorrow.local.";
}

export async function runSupportClaudeChat(body: SupportChatBody): Promise<{ reply: string; usedAgent: boolean }> {
  const key = apiKey();
  if (!key) {
    return { reply: friendlyFailure(body.locale), usedAgent: false };
  }

  const system = buildSupportSystemPrompt(body.locale);
  const messages: MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: claudeModel(),
      max_tokens: 1024,
      system,
      messages,
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return { reply: text || friendlyFailure(body.locale), usedAgent: true };
  } catch (err) {
    logger.warn("Support Claude chat failed", err instanceof Error ? err.message : err);
    return { reply: friendlyFailure(body.locale), usedAgent: false };
  }
}
