import axios from "axios";

/** Pull a user-visible message from failed API calls (Express `{ error, code }` or network). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
    if (!err.response) {
      if (err.code === "ECONNABORTED") {
        return "השרת לא הגיב בזמן. ודא ש-MongoDB רץ (npm run docker:deps), שהטרמינל מריץ npm run dev, ונסה שוב.";
      }
      return "לא ניתן להתחבר לשרת. ודא שה־gateway רץ (פורט 4000) וש־MongoDB זמין.";
    }
  }
  return fallback;
}
