import { z } from "zod";

export const assistantChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const assistantChatBodySchema = z.object({
  messages: z.array(assistantChatMessageSchema).min(1).max(24),
  locale: z.enum(["he", "en"]).optional().default("he"),
  mode: z.enum(["hybrid", "agent_only"]).optional().default("hybrid"),
  /** Current app path for contextual answers */
  pathname: z.string().max(120).optional(),
});

export type AssistantChatBody = z.infer<typeof assistantChatBodySchema>;
