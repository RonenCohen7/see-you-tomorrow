import axios from "axios";

/** End-user wording — no local dev commands (Docker / npm). */
const MSG_TIMEOUT_USER =
  "השרת התעכב והבקשה לא הושלמה בזמן. רעננו את העמוד או נסו שוב. אם הבעיה חוזרת, פנו למנהל המערכת.";
const MSG_NETWORK_USER =
  "לא ניתן להתחבר לשרת כרגע. בדקו את החיבור לאינטרנט, רעננו את העמוד או נסו מאוחר יותר. אם זה נמשך, פנו למנהל המערכת.";

/** Seconds until retry when API returns `code: RATE_LIMIT` (gateway / auth). */
export function rateLimitRetrySecondsFromAxios(err: unknown): number | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  const data = err.response?.data;
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  if (o.code === "RATE_LIMIT" && typeof o.retryAfterSeconds === "number" && Number.isFinite(o.retryAfterSeconds)) {
    return Math.max(1, Math.floor(o.retryAfterSeconds));
  }
  return undefined;
}

/** Pull a user-visible message from failed API calls (Express `{ error, code }` or network). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
    if (!err.response) {
      if (err.code === "ECONNABORTED") {
        return MSG_TIMEOUT_USER;
      }
      return MSG_NETWORK_USER;
    }
    return fallback;
  }
  if (err instanceof Error && typeof err.message === "string" && err.message.trim() !== "") {
    return err.message;
  }
  return fallback;
}
