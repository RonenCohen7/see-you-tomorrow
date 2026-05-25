import { z } from "zod";

export const supportChatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
  locale: z.enum(["he", "en"]).default("he"),
  turnstileToken: z.string().optional(),
});

export type SupportChatBody = z.infer<typeof supportChatBodySchema>;
