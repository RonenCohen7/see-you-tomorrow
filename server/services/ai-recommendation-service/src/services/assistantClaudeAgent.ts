import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { logger } from "@syt/shared";
import { buildAssistantSystemPrompt } from "./assistantSystemContext.js";
import { ASSISTANT_TOOL_DEFINITIONS, runAssistantTool } from "./assistantTools.js";
import type { AssistantChatBody } from "../validations/assistant.js";

const MAX_TOOL_ROUNDS = 8;

function claudeModel(): string {
  return process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
}

function apiKey(): string | undefined {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k || undefined;
}

export type AssistantChatResult = {
  reply: string;
  navigateTo?: string;
  usedAgent: true;
};

function friendlyAnthropicFailure(err: unknown, locale: "he" | "en"): string {
  const status =
    err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : undefined;
  const raw = `${err instanceof Error ? err.message : String(err)} ${
    err && typeof err === "object" && "error" in err ? JSON.stringify((err as { error: unknown }).error) : ""
  }`.toLowerCase();

  if (raw.includes("credit balance") || raw.includes("billing") || raw.includes("purchase credits")) {
    return locale === "en"
      ? "The Anthropic API account has no credits. Add billing at console.anthropic.com, or use quick prompts that work without the smart assistant."
      : "לחשבון Anthropic אין יתרת אשראי. הוסיפו קרדיט ב־console.anthropic.com, או השתמשו בדוגמאות המהירות (שאילתות פשוטות בלי העוזר החכם).";
  }
  if (status === 401 || raw.includes("authentication") || raw.includes("invalid x-api-key")) {
    return locale === "en"
      ? "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in the server .env and restart the AI service."
      : "מפתח Anthropic נדחה. בדקו את ANTHROPIC_API_KEY ב־.env והפעילו מחדש את שירות ה-AI.";
  }
  if (status === 429) {
    return locale === "en"
      ? "Anthropic rate limit — wait a moment and try again."
      : "מגבלת קצב ב-Anthropic — המתינו רגע ונסו שוב.";
  }
  if (status === 404 && raw.includes("model")) {
    return locale === "en"
      ? "Claude model not found. Set CLAUDE_MODEL to a current id (e.g. claude-sonnet-4-6) in .env and restart the AI service."
      : "מודל Claude לא קיים. עדכנו CLAUDE_MODEL ב־.env (למשל claude-sonnet-4-6) והפעילו מחדש את שירות ה-AI.";
  }
  return locale === "en"
    ? "The smart assistant could not reach Claude. Try again or use a quick prompt."
    : "העוזר החכם לא הצליח לפנות ל-Claude. נסו שוב או השתמשו בדוגמה מהירה.";
}

export async function runAssistantClaudeChat(opts: {
  body: AssistantChatBody;
  role: string;
  authHeader: string;
}): Promise<AssistantChatResult> {
  const key = apiKey();
  if (!key) {
    const msg =
      opts.body.locale === "en"
        ? "Smart assistant is not configured (missing ANTHROPIC_API_KEY on the server)."
        : "העוזר החכם לא מוגדר בשרת (חסר ANTHROPIC_API_KEY).";
    return { reply: msg, usedAgent: true };
  }

  const client = new Anthropic({ apiKey: key });
  const system = buildAssistantSystemPrompt({
    locale: opts.body.locale,
    role: opts.role,
    pathname: opts.body.pathname,
  });

  const messages: MessageParam[] = opts.body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let navigateTo: string | undefined;
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    const started = Date.now();

    let response;
    try {
      response = await client.messages.create({
        model: claudeModel(),
        max_tokens: 1200,
        system,
        tools: ASSISTANT_TOOL_DEFINITIONS,
        messages,
      });
    } catch (err) {
      logger.warn("assistant.claude.api_error", {
        message: err instanceof Error ? err.message : String(err),
      });
      return {
        reply: friendlyAnthropicFailure(err, opts.body.locale),
        navigateTo,
        usedAgent: true,
      };
    }

    logger.info("assistant.claude.round", {
      stop: response.stop_reason,
      ms: Date.now() - started,
      round: rounds,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
      return {
        reply: text || (opts.body.locale === "en" ? "Done." : "בוצע."),
        navigateTo,
        usedAgent: true,
      };
    }

    if (response.stop_reason !== "tool_use") {
      return {
        reply:
          opts.body.locale === "en"
            ? "I could not complete the answer. Please try rephrasing."
            : "לא הצלחתי להשלים תשובה. נסו לנסח מחדש.",
        navigateTo,
        usedAgent: true,
      };
    }

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    messages.push({ role: "assistant", content: response.content });

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type !== "tool_use") continue;
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput =
          typeof block.input === "object" && block.input !== null
            ? (block.input as Record<string, unknown>)
            : {};
      } catch {
        parsedInput = {};
      }

      try {
        const result = await runAssistantTool(block.name, parsedInput, {
          authHeader: opts.authHeader,
          role: opts.role,
          locale: opts.body.locale,
        });
        if (result.navigateTo) navigateTo = result.navigateTo;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.json,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("assistant.tool.error", { tool: block.name, message });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ error: message }),
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    reply:
      opts.body.locale === "en"
        ? "Too many steps — please ask a simpler question."
        : "יותר מדי שלבים — נסו שאלה פשוטה יותר.",
    navigateTo,
    usedAgent: true,
  };
}
