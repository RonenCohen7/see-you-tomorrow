import api from "./api";
import type { Role } from "../types/models";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatMode = "hybrid" | "agent_only";

export type AssistantChatResponse = {
  reply: string;
  navigateTo?: string;
  usedAgent?: boolean;
};

export async function postAssistantChat(opts: {
  messages: AssistantChatMessage[];
  locale: string;
  mode?: AssistantChatMode;
  pathname?: string;
}): Promise<AssistantChatResponse> {
  const { data } = await api.post<AssistantChatResponse>("/api/ai/assistant/chat", {
    messages: opts.messages,
    locale: opts.locale.startsWith("he") ? "he" : "en",
    mode: opts.mode ?? "hybrid",
    pathname: opts.pathname,
  });
  return data;
}

/** Roles allowed to use smart agent (all logged-in users per plan; manager queries need manager/admin for some tools server-side) */
export function canUseSmartAgent(_role: Role): boolean {
  return true;
}
