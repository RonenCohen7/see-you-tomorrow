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
        return "השרת לא הגיב בזמן. ודא ש-MongoDB רץ (npm run docker:deps בשורה נפרדת), ואז npm run dev מהשורש — כל פקודה בשורה משלה.";
      }
      return "לא ניתן להתחבר לשרת. ודא שה־gateway רץ (פורט 4000), ש-MongoDB זמין, ושהרצת npm run dev מהשורש (פקודה אחת בשורה).";
    }
    return fallback;
  }
  if (err instanceof Error && typeof err.message === "string" && err.message.trim() !== "") {
    return err.message;
  }
  return fallback;
}
