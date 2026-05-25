import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "";

export type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SupportChatResponse = {
  reply: string;
  usedAgent: boolean;
};

const supportApi = axios.create({
  baseURL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 45_000,
});

export async function postSupportChat(body: {
  messages: SupportChatMessage[];
  locale: "he" | "en";
  turnstileToken?: string | null;
}): Promise<SupportChatResponse> {
  const { data } = await supportApi.post<SupportChatResponse>("/api/ai/support/chat", {
    messages: body.messages,
    locale: body.locale,
    ...(body.turnstileToken ? { turnstileToken: body.turnstileToken } : {}),
  });
  return data;
}
