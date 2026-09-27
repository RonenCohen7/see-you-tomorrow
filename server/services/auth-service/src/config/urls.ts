export const notificationBase = () => process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4006";

export function publicAppBaseUrl(): string {
  const raw =
    process.env.PUBLIC_APP_URL ?? process.env.CORS_ORIGIN?.split(",")[0]?.trim() ?? "http://localhost:5173";
  return raw.replace(/\/$/, "");
}
